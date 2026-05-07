// Kociemba two-phase solver for arbitrary 3×3 sticker states.
//
// Wraps the `cubejs` package which implements Herbert Kociemba's two-phase algorithm
// (always solves any valid state in ≤ 22 moves, typical 18-22).
//
// The package's `Cube.fromString()` accepts a 54-character facelet representation in the
// canonical Kociemba ordering (U R F D L B). We convert this app's `cube` object to that
// string, solve, then parse the move sequence back into our internal move objects.
//
// Initialization: `Cube.initSolver()` builds pruning tables (~4-5s on first call). We do
// this lazily on first solve, then cache. For best UX, call `warmupKociemba()` from app
// startup so the user doesn't wait when they first hit "Solve".

import Cube from 'cubejs';
import { parseMoves } from './cube.js';
import { optimizeMoves } from './solver-shared.js';

const FACELET_CHAR = ['U', 'R', 'F', 'D', 'L', 'B'];

let solverReady = false;
let solverInitInflight = null;

export function isKociembaReady() { return solverReady; }

export function warmupKociemba() {
  if (solverReady) return Promise.resolve();
  if (solverInitInflight) return solverInitInflight;
  solverInitInflight = new Promise((resolve) => {
    // Defer to next tick so caller doesn't block.
    setTimeout(() => {
      try {
        Cube.initSolver();
        solverReady = true;
      } catch (e) {
        console.warn('Kociemba init failed:', e);
      }
      resolve();
    }, 0);
  });
  return solverInitInflight;
}

// Convert this app's cube state to Kociemba's 54-character facelet string.
// Order: U(9) R(9) F(9) D(9) L(9) B(9). Each face's indices 0..8 map directly.
export function cubeToFacelet(cube) {
  if (cube.n !== 3) throw new Error('Kociemba supports 3×3 only');
  const order = [0, 1, 2, 3, 4, 5]; // U R F D L B
  let s = '';
  for (const f of order) {
    const face = cube.faces[f];
    for (let i = 0; i < 9; i++) s += FACELET_CHAR[face[i]];
  }
  return s;
}

// Synchronous solve. Returns { moves, solved } where moves is in our internal format.
// Throws if solver is not yet initialized; call warmupKociemba() first or use solveWithKociemba.
export function kociembaSolveSync(cube) {
  if (!solverReady) throw new Error('Kociemba solver not initialized');
  const facelet = cubeToFacelet(cube);
  const c = Cube.fromString(facelet);
  if (c.isSolved()) return { moves: [], solved: true };
  const algo = c.solve(); // string like "D2 B' R' B L' B ..."
  if (!algo) return { moves: [], solved: false };
  const parsed = parseMoves(algo);
  return { moves: optimizeMoves(parsed), solved: true };
}

// Async wrapper that ensures init has run.
export async function solveWithKociemba(cube) {
  await warmupKociemba();
  return kociembaSolveSync(cube);
}
