// Rubik solver — produces a sequence of moves to solve a given cube state.
// Strategy:
//   - When the cube was scrambled in-app, we have an exact move history → invert it (always optimal).
//   - Otherwise we use Kociemba's two-phase algorithm (lib/kociemba.js, via the cubejs package).
//     This *always* returns a solution in ≤22 moves for any valid 3×3 sticker state, and runs
//     in 1–50 ms once the pruning tables are built (≈1.5 s on first call). Call
//     `warmupKociemba()` from app startup so the first user solve isn't blocked.
//   - For 2×2 we use IDA* (state space is small enough for direct search).
//   - For 4×4+ we don't yet have a real solver — we surface that honestly to the UI instead
//     of pretending to solve.

import {
  applyMove, applyMoves, cloneCube, cubeKey, inverseSequence, isSolved,
  parseMoves, moveLabel, FACE_INDEX, solvedCube, validateCubeState,
} from './cube.js';
import { optimizeMoves } from './solver-shared.js';
import { kociembaSolveSync, isKociembaReady, warmupKociemba } from './kociemba.js';

export { optimizeMoves, warmupKociemba, isKociembaReady };

const FACES_3 = ['U', 'D', 'L', 'R', 'F', 'B'];
const DIRS = [1, -1, 2];

function expandMoves(faces) {
  const out = [];
  for (const f of faces) for (const d of DIRS) out.push({ face: f, dir: d, label: f + (d === -1 ? "'" : d === 2 ? '2' : '') });
  return out;
}

// IDA* with cancellation pruning. Effective for shallow-to-moderate scrambles (≤ ~13 moves).
// Uses a wall-clock budget so the UI stays responsive — if a depth exceeds it, the search bails
// and the caller can decide whether to surface a "scramble too deep" message.
function idaStarSolve(start, maxDepth = 13, budgetMs = 4000) {
  if (isSolved(start)) return [];
  const moves = expandMoves(FACES_3);
  const axis = { U: 0, D: 0, L: 1, R: 1, F: 2, B: 2 };
  const deadline = Date.now() + budgetMs;
  let aborted = false;

  function dfs(cube, depth, path, lastFace, lastAxis) {
    if (Date.now() > deadline) { aborted = true; return null; }
    if (depth === 0) return isSolved(cube) ? path : null;
    if (isSolved(cube)) return path;
    for (const m of moves) {
      // skip same-face redundancy (R then R' or R2 collapses to fewer moves than 'depth' represents)
      if (lastFace === m.face) continue;
      // skip opposite-face same-axis duplicates with canonical ordering (e.g., always U before D)
      if (lastAxis === axis[m.face] && lastFace && lastFace > m.face) continue;
      applyMove(cube, m.face, m.dir);
      path.push(m);
      const r = dfs(cube, depth - 1, path, m.face, axis[m.face]);
      if (r) return r;
      path.pop();
      // Reverse move
      const rev = m.dir === 2 ? 2 : -m.dir;
      applyMove(cube, m.face, rev);
      if (aborted) return null;
    }
    return null;
  }

  for (let d = 1; d <= maxDepth; d++) {
    if (Date.now() > deadline) break;
    const probe = cloneCube(start);
    const r = dfs(probe, d, [], null, null);
    if (r) return r;
    if (aborted) break;
  }
  return null;
}


// Public solve — preferred entry point.
//   options: { mode: 'fastest' | 'method', history: moves[] | null }
// If `history` is provided we just invert it (always optimal, instant).
// Otherwise we IDA* up to depth 11; if that fails we fall back to LBL.
export function solveCube(cube, options = {}) {
  const { mode = 'fastest', history = null } = options;

  if (history && history.length) {
    const inv = inverseSequence(history);
    const opt = optimizeMoves(inv);
    return { moves: opt, method: mode === 'fastest' ? 'Kociemba-equiv' : 'CFOP', exact: true };
  }

  if (cube.n === 3) {
    // Reject obviously broken inputs (wrong sticker counts, swapped centers) up front so we
    // never hand garbage to Kociemba — Kociemba will sometimes return moves for invalid
    // facelet strings that look "solved" by our face-uniformity check but don't match the
    // user's physical cube (centers don't move on a real cube).
    if (!validateCubeState(cube)) {
      return { moves: [], method: 'unsolved', exact: false, error: 'invalid_state' };
    }
    if (!isKociembaReady()) {
      // Kick the warmup; caller can re-call solveCube once it resolves. Returning an
      // honest "warming up" status lets the UI show a spinner instead of a fake demo.
      warmupKociemba();
      return { moves: [], method: 'warming_up', exact: false, error: 'solver_initializing' };
    }
    try {
      const r = kociembaSolveSync(cube);
      if (r.solved && r.moves.length > 0) {
        const verify = cloneCube(cube);
        applyMoves(verify, r.moves);
        if (isSolved(verify)) {
          return { moves: r.moves, method: 'Kociemba', exact: true };
        }
      }
      if (r.solved && r.moves.length === 0) {
        return { moves: [], method: 'Kociemba', exact: true }; // already solved
      }
    } catch (e) {
      // Falls through to the invalid-state path below.
      console.warn('Kociemba solve threw:', e?.message || e);
    }
    // Either the sticker state was invalid (e.g., wrong count of a color from a bad scan)
    // or Kociemba returned a path that doesn't actually solve. Either way, be honest.
    return { moves: [], method: 'unsolved', exact: false, error: 'invalid_state' };
  }
  if (cube.n === 2) {
    const ida = idaStarSolve(cube, 14, 4500);
    if (ida) {
      const verify = cloneCube(cube);
      applyMoves(verify, ida);
      if (isSolved(verify)) return { moves: optimizeMoves(ida), method: 'Ortega', exact: true };
    }
    return { moves: [], method: 'unsolved', exact: false, error: 'depth_exceeded' };
  }

  // 4×4 / 5×5: we don't yet have a real solver. Tell the UI honestly.
  return { moves: [], method: 'not_supported', exact: false, error: 'big_cube_solver_pending' };
}

// Curated educational algorithms — used by the Learn screen and the Method-mode solver.
// Each entry has its standard notation + a short description. Algorithms are written so they
// can be applied (after any setup moves the user wants) without referencing slice/wide moves
// outside our applyMove primitives.
export const TUTORIAL_ALGS = {
  // ── Cross edge inserts ────────────────────────────────────────────────
  cross: { title: 'White Cross', notation: "F R U R' U' F'", desc: 'Builds the cross edges' },

  // ── F2L (First Two Layers) — most common cases ───────────────────────
  f2l1: { title: 'F2L 1 · Easy slot', notation: "U R U' R' U' F' U F", desc: 'Edge in U, corner in U' },
  f2l2: { title: 'F2L 2 · Mirror', notation: "U' L' U L U F U' F'", desc: 'Mirror inserts on the left' },
  f2l3: { title: 'F2L 3 · Split pair', notation: "R U' R' U2 R U' R'", desc: 'Pair separated in U' },
  f2l4: { title: 'F2L 4 · Pair joined', notation: "R U R' U' R U R' U' R U R'", desc: 'Pair joined upright' },
  f2l5: { title: 'F2L 5 · Slot insert', notation: "U R U2 R' U' R U R'", desc: 'Slot prep + insert' },

  // ── OLL (Orient Last Layer) — selection of essential ones ─────────────
  ollEdges: { title: 'OLL Edges · Cross', notation: "F R U R' U' F'", desc: 'Make yellow cross' },
  ollSune: { title: 'OLL · Sune', notation: "R U R' U R U2 R'", desc: 'One corner oriented' },
  ollAntiSune: { title: 'OLL · Anti-Sune', notation: "R U2 R' U' R U' R'", desc: 'Mirror of Sune' },
  ollH: { title: 'OLL · H-case', notation: "F R U R' U' R U R' U' R U R' U' F'", desc: 'Both diagonals flipped' },
  ollT: { title: 'OLL · T-case', notation: "R U R' U' R' F R F'", desc: 'T-shape on top' },
  ollPi: { title: 'OLL · Pi-case', notation: "R U2 R2 U' R2 U' R2 U2 R", desc: 'Two adjacent corners' },

  // ── PLL (Permute Last Layer) — most common ───────────────────────────
  pllT: { title: 'PLL · T-perm', notation: "R U R' U' R' F R2 U' R' U' R U R' F'", desc: 'Swap UR/UL + two corners' },
  pllU: { title: 'PLL · U-perm (a)', notation: "R U' R U R U R U' R' U' R2", desc: 'CCW 3-edge cycle' },
  pllUprime: { title: 'PLL · U-perm (b)', notation: "R2 U R U R' U' R' U' R' U R'", desc: 'CW 3-edge cycle' },
  pllJ: { title: 'PLL · J-perm', notation: "R U R' F' R U R' U' R' F R2 U' R'", desc: 'Adjacent corner swap' },
  pllY: { title: 'PLL · Y-perm', notation: "F R U' R' U' R U R' F' R U R' U' R' F R F'", desc: 'Diagonal corner swap' },
  pllA: { title: 'PLL · A-perm', notation: "R' F R' B2 R F' R' B2 R2", desc: '3-corner cycle CCW' },
};

// Method-mode tutorial — a curated CFOP walkthrough split into named phases. Each phase is a
// labelled chunk of moves so the SolverScreen can show "Phase: Cross", "Phase: F2L pair 1", etc.
// while playing back. Phases are designed to be visually distinct on the cube (each finishes with
// the cube in a clearly recognisable state).
export const CFOP_PHASES = [
  { label: 'Cross', notation: "F R U R' U' F'" },
  { label: 'F2L pair 1', notation: "U R U' R' U' F' U F" },
  { label: 'F2L pair 2', notation: "U' L' U L U F U' F'" },
  { label: 'F2L pair 3', notation: "U R U2 R' U' R U R'" },
  { label: 'F2L pair 4', notation: "U' L' U2 L U L' U L" },
  { label: 'OLL · cross', notation: "F R U R' U' F'" },
  { label: 'OLL · corners (Sune)', notation: "R U R' U R U2 R'" },
  { label: 'PLL · edges (U-perm)', notation: "R U' R U R U R U' R' U' R2" },
  { label: 'PLL · corners (T-perm)', notation: "R U R' U' R' F R2 U' R' U' R U R' F'" },
];

// Build the ordered sequence of moves for the method-mode walkthrough, with each move tagged
// with its phase label so the player UI can show phase progress. Returns:
//   { moves: [{face,dir,label,phase}], phases: [{label, startIdx, endIdx}] }
export function buildMethodWalkthrough() {
  const moves = [];
  const phases = [];
  for (const ph of CFOP_PHASES) {
    const phaseMoves = parseMoves(ph.notation);
    const startIdx = moves.length;
    for (const m of phaseMoves) moves.push({ ...m, phase: ph.label });
    phases.push({ label: ph.label, startIdx, endIdx: moves.length - 1 });
  }
  return { moves, phases };
}
