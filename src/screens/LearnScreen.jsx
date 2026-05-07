import React from 'react';
import { T } from '../theme.js';
import { useI18n } from '../i18n.jsx';
import Cube3D from '../components/Cube3D.jsx';
import { CubeThumb } from '../components/CubeNet.jsx';
import { ArrowRight, CheckIcon, SparkIcon } from '../components/Icons.jsx';
import { TUTORIAL_ALGS } from '../lib/solver.js';
import { solvedCube, applyMoves, parseMoves, cloneCube } from '../lib/cube.js';
import AnimatedCube from '../components/AnimatedCube.jsx';
import { loadStats, recordAlgViewed, recordLessonOpened, subscribeStats } from '../lib/stats.js';

export default function LearnScreen() {
  const { t, lang } = useI18n();
  const [size, setSize] = React.useState(3);
  const [openAlg, setOpenAlg] = React.useState(null);
  const [stats, setStats] = React.useState(loadStats);
  React.useEffect(() => subscribeStats(setStats), []);
  const lessonProgress = stats.lessonProgress || {};

  // Counts reflect what's actually in TUTORIAL_ALGS — no inflated claims.
  const ollCount = Object.keys(TUTORIAL_ALGS).filter(k => k.startsWith('oll')).length;
  const pllCount = Object.keys(TUTORIAL_ALGS).filter(k => k.startsWith('pll')).length;
  const f2lCount = Object.keys(TUTORIAL_ALGS).filter(k => k.startsWith('f2l')).length;

  const sizes = [
    { n: 2, label: t.cube2, level: t.beginner, count: 4 },
    { n: 3, label: t.cube3, level: t.intermediate, count: 6 },
    { n: 4, label: t.cube4, level: t.advanced, count: 3 },
  ];

  const lessons3 = [
    { id: 'cross',  title: t.whiteCross,        sub: 'Cross',                  alg: TUTORIAL_ALGS.cross },
    { id: 'f2l',    title: t.f2lTitle,          sub: `F2L · ${f2lCount} algs`, alg: TUTORIAL_ALGS.f2l1 },
    { id: 'oll',    title: t.ollTitle,          sub: `OLL · ${ollCount} algs`, alg: TUTORIAL_ALGS.ollSune },
    { id: 'pll',    title: t.pllTitle,          sub: `PLL · ${pllCount} algs`, alg: TUTORIAL_ALGS.pllT },
    { id: 'finger', title: t.fingerTricksTitle, sub: t.fingerTricks,           alg: TUTORIAL_ALGS.ollAntiSune, secret: true },
    { id: 'champ',  title: t.championAlgs,      sub: t.secret,                 alg: TUTORIAL_ALGS.pllY,        secret: true },
  ];

  function handleLessonClick(lesson) {
    setOpenAlg(openAlg === lesson.id ? null : lesson.id);
    if (openAlg !== lesson.id) {
      recordLessonOpened(lesson.id);
      // Roll up progress at the size-tier level too so HomeScreen lesson rows reflect activity.
      recordLessonOpened(`cube${size}`);
      if (lesson.alg?.notation) recordAlgViewed(lesson.alg.notation);
    }
  }
  function handleAlgClick(alg) {
    setOpenAlg(openAlg === alg.notation ? null : alg.notation);
    if (openAlg !== alg.notation) {
      recordAlgViewed(alg.notation);
      recordLessonOpened(`cube${size}`);
    }
  }

  // Algorithm gallery — grouped by phase. Each card opens to show the animated cube + alg
  // notation. Useful as a reference once the user has a feel for the basics.
  const galleries = [
    {
      title: lang === 'th' ? 'F2L · เคสที่พบบ่อย' : 'F2L · common cases',
      algs: [TUTORIAL_ALGS.f2l1, TUTORIAL_ALGS.f2l2, TUTORIAL_ALGS.f2l3, TUTORIAL_ALGS.f2l4, TUTORIAL_ALGS.f2l5],
    },
    {
      title: lang === 'th' ? 'OLL · สูตรหลัก' : 'OLL · core algs',
      algs: [TUTORIAL_ALGS.ollEdges, TUTORIAL_ALGS.ollSune, TUTORIAL_ALGS.ollAntiSune,
             TUTORIAL_ALGS.ollT, TUTORIAL_ALGS.ollH, TUTORIAL_ALGS.ollPi],
    },
    {
      title: lang === 'th' ? 'PLL · 6 สูตรแรก' : 'PLL · first 6',
      algs: [TUTORIAL_ALGS.pllT, TUTORIAL_ALGS.pllU, TUTORIAL_ALGS.pllUprime,
             TUTORIAL_ALGS.pllJ, TUTORIAL_ALGS.pllY, TUTORIAL_ALGS.pllA],
    },
  ];

  return (
    <div className="scrollable" style={{ paddingTop: 56, paddingBottom: 130, background: T.bg, minHeight: '100%', overflowY: 'auto', height: '100%' }}>
      <div style={{ padding: '8px 24px 0' }}>
        <div style={{ color: T.dim, fontSize: 11, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase' }}>
          {t.lessons}
        </div>
        <div style={{ color: T.text, fontSize: 26, fontWeight: 700, marginTop: 2 }}>
          {t.masterCube}
        </div>
      </div>

      {/* Cube size selector */}
      <div style={{ padding: '14px 16px 0' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {sizes.map(s => (
            <button key={s.n} onClick={() => setSize(s.n)} style={{
              flex: 1,
              background: size === s.n ? T.cardHi : T.card,
              border: `1px solid ${size === s.n ? 'rgba(124,92,255,0.4)' : T.border}`,
              borderRadius: 18, padding: '12px 8px',
              cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
            }}>
              <CubeThumb n={s.n} size={36} />
              <div style={{ color: T.text, fontSize: 12, fontWeight: 700, marginTop: 4 }}>
                {s.n}×{s.n}
              </div>
              <div style={{ color: T.dim, fontSize: 9, fontWeight: 600, letterSpacing: 0.3 }}>
                {s.count} {t.chapter}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Featured */}
      <div style={{ padding: '20px 16px 0' }}>
        <div style={{
          background: `linear-gradient(135deg, rgba(124,92,255,0.18) 0%, rgba(255,106,61,0.12) 100%)`,
          border: `1px solid rgba(124,92,255,0.3)`,
          borderRadius: 22, padding: 16,
          display: 'flex', gap: 14, alignItems: 'center',
        }}>
          <div style={{ width: 70, height: 70, flexShrink: 0 }}>
            <Cube3D cube={solvedCube(size)} width={70} height={70} autoSpin dragEnabled={false} cameraDistance={6.5} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: T.text, fontSize: 14, fontWeight: 700 }}>
              {size === 3 ? t.methodCFOP : sizes.find(s => s.n === size)?.label}
            </div>
            <div style={{ color: T.muted, fontSize: 11, marginTop: 2 }}>
              {sizes.find(s => s.n === size)?.count} {t.chapter} · {sizes.find(s => s.n === size)?.level}
            </div>
            <button style={{
              marginTop: 8,
              background: T.text, color: T.bg, border: 'none',
              padding: '6px 12px', borderRadius: 10,
              fontSize: 11, fontWeight: 700, cursor: 'pointer',
            }}>{t.startLesson}</button>
          </div>
        </div>
      </div>

      {/* Chapter list — progress is sourced from real lesson opens, not hardcoded */}
      <div style={{ padding: '20px 16px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {lessons3.map((l, i) => {
          const prog = lessonProgress[l.id] || 0;
          const done = prog >= 1;
          return (
            <div key={l.id} style={{
              background: T.card,
              border: `1px solid ${T.border}`,
              borderRadius: 18,
              padding: '12px 14px',
              cursor: 'pointer',
              opacity: l.secret && prog === 0 ? 0.85 : 1,
            }} onClick={() => handleLessonClick(l)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: done ? `linear-gradient(135deg, ${T.accent2}, #00B894)` : T.cardHi,
                  border: done ? 'none' : `1px solid ${T.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {done ? <CheckIcon /> : l.secret ? <SparkIcon color={T.warn} /> : (
                    <span style={{ color: T.muted, fontSize: 12, fontWeight: 700 }}>{i + 1}</span>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ color: T.text, fontSize: 13, fontWeight: 700 }}>{l.title}</div>
                    {l.secret && (
                      <div style={{
                        padding: '2px 6px', borderRadius: 6,
                        background: 'rgba(255,182,39,0.15)',
                        color: T.warn, fontSize: 9, fontWeight: 700, letterSpacing: 0.3,
                      }}>{t.pro}</div>
                    )}
                  </div>
                  <div style={{ color: T.muted, fontSize: 10, marginTop: 1 }}>{l.sub}</div>
                </div>
                {prog > 0 && prog < 1 && (
                  <div style={{ color: T.accent2, fontSize: 11, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                    {Math.round(prog * 100)}%
                  </div>
                )}
                <ArrowRight color={T.dim} size={14} />
              </div>
              {openAlg === l.id && (
                <AlgPreview alg={l.alg} />
              )}
            </div>
          );
        })}
      </div>

      {/* Algorithm galleries — F2L / OLL / PLL collections */}
      {galleries.map((g) => (
        <div key={g.title} style={{ padding: '24px 16px 0' }}>
          <div style={{
            color: T.text, fontSize: 14, fontWeight: 700, marginBottom: 8, paddingLeft: 4,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <SparkIcon color={T.accent} size={14} />
            {g.title}
            <span style={{ color: T.dim, fontSize: 11, fontWeight: 600 }}>· {g.algs.length}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {g.algs.map((alg) => (
              <div
                key={alg.notation}
                onClick={() => handleAlgClick(alg)}
                style={{
                  background: T.card, border: `1px solid ${T.border}`,
                  borderRadius: 14, padding: '10px 12px',
                  cursor: 'pointer',
                }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: T.text, fontSize: 12, fontWeight: 700 }}>{alg.title}</div>
                    <div style={{
                      color: T.muted, fontSize: 10, marginTop: 1,
                      fontFamily: 'JetBrains Mono, ui-monospace, monospace',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>{alg.notation}</div>
                  </div>
                  <ArrowRight color={T.dim} size={12} />
                </div>
                {openAlg === alg.notation && <AlgPreview alg={alg} />}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function AlgPreview({ alg }) {
  const { lang } = useI18n();
  const moves = React.useMemo(() => parseMoves(alg.notation), [alg.notation]);
  return (
    <div className="fade-up" style={{
      marginTop: 12, paddingTop: 12,
      borderTop: `1px solid ${T.border}`,
      display: 'flex', gap: 14, alignItems: 'center',
    }}>
      <div style={{ width: 96, height: 96, flexShrink: 0 }}>
        <AnimatedCube width={96} height={96} sequence={moves} speed={0.7} rotation={{ x: -0.45, y: -0.55 }} dragEnabled={false} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: T.muted, fontSize: 10, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase' }}>
          {lang === 'th' ? 'สูตร' : 'Algorithm'}
        </div>
        <div style={{
          color: T.text, fontSize: 13, fontWeight: 700,
          fontFamily: 'JetBrains Mono, ui-monospace, monospace',
          marginTop: 4, lineHeight: 1.4, wordBreak: 'break-word',
        }}>{alg.notation}</div>
        <div style={{ color: T.muted, fontSize: 11, marginTop: 4 }}>{alg.desc}</div>
      </div>
    </div>
  );
}
