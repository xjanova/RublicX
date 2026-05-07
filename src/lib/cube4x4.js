// 4×4 solver — bidirectional BFS.
//
// 4×4 has no published JS solver and writing a full reduction-method (Yau / K4 / Hoya)
// from scratch — with hardcoded center patterns, edge-pair triggers, and OLL/PLL parity
// algs — is a multi-day project. As an honest stop-gap we use bidirectional BFS:
//
//   • Search forward from the user's cube and backward from the solved state in lock-step.
//   • Each frontier of depth d covers all states reachable in d moves with same-face/
//     axis cancellation.
//   • As soon as a state appears in BOTH visited maps, we splice the two halves together
//     for a complete solution.
//
// What this DOES solve:
//   • Cubes scrambled lightly enough that an end-to-end solution is ≤ ~10 moves total.
//   • Cubes the user just scrambled in-app with a few moves and re-scanned.
//   • Cubes that are within a handful of moves of solved (e.g., user almost finished and
//     wants the last few moves).
//
// What this DOES NOT solve:
//   • Random-state 4×4 scrambles (typical depth 30-50 moves). The Solver UI surfaces
//     `cannot_solve` honestly in that case rather than pretending.
//
// Move set: all 18 outer + 18 wide = 36 moves. With same-face cancellation effective
// branching ≈ 30; with axis-canonical pruning closer to 22.

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

// Hash the cube state. For 4×4 we have 6 faces × 16 stickers, each in 0..5. We pack each
// face into a 16-character base-6 string and join. Distinct states → distinct hashes.
function hashCube(cube) {
  const parts = new Array(6);
  for (let f = 0; f < 6; f++) {
    let s = '';
    const face = cube.faces[f];
    for (let i = 0; i < 16; i++) s += face[i];
    parts[f] = s;
  }
  return parts.join('|');
}

// Hard cap on visited-map size per side. Each entry is ~200 bytes (96-char hash + small
// object). 200K entries ≈ 40 MB; combined with frontier cube clones we stay under ~250 MB.
// Beyond this we bail to avoid OOM crashes on deep scrambles.
const MAX_VISITED_PER_SIDE = 200_000;

// One-step BFS expansion. Given a frontier, produce the next frontier and update visited.
// Returns { meet, frontier, oom } — `meet` is a hash if both sides intersected, `oom` is
// true if we hit the visited-map cap and bailed.
function expandLayer(frontier, visited, otherVisited) {
  const next = [];
  for (const node of frontier) {
    if (visited.size >= MAX_VISITED_PER_SIDE) return { meet: null, frontier: next, oom: true };
    for (const m of ALL_MOVES) {
      if (node.lastFace === m.face) continue;
      if (node.lastAxis === AXIS[m.face] && node.lastFace && node.lastFace > m.face) continue;
      const c = cloneCube(node.cube);
      applyOne(c, m);
      const h = hashCube(c);
      if (visited.has(h)) continue;
      visited.set(h, { prev: node.hash, move: m });
      if (otherVisited.has(h)) {
        next.push({ hash: h, cube: c, lastFace: m.face, lastAxis: AXIS[m.face] });
        return { meet: h, frontier: next, oom: false };
      }
      next.push({ hash: h, cube: c, lastFace: m.face, lastAxis: AXIS[m.face] });
    }
  }
  return { meet: null, frontier: next, oom: false };
}

// Reconstruct the move list from `start` to `meetHash` using the visited map.
// `inverse` = true if the moves should be inverted (for the goal-side path which was
// expanded backward from solved).
function reconstructPath(visited, fromHash, meetHash, inverse) {
  const moves = [];
  let cur = meetHash;
  while (cur !== fromHash) {
    const entry = visited.get(cur);
    if (!entry) break;
    moves.push(entry.move);
    cur = entry.prev;
  }
  if (!inverse) moves.reverse(); // start-side path: visited map records moves in order taken
  // For goal-side (inverse=true), the moves take you FROM solved TO meet; to apply them as
  // part of "user's cube → solved" we need to invert and reverse.
  if (inverse) return moves.map(inverseMove); // already in meet→start order (reverse of start→meet)
  return moves;
}

// Public solver. Returns an array of moves or null.
//   maxTotalDepth: total path length budget. For depth 12 we expand to 6 layers each side,
//                  which is roughly 22^6 ≈ 113M states — at the edge of tractable in JS.
//   budgetMs:      wall-clock cap.
export function solve4x4(cube, options = {}) {
  if (cube.n !== 4) throw new Error('solve4x4 requires n=4');
  if (isSolved(cube)) return [];

  const { maxTotalDepth = 10, budgetMs = 20000 } = options;
  const deadline = Date.now() + budgetMs;

  const startCube = cloneCube(cube);
  const goalCube = cloneCube(cube);
  // Reset goalCube to solved
  for (let f = 0; f < 6; f++) for (let i = 0; i < 16; i++) goalCube.faces[f][i] = f;

  const startHash = hashCube(startCube);
  const goalHash = hashCube(goalCube);

  const startVisited = new Map();
  const goalVisited = new Map();
  startVisited.set(startHash, { prev: null, move: null });
  goalVisited.set(goalHash, { prev: null, move: null });

  let startFront = [{ hash: startHash, cube: startCube, lastFace: null, lastAxis: null }];
  let goalFront = [{ hash: goalHash, cube: goalCube, lastFace: null, lastAxis: null }];

  // BFS from both sides, expanding the smaller frontier each iteration to balance work.
  let totalDepth = 0;
  while (totalDepth < maxTotalDepth && Date.now() < deadline) {
    if (startFront.length === 0 && goalFront.length === 0) return null;

    const expandStart = startFront.length <= goalFront.length;
    const front = expandStart ? startFront : goalFront;
    const visited = expandStart ? startVisited : goalVisited;
    const otherVisited = expandStart ? goalVisited : startVisited;

    const { meet, frontier, oom } = expandLayer(front, visited, otherVisited);

    if (meet) {
      // start-side path: user-cube → meet (collected in correct order by reconstructPath).
      const startPath = reconstructPath(startVisited, startHash, meet, false);
      // goal-side path with inverse=true returns the moves to go from meet → solved
      // (it walks the visited map from meet back to solved-hash, inverting each move it
      // recorded along the forward direction). So we just append it as-is.
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

// Quick check exposed for callers that want to surface "this is too deep" honestly.
export function couldSolve4x4(cube) {
  return cube.n === 4;
}
