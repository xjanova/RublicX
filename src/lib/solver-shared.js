// Shared helpers used by both the IDA* solver and the LBL solver.

import { moveLabel } from './cube.js';

// Optimize a sequence: collapse same-face consecutive turns and cancel inverses.
// e.g.   R R'      → (nothing)
//        R R       → R2
//        R R2      → R'
//        R2 R2     → (nothing)
export function optimizeMoves(moves) {
  const out = [];
  for (const m of moves) {
    const prev = out[out.length - 1];
    if (prev && prev.face === m.face) {
      const dirSum = (prev.dir === 2 ? 2 : prev.dir) + (m.dir === 2 ? 2 : m.dir);
      const norm = ((dirSum % 4) + 4) % 4;
      if (norm === 0) out.pop();
      else if (norm === 1) out[out.length - 1] = { face: m.face, dir: 1, label: m.face };
      else if (norm === 2) out[out.length - 1] = { face: m.face, dir: 2, label: m.face + '2' };
      else if (norm === 3) out[out.length - 1] = { face: m.face, dir: -1, label: m.face + "'" };
    } else {
      out.push({ ...m, label: moveLabel(m) });
    }
  }
  return out;
}
