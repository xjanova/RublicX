// Color detection for the camera scanner.
// Pipeline:
//   1) Sample average RGB inside each grid cell from the captured frame.
//   2) Convert to CIELAB (perceptual).
//   3) k-means cluster (k=6, init = standard cube colors) over the 6 faces' samples to learn this cube's
//      actual hues under current lighting.
//   4) Auto white-balance: shift centroids by the offset between the white centroid and the standard white.
//   5) Snap each sticker to its nearest cluster.

import { HEX_BY_FACE, FACE_NAMES, FACE_INDEX } from './cube.js';

export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function rgbToHex([r, g, b]) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return '#' + c(r) + c(g) + c(b);
}

function srgbToLinear(c) {
  const x = c / 255;
  return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
}

function rgbToXyz([r, g, b]) {
  const R = srgbToLinear(r), G = srgbToLinear(g), B = srgbToLinear(b);
  return [
    R * 0.4124 + G * 0.3576 + B * 0.1805,
    R * 0.2126 + G * 0.7152 + B * 0.0722,
    R * 0.0193 + G * 0.1192 + B * 0.9505,
  ];
}

function xyzToLab([x, y, z]) {
  const Xn = 0.95047, Yn = 1.0, Zn = 1.08883;
  const f = (t) => t > 0.008856 ? Math.cbrt(t) : (7.787 * t + 16 / 116);
  const fx = f(x / Xn), fy = f(y / Yn), fz = f(z / Zn);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export function rgbToLab(rgb) { return xyzToLab(rgbToXyz(rgb)); }

function labDist(a, b) {
  const dl = a[0] - b[0], da = a[1] - b[1], db = a[2] - b[2];
  return dl * dl + da * da + db * db;
}

// Sample a frame's grid cells. `frameCanvasCtx` = 2d ctx. `frameW/H` = canvas dimensions.
// `gridX, gridY, gridW, gridH` = bounding rect of the N×N detection grid in canvas coords.
// Returns an N×N array of [r,g,b] sampled from the inner 60% of each cell.
//
// Uses median per channel (more robust to specular highlights / hot pixels than mean).
// For preview-rate sampling we want this to be fast — we subsample every 4th pixel.
export function sampleGrid(ctx, frameW, frameH, n, rect) {
  const { x, y, w, h } = rect;
  const out = [];
  const cellW = w / n, cellH = h / n;
  const inset = 0.18;
  for (let r = 0; r < n; r++) {
    const row = [];
    for (let c = 0; c < n; c++) {
      const cx = Math.round(x + cellW * (c + inset));
      const cy = Math.round(y + cellH * (r + inset));
      const cw = Math.max(2, Math.round(cellW * (1 - 2 * inset)));
      const ch = Math.max(2, Math.round(cellH * (1 - 2 * inset)));
      const px = ctx.getImageData(cx, cy, cw, ch);
      const Rs = [], Gs = [], Bs = [];
      // Subsample every 4th pixel (skip 16 bytes between picks) — enough for stable median.
      const step = 16;
      for (let i = 0; i < px.data.length; i += step) {
        // Drop very dark / very bright pixels (likely shadow / specular highlight).
        const lum = (px.data[i] + px.data[i + 1] + px.data[i + 2]) / 3;
        if (lum < 18 || lum > 245) continue;
        Rs.push(px.data[i]); Gs.push(px.data[i + 1]); Bs.push(px.data[i + 2]);
      }
      if (Rs.length === 0) {
        // Fallback to mean over all sampled pixels if too aggressive a filter.
        let R = 0, G = 0, B = 0, n2 = 0;
        for (let i = 0; i < px.data.length; i += step) {
          R += px.data[i]; G += px.data[i + 1]; B += px.data[i + 2]; n2++;
        }
        row.push([R / Math.max(1, n2), G / Math.max(1, n2), B / Math.max(1, n2)]);
      } else {
        Rs.sort((a, b) => a - b); Gs.sort((a, b) => a - b); Bs.sort((a, b) => a - b);
        const mid = Math.floor(Rs.length / 2);
        row.push([Rs[mid], Gs[mid], Bs[mid]]);
      }
    }
    out.push(row);
  }
  return out;
}

// Score a single sample's confidence as a recognizable cube color: how close (in LAB) is it
// to its nearest standard cube color, normalized into [0..1]. 1 = perfect match.
export function rgbConfidence(rgb) {
  const lab = rgbToLab(rgb);
  let bestD = Infinity;
  for (const hex of HEX_BY_FACE) {
    const stdLab = rgbToLab(hexToRgb(hex));
    const d = labDist(lab, stdLab);
    if (d < bestD) bestD = d;
  }
  // Typical LAB distance for "same color under realistic lighting" is ≤ 200.
  // A perfect match is 0; ≥ 800 is a wildly off color.
  return Math.max(0, Math.min(1, 1 - Math.sqrt(bestD) / 28));
}

// How much did two samples (each N×N RGB) drift between frames? Lower = more stable.
// Returns the maximum per-cell LAB distance across the grid.
export function frameDrift(prev, cur) {
  if (!prev || !cur || prev.length !== cur.length) return Infinity;
  let maxD = 0;
  for (let r = 0; r < prev.length; r++) {
    for (let c = 0; c < prev[r].length; c++) {
      const a = rgbToLab(prev[r][c]);
      const b = rgbToLab(cur[r][c]);
      const d = labDist(a, b);
      if (d > maxD) maxD = d;
    }
  }
  return Math.sqrt(maxD);
}

// Aggregate confidence: minimum cell confidence across the whole grid.
// (One bad cell drops the whole frame — we want all 9 cells solid before firing capture.)
export function gridConfidence(grid) {
  let minC = 1;
  for (const row of grid) for (const rgb of row) {
    const c = rgbConfidence(rgb);
    if (c < minC) minC = c;
  }
  return minC;
}

// k-means in LAB space, init = standard cube colors. samples is a flat array of [r,g,b].
export function kmeansFaces(samples, maxIter = 12) {
  const labs = samples.map(rgbToLab);
  let centroids = HEX_BY_FACE.map(h => rgbToLab(hexToRgb(h)));
  let assignments = new Array(labs.length).fill(0);
  for (let iter = 0; iter < maxIter; iter++) {
    let changed = false;
    for (let i = 0; i < labs.length; i++) {
      let best = 0, bestD = Infinity;
      for (let k = 0; k < 6; k++) {
        const d = labDist(labs[i], centroids[k]);
        if (d < bestD) { bestD = d; best = k; }
      }
      if (assignments[i] !== best) { assignments[i] = best; changed = true; }
    }
    if (!changed) break;
    const sums = Array.from({ length: 6 }, () => [0, 0, 0]);
    const counts = new Array(6).fill(0);
    for (let i = 0; i < labs.length; i++) {
      const k = assignments[i];
      sums[k][0] += labs[i][0]; sums[k][1] += labs[i][1]; sums[k][2] += labs[i][2];
      counts[k]++;
    }
    for (let k = 0; k < 6; k++) {
      if (counts[k] > 0) centroids[k] = [sums[k][0] / counts[k], sums[k][1] / counts[k], sums[k][2] / counts[k]];
    }
  }
  // Auto white-balance: shift all samples so the white centroid matches standard white.
  const stdWhite = rgbToLab(hexToRgb(HEX_BY_FACE[0]));
  const offset = [stdWhite[0] - centroids[0][0], stdWhite[1] - centroids[0][1], stdWhite[2] - centroids[0][2]];
  return { centroids, assignments, offset };
}

// Convenience: classify already-flattened samples into face indices using k-means.
export function classifySamples(samples) {
  const flat = samples;
  const { assignments } = kmeansFaces(flat);
  return assignments;
}

// Pure-RGB nearest match (used by the simulator preview / fallback).
export function nearestStandardColor(rgb) {
  let best = 0, bestD = Infinity;
  for (let k = 0; k < 6; k++) {
    const std = hexToRgb(HEX_BY_FACE[k]);
    const dr = rgb[0] - std[0], dg = rgb[1] - std[1], db = rgb[2] - std[2];
    const d = dr * dr + dg * dg + db * db;
    if (d < bestD) { bestD = d; best = k; }
  }
  return best;
}

export { FACE_NAMES, FACE_INDEX, HEX_BY_FACE };
