// Plays a sequence of moves on a cube and renders via Cube3D with smooth animation per step.
// At each step, we tween `t: 0..1` for the current move, then commit the move into cube state and advance.
import React from 'react';
import Cube3D from './Cube3D.jsx';
import { applyMove, cloneCube, solvedCube } from '../lib/cube.js';

export default function AnimatedCube({
  initialCube,
  sequence = [],
  speed = 1,
  playing = true,
  loop = true,
  width = 280,
  height = 280,
  rotation,
  autoSpin = false,
  dragEnabled = true,
  onMoveChange,
}) {
  const [cube, setCube] = React.useState(() => initialCube ? cloneCube(initialCube) : solvedCube(3));
  const [moveIdx, setMoveIdx] = React.useState(0);
  const [t, setT] = React.useState(0);
  const startRef = React.useRef(null);
  const rafRef = React.useRef(null);

  React.useEffect(() => {
    setCube(initialCube ? cloneCube(initialCube) : solvedCube(3));
    setMoveIdx(0);
    setT(0);
    startRef.current = null;
  }, [initialCube]);

  React.useEffect(() => {
    onMoveChange && onMoveChange(moveIdx);
  }, [moveIdx, onMoveChange]);

  React.useEffect(() => {
    if (!playing || sequence.length === 0) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }
    const dur = 600 / speed;
    const tick = (ts) => {
      if (!startRef.current) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const progress = Math.min(1, elapsed / dur);
      const eased = progress < 0.5 ? 4 * progress ** 3 : 1 - Math.pow(-2 * progress + 2, 3) / 2;
      setT(eased);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setCube((prev) => {
          const next = cloneCube(prev);
          const m = sequence[moveIdx];
          applyMove(next, m.face, m.dir, m.layer || 0);
          if (m.wide) applyMove(next, m.face, m.dir, 1);
          return next;
        });
        setT(0);
        startRef.current = null;
        setMoveIdx((i) => {
          const next = i + 1;
          if (next >= sequence.length) {
            if (loop) {
              return 0;
            }
            return i;
          }
          return next;
        });
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [playing, sequence, speed, moveIdx, loop]);

  // When sequence loops back, reset cube to initial.
  React.useEffect(() => {
    if (moveIdx === 0 && t === 0) {
      setCube(initialCube ? cloneCube(initialCube) : solvedCube(3));
    }
  }, [moveIdx, initialCube]);

  const move = sequence[moveIdx];
  const animateMove = move ? { face: move.face, dir: move.dir, t, layer: move.layer || 0 } : null;

  return (
    <Cube3D
      cube={cube}
      width={width}
      height={height}
      autoSpin={autoSpin}
      rotation={rotation}
      animateMove={animateMove}
      dragEnabled={dragEnabled}
    />
  );
}
