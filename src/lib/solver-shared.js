// Shared helpers used by both the IDA* solver and the LBL solver.

import { moveLabel } from './cube.js';

// Optimize a sequence: collapse same-face consecutive turns and cancel inverses.
// e.g.   R R'      → (nothing)
//        R R       → R2
//        R R2      → R'
//        R2 R2     → (nothing)
//
// IMPORTANT for 4×4+: outer R and wide Rw are DIFFERENT moves and must not be merged.
// We require both `face` AND `wide` to match before collapsing.
export function optimizeMoves(moves) {
  const out = [];
  for (const m of moves) {
    const prev = out[out.length - 1];
    if (prev && prev.face === m.face && !!prev.wide === !!m.wide) {
      const dirSum = (prev.dir === 2 ? 2 : prev.dir) + (m.dir === 2 ? 2 : m.dir);
      const norm = ((dirSum % 4) + 4) % 4;
      const wide = !!m.wide;
      const w = wide ? 'w' : '';
      if (norm === 0) out.pop();
      else if (norm === 1) out[out.length - 1] = { face: m.face, dir:  1, wide, label: m.face + w };
      else if (norm === 2) out[out.length - 1] = { face: m.face, dir:  2, wide, label: m.face + w + '2' };
      else if (norm === 3) out[out.length - 1] = { face: m.face, dir: -1, wide, label: m.face + w + "'" };
    } else {
      out.push({ ...m, label: moveLabel(m) + (m.wide ? '' : '') });
    }
  }
  // Clean up labels for wide moves whose original label may have lacked the 'w'.
  for (const o of out) {
    if (o.wide && !/w/.test(o.label)) {
      const sfx = o.dir === -1 ? "'" : o.dir === 2 ? '2' : '';
      o.label = o.face + 'w' + sfx;
    }
  }
  return out;
}
