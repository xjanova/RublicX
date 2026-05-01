import React from 'react';
import { T } from '../theme.js';
import { useI18n } from '../i18n.jsx';
import AnimatedCube from '../components/AnimatedCube.jsx';
import { CubeThumb } from '../components/CubeNet.jsx';
import {
  ArrowRight, FlameIcon, ScanIcon, SparkIcon, LockIcon,
} from '../components/Icons.jsx';
import { parseMoves } from '../lib/cube.js';

const DEMO_SEQUENCE = parseMoves("R U F' L U' R'");

export default function HomeScreen({ onNavigate }) {
  const { t, lang } = useI18n();
  return (
    <div className="scrollable" style={{
      paddingTop: 56, paddingBottom: 130,
      background: T.bg,
      minHeight: '100%',
      position: 'relative',
      overflowY: 'auto',
      height: '100%',
    }}>
      <div style={{
        position: 'absolute', top: -80, left: -40, width: 320, height: 320,
        background: 'radial-gradient(circle, rgba(124,92,255,0.35) 0%, transparent 65%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', top: 80, right: -120, width: 320, height: 320,
        background: 'radial-gradient(circle, rgba(255,106,61,0.2) 0%, transparent 65%)',
        pointerEvents: 'none',
      }} />

      {/* Header */}
      <div style={{ padding: '8px 24px 0', position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ color: T.dim, fontSize: 13, fontWeight: 500, letterSpacing: 0.3 }}>
              {t.welcomeBack}
            </div>
            <div style={{ color: T.text, fontSize: 26, fontWeight: 700, marginTop: 2 }}>
              {t.name}
            </div>
          </div>
          <div style={{
            width: 44, height: 44, borderRadius: 22,
            background: `linear-gradient(135deg, ${T.accent}, ${T.accent3})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 700, fontSize: 16,
            boxShadow: '0 4px 12px rgba(124,92,255,0.4)',
          }}>{lang === 'th' ? 'นน' : 'NK'}</div>
        </div>
      </div>

      {/* Hero card */}
      <div style={{ padding: '20px 16px 0', position: 'relative', zIndex: 1 }}>
        <div style={{
          background: `linear-gradient(135deg, ${T.cardHi} 0%, ${T.card} 100%)`,
          border: `1px solid ${T.border}`,
          borderRadius: 28,
          padding: '24px 20px 20px',
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', top: -40, right: -40, width: 200, height: 200,
            background: 'radial-gradient(circle, rgba(124,92,255,0.3) 0%, transparent 65%)',
          }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative' }}>
            <div style={{ flex: 1, paddingTop: 4 }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '4px 10px', borderRadius: 12,
                background: 'rgba(255,182,39,0.14)',
                color: T.warn, fontSize: 11, fontWeight: 700, letterSpacing: 0.4,
              }}>
                <FlameIcon size={12} color={T.warn} />
                {t.streak3}
              </div>
              <div style={{ color: T.text, fontSize: 22, fontWeight: 700, marginTop: 12, lineHeight: 1.15 }}>
                {t.todayLesson}
              </div>
              <div style={{ color: T.muted, fontSize: 13, marginTop: 4 }}>
                {t.crossF2L} · 12 {t.minutes}
              </div>
              <button onClick={() => onNavigate?.('learn')} style={{
                marginTop: 14,
                background: T.text, color: T.bg, border: 'none',
                padding: '10px 16px', borderRadius: 14,
                fontSize: 13, fontWeight: 700, letterSpacing: 0.2,
                display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer',
              }}>
                {t.continue}
                <ArrowRight size={14} color={T.bg} />
              </button>
            </div>
            <div style={{
              width: 130, height: 130, marginLeft: -10, marginTop: -10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <AnimatedCube
                width={130} height={130}
                sequence={DEMO_SEQUENCE} speed={0.8}
                rotation={{ x: -0.45, y: -0.55 }}
                dragEnabled={false}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div style={{
        padding: '14px 16px 0',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 10,
        position: 'relative', zIndex: 1,
      }}>
        <QuickCard
          icon={<ScanIcon size={22} color={T.accent2} />}
          label={t.quickSolve}
          subtitle={t.fastestSolve}
          tint="rgba(0,224,183,0.12)"
          onClick={() => onNavigate?.('scan')}
        />
        <QuickCard
          icon={<SparkIcon size={20} color={T.accent} />}
          label={t.learnMethod}
          subtitle="CFOP · OLL · PLL"
          tint="rgba(124,92,255,0.14)"
          onClick={() => onNavigate?.('learn')}
        />
      </div>

      {/* Stats row */}
      <div style={{ padding: '20px 16px 0', position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <StatTile label={t.solved} value="247" />
          <StatTile label={t.bestTime} value="14.3s" highlight />
          <StatTile label={t.streak} value={`12 ${t.days}`} />
        </div>
      </div>

      {/* Lesson list */}
      <div style={{ padding: '24px 24px 8px', position: 'relative', zIndex: 1 }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
          color: T.text, fontSize: 18, fontWeight: 700,
        }}>
          {t.lessons}
          <span style={{ color: T.dim, fontSize: 12, fontWeight: 600 }}>{t.explore}</span>
        </div>
      </div>
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10, position: 'relative', zIndex: 1 }}>
        <LessonRow n={2} title={t.cube2} subtitle={`${t.beginner} · 6 ${t.chapter}`} progress={0.65} onClick={() => onNavigate?.('learn')} />
        <LessonRow n={3} title={t.cube3} subtitle={`${t.intermediate} · 14 ${t.chapter}`} progress={0.42} active onClick={() => onNavigate?.('learn')} />
        <LessonRow n={4} title={t.cube4} subtitle={`${t.advanced} · 9 ${t.chapter}`} progress={0.12} onClick={() => onNavigate?.('learn')} />
        <LessonRow n={3} title={t.secret} subtitle={`${t.oll} · ${t.pll}`} progress={0} locked />
      </div>
    </div>
  );
}

function QuickCard({ icon, label, subtitle, tint, onClick }) {
  return (
    <button onClick={onClick} style={{
      background: T.card,
      border: `1px solid ${T.border}`,
      borderRadius: 20,
      padding: 14,
      cursor: 'pointer',
      textAlign: 'left',
      color: T.text,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: tint,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>{icon}</div>
      <div style={{ color: T.text, fontSize: 14, fontWeight: 700, marginTop: 10 }}>{label}</div>
      <div style={{ color: T.muted, fontSize: 11, marginTop: 2 }}>{subtitle}</div>
    </button>
  );
}

function StatTile({ label, value, highlight }) {
  return (
    <div style={{
      flex: 1,
      background: highlight ? `linear-gradient(135deg, ${T.accent} 0%, ${T.accent3} 100%)` : T.card,
      border: highlight ? 'none' : `1px solid ${T.border}`,
      borderRadius: 16,
      padding: '10px 12px',
    }}>
      <div style={{ color: highlight ? 'rgba(255,255,255,0.8)' : T.dim, fontSize: 10, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ color: highlight ? '#fff' : T.text, fontSize: 18, fontWeight: 700, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
    </div>
  );
}

function LessonRow({ n, title, subtitle, progress, active, locked, onClick }) {
  return (
    <button onClick={locked ? undefined : onClick} disabled={locked} style={{
      display: 'flex', alignItems: 'center', gap: 14,
      background: active ? T.cardHi : T.card,
      border: `1px solid ${active ? 'rgba(124,92,255,0.4)' : T.border}`,
      borderRadius: 20,
      padding: '14px 14px',
      opacity: locked ? 0.55 : 1,
      cursor: locked ? 'not-allowed' : 'pointer',
      width: '100%',
      textAlign: 'left',
      color: T.text,
    }}>
      <CubeThumb n={n} locked={locked} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: T.text, fontSize: 14, fontWeight: 700 }}>{title}</div>
        <div style={{ color: T.muted, fontSize: 11, marginTop: 2 }}>{subtitle}</div>
        {!locked && (
          <div style={{
            marginTop: 8, height: 4, borderRadius: 2,
            background: 'rgba(255,255,255,0.06)', overflow: 'hidden',
          }}>
            <div style={{
              width: `${progress * 100}%`, height: '100%',
              background: active ? `linear-gradient(90deg, ${T.accent}, ${T.accent3})` : T.text,
              borderRadius: 2,
            }} />
          </div>
        )}
      </div>
      {locked ? <LockIcon /> : <ArrowRight color={T.dim} />}
    </button>
  );
}
