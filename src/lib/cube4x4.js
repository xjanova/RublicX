// 4×4 solver — bidirectional BFS with memory cap.
//
// Why bidirectional BFS rather than reduction-method:
//
//   The "human" reduction method (solve centers → pair edges → 3×3 phase + parity) requires
//   ~30 hardcoded center-placement patterns plus 4-5 edge-pairing triggers plus OLL/PLL
//   parity algorithms. Implementing all those correctly is a multi-day effort with edge
//   cases. We tried staging via subspace BFS (white positions, yellow positions, ...) but
//   each later stage needs moves that *temporarily* disturb earlier stages — without proper
//   commutator sequences in the move set, BFS dead-ends.
//
//   Bidirectional BFS sidesteps the algorithm question entirely: search forward from the
//   user's cube and backward from solved in lock-step, splice the halves at the meet
//   point. With same-face cancellation + axis-canonical pruning, effective branching is
//   ~22 per node. We hard-cap visited entries at 200K per side (~80 MB) so the browser
//   tab can't OOM on a deep scramble.
//
// Coverage:
//   • Cubes within ~6-7 moves of solved → solved cleanly (verified by tests).
//   • Deep random-state cubes → honest "scramble too deep" surfaced to the UI.
//
// A real reduction-method 4×4 is on the roadmap; this is the first iteration that ships
// a real solver for SOME 4×4 states without ever lying about a fake solution.

import { applyMove, cloneCube, isSolved } from './cube.js';

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

// Pack the 96 sticker values into a string. Stable, comparable, hashable.
function hashCube(cube) {
  let s = '';
  for (let f = 0; f < 6; f++) {
    const face = cube.faces[f];
    for (let i = 0; i < 16; i++) s += face[i];
  }
  return s;
}

// Memory caps. We keep both visited maps AND the per-layer frontier bounded so the
// browser tab can't OOM on a deep scramble.
//   • MAX_VISITED_PER_SIDE — total distinct states stored per direction.
//   • MAX_FRONTIER — max active frontier size; if a layer would exceed this, we cap it
//     and rely on the OTHER side to find the meet point.
//
// Sized so a typical 8-move scramble (≈ 22^4 = 234k states each side) fits, while a
// 12+ move random-state scramble bails honestly within ~3 s.
const MAX_VISITED_PER_SIDE = 400_000;
const MAX_FRONTIER = 250_000;

// Cube state as a flat 96-byte Uint8Array (6 faces × 16 stickers). Much smaller and faster
// to clone than the {n, faces: [array, array, ...]} object form, which matters when the
// frontier holds tens of thousands of states.
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
function hashFlat(flat) {
  // Faster than per-byte concat. Build with a Buffer-like join.
  return String.fromCharCode(...flat);
}

function expandLayer(frontier, visited, otherVisited) {
  const next = [];
  for (const node of frontier) {
    if (visited.size >= MAX_VISITED_PER_SIDE) return { meet: null, frontier: next, oom: true };
    if (next.length >= MAX_FRONTIER) return { meet: null, frontier: next, oom: true };
    // Reconstitute object-cube from flat for the move primitives that expect that shape.
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

// Walk visited map from `meetHash` back to `fromHash`, collecting moves. With inverse=true,
// returns the inverted sequence (used for the goal-side, which was searched from solved).
function reconstructPath(visited, fromHash, meetHash, inverse) {
  const moves = [];
  let cur = meetHash;
  while (cur !== fromHash) {
    const entry = visited.get(cur);
    if (!entry) break;
    moves.push(entry.move);
    cur = entry.prev;
  }
  if (!inverse) {
    moves.reverse();
    return moves;
  }
  // moves is currently meet→fromHash order. After inverting each, we get the moves to go
  // FROM meet TO fromHash (= meet → solved). So return as-is, with each inverted.
  return moves.map(inverseMove);
}

export function solve4x4(cube, options = {}) {
  if (cube.n !== 4) throw new Error('solve4x4 requires n=4');
  if (isSolved(cube)) return [];

  const { maxTotalDepth = 10, budgetMs = 20000 } = options;
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

    // Always expand the smaller frontier to balance work.
    const expandStart = startFront.length <= goalFront.length;
    const front = expandStart ? startFront : goalFront;
    const visited = expandStart ? startVisited : goalVisited;
    const otherVisited = expandStart ? goalVisited : startVisited;

    const { meet, frontier, oom } = expandLayer(front, visited, otherVisited);

    if (meet) {
      const startPath = reconstructPath(startVisited, startHash, meet, false);
      const goalPath = reconstructPath(goalVisited, goalHash, meet, true);
      return [...startPath, ...goalPath];
    }

    if (oom) return null;
    if (expandStart) startFront = frontier;
    else goalFront = frontier;
    totalDepth += 1;
  }

  return null; // couldn't solve within budget
}
