// Three.js Rubik's cube renderer using @react-three/fiber.
// Supports any N (2..5), animated face rotations (single or wide layer), drag-to-rotate, auto-spin.
import React from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { HEX_BY_FACE, FACE_INDEX, FACE_NAMES, toFaceGrids, solvedCube } from '../lib/cube.js';

const FACE_NORMALS = {
  U: [0, 1, 0],
  D: [0, -1, 0],
  R: [1, 0, 0],
  L: [-1, 0, 0],
  F: [0, 0, 1],
  B: [0, 0, -1],
};

// Build cubie data: positions (i,j,k) + sticker color per visible face.
function buildCubies(cube) {
  const { n, faces } = cube;
  const half = (n - 1) / 2;
  const cubies = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      for (let k = 0; k < n; k++) {
        // skip interior
        if (i > 0 && i < n - 1 && j > 0 && j < n - 1 && k > 0 && k < n - 1) continue;
        const x = i - half, y = j - half, z = k - half;
        const stickers = {};
        // U face: j == n-1, sticker at (n-1-k, i)  (so when looking down from +Y, top-left is back-left)
        if (j === n - 1) stickers.U = HEX_BY_FACE[faces[FACE_INDEX.U][(n - 1 - k) * n + i]];
        if (j === 0)     stickers.D = HEX_BY_FACE[faces[FACE_INDEX.D][k * n + i]];
        if (i === n - 1) stickers.R = HEX_BY_FACE[faces[FACE_INDEX.R][(n - 1 - j) * n + (n - 1 - k)]];
        if (i === 0)     stickers.L = HEX_BY_FACE[faces[FACE_INDEX.L][(n - 1 - j) * n + k]];
        if (k === n - 1) stickers.F = HEX_BY_FACE[faces[FACE_INDEX.F][(n - 1 - j) * n + i]];
        if (k === 0)     stickers.B = HEX_BY_FACE[faces[FACE_INDEX.B][(n - 1 - j) * n + (n - 1 - i)]];
        cubies.push({ x, y, z, i, j, k, stickers });
      }
    }
  }
  return cubies;
}

function Sticker({ face, size, color }) {
  const half = size / 2 + 0.001;
  const s = size * 0.92;
  const positions = {
    U: [0, half, 0], D: [0, -half, 0],
    R: [half, 0, 0], L: [-half, 0, 0],
    F: [0, 0, half], B: [0, 0, -half],
  };
  const rotations = {
    U: [-Math.PI / 2, 0, 0], D: [Math.PI / 2, 0, 0],
    R: [0, Math.PI / 2, 0], L: [0, -Math.PI / 2, 0],
    F: [0, 0, 0], B: [0, Math.PI, 0],
  };
  return (
    <mesh position={positions[face]} rotation={rotations[face]}>
      <planeGeometry args={[s, s]} />
      <meshStandardMaterial color={color} roughness={0.45} metalness={0} />
    </mesh>
  );
}

function Cubie({ data, size, animateMove, n }) {
  const ref = React.useRef();
  const { stickers, x, y, z, i, j, k } = data;
  const onLayer = (() => {
    if (!animateMove) return false;
    const { face, layer = 0 } = animateMove;
    const last = n - 1 - layer;
    if (face === 'U') return j === last;
    if (face === 'D') return j === layer;
    if (face === 'R') return i === last;
    if (face === 'L') return i === layer;
    if (face === 'F') return k === last;
    if (face === 'B') return k === layer;
    return false;
  })();

  const groupRef = React.useRef();
  React.useEffect(() => {
    if (!groupRef.current) return;
    if (onLayer && animateMove) {
      const { face, dir, t } = animateMove;
      const angle = (Math.PI / 2) * dir * t * (face === 'D' || face === 'L' || face === 'B' ? -1 : 1);
      // Rotate the inner group around the face's axis
      groupRef.current.rotation.set(0, 0, 0);
      if (face === 'U' || face === 'D') groupRef.current.rotation.y = -angle;
      else if (face === 'R' || face === 'L') groupRef.current.rotation.x = -angle;
      else groupRef.current.rotation.z = -angle;
    } else if (groupRef.current) {
      groupRef.current.rotation.set(0, 0, 0);
    }
  });

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      <group position={[x * size, y * size, z * size]}>
        {/* Plastic core */}
        <mesh>
          <boxGeometry args={[size * 0.98, size * 0.98, size * 0.98]} />
          <meshStandardMaterial color="#0a0a0a" roughness={0.7} />
        </mesh>
        {Object.entries(stickers).map(([face, color]) => (
          <Sticker key={face} face={face} size={size} color={color} />
        ))}
      </group>
    </group>
  );
}

function Scene({ cube, size, animateMove, autoSpin, rotation, dragEnabled }) {
  const groupRef = React.useRef();
  const { gl } = useThree();
  const cubies = React.useMemo(() => buildCubies(cube), [cube]);
  const dragState = React.useRef({ active: false, lastX: 0, lastY: 0, rx: rotation?.x || -0.45, ry: rotation?.y || -0.6 });

  React.useEffect(() => {
    if (rotation && groupRef.current) {
      dragState.current.rx = rotation.x || -0.45;
      dragState.current.ry = rotation.y || -0.6;
      groupRef.current.rotation.x = dragState.current.rx;
      groupRef.current.rotation.y = dragState.current.ry;
    }
  }, [rotation]);

  React.useEffect(() => {
    if (!dragEnabled) return;
    const dom = gl.domElement;
    const onDown = (e) => {
      dragState.current.active = true;
      dragState.current.lastX = e.clientX;
      dragState.current.lastY = e.clientY;
      dom.setPointerCapture(e.pointerId);
    };
    const onMove = (e) => {
      if (!dragState.current.active) return;
      const dx = e.clientX - dragState.current.lastX;
      const dy = e.clientY - dragState.current.lastY;
      dragState.current.lastX = e.clientX;
      dragState.current.lastY = e.clientY;
      dragState.current.ry += dx * 0.01;
      dragState.current.rx = Math.max(-1.55, Math.min(1.55, dragState.current.rx + dy * 0.01));
    };
    const onUp = () => { dragState.current.active = false; };
    dom.addEventListener('pointerdown', onDown);
    dom.addEventListener('pointermove', onMove);
    dom.addEventListener('pointerup', onUp);
    dom.addEventListener('pointercancel', onUp);
    return () => {
      dom.removeEventListener('pointerdown', onDown);
      dom.removeEventListener('pointermove', onMove);
      dom.removeEventListener('pointerup', onUp);
      dom.removeEventListener('pointercancel', onUp);
    };
  }, [gl, dragEnabled]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    if (autoSpin && !dragState.current.active) {
      dragState.current.ry += delta * 0.6;
    }
    groupRef.current.rotation.x = dragState.current.rx;
    groupRef.current.rotation.y = dragState.current.ry;
  });

  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[5, 8, 5]} intensity={0.9} />
      <directionalLight position={[-3, -2, 4]} intensity={0.35} color="#7C5CFF" />
      <pointLight position={[0, -5, 3]} intensity={0.3} color="#FF6A3D" />
      <group ref={groupRef}>
        {cubies.map((c) => (
          <Cubie key={`${c.i}-${c.j}-${c.k}`} data={c} size={size} animateMove={animateMove} n={cube.n} />
        ))}
      </group>
    </>
  );
}

// Public Cube3D — renders any cube state with optional animateMove.
export default function Cube3D({
  cube,
  width = 280,
  height = 280,
  autoSpin = true,
  rotation,
  animateMove,
  dragEnabled = true,
  cameraDistance = 6,
}) {
  const safeCube = cube || solvedCube(3);
  return (
    <div style={{ width, height, touchAction: 'none' }}>
      <Canvas
        camera={{ position: [cameraDistance * 0.5, cameraDistance * 0.4, cameraDistance], fov: 32 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, preserveDrawingBuffer: false }}
        style={{ background: 'transparent' }}
      >
        <Scene
          cube={safeCube}
          size={1}
          animateMove={animateMove}
          autoSpin={autoSpin}
          rotation={rotation}
          dragEnabled={dragEnabled}
        />
      </Canvas>
    </div>
  );
}
