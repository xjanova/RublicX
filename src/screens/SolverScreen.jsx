import React from 'react';
import { T } from '../theme.js';
import { useI18n } from '../i18n.jsx';
import AnimatedCube from '../components/AnimatedCube.jsx';
import { PlayIcon, PauseIcon, PrevIcon, NextIcon, SparkIcon } from '../components/Icons.jsx';
import { solveCube, buildMethodWalkthrough, warmupKociemba, isKociembaReady } from '../lib/solver.js';
import { solvedCube, applyMoves, cloneCube, fromFaceGrids, parseMoves, validateCubeState } from '../lib/cube.js';
import { recordScrambleSolveCompleted } from '../lib/stats.js';

const METHOD_WALKTHROUGH = buildMethodWalkthrough();

export default function SolverScreen({ scanResult, scrambleHistory, onNavigate }) {
  const { t, lang } = useI18n();
  const [playing, setPlaying] = React.useState(true);
  const [speed, setSpeed] = React.useState(1);
  const [mode, setMode] = React.useState('fastest');
  const [moveIdx, setMoveIdx] = React.useState(0);
  const [solverReady, setSolverReady] = React.useState(isKociembaReady());

  // Poll for solver readiness if not ready yet (cheap; only while screen is open and not yet ready).
  React.useEffect(() => {
    if (solverReady) return;
    let cancelled = false;
    warmupKociemba().then(() => { if (!cancelled) setSolverReady(true); });
    const id = setInterval(() => { if (isKociembaReady()) { setSolverReady(true); clearInterval(id); } }, 250);
    return () => { cancelled = true; clearInterval(id); };
  }, [solverReady]);

  // Resolve the input cube state.
  const initialCube = React.useMemo(() => {
    if (scanResult) return fromFaceGrids(scanResult.faces, scanResult.size);
    const demoScramble = parseMoves("R U R' U' F R F' L U' L' D F2");
    const c = solvedCube(3);
    applyMoves(c, demoScramble);
    return c;
  }, [scanResult]);

  const stickerCountsValid = React.useMemo(() => validateCubeState(initialCube), [initialCube]);

  // Compute solution. Method-based mode shows a generic CFOP walkthrough labeled clearly as
  // a demo. Fastest mode runs Kociemba on the actual cube state — if that fails (invalid scan,
  // solver still warming up, or 4×4+ where we don't yet have a real solver) we show an honest
  // empty-state instead of a fake sequence.
  const { sequence, methodName, statusKind, phases, isMethodDemo } = React.useMemo(() => {
    if (mode === 'method') {
      return {
        sequence: METHOD_WALKTHROUGH.moves,
        phases: METHOD_WALKTHROUGH.phases,
        methodName: 'CFOP',
        statusKind: 'method_demo',
        isMethodDemo: true,
      };
    }
    if (initialCube.n !== 3 && initialCube.n !== 2) {
      return { sequence: [], phases: null, methodName: 'unsupported', statusKind: 'unsupported_size' };
    }
    if (initialCube.n === 3 && !stickerCountsValid && scanResult) {
      return { sequence: [], phases: null, methodName: 'invalid_scan', statusKind: 'invalid_scan' };
    }
    if (initialCube.n === 3 && !solverReady) {
      return { sequence: [], phases: null, methodName: 'warming_up', statusKind: 'warming_up' };
    }
    const result = solveCube(cloneCube(initialCube), {
      mode,
      history: scrambleHistory && !scanResult ? scrambleHistory : null,
    });
    // 0 moves with method 'Kociemba' or 'Kociemba-equiv' means the cube is already solved — that's success.
    if ((!result.moves || result.moves.length === 0)
        && (result.method === 'Kociemba' || result.method === 'Kociemba-equiv') && result.exact) {
      return { sequence: [], phases: null, methodName: result.method, statusKind: 'already_solved' };
    }
    if (!result.moves || result.moves.length === 0) {
      // Solver couldn't produce moves — surface honestly.
      const kind = result.error === 'solver_initializing' ? 'warming_up'
                 : result.error === 'big_cube_solver_pending' ? 'unsupported_size'
                 : result.error === 'scramble_too_deep_4x4' ? 'too_deep_4x4'
                 : 'cannot_solve';
      return { sequence: [], phases: null, methodName: result.method, statusKind: kind };
    }
    return { sequence: result.moves, phases: null, methodName: result.method, statusKind: 'ok' };
  }, [initialCube, mode, scrambleHistory, scanResult, solverReady, stickerCountsValid]);

  // Credit the user once per successful solver run (only fastest mode, only when we actually solved).
  const creditedRef = React.useRef(false);
  React.useEffect(() => {
    if (statusKind === 'ok' && !creditedRef.current && (scanResult || scrambleHistory)) {
      creditedRef.current = true;
      try { recordScrambleSolveCompleted(); } catch {}
    }
  }, [statusKind, scanResult, scrambleHistory]);

  // already_solved is a success state too (no error UI, but no playback either).
  const unsolved = statusKind !== 'ok' && statusKind !== 'method_demo' && statusKind !== 'already_solved';
  const noSequence = sequence.length === 0;

  const currentPhase = React.useMemo(() => {
    if (!phases) return null;
    return phases.find((p) => moveIdx >= p.startIdx && moveIdx <= p.endIdx) || phases[0];
  }, [phases, moveIdx]);

  return (
    <div className="scrollable" style={{
      paddingTop: 56, paddingBottom: 130,
      background: T.bg, minHeight: '100%',
      position: 'relative', overflowY: 'auto', height: '100%',
    }}>
      <div style={{
        position: 'absolute', top: 100, left: '50%', transform: 'translateX(-50%)', width: 320, height: 320,
        background: 'radial-gradient(circle, rgba(124,92,255,0.25) 0%, transparent 65%)',
        pointerEvents: 'none',
      }} />

      <div style={{ padding: '8px 24px 0', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ color: T.dim, fontSize: 11, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase' }}>
            {t.solution}
          </div>
          <div style={{ color: T.text, fontSize: 26, fontWeight: 700, marginTop: 2 }}>
            {statusKind === 'method_demo'
              ? (lang === 'th' ? 'สูตร CFOP สาธิต' : 'CFOP walkthrough')
              : statusKind === 'warming_up'
              ? (lang === 'th' ? 'กำลังเตรียมตัวแก้…' : 'Warming up solver…')
              : statusKind === 'invalid_scan'
              ? (lang === 'th' ? 'สแกนไม่ครบ' : 'Scan incomplete')
              : statusKind === 'unsupported_size'
              ? (lang === 'th' ? 'ยังไม่รองรับขนาดนี้' : 'Size not yet supported')
              : statusKind === 'cannot_solve'
              ? (lang === 'th' ? 'ไม่สามารถแก้ได้' : 'Could not solve')
              : statusKind === 'already_solved'
              ? (lang === 'th' ? 'ลูกแก้แล้ว 🎉' : 'Already solved 🎉')
              : t.solved2}
          </div>
        </div>
        <div style={{
          padding: '6px 12px', borderRadius: 14,
          background: unsolved ? 'rgba(255,182,39,0.16)' : 'rgba(0,224,183,0.14)',
          color: unsolved ? T.warn : T.accent2, fontSize: 11, fontWeight: 700, letterSpacing: 0.3,
          display: 'flex', alignItems: 'center', gap: 5,
        }}>
          <SparkIcon size={12} color={unsolved ? T.warn : T.accent2} />
          {statusKind === 'ok'
            ? (methodName === 'Kociemba' ? 'Kociemba ≤22' : t.optimal)
            : statusKind === 'method_demo'
            ? (lang === 'th' ? 'สาธิต' : 'demo')
            : statusKind === 'warming_up'
            ? (lang === 'th' ? 'รอสักครู่' : 'please wait')
            : (lang === 'th' ? 'ตรวจสอบใหม่' : 'check input')}
        </div>
      </div>

      {statusKind === 'method_demo' && !scanResult && !scrambleHistory && (
        <div style={{ padding: '12px 16px 0' }}>
          <div style={{
            background: 'rgba(124,92,255,0.10)', border: '1px solid rgba(124,92,255,0.35)',
            borderRadius: 14, padding: '10px 14px', display: 'flex', gap: 10,
          }}>
            <div style={{ fontSize: 18 }}>📘</div>
            <div style={{ flex: 1, color: T.text, fontSize: 12, lineHeight: 1.4 }}>
              {lang === 'th'
                ? 'นี่คือลำดับสาธิต CFOP ทั่วไป — ไม่ใช่การแก้ลูกของคุณ ไปแท็บสแกนเพื่อให้แก้ลูกจริง'
                : 'Generic CFOP walkthrough — not solving your specific cube. Use the Scan tab for a real solve.'}
            </div>
          </div>
        </div>
      )}

      {statusKind === 'warming_up' && (
        <div style={{ padding: '12px 16px 0' }}>
          <div style={{
            background: 'rgba(124,92,255,0.10)', border: '1px solid rgba(124,92,255,0.35)',
            borderRadius: 14, padding: '12px 14px', display: 'flex', gap: 12, alignItems: 'center',
          }}>
            <div style={{ fontSize: 22 }}>⏳</div>
            <div style={{ flex: 1, color: T.text, fontSize: 12, lineHeight: 1.4 }}>
              {lang === 'th'
                ? 'กำลังสร้างตาราง pruning สำหรับ Kociemba (≈1–5 วินาที ครั้งแรก) จากนั้นแก้ลูกจริงในหลักมิลลิวินาที'
                : 'Building Kociemba pruning tables (~1–5 s, first time only). After that, real solves run in milliseconds.'}
            </div>
          </div>
        </div>
      )}

      {statusKind === 'invalid_scan' && (
        <div style={{ padding: '12px 16px 0' }}>
          <div style={{
            background: 'rgba(255,80,80,0.10)', border: '1px solid rgba(255,80,80,0.35)',
            borderRadius: 14, padding: '12px 14px', display: 'flex', gap: 12, alignItems: 'center',
          }}>
            <div style={{ fontSize: 22 }}>⚠️</div>
            <div style={{ flex: 1, color: T.text, fontSize: 12, lineHeight: 1.4 }}>
              {lang === 'th'
                ? 'สีบางหน้าไม่ครบ 9 ช่อง — น่าจะเป็นข้อผิดพลาดจากการสแกน กรุณาสแกนใหม่ในแสงที่สม่ำเสมอ'
                : 'Sticker counts are off — likely a scan error. Try rescanning under more even lighting.'}
            </div>
          </div>
        </div>
      )}

      {statusKind === 'cannot_solve' && (
        <div style={{ padding: '12px 16px 0' }}>
          <div style={{
            background: 'rgba(255,182,39,0.10)', border: '1px solid rgba(255,182,39,0.35)',
            borderRadius: 14, padding: '12px 14px', display: 'flex', gap: 12, alignItems: 'center',
          }}>
            <div style={{ fontSize: 22 }}>🤔</div>
            <div style={{ flex: 1, color: T.text, fontSize: 12, lineHeight: 1.4 }}>
              {lang === 'th'
                ? 'ตัวแก้คืนค่าว่างเปล่า — มักหมายถึงสีของลูกอ่านผิด (เช่น ส้มกับแดงสลับ) สแกนใหม่ดูครับ'
                : 'Solver returned no moves — usually means colors were misread (e.g., red↔orange swap). Try rescanning.'}
            </div>
          </div>
        </div>
      )}

      {statusKind === 'unsupported_size' && (
        <div style={{ padding: '12px 16px 0' }}>
          <div style={{
            background: 'rgba(255,182,39,0.10)', border: '1px solid rgba(255,182,39,0.35)',
            borderRadius: 14, padding: '12px 14px', display: 'flex', gap: 12, alignItems: 'center',
          }}>
            <div style={{ fontSize: 22 }}>🚧</div>
            <div style={{ flex: 1, color: T.text, fontSize: 12, lineHeight: 1.4 }}>
              {lang === 'th'
                ? 'ตอนนี้รองรับ 2×2 และ 3×3 (เต็มทุก state) และ 4×4 (ใน 10 ท่าจาก solved). 5×5 ยังพัฒนาอยู่'
                : 'Solver supports 2×2 and 3×3 (any state) and 4×4 (within 10 moves of solved). 5×5 is in progress.'}
            </div>
          </div>
        </div>
      )}

      {statusKind === 'too_deep_4x4' && (
        <div style={{ padding: '12px 16px 0' }}>
          <div style={{
            background: 'rgba(255,182,39,0.10)', border: '1px solid rgba(255,182,39,0.35)',
            borderRadius: 14, padding: '12px 14px', display: 'flex', gap: 12, alignItems: 'center',
          }}>
            <div style={{ fontSize: 22 }}>📐</div>
            <div style={{ flex: 1, color: T.text, fontSize: 12, lineHeight: 1.4 }}>
              {lang === 'th'
                ? '4×4 ของคุณสับลึกเกินกว่าที่ตัวแก้รุ่นนี้รองรับ (~10 ท่าจาก solved). full reduction solver กำลังพัฒนาในเวอร์ชั่นถัดไป'
                : 'Your 4×4 is scrambled deeper than this solver supports (~10 moves from solved). Full reduction solver is in development for the next version.'}
            </div>
          </div>
        </div>
      )}

      {/* Mode segmented */}
      <div style={{ padding: '14px 16px 0', position: 'relative' }}>
        <div style={{
          display: 'flex',
          background: T.card,
          border: `1px solid ${T.border}`,
          borderRadius: 14,
          padding: 4,
        }}>
          {[
            { id: 'fastest', label: t.fastestSolve },
            { id: 'method', label: t.learnMethod },
          ].map(m => (
            <button key={m.id} onClick={() => { setMode(m.id); setMoveIdx(0); }} style={{
              flex: 1,
              padding: '10px 12px', borderRadius: 10,
              border: 'none', cursor: 'pointer',
              background: mode === m.id ? T.cardHi : 'transparent',
              color: mode === m.id ? T.text : T.muted,
              fontSize: 12, fontWeight: 700, letterSpacing: 0.2,
              boxShadow: mode === m.id ? '0 2px 8px rgba(0,0,0,0.3)' : 'none',
            }}>{m.label}</button>
          ))}
        </div>
      </div>

      {currentPhase && (
        <div style={{ padding: '12px 16px 0' }}>
          <div style={{
            background: `linear-gradient(135deg, rgba(124,92,255,0.18) 0%, rgba(255,106,61,0.10) 100%)`,
            border: '1px solid rgba(124,92,255,0.35)',
            borderRadius: 14, padding: '10px 14px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ color: T.muted, fontSize: 9, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase' }}>
                {lang === 'th' ? 'ขั้นตอน' : 'Phase'} {phases.indexOf(currentPhase) + 1}/{phases.length}
              </div>
              <div style={{ color: T.text, fontSize: 14, fontWeight: 700, marginTop: 2 }}>
                {currentPhase.label}
              </div>
            </div>
            <div style={{
              padding: '4px 10px', borderRadius: 999,
              background: 'rgba(255,255,255,0.06)',
              color: T.muted, fontSize: 10, fontWeight: 700, letterSpacing: 0.3,
              fontFamily: 'JetBrains Mono, ui-monospace, monospace',
            }}>
              {moveIdx - currentPhase.startIdx + 1}/{currentPhase.endIdx - currentPhase.startIdx + 1}
            </div>
          </div>
        </div>
      )}

      {/* 3D cube viewer (always shown — even when there's no sequence, the user sees their cube) */}
      <div style={{
        margin: '20px auto 0',
        width: 300, height: 300,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative',
      }}>
        <div style={{
          position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
          width: 220, height: 32, borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(124,92,255,0.35) 0%, transparent 70%)',
          filter: 'blur(8px)', pointerEvents: 'none',
        }} />
        <AnimatedCube
          width={260} height={260}
          initialCube={initialCube}
          sequence={sequence}
          speed={speed}
          playing={playing && !noSequence}
          rotation={{ x: -0.45, y: -0.55 }}
          onMoveChange={setMoveIdx}
        />
      </div>

      {/* Move strip + playback only render when there's an actual sequence */}
      {!noSequence && (<>
      <div style={{ padding: '8px 16px 0', position: 'relative' }}>
        <div className="scrollable" style={{
          display: 'flex', gap: 6, overflowX: 'auto',
          padding: '4px 0',
        }}>
          {sequence.map((m, i) => {
            const past = i < moveIdx;
            const current = i === moveIdx;
            return (
              <div key={i} style={{
                flex: '0 0 auto',
                minWidth: 44, height: 44, borderRadius: 12,
                background: current
                  ? `linear-gradient(135deg, ${T.accent}, ${T.accent3})`
                  : past ? T.cardHi : T.card,
                border: `1px solid ${current ? 'transparent' : T.border}`,
                color: current ? '#fff' : past ? T.muted : T.text,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 700,
                fontFamily: 'JetBrains Mono, ui-monospace, monospace',
                opacity: past ? 0.5 : 1,
                transition: 'all 0.3s',
                boxShadow: current ? '0 6px 16px rgba(124,92,255,0.4)' : 'none',
              }}>{m.label}</div>
            );
          })}
        </div>
      </div>

      {/* Stats */}
      <div style={{ padding: '20px 16px 0', display: 'flex', gap: 8 }}>
        <SolveStat label={t.movesShort} value={sequence.length} />
        <SolveStat label={t.timeShort} value={(sequence.length * 0.6).toFixed(1)} highlight />
        <SolveStat label={t.methodShort} value={mode === 'fastest' ? methodName : 'CFOP'} small />
      </div>

      {/* Playback controls */}
      <div style={{ padding: '20px 16px 0' }}>
        <div style={{
          background: T.card, border: `1px solid ${T.border}`, borderRadius: 22,
          padding: '14px 16px',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 10,
          }}>
            <div style={{ color: T.muted, fontSize: 11, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase' }}>
              {t.step} {Math.min(moveIdx + 1, sequence.length)}/{sequence.length}
            </div>
            <div style={{ color: T.text, fontSize: 12, fontWeight: 600, fontFamily: 'JetBrains Mono, ui-monospace, monospace' }}>
              {sequence[moveIdx]?.label}
            </div>
          </div>
          <div style={{
            height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)',
            overflow: 'hidden', marginBottom: 14,
          }}>
            <div style={{
              width: `${((moveIdx + 1) / sequence.length) * 100}%`,
              height: '100%',
              background: `linear-gradient(90deg, ${T.accent}, ${T.accent3})`,
              transition: 'width 0.3s',
            }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <CtrlBtn onClick={() => setMoveIdx(i => Math.max(0, i - 1))} aria-label="Previous"><PrevIcon /></CtrlBtn>
            <button onClick={() => setPlaying(p => !p)} aria-label="Play/Pause" style={{
              width: 56, height: 56, borderRadius: 28,
              background: `linear-gradient(135deg, ${T.accent}, ${T.accent3})`,
              border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 20px rgba(124,92,255,0.4)',
            }}>
              {playing ? <PauseIcon size={20} /> : <PlayIcon size={20} />}
            </button>
            <CtrlBtn onClick={() => setMoveIdx(i => Math.min(sequence.length - 1, i + 1))} aria-label="Next"><NextIcon /></CtrlBtn>
          </div>
          <div style={{ marginTop: 14, display: 'flex', gap: 6 }}>
            <div style={{ flex: 1, color: T.muted, fontSize: 11, fontWeight: 600, alignSelf: 'center' }}>
              {t.speed}
            </div>
            {[0.5, 1, 1.5, 2].map(s => (
              <button key={s} onClick={() => setSpeed(s)} style={{
                padding: '6px 10px', borderRadius: 10,
                background: speed === s ? T.cardHi : 'transparent',
                border: `1px solid ${speed === s ? T.border : 'transparent'}`,
                color: speed === s ? T.text : T.dim,
                fontSize: 11, fontWeight: 700, fontFamily: 'JetBrains Mono, ui-monospace, monospace',
                cursor: 'pointer',
              }}>{s}×</button>
            ))}
          </div>
        </div>
      </div>
      </>)}

      {noSequence && unsolved && (
        <div style={{ padding: '20px 16px 0' }}>
          <button onClick={() => onNavigate?.('scan')} style={{
            width: '100%', padding: '14px 16px', borderRadius: 16,
            background: T.cardHi, border: `1px solid ${T.border}`,
            color: T.text, fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}>{lang === 'th' ? 'สแกนใหม่' : 'Rescan cube'}</button>
        </div>
      )}
    </div>
  );
}

function CtrlBtn({ children, onClick, ...rest }) {
  return (
    <button onClick={onClick} {...rest} style={{
      width: 44, height: 44, borderRadius: 14,
      background: T.cardHi, border: `1px solid ${T.border}`,
      cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>{children}</button>
  );
}

function SolveStat({ label, value, highlight, small }) {
  return (
    <div style={{
      flex: 1,
      background: highlight ? `linear-gradient(135deg, ${T.accent2} 0%, #00B894 100%)` : T.card,
      border: highlight ? 'none' : `1px solid ${T.border}`,
      borderRadius: 16, padding: '10px 12px',
    }}>
      <div style={{ color: highlight ? 'rgba(255,255,255,0.85)' : T.dim, fontSize: 10, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ color: highlight ? '#fff' : T.text, fontSize: small ? 14 : 18, fontWeight: 700, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
    </div>
  );
}
