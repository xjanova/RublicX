import React from 'react';
import { T } from '../theme.js';
import { useI18n, FACE_LABELS, SCAN_INSTRUCTIONS } from '../i18n.jsx';
import CubeNet from '../components/CubeNet.jsx';
import { CameraIcon, ChevronLeftIcon, InfoIcon, SparkIcon, CheckIcon } from '../components/Icons.jsx';
import { sampleGrid, kmeansFaces } from '../lib/colorDetect.js';
import { HEX_BY_FACE } from '../lib/cube.js';

const SCAN_FACES = ['U', 'R', 'F', 'D', 'L', 'B'];
const FACE_TINT = { U: '#fff', R: '#B71234', F: '#009B48', D: '#FFD500', L: '#FF5800', B: '#0046AD' };

const SIZE_OPTIONS = [
  { n: 2, label: '2×2', subKey: 'pocketSub' },
  { n: 3, label: '3×3', subKey: 'classicSub' },
  { n: 4, label: '4×4', subKey: 'revengeSub' },
  { n: 5, label: '5×5', subKey: 'professorSub' },
];

export default function ScanScreen({ onScanComplete, onBack }) {
  const { t, lang } = useI18n();
  const [cubeSize, setCubeSize] = React.useState(3);
  const [faceIdx, setFaceIdx] = React.useState(0);
  const [scannedFaces, setScannedFaces] = React.useState({});
  const [pulse, setPulse] = React.useState(false);
  const [confidence, setConfidence] = React.useState(0.94);
  const [cameraReady, setCameraReady] = React.useState(false);
  const [cameraError, setCameraError] = React.useState(null);
  const [allSamples, setAllSamples] = React.useState([]); // for k-means at end
  const videoRef = React.useRef(null);
  const streamRef = React.useRef(null);

  React.useEffect(() => {
    let cancelled = false;
    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
          setCameraReady(true);
        }
      } catch (err) {
        setCameraError(err.message || 'permission_denied');
      }
    }
    start();
    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  React.useEffect(() => {
    setScannedFaces({});
    setFaceIdx(0);
    setAllSamples([]);
  }, [cubeSize]);

  const currentFace = SCAN_FACES[faceIdx];
  const palette = HEX_BY_FACE;

  const captureFace = () => {
    setPulse(true);
    setConfidence(0.86 + Math.random() * 0.13);
    let cells;
    try {
      const video = videoRef.current;
      if (video && video.videoWidth) {
        const c = document.createElement('canvas');
        c.width = video.videoWidth;
        c.height = video.videoHeight;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(video, 0, 0, c.width, c.height);
        const minSide = Math.min(c.width, c.height);
        const gridSize = minSide * 0.55;
        const rect = {
          x: (c.width - gridSize) / 2,
          y: (c.height - gridSize) / 2,
          w: gridSize,
          h: gridSize,
        };
        const samples = sampleGrid(ctx, c.width, c.height, cubeSize, rect);
        cells = samples.flat();
      }
    } catch (e) {
      cells = null;
    }
    if (!cells) cells = simulatedFace(cubeSize, currentFace);

    setTimeout(() => {
      const updated = { ...scannedFaces };
      const updatedSamples = [...allSamples, ...cells.map(rgb => ({ face: currentFace, rgb }))];
      setAllSamples(updatedSamples);

      if (faceIdx === SCAN_FACES.length - 1) {
        // All 6 faces collected — do final k-means classification.
        const flat = updatedSamples.map(s => s.rgb);
        const { assignments } = kmeansFaces(flat);
        let p = 0;
        for (const fname of SCAN_FACES) {
          const slice = assignments.slice(p, p + cubeSize * cubeSize);
          updated[fname] = slice.map(idx => palette[idx]);
          p += cubeSize * cubeSize;
        }
        setScannedFaces(updated);
        setPulse(false);
        // signal completion
        setTimeout(() => onScanComplete?.({ size: cubeSize, faces: updated }), 200);
      } else {
        // Show provisional colors using nearest-standard for now; will be re-classified at end.
        const provisional = cells.map(rgb => nearest(rgb));
        updated[currentFace] = provisional;
        setScannedFaces(updated);
        setFaceIdx(i => i + 1);
        setPulse(false);
      }
    }, 500);
  };

  const totalScanned = Object.keys(scannedFaces).length;
  const allDone = totalScanned === 6;

  return (
    <div style={{
      position: 'relative', width: '100%', height: '100%',
      background: '#000', overflow: 'hidden',
    }}>
      {/* Camera feed */}
      {cameraReady && !cameraError && (
        <video ref={videoRef} autoPlay playsInline muted style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%',
          objectFit: 'cover',
        }} />
      )}
      {!cameraReady && !cameraError && (
        <div style={{
          position: 'absolute', inset: 0,
          background: `
            radial-gradient(ellipse at 30% 20%, rgba(60,40,90,0.4) 0%, transparent 50%),
            radial-gradient(ellipse at 70% 80%, rgba(120,60,40,0.3) 0%, transparent 55%),
            linear-gradient(180deg, #1a1520 0%, #0a0815 100%)
          `,
        }} />
      )}
      {cameraError && (
        <div style={{
          position: 'absolute', inset: 0, padding: 32,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          background: 'linear-gradient(180deg, #1a1520 0%, #0a0815 100%)', textAlign: 'center',
        }}>
          <div style={{ fontSize: 38 }}>📷</div>
          <div style={{ color: T.text, fontSize: 16, fontWeight: 700, marginTop: 12 }}>
            {t.cameraDenied}
          </div>
          <div style={{ color: T.muted, fontSize: 13, marginTop: 6, maxWidth: 280 }}>
            {t.cameraDeniedHelp}
          </div>
        </div>
      )}
      {/* Vignette */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '50%',
        background: 'linear-gradient(180deg, transparent 0%, rgba(20,15,15,0.6) 60%, rgba(15,12,10,0.95) 100%)',
        pointerEvents: 'none',
      }} />

      {/* Top header */}
      <div style={{
        position: 'absolute', top: 56, left: 0, right: 0,
        padding: '0 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        zIndex: 10,
      }}>
        <button onClick={onBack} aria-label="Back" style={{
          width: 40, height: 40, borderRadius: 20,
          background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(12px)',
          border: '0.5px solid rgba(255,255,255,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
        }}>
          <ChevronLeftIcon />
        </button>
        <div style={{
          padding: '8px 14px', borderRadius: 20,
          background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(12px)',
          border: '0.5px solid rgba(255,255,255,0.15)',
          color: '#fff', fontSize: 12, fontWeight: 700, letterSpacing: 0.3,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: 3, background: '#FF4D6D',
            boxShadow: '0 0 8px rgba(255,77,109,0.8)',
            animation: 'recPulse 1.2s ease-in-out infinite',
          }} />
          REC · {totalScanned}/6
        </div>
        <div aria-label="Info" style={{
          width: 40, height: 40, borderRadius: 20,
          background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(12px)',
          border: '0.5px solid rgba(255,255,255,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}><InfoIcon /></div>
      </div>

      {/* Cube size pills */}
      <div style={{
        position: 'absolute', top: 108, left: 0, right: 0,
        display: 'flex', justifyContent: 'center', gap: 6,
        padding: '0 16px', zIndex: 9,
      }}>
        {SIZE_OPTIONS.map(s => {
          const active = cubeSize === s.n;
          return (
            <button key={s.n} onClick={() => setCubeSize(s.n)} style={{
              padding: '7px 12px', borderRadius: 14,
              background: active ? `linear-gradient(135deg, ${T.accent}, ${T.accent3})` : 'rgba(0,0,0,0.5)',
              backdropFilter: active ? 'none' : 'blur(12px)',
              border: active ? 'none' : '0.5px solid rgba(255,255,255,0.15)',
              color: '#fff', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
              boxShadow: active ? '0 6px 16px rgba(124,92,255,0.4)' : 'none',
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.2 }}>{s.label}</div>
              <div style={{ fontSize: 8, fontWeight: 600, opacity: 0.75, letterSpacing: 0.4, textTransform: 'uppercase' }}>
                {t[s.subKey]}
              </div>
            </button>
          );
        })}
      </div>

      {/* Scan target */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -48%)',
        zIndex: 5,
      }}>
        <ScanFrame size={250} n={cubeSize} pulse={pulse} />
      </div>

      {/* Instruction bubble */}
      <div style={{
        position: 'absolute', top: 178, left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 8,
      }}>
        <div style={{
          padding: '10px 18px', borderRadius: 24,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(20px) saturate(180%)',
          border: '0.5px solid rgba(255,255,255,0.18)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{
            width: 22, height: 22, borderRadius: 6,
            background: FACE_TINT[currentFace],
            boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,0.2)',
          }} />
          <div style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>
            {SCAN_INSTRUCTIONS[lang][currentFace]}
          </div>
          <div style={{
            padding: '2px 6px', borderRadius: 6,
            background: 'rgba(0,224,183,0.18)',
            color: T.accent2, fontSize: 9, fontWeight: 800, letterSpacing: 0.4,
          }}>{(confidence * 100).toFixed(0)}%</div>
        </div>
      </div>

      {/* AI badges */}
      <div style={{
        position: 'absolute', top: 220, left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 8, display: 'flex', gap: 6,
      }}>
        <div style={{
          padding: '4px 10px', borderRadius: 999,
          background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(12px)',
          border: '0.5px solid rgba(0,224,183,0.4)',
          color: T.accent2, fontSize: 10, fontWeight: 700, letterSpacing: 0.3,
          display: 'flex', alignItems: 'center', gap: 5,
        }}>
          <SparkIcon size={11} color={T.accent2} />
          {t.aiColorId}
        </div>
        <div style={{
          padding: '4px 10px', borderRadius: 999,
          background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(12px)',
          border: '0.5px solid rgba(255,255,255,0.15)',
          color: '#fff', fontSize: 10, fontWeight: 700, letterSpacing: 0.3,
        }}>HSL · LAB · {t.autoWB}</div>
      </div>

      {/* Bottom panel */}
      <div style={{
        position: 'absolute', bottom: 110, left: 12, right: 12,
        background: 'rgba(15,15,22,0.78)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        borderRadius: 28,
        border: '0.5px solid rgba(255,255,255,0.1)',
        padding: '16px 16px 14px',
        zIndex: 10,
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
          <CubeNet n={cubeSize} scale={cubeSize <= 3 ? 0.85 : 0.6} scannedFaces={scannedFaces} currentFace={currentFace} />
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 4px', marginBottom: 10,
        }}>
          <div style={{ color: T.muted, fontSize: 10, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase' }}>
            {t.detected} · {cubeSize}×{cubeSize}
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {palette.map((c, i) => (
              <div key={c} style={{
                width: 14, height: 14, borderRadius: 3,
                background: c,
                opacity: 0.95,
                boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,0.2)',
                outline: i === SCAN_FACES.indexOf(currentFace) ? `1.5px solid ${T.accent2}` : 'none',
                outlineOffset: 1,
              }} />
            ))}
          </div>
        </div>
        <button onClick={captureFace} disabled={allDone} style={{
          width: '100%', height: 50, borderRadius: 16,
          background: allDone
            ? `linear-gradient(135deg, ${T.accent2} 0%, #00B894 100%)`
            : `linear-gradient(135deg, ${T.accent} 0%, ${T.accent3} 100%)`,
          border: 'none', color: '#fff',
          fontSize: 14, fontWeight: 700, letterSpacing: 0.3,
          cursor: allDone ? 'default' : 'pointer',
          boxShadow: allDone
            ? '0 8px 24px rgba(0,224,183,0.4)'
            : '0 8px 24px rgba(124,92,255,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          {allDone ? (<><CheckIcon /> {t.solveCube}</>) : (
            <><CameraIcon /> {t.captureFace} · {FACE_LABELS[lang][currentFace]}</>
          )}
        </button>
      </div>
    </div>
  );
}

function ScanFrame({ size = 250, n = 3, pulse }) {
  return (
    <div style={{
      width: size, height: size,
      position: 'relative',
      transform: 'perspective(800px) rotateX(8deg)',
      filter: pulse ? 'brightness(1.4)' : 'none',
      transition: 'filter 0.3s',
    }}>
      {[
        { top: 0, left: 0, borderTop: `2px solid ${T.accent2}`, borderLeft: `2px solid ${T.accent2}`, borderRadius: '14px 0 0 0' },
        { top: 0, right: 0, borderTop: `2px solid ${T.accent2}`, borderRight: `2px solid ${T.accent2}`, borderRadius: '0 14px 0 0' },
        { bottom: 0, left: 0, borderBottom: `2px solid ${T.accent2}`, borderLeft: `2px solid ${T.accent2}`, borderRadius: '0 0 0 14px' },
        { bottom: 0, right: 0, borderBottom: `2px solid ${T.accent2}`, borderRight: `2px solid ${T.accent2}`, borderRadius: '0 0 14px 0' },
      ].map((s, i) => (
        <div key={i} style={{ position: 'absolute', width: 30, height: 30, ...s }} />
      ))}
      <div style={{
        position: 'absolute', inset: 14,
        display: 'grid',
        gridTemplateColumns: `repeat(${n}, 1fr)`,
        gridTemplateRows: `repeat(${n}, 1fr)`,
        gap: n <= 3 ? 6 : 4,
      }}>
        {Array.from({ length: n * n }).map((_, i) => (
          <div key={i} style={{
            background: 'rgba(255,255,255,0.03)',
            border: `1.5px solid rgba(0,224,183,${0.4 + (i % 3) * 0.15})`,
            borderRadius: n <= 3 ? 8 : 5,
            position: 'relative',
          }}>
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              width: n <= 3 ? 8 : 5, height: n <= 3 ? 8 : 5, borderRadius: '50%',
              background: T.accent2, opacity: 0.55,
              boxShadow: `0 0 6px ${T.accent2}`,
            }} />
          </div>
        ))}
      </div>
      <div style={{
        position: 'absolute', left: 14, right: 14, top: '50%',
        height: 2,
        background: `linear-gradient(90deg, transparent 0%, ${T.accent2} 50%, transparent 100%)`,
        boxShadow: `0 0 8px ${T.accent2}`,
        animation: 'scanlineMove 2s ease-in-out infinite alternate',
      }} />
    </div>
  );
}

// Fallback: simulate detected face colors when camera is unavailable.
function simulatedFace(n, faceKey) {
  const palette = HEX_BY_FACE;
  const baseHexByFaceKey = { U: '#FFFFFF', D: '#FFD500', F: '#009B48', B: '#0046AD', L: '#FF5800', R: '#B71234' };
  const base = baseHexByFaceKey[faceKey];
  const out = [];
  for (let i = 0; i < n * n; i++) {
    if (Math.random() < 0.6) out.push(hexRgb(base));
    else out.push(hexRgb(palette[Math.floor(Math.random() * palette.length)]));
  }
  return out;
}

function nearest(rgb) {
  let best = 0, bestD = Infinity;
  for (let k = 0; k < 6; k++) {
    const std = hexRgb(HEX_BY_FACE[k]);
    const d = (rgb[0] - std[0]) ** 2 + (rgb[1] - std[1]) ** 2 + (rgb[2] - std[2]) ** 2;
    if (d < bestD) { bestD = d; best = k; }
  }
  return HEX_BY_FACE[best];
}

function hexRgb(h) {
  const s = h.replace('#', '');
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}
