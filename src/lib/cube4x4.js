// 4×4 solver — primary path uses cs0x7f's TPR (Three-Phase Reduction) algorithm vendored
// from cstimer (the de-facto reference 4×4 solver in the cubing community), with our
// previous bidirectional-BFS as a verifying fallback.
//
// Why this combination:
//   • cs0x7f's TPR handles arbitrary random-state 4×4s in ~50 moves and a few hundred ms
//     once its pruning tables are built.
//   • The output of `genFacelet` is the SCRAMBLE (moves taking solved → state). To use it
//     as a SOLUTION (state → solved) we INVERT the move list — reverse + flip CW/CCW.
//   • The inverted output occasionally fails to solve (an edge case where cs0x7f's solver
//     finds a different equivalent scramble), so we VERIFY before returning. If the
//     verification fails, we fall back to our bidirectional BFS which handles shallow
//     scrambles up to ~6 moves cleanly.
//   • Memory caps on the BFS prevent browser-tab OOM on deep scrambles where neither
//     path finds a verified solution; in that case we return null and the UI surfaces it.

import { applyMove, cloneCube, isSolved, parseMoves } from './cube.js';
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

// Reverse + flip-direction each move. cs0x7f's `genFacelet` returns the scramble (moves
// taking SOLVED to the input state); to use it as a solution we invert.
function invertSolution(s) {
  const tokens = s.trim().split(/\s+/).filter(Boolean);
  return tokens.reverse().map((m) => {
    if (m.endsWith("'")) return m.slice(0, -1);
    if (m.endsWith('2')) return m;
    return m + "'";
  }).join(' ');
}

let _cs0x7fInited = false;
function ensureCs0x7fInit() {
  if (_cs0x7fInited) return;
  scramble_444.init(); // builds pruning tables (~1.5 s first call, ~0 ms after)
  _cs0x7fInited = true;
}

// Try cs0x7f's TPR solver. Verifies the produced solution actually solves the input;
// returns null if not (caller falls back to BFS).
function trySolveWithTPR(cube) {
  try {
    ensureCs0x7fInit();
    const facelet = cubeToFacelet96(cube);
    const scrambleStr = scramble_444.genFacelet(facelet).trim();
    if (!scrambleStr) return []; // already solved
    const solutionStr = invertSolution(scrambleStr);
    const moves = parseMoves(solutionStr);

    // Verify: applying these moves to the input must yield a solved cube.
    const verify = cloneCube(cube);
    for (const m of moves) {
      applyMove(verify, m.face, m.dir, 0);
      if (m.wide) applyMove(verify, m.face, m.dir, 1);
    }
    return isSolved(verify) ? moves : null;
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
