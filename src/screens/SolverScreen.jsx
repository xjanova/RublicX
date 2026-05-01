import React from 'react';
import { T } from '../theme.js';
import { useI18n } from '../i18n.jsx';
import AnimatedCube from '../components/AnimatedCube.jsx';
import { PlayIcon, PauseIcon, PrevIcon, NextIcon, SparkIcon } from '../components/Icons.jsx';
import { solveCube } from '../lib/solver.js';
import { solvedCube, applyMoves, cloneCube, fromFaceGrids, parseMoves } from '../lib/cube.js';

export default function SolverScreen({ scanResult, scrambleHistory }) {
  const { t } = useI18n();
  const [playing, setPlaying] = React.useState(true);
  const [speed, setSpeed] = React.useState(1);
  const [mode, setMode] = React.useState('fastest');
  const [moveIdx, setMoveIdx] = React.useState(0);

  // Resolve the input cube state.
  const initialCube = React.useMemo(() => {
    if (scanResult) return fromFaceGrids(scanResult.faces, scanResult.size);
    // Demo cube: solved cube with a fixed scramble applied
    const demoScramble = parseMoves("R U R' U' F R F' L U' L' D F2");
    const c = solvedCube(3);
    applyMoves(c, demoScramble);
    return c;
  }, [scanResult]);

  // Compute solution.
  const { sequence, methodName } = React.useMemo(() => {
    const result = solveCube(cloneCube(initialCube), {
      mode,
      history: scrambleHistory && !scanResult ? scrambleHistory : null,
    });
    return {
      sequence: result.moves.length ? result.moves : parseMoves("R U R' U' F R F' L U' L'"),
      methodName: result.method,
    };
  }, [initialCube, mode, scrambleHistory, scanResult]);

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
            {t.solved2}
          </div>
        </div>
        <div style={{
          padding: '6px 12px', borderRadius: 14,
          background: 'rgba(0,224,183,0.14)',
          color: T.accent2, fontSize: 11, fontWeight: 700, letterSpacing: 0.3,
          display: 'flex', alignItems: 'center', gap: 5,
        }}>
          <SparkIcon size={12} color={T.accent2} />
          {t.optimal}
        </div>
      </div>

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

      {/* 3D cube viewer */}
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
          playing={playing}
          rotation={{ x: -0.45, y: -0.55 }}
          onMoveChange={setMoveIdx}
        />
      </div>

      {/* Move strip */}
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
