import React from 'react';
import { T } from '../theme.js';
import { useI18n, FACE_LABELS, SCAN_INSTRUCTIONS } from '../i18n.jsx';
import CubeNet from '../components/CubeNet.jsx';
import { CameraIcon, ChevronLeftIcon, InfoIcon, SparkIcon, CheckIcon } from '../components/Icons.jsx';
import {
  sampleGrid, kmeansFaces, rgbConfidence, frameDrift, gridConfidence,
  hexToRgb, rgbToHex, nearestStandardColor,
} from '../lib/colorDetect.js';
import { HEX_BY_FACE } from '../lib/cube.js';

const SCAN_FACES = ['U', 'R', 'F', 'D', 'L', 'B'];
const FACE_TINT = { U: '#fff', R: '#B71234', F: '#009B48', D: '#FFD500', L: '#FF5800', B: '#0046AD' };

const SIZE_OPTIONS = [
  { n: 2, label: '2×2', subKey: 'pocketSub' },
  { n: 3, label: '3×3', subKey: 'classicSub' },
  { n: 4, label: '4×4', subKey: 'revengeSub' },
  { n: 5, label: '5×5', subKey: 'professorSub' },
];

// Auto-capture thresholds. Tuned empirically:
//   - Per-cell LAB distance to standard cube color ≤ 12 → "confident"
//   - Frame-to-frame drift ≤ 10 → "stable"
//   - Both must hold for STABILITY_FRAMES consecutive samples → fire capture
const STABILITY_FRAMES = 4;
const CONFIDENCE_THRESHOLD = 0.62;
const DRIFT_THRESHOLD = 12;
const SAMPLE_INTERVAL_MS = 220;

export default function ScanScreen({ onScanComplete, onBack }) {
  const { t, lang } = useI18n();
  const [cubeSize, setCubeSize] = React.useState(3);
  const [faceIdx, setFaceIdx] = React.useState(0);
  const [scannedFaces, setScannedFaces] = React.useState({});
  const [pulse, setPulse] = React.useState(false);
  const [cameraReady, setCameraReady] = React.useState(false);
  const [cameraError, setCameraError] = React.useState(null);
  const [cameraStarting, setCameraStarting] = React.useState(false);

  // Live preview + auto-capture state
  const [livePreview, setLivePreview] = React.useState(null);   // current N×N RGB grid for the scan target
  const [confidence, setConfidence] = React.useState(0);        // 0..1
  const [stableCount, setStableCount] = React.useState(0);
  const [autoCountdown, setAutoCountdown] = React.useState(0);  // STABILITY_FRAMES..0; 0 = not active
  const [allSamples, setAllSamples] = React.useState([]);

  const videoRef = React.useRef(null);
  const streamRef = React.useRef(null);
  const sampleCanvasRef = React.useRef(null);
  const sampleTimerRef = React.useRef(null);
  const lastGridRef = React.useRef(null);
  const captureLockRef = React.useRef(false);

  const startCamera = React.useCallback(async () => {
    if (cameraReady || cameraStarting) return;
    setCameraError(null);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('mediaDevices_unavailable');
      return;
    }
    setCameraStarting(true);
    try {
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { exact: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        videoRef.current.setAttribute('playsinline', 'true');
        try { await videoRef.current.play(); } catch {}
        setCameraReady(true);
      }
    } catch (err) {
      setCameraError(err?.name || err?.message || 'unknown');
    } finally {
      setCameraStarting(false);
    }
  }, [cameraReady, cameraStarting]);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (sampleTimerRef.current) clearInterval(sampleTimerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  // Reset face / scanned state when cube size changes
  React.useEffect(() => {
    setScannedFaces({});
    setFaceIdx(0);
    setAllSamples([]);
    setLivePreview(null);
    setStableCount(0);
    setAutoCountdown(0);
    lastGridRef.current = null;
  }, [cubeSize]);

  const currentFace = SCAN_FACES[faceIdx];
  const allDone = Object.keys(scannedFaces).length === 6;

  // Sample the current frame's grid into livePreview state.
  const sampleNow = React.useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return null;
    let canvas = sampleCanvasRef.current;
    if (!canvas) {
      canvas = document.createElement('canvas');
      sampleCanvasRef.current = canvas;
    }
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const minSide = Math.min(canvas.width, canvas.height);
    const gridSize = minSide * 0.55;
    const rect = {
      x: (canvas.width - gridSize) / 2,
      y: (canvas.height - gridSize) / 2,
      w: gridSize,
      h: gridSize,
    };
    return sampleGrid(ctx, canvas.width, canvas.height, cubeSize, rect);
  }, [cubeSize]);

  // Continuous sampling loop while camera is ready and we still have faces to scan.
  React.useEffect(() => {
    if (!cameraReady || allDone) {
      if (sampleTimerRef.current) {
        clearInterval(sampleTimerRef.current);
        sampleTimerRef.current = null;
      }
      return;
    }
    sampleTimerRef.current = setInterval(() => {
      if (captureLockRef.current) return;
      const grid = sampleNow();
      if (!grid) return;
      setLivePreview(grid);
      const conf = gridConfidence(grid);
      setConfidence(conf);
      const drift = frameDrift(lastGridRef.current, grid);
      lastGridRef.current = grid;
      const isStable = drift < DRIFT_THRESHOLD;
      const isConfident = conf > CONFIDENCE_THRESHOLD;
      if (isStable && isConfident) {
        setStableCount((s) => {
          const next = Math.min(STABILITY_FRAMES, s + 1);
          setAutoCountdown(STABILITY_FRAMES - next);
          if (next >= STABILITY_FRAMES) {
            // Auto-fire capture
            captureLockRef.current = true;
            setTimeout(() => doCapture(grid), 80);
          }
          return next;
        });
      } else {
        setStableCount(0);
        setAutoCountdown(0);
      }
    }, SAMPLE_INTERVAL_MS);
    return () => {
      if (sampleTimerRef.current) clearInterval(sampleTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraReady, allDone, cubeSize, sampleNow]);

  const doCapture = (gridOverride) => {
    setPulse(true);
    const grid = gridOverride || sampleNow() || simulatedGrid(cubeSize);
    const cells = grid.flat();
    setTimeout(() => {
      const updated = { ...scannedFaces };
      const updatedSamples = [...allSamples, ...cells.map((rgb) => ({ face: currentFace, rgb }))];
      setAllSamples(updatedSamples);
      if (faceIdx === SCAN_FACES.length - 1) {
        // All 6 faces collected — final classification with k-means over the union.
        const flat = updatedSamples.map((s) => s.rgb);
        const { assignments } = kmeansFaces(flat);
        let p = 0;
        for (const fname of SCAN_FACES) {
          const slice = assignments.slice(p, p + cubeSize * cubeSize);
          updated[fname] = slice.map((idx) => HEX_BY_FACE[idx]);
          p += cubeSize * cubeSize;
        }
        setScannedFaces(updated);
        setPulse(false);
        captureLockRef.current = false;
        setTimeout(() => onScanComplete?.({ size: cubeSize, faces: updated }), 250);
      } else {
        // Provisional per-cell mapping; final classification happens on last face.
        updated[currentFace] = cells.map((rgb) => HEX_BY_FACE[nearestStandardColor(rgb)]);
        setScannedFaces(updated);
        setFaceIdx((i) => i + 1);
        setStableCount(0);
        setAutoCountdown(0);
        lastGridRef.current = null;
        setPulse(false);
        captureLockRef.current = false;
      }
    }, 320);
  };

  return (
    <div style={{
      position: 'relative', width: '100%', height: '100%',
      background: '#000', overflow: 'hidden',
    }}>
      {/* Camera feed (always rendered so we can call play() on it before showing UI). */}
      <video ref={videoRef} autoPlay playsInline muted style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%',
        objectFit: 'cover',
        opacity: cameraReady ? 1 : 0,
        transition: 'opacity 0.2s',
      }} />

      {/* Camera-disabled full-screen overlay (covers everything else, zIndex 50). */}
      {!cameraReady && (
        <div style={{
          position: 'absolute', inset: 0, padding: 32,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          textAlign: 'center', zIndex: 50,
          background: 'linear-gradient(180deg, #1a1520 0%, #0a0815 100%)',
        }}>
          <button onClick={onBack} aria-label="Back" style={{
            position: 'absolute', top: 56, left: 16,
            width: 40, height: 40, borderRadius: 20,
            background: 'rgba(0,0,0,0.45)', border: '0.5px solid rgba(255,255,255,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: '#fff',
          }}>
            <ChevronLeftIcon />
          </button>

          <div style={{ fontSize: 56 }}>📷</div>
          <div style={{ color: T.text, fontSize: 18, fontWeight: 700, marginTop: 16 }}>
            {cameraError ? t.cameraDenied : (lang === 'th' ? 'แตะเพื่อเปิดกล้อง' : 'Tap to enable camera')}
          </div>
          <div style={{ color: T.muted, fontSize: 13, marginTop: 8, maxWidth: 320, lineHeight: 1.5 }}>
            {cameraError
              ? `${t.cameraDeniedHelp}\n(${cameraError})`
              : (lang === 'th'
                  ? 'เบราว์เซอร์ต้องการสิทธิ์ก่อน กดปุ่มแล้วอนุญาต'
                  : 'Browser needs your permission first. Tap and allow.')}
          </div>
          <button
            onClick={startCamera}
            disabled={cameraStarting}
            style={{
              marginTop: 28,
              padding: '14px 40px',
              borderRadius: 18,
              background: `linear-gradient(135deg, ${T.accent}, ${T.accent3})`,
              border: 'none', color: '#fff',
              fontSize: 15, fontWeight: 700, letterSpacing: 0.3,
              cursor: cameraStarting ? 'default' : 'pointer',
              opacity: cameraStarting ? 0.6 : 1,
              boxShadow: '0 12px 32px rgba(124,92,255,0.5)',
              touchAction: 'manipulation',
            }}>
            {cameraStarting
              ? (lang === 'th' ? 'กำลังเปิด…' : 'Starting…')
              : cameraError
                ? (lang === 'th' ? 'ลองอีกครั้ง' : 'Try again')
                : (lang === 'th' ? 'เปิดกล้อง' : 'Enable camera')}
          </button>

          {!cameraError && (
            <div style={{ color: T.dim, fontSize: 11, marginTop: 24, lineHeight: 1.5 }}>
              {lang === 'th'
                ? 'หากกดแล้วไม่ขึ้น popup ลองตรวจสอบสิทธิ์กล้องในตั้งค่าเบราว์เซอร์'
                : 'If no prompt appears, check camera permissions in browser settings.'}
            </div>
          )}
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
            width: 6, height: 6, borderRadius: 3,
            background: stableCount >= STABILITY_FRAMES - 1 ? T.accent2 : '#FF4D6D',
            boxShadow: `0 0 8px ${stableCount >= STABILITY_FRAMES - 1 ? T.accent2 : '#FF4D6D'}`,
            animation: 'recPulse 1.2s ease-in-out infinite',
          }} />
          REC · {Object.keys(scannedFaces).length}/6
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

      {/* Scan target with live cell preview */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -48%)',
        zIndex: 5,
      }}>
        <ScanFrame
          size={250}
          n={cubeSize}
          pulse={pulse}
          stable={stableCount >= STABILITY_FRAMES - 1}
          countdown={autoCountdown}
          stabilityFrames={STABILITY_FRAMES}
          livePreview={livePreview}
        />
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
            background: confidence > CONFIDENCE_THRESHOLD ? 'rgba(0,224,183,0.18)' : 'rgba(255,77,109,0.18)',
            color: confidence > CONFIDENCE_THRESHOLD ? T.accent2 : '#FF4D6D',
            fontSize: 9, fontWeight: 800, letterSpacing: 0.4,
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
            {HEX_BY_FACE.map((c, i) => (
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
        <button onClick={() => doCapture()} disabled={allDone} style={{
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
        <div style={{
          color: T.dim, fontSize: 10, fontWeight: 600,
          textAlign: 'center', marginTop: 8, letterSpacing: 0.3,
        }}>
          {lang === 'th'
            ? 'ถือลูกบาศก์ในกรอบ — โปรแกรมจะถ่ายเองเมื่อสีนิ่ง'
            : 'Hold cube inside frame — auto-captures when colors are stable'}
        </div>
      </div>
    </div>
  );
}

function ScanFrame({ size = 250, n = 3, pulse, stable, countdown, stabilityFrames, livePreview }) {
  const frameColor = stable ? T.accent2 : T.accent2;
  return (
    <div style={{
      width: size, height: size,
      position: 'relative',
      transform: 'perspective(800px) rotateX(8deg)',
      filter: pulse ? 'brightness(1.4)' : 'none',
      transition: 'filter 0.3s',
    }}>
      {[
        { top: 0, left: 0, borderTop: `2px solid ${frameColor}`, borderLeft: `2px solid ${frameColor}`, borderRadius: '14px 0 0 0' },
        { top: 0, right: 0, borderTop: `2px solid ${frameColor}`, borderRight: `2px solid ${frameColor}`, borderRadius: '0 14px 0 0' },
        { bottom: 0, left: 0, borderBottom: `2px solid ${frameColor}`, borderLeft: `2px solid ${frameColor}`, borderRadius: '0 0 0 14px' },
        { bottom: 0, right: 0, borderBottom: `2px solid ${frameColor}`, borderRight: `2px solid ${frameColor}`, borderRadius: '0 0 14px 0' },
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
        {Array.from({ length: n * n }).map((_, i) => {
          const r = Math.floor(i / n), c = i % n;
          const rgb = livePreview?.[r]?.[c];
          const conf = rgb ? rgbConfidence(rgb) : 0;
          const hex = rgb ? rgbToHex(rgb) : null;
          return (
            <div key={i} style={{
              background: hex ? `${hex}cc` : 'rgba(255,255,255,0.03)',
              border: `1.5px solid rgba(0,224,183,${0.4 + conf * 0.5})`,
              borderRadius: n <= 3 ? 8 : 5,
              position: 'relative',
              transition: 'background 0.15s, border-color 0.15s',
            }}>
              <div style={{
                position: 'absolute', top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                width: n <= 3 ? 6 : 4, height: n <= 3 ? 6 : 4, borderRadius: '50%',
                background: T.accent2, opacity: 0.55 + conf * 0.4,
                boxShadow: `0 0 6px ${T.accent2}`,
              }} />
            </div>
          );
        })}
      </div>
      <div style={{
        position: 'absolute', left: 14, right: 14, top: '50%',
        height: 2,
        background: `linear-gradient(90deg, transparent 0%, ${frameColor} 50%, transparent 100%)`,
        boxShadow: `0 0 8px ${frameColor}`,
        animation: 'scanlineMove 2s ease-in-out infinite alternate',
      }} />
      {countdown > 0 && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          fontSize: 64, fontWeight: 200,
          color: '#fff',
          textShadow: '0 0 24px rgba(0,224,183,0.8), 0 4px 16px rgba(0,0,0,0.6)',
          fontFamily: 'JetBrains Mono, ui-monospace, monospace',
          pointerEvents: 'none',
        }}>{countdown}</div>
      )}
    </div>
  );
}

function simulatedGrid(n) {
  const out = [];
  const palette = HEX_BY_FACE.map(hexToRgb);
  for (let r = 0; r < n; r++) {
    const row = [];
    for (let c = 0; c < n; c++) row.push(palette[Math.floor(Math.random() * 6)]);
    out.push(row);
  }
  return out;
}
