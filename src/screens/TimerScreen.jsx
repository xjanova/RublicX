import React from 'react';
import { T } from '../theme.js';
import { useI18n } from '../i18n.jsx';
import { scramble, scrambleString } from '../lib/cube.js';
import { recordSolve, loadStats, recentSolves, subscribeStats } from '../lib/stats.js';

export default function TimerScreen() {
  const { t, lang } = useI18n();
  const [state, setState] = React.useState('idle');
  const [time, setTime] = React.useState(0);
  const [held, setHeld] = React.useState(false);
  const [stats, setStats] = React.useState(loadStats);
  const history = React.useMemo(() => recentSolves(stats, 12).map(s => s.time), [stats]);
  const [scrambleStr, setScrambleStr] = React.useState(() => scrambleString(scramble(3, 20)));
  const intervalRef = React.useRef(null);
  const startRef = React.useRef(null);
  const holdTimerRef = React.useRef(null);

  React.useEffect(() => subscribeStats(setStats), []);

  React.useEffect(() => {
    if (state === 'running') {
      startRef.current = performance.now();
      intervalRef.current = setInterval(() => {
        setTime((performance.now() - startRef.current) / 1000);
      }, 50);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [state]);

  const onPress = (e) => {
    e.preventDefault();
    if (state === 'running') {
      const finalTime = (performance.now() - startRef.current) / 1000;
      setTime(finalTime);
      setState('done');
      recordSolve(parseFloat(finalTime.toFixed(2)), scrambleStr);
      setScrambleStr(scrambleString(scramble(3, 20)));
    } else if (state === 'idle' || state === 'done') {
      setHeld(true);
      holdTimerRef.current = setTimeout(() => setState('ready'), 600);
    }
  };
  const onRelease = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (state === 'ready') {
      setTime(0);
      setState('running');
    }
    setHeld(false);
  };

  const color = state === 'ready' ? T.accent2 : state === 'done' ? T.accent2 : T.text;
  const best = history.length ? Math.min(...history) : null;
  const fmt = (n, d = 2) => (n == null || !isFinite(n)) ? '—' : n.toFixed(d);
  // Avg-of-N is only meaningful with N samples; show em-dash until then.
  const avgOf = (slice, n) => {
    if (slice.length < n) return '—';
    return (slice.reduce((a, b) => a + b, 0) / slice.length).toFixed(2);
  };
  const avg5 = avgOf(history.slice(-5), 5);
  const avg12 = avgOf(history.slice(-12), 12);

  return (
    <div className="scrollable" style={{ paddingTop: 56, paddingBottom: 130, background: T.bg, minHeight: '100%', position: 'relative', overflowY: 'auto', height: '100%' }}>
      <div style={{ padding: '8px 24px 0' }}>
        <div style={{ color: T.dim, fontSize: 11, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase' }}>
          {t.timer}
        </div>
        <div style={{ color: T.text, fontSize: 26, fontWeight: 700, marginTop: 2 }}>
          3×3 · {t.timeLabel}
        </div>
      </div>

      <div style={{ padding: '14px 16px 0' }}>
        <div style={{
          background: T.card, border: `1px solid ${T.border}`,
          borderRadius: 16, padding: '12px 14px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <div style={{ color: T.dim, fontSize: 10, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase' }}>
              {t.scramble}
            </div>
            <button onClick={() => setScrambleStr(scrambleString(scramble(3, 20)))} style={{
              background: 'transparent', border: `1px solid ${T.border}`,
              color: T.muted, fontSize: 10, fontWeight: 700,
              padding: '4px 10px', borderRadius: 999, cursor: 'pointer',
            }}>↻ {lang === 'th' ? 'สับใหม่' : 'New'}</button>
          </div>
          <div style={{
            color: T.text, fontFamily: 'JetBrains Mono, ui-monospace, monospace',
            fontSize: 14, fontWeight: 600, lineHeight: 1.5, wordSpacing: 4,
          }}>{scrambleStr}</div>
        </div>
      </div>

      <div style={{ padding: '24px 16px 0' }}>
        <button
          onPointerDown={onPress}
          onPointerUp={onRelease}
          onPointerLeave={onRelease}
          style={{
            width: '100%', height: 240, borderRadius: 32,
            border: `1px solid ${state === 'ready' ? T.accent2 : T.border}`,
            background: state === 'ready'
              ? `linear-gradient(135deg, rgba(0,224,183,0.18) 0%, rgba(0,184,148,0.1) 100%)`
              : T.card,
            cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.2s',
            transform: held ? 'scale(0.99)' : 'scale(1)',
            position: 'relative', overflow: 'hidden',
            color: T.text,
            touchAction: 'manipulation',
          }}>
          {state === 'ready' && (
            <div style={{
              position: 'absolute', inset: 0,
              boxShadow: `inset 0 0 60px rgba(0,224,183,0.25)`,
              borderRadius: 32, pointerEvents: 'none',
            }} />
          )}
          <div style={{
            color, fontSize: 64, fontWeight: 200, fontVariantNumeric: 'tabular-nums',
            fontFamily: 'JetBrains Mono, ui-monospace, monospace',
            letterSpacing: -1,
          }}>{time.toFixed(2)}</div>
          <div style={{ color: T.muted, fontSize: 12, fontWeight: 600, marginTop: 8, letterSpacing: 0.3 }}>
            {state === 'idle' && t.holdToReady}
            {state === 'ready' && t.release}
            {state === 'running' && '...'}
            {state === 'done' && t.solved2}
          </div>
        </button>
      </div>

      <div style={{ padding: '14px 16px 0', display: 'flex', gap: 8 }}>
        <Stat label={t.bestEver} value={fmt(best)} highlight />
        <Stat label={t.avg5} value={avg5} />
        <Stat label={t.avg12} value={avg12} />
      </div>

      <div style={{ padding: '14px 16px 0' }}>
        <div style={{
          background: T.card, border: `1px solid ${T.border}`,
          borderRadius: 18, padding: '14px 16px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ color: T.muted, fontSize: 11, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase' }}>
              {t.last12}
            </div>
            <div style={{ color: T.text, fontSize: 11, fontWeight: 700 }}>{history.length} / 12</div>
          </div>
          {history.length === 0 ? (
            <div style={{ color: T.dim, fontSize: 12, padding: '20px 0', textAlign: 'center' }}>
              {lang === 'th' ? 'จับเวลาครั้งแรกเพื่อเริ่มกราฟ' : 'Time your first solve to start the chart'}
            </div>
          ) : (
            <Sparkline data={history.slice(-12)} />
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }) {
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
      <div style={{ color: highlight ? '#fff' : T.text, fontSize: 18, fontWeight: 700, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
    </div>
  );
}

function Sparkline({ data }) {
  const w = 320, h = 64;
  const max = Math.max(...data), min = Math.min(...data);
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((d - min) / (max - min || 1)) * h;
    return [x, y];
  });
  const path = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h + 16}`} style={{ width: '100%', height: 80 }}>
      <defs>
        <linearGradient id="spark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={T.accent} stopOpacity="0.4"/>
          <stop offset="100%" stopColor={T.accent} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <path d={`${path} L ${w} ${h} L 0 ${h} Z`} fill="url(#spark)" />
      <path d={path} fill="none" stroke={T.accent} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
      {pts.map(([x, y], i) => {
        const isBest = data[i] === min;
        return (
          <g key={i}>
            <circle cx={x} cy={y} r={isBest ? 4 : 2.5} fill={isBest ? T.accent2 : T.accent} stroke={T.bg} strokeWidth="1.5"/>
            {isBest && <text x={x} y={y - 8} fontSize="10" fill={T.accent2} textAnchor="middle" fontWeight="700">{data[i].toFixed(2)}</text>}
          </g>
        );
      })}
    </svg>
  );
}
