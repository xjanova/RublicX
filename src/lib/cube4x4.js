// 4×4 solver — primary path uses cs0x7f's TPR (Three-Phase Reduction) algorithm vendored
// from cstimer (the de-facto reference 4×4 solver in the cubing community), with our
// bidirectional-BFS as a fallback for cases the TPR misses.
//
// How the path works:
//   1. cs0x7f's `genFaceletWithStatus` runs the full TPR pipeline: 3 phases of reduction
//      (centers → centers+edge axis → full reduction) then a 3×3 finishing solve via
//      vendored min2phase Kociemba. It exposes the raw moveBuffer (the moves cs0x7f
//      applied internally to take INPUT → SOLVED state) and the post-solve facelet.
//   2. The internal `getMoveString` reverses+conjugates the moveBuffer to produce a
//      "scramble" (moves taking SOLVED → INPUT). Inverting that scramble would normally
//      give us a solution.
//   3. **The catch**: cs0x7f's pipeline frequently leaves the cube in a *solved-up-to-
//      cube-rotation* state at the end (because the embedded 3×3 Kociemba solver treats
//      any color-uniform face-state as solved, regardless of which color is on which face).
//      The internal symmetry-conjugation in getMoveString is supposed to compensate, but
//      it's buggy for arbitrary inputs with permuted centers. Result: ~50-90% of
//      cs0x7f-output solutions fail verification.
//   4. **The fix**: we use the raw moveBuffer directly. The moveBuffer takes INPUT → P
//      where P is "solved up to a cube rotation R" (verified empirically against the
//      exposed `postSolveFL`). Then `solution = moveBuffer + R⁻¹` correctly takes
//      INPUT → SOLVED. We compute R from the postSolveFL by checking which of the 24
//      cube-rotation states matches.
//   5. BFS fallback covers any pathological case the TPR can't handle.

import { applyMove, applyMoves, cloneCube, isSolved, parseMoves } from './cube.js';
import scramble_444 from './vendor/cs0x7f-scramble_444.js';

const FACELET = ['U', 'R', 'F', 'D', 'L', 'B'];

// Convert our cube model to cs0x7f's 96-character "URFDLB" facelet string.
// Block order = U, R, F, D, L, B (each 16 chars row-major). Verified to match cs0x7f's
// internal `applyScrambleToFacelet` for every primitive move.
function cubeToFacelet96(cube) {
  let s = '';
  for (let f = 0; f < 6; f++) {
    const face = cube.faces[f];
    for (let i = 0; i < 16; i++) s += FACELET[face[i]];
  }
  return s;
}

let _cs0x7fInited = false;
function ensureCs0x7fInit() {
  if (_cs0x7fInited) return;
  scramble_444.init(); // builds pruning tables (~1.5 s first call, ~0 ms after)
  _cs0x7fInited = true;
}

// Cube rotations on a 4×4 expressed as wide-move sequences. Each rotation moves every
// layer together. On a 4×4 a single wide move (e.g. Rw) only rotates 2 of the 4 layers,
// so we use TWO opposite wide moves to rotate the entire cube:
//   x  = Rw Lw'  (top-half wide + bottom-half wide-inverse, rotating all 4 layers around R-axis)
//   y  = Uw Dw'
//   z  = Fw Bw'
const ROT_PRIMITIVES = {
  'x':  "Rw Lw'",
  "x'": "Rw' Lw",
  'x2': 'Rw2 Lw2',
  'y':  "Uw Dw'",
  "y'": "Uw' Dw",
  'y2': 'Uw2 Dw2',
  'z':  "Fw Bw'",
  "z'": "Fw' Bw",
  'z2': 'Fw2 Bw2',
};

function expandRotationsToMoves(seq) {
  if (!seq) return [];
  const tokens = seq.trim().split(/\s+/).filter(Boolean);
  const expanded = [];
  for (const t of tokens) {
    const wide = ROT_PRIMITIVES[t];
    if (wide) expanded.push(wide); else expanded.push(t);
  }
  return parseMoves(expanded.join(' '));
}

// Build the 24 unique cube-rotation states. For each rotation sequence, the resulting
// face-color permutation on a solved cube is its fingerprint; duplicate fingerprints
// (e.g. y vs xyz') collapse to one canonical sequence (we keep the SHORTEST).
function buildRotationCatalog() {
  const xs = ['', 'x', 'x2', "x'"];
  const ys = ['', 'y', 'y2', "y'"];
  const zs = ['', 'z', 'z2', "z'"];
  const seen = new Map();
  for (const x of xs) for (const y of ys) for (const z of zs) {
    const seq = [x, y, z].filter(Boolean).join(' ');
    const fp = solvedAfterRotSeq(seq);
    if (!seen.has(fp) || seen.get(fp).length > seq.length) seen.set(fp, seq);
  }
  const out = [];
  for (const [fp, seq] of seen) out.push({ fingerprint: fp, seq });
  return out;
}

// Return a fingerprint string of a solved 4×4 after applying rotation sequence `seq`.
// Encoding: 96 chars where each char is the face-index (0..5) cast directly to a char
// code via String.fromCharCode. Match against any 96-element int array using the same
// encoding so equality is a single string compare.
function solvedAfterRotSeq(seq) {
  const c = { n: 4, faces: [] };
  for (let f = 0; f < 6; f++) {
    const face = new Array(16);
    for (let i = 0; i < 16; i++) face[i] = f;
    c.faces.push(face);
  }
  if (seq) applyMoves(c, expandRotationsToMoves(seq));
  let s = '';
  for (let f = 0; f < 6; f++) for (let i = 0; i < 16; i++) s += String.fromCharCode(c.faces[f][i]);
  return s;
}

const ROTATION_CATALOG = buildRotationCatalog();

// Find which cube rotation R takes solved → `targetFL`. `targetFL` is a 96-element
// array of face-index ints (0..5) — typically `result.postSolveFL` from the vendor's
// genFaceletWithStatus. Returns the rotation sequence string ('' for identity), or
// null if no rotation matches (which means targetFL isn't a valid cube rotation of solved).
function findCubeRotation(targetFL) {
  let fp = '';
  for (let i = 0; i < 96; i++) fp += String.fromCharCode(targetFL[i]);
  for (const r of ROTATION_CATALOG) {
    if (r.fingerprint === fp) return r.seq;
  }
  return null;
}

function inverseRotationSeq(seq) {
  if (!seq) return '';
  const tokens = seq.trim().split(/\s+/).filter(Boolean);
  return tokens.reverse().map((m) => {
    if (m.endsWith("'")) return m.slice(0, -1);
    if (m.endsWith('2')) return m;
    return m + "'";
  }).join(' ');
}

// Try cs0x7f's TPR solver. Returns parsed moves on success, null on failure.
function trySolveWithTPR(cube) {
  try {
    ensureCs0x7fInit();
    const facelet = cubeToFacelet96(cube);
    const result = scramble_444.genFaceletWithStatus(facelet);

    // Edge case: input is already solved.
    if (!result.moveBuffer || result.moveBuffer.length === 0) {
      return isSolved(cube) ? [] : null;
    }

    // The raw moveBuffer is the sequence cs0x7f applied to take INPUT → postSolveFL.
    // postSolveFL is "solved up to a cube rotation R" (centers may be on wrong faces).
    // The actual solution is moveBuffer + R⁻¹.
    const moveBufferStr = result.moveBuffer.join(' ');
    const moveBufferMoves = parseMoves(moveBufferStr);

    // Fast path: if cs0x7f's solver perfectly solved the cube (no residual rotation),
    // the moveBuffer alone is the solution.
    if (result.solcubeOk) {
      // Verify just to be safe.
      const v = cloneCube(cube);
      applyMoves(v, moveBufferMoves);
      if (isSolved(v)) return moveBufferMoves;
    }

    // Slow path: detect the residual rotation R from postSolveFL and append R⁻¹ to
    // the moveBuffer. R⁻¹ is a cube rotation, expressed in our move alphabet via
    // wide-move pairs (e.g. y = "Uw Dw'") so applyMove can execute it directly.
    if (result.postSolveFL) {
      const rotSeq = findCubeRotation(result.postSolveFL);
      if (rotSeq !== null) {
        const invRot = inverseRotationSeq(rotSeq);
        const invRotMoves = expandRotationsToMoves(invRot);
        const moves = [...moveBufferMoves, ...invRotMoves];
        const v = cloneCube(cube);
        applyMoves(v, moves);
        if (isSolved(v)) return moves;
      }
    }

    return null;
  } catch {
    return null;
  }
}

// ── Bidirectional-BFS fallback (handles shallow scrambles cs0x7f happens to miss) ──

const OUTER_FACES = ['U', 'D', 'L', 'R', 'F', 'B'];
const DIRS = [1, -1, 2];
const AXIS = { U: 0, D: 0, L: 1, R: 1, F: 2, B: 2 };

const ALL_MOVES = (() => {
  const out = [];
  for (const f of OUTER_FACES) for (const d of DIRS) {
    out.push({ face: f, dir: d, wide: false, label: f + (d === -1 ? "'" : d === 2 ? '2' : '') });
  }
  for (const f of OUTER_FACES) for (const d of DIRS) {
    out.push({ face: f, dir: d, wide: true, label: f + 'w' + (d === -1 ? "'" : d === 2 ? '2' : '') });
  }
  return out;
})();

function applyOne(cube, m) {
  applyMove(cube, m.face, m.dir, 0);
  if (m.wide) applyMove(cube, m.face, m.dir, 1);
}
function inverseMove(m) {
  return {
    face: m.face,
    dir: m.dir === 2 ? 2 : -m.dir,
    wide: m.wide,
    label: m.face + (m.wide ? 'w' : '') + (m.dir === -1 ? '' : m.dir === 2 ? '2' : "'"),
  };
}

const MAX_VISITED_PER_SIDE = 400_000;
const MAX_FRONTIER = 250_000;

function cubeToFlat(cube) {
  const out = new Uint8Array(96);
  for (let f = 0; f < 6; f++) {
    const face = cube.faces[f];
    for (let i = 0; i < 16; i++) out[f * 16 + i] = face[i];
  }
  return out;
}
function flatToCube(flat) {
  const faces = [];
  for (let f = 0; f < 6; f++) {
    const face = new Array(16);
    for (let i = 0; i < 16; i++) face[i] = flat[f * 16 + i];
    faces.push(face);
  }
  return { n: 4, faces };
}
function hashFlat(flat) { return String.fromCharCode(...flat); }

function expandLayer(frontier, visited, otherVisited) {
  const next = [];
  for (const node of frontier) {
    if (visited.size >= MAX_VISITED_PER_SIDE) return { meet: null, frontier: next, oom: true };
    if (next.length >= MAX_FRONTIER) return { meet: null, frontier: next, oom: true };
    const objCube = flatToCube(node.flat);
    for (const m of ALL_MOVES) {
      if (node.lastFace === m.face) continue;
      if (node.lastAxis === AXIS[m.face] && node.lastFace && node.lastFace > m.face) continue;
      const c = cloneCube(objCube);
      applyOne(c, m);
      const flat = cubeToFlat(c);
      const h = hashFlat(flat);
      if (visited.has(h)) continue;
      visited.set(h, { prev: node.hash, move: m });
      if (otherVisited.has(h)) {
        next.push({ hash: h, flat, lastFace: m.face, lastAxis: AXIS[m.face] });
        return { meet: h, frontier: next, oom: false };
      }
      next.push({ hash: h, flat, lastFace: m.face, lastAxis: AXIS[m.face] });
    }
  }
  return { meet: null, frontier: next, oom: false };
}

function reconstructPath(visited, fromHash, meetHash, inverse) {
  const moves = [];
  let cur = meetHash;
  while (cur !== fromHash) {
    const entry = visited.get(cur);
    if (!entry) break;
    moves.push(entry.move);
    cur = entry.prev;
  }
  if (!inverse) { moves.reverse(); return moves; }
  return moves.map(inverseMove);
}

function trySolveWithBFS(cube, opts = {}) {
  if (isSolved(cube)) return [];
  const { maxTotalDepth = 10, budgetMs = 15000 } = opts;
  const deadline = Date.now() + budgetMs;
  const startFlat = cubeToFlat(cube);
  const goalFlatCube = { n: 4, faces: [] };
  for (let f = 0; f < 6; f++) {
    const face = new Array(16);
    for (let i = 0; i < 16; i++) face[i] = f;
    goalFlatCube.faces.push(face);
  }
  const goalFlat = cubeToFlat(goalFlatCube);
  const startHash = hashFlat(startFlat);
  const goalHash = hashFlat(goalFlat);
  const startVisited = new Map();
  const goalVisited = new Map();
  startVisited.set(startHash, { prev: null, move: null });
  goalVisited.set(goalHash, { prev: null, move: null });
  let startFront = [{ hash: startHash, flat: startFlat, lastFace: null, lastAxis: null }];
  let goalFront = [{ hash: goalHash, flat: goalFlat, lastFace: null, lastAxis: null }];
  let totalDepth = 0;
  while (totalDepth < maxTotalDepth && Date.now() < deadline) {
    if (startFront.length === 0 && goalFront.length === 0) return null;
    const expandStart = startFront.length <= goalFront.length;
    const front = expandStart ? startFront : goalFront;
    const visited = expandStart ? startVisited : goalVisited;
    const otherVisited = expandStart ? goalVisited : startVisited;
    const { meet, frontier, oom } = expandLayer(front, visited, otherVisited);
    if (meet) {
      const startPath = reconstructPath(startVisited, startHash, meet, false);
      const goalPath = reconstructPath(goalVisited, goalHash, meet, true);
      const moves = [...startPath, ...goalPath];
      const verify = cloneCube(cube);
      for (const m of moves) applyOne(verify, m);
      return isSolved(verify) ? moves : null;
    }
    if (oom) return null;
    if (expandStart) startFront = frontier;
    else goalFront = frontier;
    totalDepth += 1;
  }
  return null;
}

// ── Public driver ──────────────────────────────────────────────────────

export function solve4x4(cube, options = {}) {
  if (cube.n !== 4) throw new Error('solve4x4 requires n=4');
  if (isSolved(cube)) return [];

  // Path A: cs0x7f's TPR solver. Fast (1-50 ms after init), produces ~50-move solutions
  // for arbitrary random-state cubes. May misfire on a few shallow custom scrambles —
  // we verify before accepting.
  const tpr = trySolveWithTPR(cube);
  if (tpr) return tpr;

  // Path B: bidirectional BFS for shallow scrambles where TPR didn't verify. Caps memory
  // so we don't OOM on deep states the BFS can't reach.
  const bfs = trySolveWithBFS(cube, options);
  if (bfs) return bfs;

  return null;
}
