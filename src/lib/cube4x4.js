// 4×4 solver — staged reduction:
//   • Phase 1 (centers) via iterative-deepening greedy DFS.
//   • Phase 2 (edge pairing) via hardcoded "slice-flip" triggers with setup search.
//   • Phase 3 (3×3 phase) via Kociemba.
//   • Phase 4 (4×4 OLL/PLL parity) via fixed algorithms applied if Kociemba leaves parity.
//
// Phase 1 (centers) works because the score function rewards correct center stickers and
// the search is shallow per step (≤6 deep DFS). Phase 2 (edges) — pure greedy can't pair
// edges without temporarily disturbing centers, so we use the standard human algorithm
//
//     Uw R U R' F R' F' R Uw'        (and 3 variations)
//
// which is a center-preserving commutator that pairs the FR edge. We try this trigger
// from various U/D rotations as "setup", pick the one that increases the paired-edge
// count, and repeat until all 12 edges are paired.

import { applyMove, cloneCube, isSolved, parseMoves, FACE_INDEX } from './cube.js';
import { optimizeMoves } from './solver-shared.js';
import { kociembaSolveSync, isKociembaReady, warmupKociemba } from './kociemba.js';

const FACE_CENTER_LOCAL = [5, 6, 9, 10];
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
function inverseOne(m) {
  return {
    face: m.face,
    dir: m.dir === 2 ? 2 : -m.dir,
    wide: m.wide,
    label: m.face + (m.wide ? 'w' : '') + (m.dir === -1 ? '' : m.dir === 2 ? '2' : "'"),
  };
}

// ── Score helpers for Phase 1 ───────────────────────────────────────────

function whitesOnU(cube) {
  let n = 0;
  for (const i of FACE_CENTER_LOCAL) if (cube.faces[0][i] === 0) n++;
  return n;
}
function yellowsOnD(cube) {
  let n = 0;
  for (const i of FACE_CENTER_LOCAL) if (cube.faces[3][i] === 3) n++;
  return n;
}
function correctCentersAllFaces(cube) {
  let n = 0;
  for (let f = 0; f < 6; f++) for (const i of FACE_CENTER_LOCAL) if (cube.faces[f][i] === f) n++;
  return n;
}

function scoreP1A(c) { return whitesOnU(c); }
function scoreP1B(c) { return whitesOnU(c) * 100 + yellowsOnD(c); }
function scoreP1C(c) {
  let sides = 0;
  for (const f of [1, 2, 4, 5]) for (const i of FACE_CENTER_LOCAL) if (c.faces[f][i] === f) sides++;
  return whitesOnU(c) * 100 + yellowsOnD(c) * 100 + sides;
}

// ── Iterative-deepening DFS to find shortest improving sequence ─────────

function findImprovingSeq(startCube, scoreFn, maxDepth, baseline, deadline) {
  for (let d = 1; d <= maxDepth; d++) {
    if (Date.now() > deadline) return null;
    const r = dfs(startCube, scoreFn, d, [], null, null, baseline, deadline);
    if (r) return r;
  }
  return null;
}

function dfs(cube, scoreFn, depth, path, lastFace, lastAxis, baseline, deadline) {
  if (depth === 0) {
    const sc = scoreFn(cube);
    if (sc > baseline) return { path: path.slice(), score: sc };
    return null;
  }
  if ((path.length & 31) === 0 && Date.now() > deadline) return null;
  for (const m of ALL_MOVES) {
    if (lastFace === m.face) continue;
    if (lastAxis === AXIS[m.face] && lastFace && lastFace > m.face) continue;
    applyOne(cube, m);
    path.push(m);
    const r = dfs(cube, scoreFn, depth - 1, path, m.face, AXIS[m.face], baseline, deadline);
    path.pop();
    applyOne(cube, inverseOne(m));
    if (r) return r;
  }
  return null;
}

function solvePhaseGreedy(cube, scoreFn, goalScore, maxDepthPerStep, totalBudgetMs) {
  const deadline = Date.now() + totalBudgetMs;
  const path = [];
  while (scoreFn(cube) < goalScore) {
    if (Date.now() > deadline) return null;
    const cur = scoreFn(cube);
    const found = findImprovingSeq(cube, scoreFn, maxDepthPerStep, cur, deadline);
    if (!found) return null;
    for (const m of found.path) applyOne(cube, m);
    path.push(...found.path);
  }
  return path;
}

// ── Edge-pair definitions (matched wing colors per edge) ───────────────

const EDGES = [
  { wing1: [['U', 13], ['F',  1]], wing2: [['U', 14], ['F',  2]] }, // UF
  { wing1: [['U',  7], ['R',  1]], wing2: [['U', 11], ['R',  2]] }, // UR
  { wing1: [['U',  2], ['B',  1]], wing2: [['U',  1], ['B',  2]] }, // UB
  { wing1: [['U',  8], ['L',  1]], wing2: [['U',  4], ['L',  2]] }, // UL
  { wing1: [['F',  7], ['R',  4]], wing2: [['F', 11], ['R',  8]] }, // FR
  { wing1: [['F',  4], ['L',  7]], wing2: [['F',  8], ['L', 11]] }, // FL
  { wing1: [['B',  4], ['R',  7]], wing2: [['B',  8], ['R', 11]] }, // BR
  { wing1: [['B',  7], ['L',  4]], wing2: [['B', 11], ['L',  8]] }, // BL
  { wing1: [['D',  1], ['F', 13]], wing2: [['D',  2], ['F', 14]] }, // DF
  { wing1: [['D',  7], ['R', 13]], wing2: [['D', 11], ['R', 14]] }, // DR
  { wing1: [['D', 14], ['B', 13]], wing2: [['D', 13], ['B', 14]] }, // DB
  { wing1: [['D',  4], ['L', 13]], wing2: [['D',  8], ['L', 14]] }, // DL
];
function s(cube, fl, idx) { return cube.faces[FACE_INDEX[fl]][idx]; }
function pairedEdgeCount(cube) {
  let n = 0;
  for (const e of EDGES) {
    const a1 = s(cube, e.wing1[0][0], e.wing1[0][1]);
    const b1 = s(cube, e.wing1[1][0], e.wing1[1][1]);
    const a2 = s(cube, e.wing2[0][0], e.wing2[0][1]);
    const b2 = s(cube, e.wing2[1][0], e.wing2[1][1]);
    if (a1 === a2 && b1 === b2) n++;
  }
  return n;
}

// ── Hardcoded edge-pairing triggers ─────────────────────────────────────

// Standard 4×4 edge-pairing alg ("3-2-3" / "free slice"). Each is a center-preserving
// commutator that pairs ONE edge while leaving the rest of the cube structurally fine.
const PAIR_TRIGGERS = [
  parseMoves("Uw R U R' F R' F' R Uw'"),
  parseMoves("Uw' R U R' F R' F' R Uw"),
  parseMoves("Dw R U R' F R' F' R Dw'"),
  parseMoves("Dw' R U R' F R' F' R Dw"),
  parseMoves("Uw L' U' L F' L F L' Uw'"),
  parseMoves("Uw' L' U' L F' L F L' Uw"),
  // "Free slice" trigger that flips one edge using slice + outer turns.
  parseMoves("Rw U R' U' Rw'"),
  parseMoves("Lw' U' L U Lw"),
];
const SETUP_MOVES = [
  parseMoves(""), parseMoves("U"), parseMoves("U'"), parseMoves("U2"),
  parseMoves("D"), parseMoves("D'"), parseMoves("D2"),
  parseMoves("U D"), parseMoves("U D'"), parseMoves("U' D"), parseMoves("U' D'"),
  parseMoves("R"), parseMoves("R'"), parseMoves("L"), parseMoves("L'"),
  parseMoves("F"), parseMoves("F'"), parseMoves("B"), parseMoves("B'"),
];

function tryAndScore(cube, sequence) {
  // Apply sequence, score, undo. Returns { newPaired, newCenters, sequence } or null on no-op.
  const c = cloneCube(cube);
  for (const m of sequence) applyOne(c, m);
  return {
    paired: pairedEdgeCount(c),
    centers: correctCentersAllFaces(c),
  };
}

function pairEdgesWithTriggers(cube, totalBudgetMs) {
  const path = [];
  const deadline = Date.now() + totalBudgetMs;
  let stuck = 0;
  while (pairedEdgeCount(cube) < 12 || correctCentersAllFaces(cube) < 24) {
    if (Date.now() > deadline) return null;
    const startPaired = pairedEdgeCount(cube);
    const startCenters = correctCentersAllFaces(cube);

    let best = null;
    let bestScore = startPaired * 100 + startCenters;

    for (const setup of SETUP_MOVES) {
      for (const trigger of PAIR_TRIGGERS) {
        const seq = [...setup, ...trigger];
        const r = tryAndScore(cube, seq);
        // Score: huge weight on paired; if centers preserved, big bonus; if paired didn't
        // change but centers improved, still acceptable.
        const score = r.paired * 100 + r.centers;
        if (score > bestScore) {
          bestScore = score;
          best = seq;
        }
      }
    }

    if (!best) {
      stuck++;
      if (stuck > 3) return null;
      // Apply a "shake" — rotate U + D to expose new configurations to the trigger search.
      const shake = parseMoves(stuck === 1 ? "U2" : stuck === 2 ? "D2" : "U D");
      for (const m of shake) applyOne(cube, m);
      path.push(...shake);
      continue;
    }
    for (const m of best) applyOne(cube, m);
    path.push(...best);
    stuck = 0;
  }
  return path;
}

// ── Reduction helpers ───────────────────────────────────────────────────

function build3x3FromReduced(cube4) {
  const map3 = [0, 1, 3, 4, 5, 7, 12, 13, 15];
  const out = { n: 3, faces: [] };
  for (let f = 0; f < 6; f++) {
    const face = new Array(9);
    for (let i = 0; i < 9; i++) face[i] = cube4.faces[f][map3[i]];
    out.faces.push(face);
  }
  return out;
}

// 4×4-only parity algorithms. After Kociemba reduces the 3×3 view, the cube might still
// be off by a 2-edge flip ("OLL parity") or a 2-edge swap ("PLL parity"). We try each in
// turn, then re-Kociemba on the result.
//
// Notation note: our parser supports outer (R), wide (Rw) but not inner-slice ("r") as a
// primitive. We express inner-R as `R' Rw` (cancel the outer turn from a wide), and write
// PLL parity using the standard "(2R)2" segment as `R' Rw R' Rw` (= inner-R 180°).
const OLL_PARITY = parseMoves("Rw2 B2 U2 Lw U2 Rw' U2 Rw U2 F2 Rw F2 Lw' B2 Rw2");
const PLL_PARITY = parseMoves("Uw2 Rw2 U2 R' Rw R' Rw Uw2 Rw2 Uw2");

// ── Public driver ──────────────────────────────────────────────────────

export function solve4x4(cube, options = {}) {
  if (cube.n !== 4) throw new Error('solve4x4 requires n=4');
  if (isSolved(cube)) return [];
  if (!isKociembaReady()) { warmupKociemba(); return null; }

  const { totalBudgetMs = 60000, debug = false } = options;
  const startTs = Date.now();
  const remaining = () => Math.max(1000, totalBudgetMs - (Date.now() - startTs));

  let cur = cloneCube(cube);
  const path = [];

  // Phase 1A — whites on U
  const p1a = solvePhaseGreedy(cur, scoreP1A, 4, 6, Math.min(8000, remaining() * 0.15));
  if (debug) console.log('1A:', p1a?.length ?? 'NULL');
  if (!p1a) return null;
  path.push(...p1a);

  // Phase 1B — yellows on D, white preserved
  const p1b = solvePhaseGreedy(cur, scoreP1B, 404, 6, Math.min(10000, remaining() * 0.18));
  if (debug) console.log('1B:', p1b?.length ?? 'NULL');
  if (!p1b) return null;
  path.push(...p1b);

  // Phase 1C — last 4 centers
  const p1c = solvePhaseGreedy(cur, scoreP1C, 816, 6, Math.min(15000, remaining() * 0.22));
  if (debug) console.log('1C:', p1c?.length ?? 'NULL');
  if (!p1c) return null;
  path.push(...p1c);

  // Phase 2 — pair edges via trigger search
  const p2 = pairEdgesWithTriggers(cur, Math.min(20000, remaining() * 0.35));
  if (debug) console.log('2:', p2?.length ?? 'NULL', 'paired=', pairedEdgeCount(cur), 'centers=', correctCentersAllFaces(cur));
  if (!p2) return null;
  path.push(...p2);

  // Phase 3 — Kociemba on reduced 3×3 view. If Kociemba can't solve (which happens when
  // 4×4 reduction left parity making the 3×3 view permutation-invalid), we DON'T give up:
  // we proceed to Phase 4 which will try applying parity-fix algorithms first.
  const reduced = build3x3FromReduced(cur);
  let p3 = [];
  try {
    const r = kociembaSolveSync(reduced);
    if (r.solved) p3 = r.moves;
  } catch {}
  for (const m of p3) applyMove(cur, m.face, m.dir, 0);
  path.push(...p3);
  if (debug) console.log('3:', p3.length, 'solved?', isSolved(cur));

  // Phase 4 — parity. We run a generous combinatorial search of parity-fix sequences.
  // Each candidate is: optional U/cube rotation + (OLL_PARITY | PLL_PARITY | both) +
  // possible mirror — then re-Kociemba to clean up the 3×3 view.
  const ROTATIONS = [
    parseMoves(''), parseMoves('U'), parseMoves("U'"), parseMoves('U2'),
    parseMoves('D'), parseMoves("D'"), parseMoves('D2'),
    parseMoves('U D'), parseMoves("U' D'"),
  ];
  const PARITY_BLOCKS = [
    [],
    OLL_PARITY,
    PLL_PARITY,
    [...OLL_PARITY, ...PLL_PARITY],
    [...PLL_PARITY, ...OLL_PARITY],
  ];
  parityLoop:
  for (const rot of ROTATIONS) {
    for (const parity of PARITY_BLOCKS) {
      if (isSolved(cur)) break parityLoop;
      const tryC = cloneCube(cur);
      const tryPath = [];
      for (const m of rot)    { applyOne(tryC, m); tryPath.push(m); }
      for (const m of parity) { applyOne(tryC, m); tryPath.push(m); }
      // Re-Kociemba up to 3 times — each parity application may reveal another parity
      // that Kociemba would have failed on the first time around.
      for (let pass = 0; pass < 3; pass++) {
        if (isSolved(tryC)) break;
        try {
          const reduced2 = build3x3FromReduced(tryC);
          const r2 = kociembaSolveSync(reduced2);
          if (r2.solved && r2.moves.length > 0) {
            for (const m of r2.moves) applyMove(tryC, m.face, m.dir, 0);
            tryPath.push(...r2.moves);
          } else {
            break;
          }
        } catch { break; }
      }
      if (isSolved(tryC)) {
        cur = tryC;
        path.push(...tryPath);
        break parityLoop;
      }
    }
  }

  // Last resort: if still unsolved, try re-running the edge-pair phase from current state
  // (the new pairing might avoid the parity case), then Kociemba again.
  if (!isSolved(cur)) {
    const p2b = pairEdgesWithTriggers(cur, Math.min(15000, remaining()));
    if (p2b) {
      path.push(...p2b);
      try {
        const reduced3 = build3x3FromReduced(cur);
        const r3 = kociembaSolveSync(reduced3);
        if (r3.solved && r3.moves.length > 0) {
          for (const m of r3.moves) applyMove(cur, m.face, m.dir, 0);
          path.push(...r3.moves);
        }
      } catch {}
      // One more parity attempt
      if (!isSolved(cur)) {
        for (const parity of PARITY_BLOCKS) {
          if (isSolved(cur)) break;
          const tryC = cloneCube(cur);
          const tryPath = [];
          for (const m of parity) { applyOne(tryC, m); tryPath.push(m); }
          try {
            const reduced4 = build3x3FromReduced(tryC);
            const r4 = kociembaSolveSync(reduced4);
            if (r4.solved && r4.moves.length > 0) {
              for (const m of r4.moves) applyMove(tryC, m.face, m.dir, 0);
              tryPath.push(...r4.moves);
            }
          } catch {}
          if (isSolved(tryC)) {
            cur = tryC;
            path.push(...tryPath);
            break;
          }
        }
      }
    }
  }
  if (debug) console.log('4 done?', isSolved(cur), 'total moves:', path.length);
  return isSolved(cur) ? optimizeMoves(path) : null;
}
