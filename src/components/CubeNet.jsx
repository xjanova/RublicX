import React from 'react';
import { T } from '../theme.js';

// Mini 2D unfolded cube net — supports any N×N. Sourced from rublicx.zip handoff.
export default function CubeNet({ scale = 1, n = 3, scannedFaces = {}, currentFace }) {
  const cell = (54 * scale) / n;
  const gap = Math.max(1, 2 * scale - (n - 3));
  const faceSize = cell * n + gap * (n - 1);
  const renderFace = (face) => {
    const colors = scannedFaces[face];
    const isCurrent = currentFace === face;
    return (
      <div style={{
        width: faceSize,
        height: faceSize,
        display: 'grid',
        gridTemplateColumns: `repeat(${n}, ${cell}px)`,
        gridTemplateRows: `repeat(${n}, ${cell}px)`,
        gap,
        padding: 4,
        borderRadius: 8,
        background: isCurrent ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)',
        border: isCurrent ? '1px solid rgba(255,255,255,0.4)' : '1px solid rgba(255,255,255,0.06)',
        boxSizing: 'content-box',
      }}>
        {Array.from({ length: n * n }).map((_, i) => (
          <div key={i} style={{
            background: colors ? colors[i] : 'rgba(255,255,255,0.08)',
            borderRadius: Math.max(1, 3 - (n - 3) * 0.5),
          }} />
        ))}
      </div>
    );
  };

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(4, ${faceSize + 8}px)`,
      gridTemplateRows: `repeat(3, ${faceSize + 8}px)`,
      gap: 4,
      justifyContent: 'center',
    }}>
      <div />
      {renderFace('U')}
      <div />
      <div />
      {renderFace('L')}
      {renderFace('F')}
      {renderFace('R')}
      {renderFace('B')}
      <div />
      {renderFace('D')}
      <div />
      <div />
    </div>
  );
}

export function CubeThumb({ n, size = 40, locked }) {
  const palette = ['#FFFFFF', '#009B48', '#B71234', '#0046AD', '#FF5800', '#FFD500'];
  return (
    <div style={{
      width: size, height: size, borderRadius: 8,
      background: '#0c0d12', padding: 3, display: 'grid',
      gridTemplateColumns: `repeat(${n}, 1fr)`,
      gridTemplateRows: `repeat(${n}, 1fr)`,
      gap: 1.5, transform: 'rotate(-12deg) skewY(-6deg)',
      boxShadow: '0 6px 16px rgba(0,0,0,0.4), inset 0 0 0 0.5px rgba(255,255,255,0.05)',
    }}>
      {Array.from({ length: n * n }).map((_, i) => (
        <div key={i} style={{
          background: locked ? '#2a2c3a' : palette[i % palette.length],
          borderRadius: 2,
          opacity: locked ? 0.6 : 1,
        }} />
      ))}
    </div>
  );
}
