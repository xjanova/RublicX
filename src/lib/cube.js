// Rubik's cube state model — sticker representation, move application, scramble.
// Convention:
//   Face order: 0=U, 1=R, 2=F, 3=D, 4=L, 5=B
//   Each face is a flat N*N array, row-major from top-left as you look AT that face.
//   Stickers store the face-color index they show (0..5).

export const FACE_INDEX = { U: 0, R: 1, F: 2, D: 3, L: 4, B: 5 };
export const FACE_NAMES = ['U', 'R', 'F', 'D', 'L', 'B'];
export const HEX_BY_FACE = ['#FFFFFF', '#B71234', '#009B48', '#FFD500', '#FF5800', '#0046AD'];

export function solvedCube(n = 3) {
  const faces = [];
  for (let f = 0; f < 6; f++) faces.push(new Array(n * n).fill(f));
  return { n, faces };
}

export function cloneCube(cube) {
  return { n: cube.n, faces: cube.faces.map(f => f.slice()) };
}

export function isSolved(cube) {
  for (let f = 0; f < 6; f++) {
    const face = cube.faces[f];
    for (let i = 1; i < face.length; i++) if (face[i] !== face[0]) return false;
  }
  return true;
}

export function cubeKey(cube) {
  return cube.faces.map(f => f.join('')).join('|');
}

// Rotate an N×N flat array clockwise (1) or counter-clockwise (-1).
function rotateFace(face, n, dir) {
  const out = new Array(n * n);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (dir === 1) out[c * n + (n - 1 - r)] = face[r * n + c];
      else out[(n - 1 - c) * n + r] = face[r * n + c];
    }
  }
  return out;
}

// For each base move, return the cycle of side-edge sticker indices touched.
// Each cycle is [faceIdx, [indices into face]] in order: a -> b -> c -> d -> a (CW direction).
// For inner-layer slice moves (4x4+), `layer` selects which layer from the named face inward (0 = outermost).
function sideCycle(face, n, layer = 0) {
  // Returns 4 strips, each [faceIndex, indices[]] in CW order.
  const idx = (r, c) => r * n + c;
  const last = n - 1 - layer;
  switch (face) {
    case 'U': // looking down on U; CW cycle: F-top -> L-top -> B-top -> R-top -> F
      return [
        [FACE_INDEX.F, Array.from({ length: n }, (_, c) => idx(layer, c))],
        [FACE_INDEX.L, Array.from({ length: n }, (_, c) => idx(layer, c))],
        [FACE_INDEX.B, Array.from({ length: n }, (_, c) => idx(layer, c))],
        [FACE_INDEX.R, Array.from({ length: n }, (_, c) => idx(layer, c))],
      ];
    case 'D': // looking up at D from below; CW cycle: F-bottom -> R-bottom -> B-bottom -> L-bottom -> F
      return [
        [FACE_INDEX.F, Array.from({ length: n }, (_, c) => idx(last, c))],
        [FACE_INDEX.R, Array.from({ length: n }, (_, c) => idx(last, c))],
        [FACE_INDEX.B, Array.from({ length: n }, (_, c) => idx(last, c))],
        [FACE_INDEX.L, Array.from({ length: n }, (_, c) => idx(last, c))],
      ];
    case 'R': // CW from right: U-right-col -> B-left-col(reversed) -> D-right-col -> F-right-col -> U
      return [
        [FACE_INDEX.U, Array.from({ length: n }, (_, r) => idx(r, last))],
        [FACE_INDEX.B, Array.from({ length: n }, (_, r) => idx(n - 1 - r, layer))],
        [FACE_INDEX.D, Array.from({ length: n }, (_, r) => idx(r, last))],
        [FACE_INDEX.F, Array.from({ length: n }, (_, r) => idx(r, last))],
      ];
    case 'L': // CW from left: U-left-col -> F-left-col -> D-left-col -> B-right-col(reversed) -> U
      return [
        [FACE_INDEX.U, Array.from({ length: n }, (_, r) => idx(r, layer))],
        [FACE_INDEX.F, Array.from({ length: n }, (_, r) => idx(r, layer))],
        [FACE_INDEX.D, Array.from({ length: n }, (_, r) => idx(r, layer))],
        [FACE_INDEX.B, Array.from({ length: n }, (_, r) => idx(n - 1 - r, last))],
      ];
    case 'F': // CW from front: U-bottom-row -> R-left-col -> D-top-row(reversed) -> L-right-col(reversed) -> U
      return [
        [FACE_INDEX.U, Array.from({ length: n }, (_, c) => idx(last, c))],
        [FACE_INDEX.R, Array.from({ length: n }, (_, r) => idx(r, layer))],
        [FACE_INDEX.D, Array.from({ length: n }, (_, c) => idx(layer, n - 1 - c))],
        [FACE_INDEX.L, Array.from({ length: n }, (_, r) => idx(n - 1 - r, last))],
      ];
    case 'B': // CW from back: U-top-row(reversed) -> L-left-col -> D-bottom-row -> R-right-col(reversed) -> U
      return [
        [FACE_INDEX.U, Array.from({ length: n }, (_, c) => idx(layer, n - 1 - c))],
        [FACE_INDEX.L, Array.from({ length: n }, (_, r) => idx(r, layer))],
        [FACE_INDEX.D, Array.from({ length: n }, (_, c) => idx(last, c))],
        [FACE_INDEX.R, Array.from({ length: n }, (_, r) => idx(n - 1 - r, last))],
      ];
    default: throw new Error('unknown face ' + face);
  }
}

// Apply a single base move (face, dir) to cube. dir: 1 = CW, -1 = CCW, 2 = 180.
// `layer` selects depth (0 = outer face). For wide moves like Rw (lowercase r), use layer=0 plus extra layer 1.
export function applyMove(cube, face, dir, layer = 0) {
  const { n, faces } = cube;
  if (dir === 2) { applyMove(cube, face, 1, layer); applyMove(cube, face, 1, layer); return cube; }
  if (layer === 0) {
    const f = FACE_INDEX[face];
    faces[f] = rotateFace(faces[f], n, dir);
  }
  // Cycle the side strips
  const strips = sideCycle(face, n, layer);
  // Read all strips first, then write
  const buf = strips.map(([fi, idxs]) => idxs.map(i => faces[fi][i]));
  for (let s = 0; s < 4; s++) {
    const dest = dir === 1 ? (s + 1) % 4 : (s + 3) % 4;
    const [fi, idxs] = strips[dest];
    for (let k = 0; k < idxs.length; k++) faces[fi][idxs[k]] = buf[s][k];
  }
  return cube;
}

// Parse SiGN notation like "R U R' U2 F'" into [{face, dir, layer, label}, ...]
// Supports F R U L D B + ' (prime) + 2 (double). Lowercase = wide turn (touches 2 layers from that face).
// Wide moves apply the outer face turn AND the slice underneath (for n >= 4).
const FACE_RE = /^([UDFBLRudfblrMESxyz])([2'])?$/;

export function parseMoves(notation) {
  return notation
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(tok => {
      const m = tok.match(FACE_RE);
      if (!m) throw new Error('bad move: ' + tok);
      const [, raw, mod] = m;
      const dir = mod === "'" ? -1 : mod === '2' ? 2 : 1;
      const isWide = raw === raw.toLowerCase() && 'udfblr'.includes(raw);
      const face = isWide ? raw.toUpperCase() : raw;
      return { face, dir, wide: isWide, label: tok };
    });
}

export function moveLabel({ face, dir }) {
  const sfx = dir === -1 ? "'" : dir === 2 ? '2' : '';
  return face + sfx;
}

export function inverseMove({ face, dir, wide, layer }) {
  return { face, dir: dir === 2 ? 2 : -dir, wide, layer, label: face + (dir === 2 ? '2' : (dir === -1 ? '' : "'")) };
}

export function applyMoves(cube, moves) {
  for (const m of moves) {
    applyMove(cube, m.face, m.dir, m.layer || 0);
    if (m.wide && cube.n >= 3) applyMove(cube, m.face, m.dir, 1);
  }
  return cube;
}

export function inverseSequence(moves) {
  return moves.slice().reverse().map(inverseMove);
}

// Random scramble — never uses same face twice in a row.
export function scramble(n = 3, length = null) {
  if (!length) length = n === 2 ? 11 : n === 3 ? 20 : n === 4 ? 30 : 35;
  const faces = ['U', 'D', 'L', 'R', 'F', 'B'];
  const dirs = [1, -1, 2];
  const moves = [];
  let lastFace = null;
  let lastAxisFace = null; // face on same axis (e.g., U/D)
  const axis = { U: 'UD', D: 'UD', L: 'LR', R: 'LR', F: 'FB', B: 'FB' };
  while (moves.length < length) {
    const f = faces[Math.floor(Math.random() * 6)];
    if (f === lastFace) continue;
    if (lastAxisFace && axis[f] === axis[lastAxisFace] && f !== lastAxisFace) {
      // allow opposite-face moves but not duplicates
    }
    const d = dirs[Math.floor(Math.random() * 3)];
    moves.push({ face: f, dir: d, label: f + (d === -1 ? "'" : d === 2 ? '2' : '') });
    lastAxisFace = lastFace && axis[lastFace] === axis[f] ? lastAxisFace : f;
    lastFace = f;
  }
  return moves;
}

export function scrambleString(moves) {
  return moves.map(m => m.label).join(' ');
}

// Convert sticker matrix coords to/from cubie position for the 3D renderer.
// Each visible sticker at face f, row r, col c maps to the cubie occupying that face cell.
// For an N×N×N cube, the 3D renderer iterates cubies (i,j,k) and looks up the sticker color
// from the corresponding face cell.
export function stickerColorAt(cube, face, r, c) {
  const f = FACE_INDEX[face];
  return cube.faces[f][r * cube.n + c];
}

// Build the sticker map as needed by the 3D renderer:
// returns { U: [[hex,...],...], R: [[...]], ... } where each is an N×N grid of hex strings.
export function toFaceGrids(cube) {
  const out = {};
  for (const fname of FACE_NAMES) {
    const f = FACE_INDEX[fname];
    const grid = [];
    for (let r = 0; r < cube.n; r++) {
      const row = [];
      for (let c = 0; c < cube.n; c++) row.push(HEX_BY_FACE[cube.faces[f][r * cube.n + c]]);
      grid.push(row);
    }
    out[fname] = grid;
  }
  return out;
}

// Inverse: build a cube from scanned face grids (each face is N×N of hex strings).
// We map hex → face index by nearest match to standard sticker palette.
export function fromFaceGrids(grids, n = 3) {
  const cube = solvedCube(n);
  const palette = HEX_BY_FACE.map(hexToRgb);
  for (const fname of FACE_NAMES) {
    const fi = FACE_INDEX[fname];
    const grid = grids[fname];
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const rgb = hexToRgb(grid[r][c]);
        let best = 0, bestD = Infinity;
        for (let p = 0; p < 6; p++) {
          const d = sqDist(rgb, palette[p]);
          if (d < bestD) { bestD = d; best = p; }
        }
        cube.faces[fi][r * n + c] = best;
      }
    }
  }
  return cube;
}

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function sqDist(a, b) {
  const dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2];
  return dr * dr + dg * dg + db * db;
}

// Validate a 3x3 cube for sticker counts (each color exactly 9).
export function validateCubeStickerCounts(cube) {
  const counts = new Array(6).fill(0);
  for (const face of cube.faces) for (const v of face) counts[v]++;
  const expected = cube.n * cube.n;
  return counts.every(c => c === expected);
}
