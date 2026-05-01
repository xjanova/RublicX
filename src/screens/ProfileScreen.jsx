import React from 'react';
import { T } from '../theme.js';
import { useI18n } from '../i18n.jsx';
import { ClockIcon, FlameIcon, SparkIcon, TrophyIcon, GlobeIcon } from '../components/Icons.jsx';

export default function ProfileScreen() {
  const { t, lang, setLang } = useI18n();
  const version = (typeof __APP_VERSION__ !== 'undefined') ? __APP_VERSION__ : '0.1.0';
  const [updateAvailable, setUpdateAvailable] = React.useState(false);

  React.useEffect(() => {
    function onUpdate() { setUpdateAvailable(true); }
    window.addEventListener('rublicx-update-available', onUpdate);
    return () => window.removeEventListener('rublicx-update-available', onUpdate);
  }, []);

  return (
    <div className="scrollable" style={{ paddingTop: 56, paddingBottom: 130, background: T.bg, minHeight: '100%', overflowY: 'auto', height: '100%' }}>
      <div style={{ padding: '8px 24px 0' }}>
        <div style={{ color: T.dim, fontSize: 11, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase' }}>
          {t.profile}
        </div>
      </div>

      <div style={{ padding: '14px 16px 0' }}>
        <div style={{
          background: T.card, border: `1px solid ${T.border}`,
          borderRadius: 22, padding: 18,
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: 32,
            background: `linear-gradient(135deg, ${T.accent}, ${T.accent3})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 22, fontWeight: 700,
            boxShadow: '0 8px 24px rgba(124,92,255,0.4)',
          }}>{lang === 'th' ? 'นน' : 'NK'}</div>
          <div style={{ flex: 1 }}>
            <div style={{ color: T.text, fontSize: 18, fontWeight: 700 }}>{t.name}</div>
            <div style={{ color: T.muted, fontSize: 12, marginTop: 2 }}>{t.cubeMaster} · Lv. 8</div>
            <div style={{
              marginTop: 8, height: 4, borderRadius: 2,
              background: 'rgba(255,255,255,0.06)', overflow: 'hidden',
            }}>
              <div style={{ width: '64%', height: '100%', background: `linear-gradient(90deg, ${T.accent}, ${T.accent3})` }}/>
            </div>
          </div>
        </div>
      </div>

      {/* Language toggle */}
      <div style={{ padding: '12px 16px 0' }}>
        <div style={{
          background: T.card, border: `1px solid ${T.border}`,
          borderRadius: 18, padding: '14px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <GlobeIcon color={T.muted} />
            <div style={{ color: T.text, fontSize: 14, fontWeight: 700 }}>
              {lang === 'th' ? 'ภาษา' : 'Language'}
            </div>
          </div>
          <div style={{
            display: 'flex', background: T.bg, padding: 4, borderRadius: 12,
            border: `1px solid ${T.border}`,
          }}>
            {['en', 'th'].map(l => (
              <button key={l} onClick={() => setLang(l)} style={{
                padding: '6px 14px', borderRadius: 8,
                background: lang === l ? T.cardHi : 'transparent',
                color: lang === l ? T.text : T.dim,
                border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 700, letterSpacing: 0.5,
              }}>{l.toUpperCase()}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Weekly goal ring */}
      <div style={{ padding: '12px 16px 0' }}>
        <div style={{
          background: T.card, border: `1px solid ${T.border}`,
          borderRadius: 22, padding: 16,
          display: 'flex', alignItems: 'center', gap: 16,
        }}>
          <Ring pct={0.72} />
          <div style={{ flex: 1 }}>
            <div style={{ color: T.muted, fontSize: 11, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase' }}>
              {t.weeklyGoal}
            </div>
            <div style={{ color: T.text, fontSize: 22, fontWeight: 700, marginTop: 2 }}>
              5 / 7 {t.days}
            </div>
            <div style={{ color: T.muted, fontSize: 11, marginTop: 4 }}>
              {t.moreDays}
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: '12px 16px 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <BigStat label={t.solved} value="247" icon={<TrophyIcon color={T.warn}/>} />
        <BigStat label={t.bestTime} value="11.84s" icon={<ClockIcon size={16} color={T.accent2}/>} />
        <BigStat label={t.streak} value={`12 ${t.days}`} icon={<FlameIcon color={T.accent3}/>} />
        <BigStat label={t.algsLearned} value="38" icon={<SparkIcon color={T.accent}/>} />
      </div>

      <div style={{ padding: '20px 24px 8px', color: T.text, fontSize: 16, fontWeight: 700 }}>
        {t.achievements}
      </div>
      <div className="scrollable" style={{ padding: '0 16px', display: 'flex', gap: 10, overflowX: 'auto' }}>
        {[
          { icon: '🥇', name: lang === 'th' ? 'ต่ำกว่า 15s' : 'Sub-15', tint: T.warn },
          { icon: '🔥', name: lang === 'th' ? '7 วันรวด' : '7-day streak', tint: T.accent3 },
          { icon: '⚡', name: 'F2L Master', tint: T.accent },
          { icon: '🧠', name: 'OLL 30/57', tint: T.accent2 },
          { icon: '🎯', name: 'PLL 12/21', tint: T.red },
        ].map((a, i) => (
          <div key={i} style={{
            flex: '0 0 90px',
            background: T.card, border: `1px solid ${T.border}`,
            borderRadius: 18, padding: '14px 8px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 22,
              background: `${a.tint}22`, border: `1px solid ${a.tint}55`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22,
            }}>{a.icon}</div>
            <div style={{ color: T.text, fontSize: 10, fontWeight: 700, textAlign: 'center', letterSpacing: 0.2 }}>
              {a.name}
            </div>
          </div>
        ))}
      </div>

      {/* Version + update */}
      <div style={{ padding: '24px 16px 0' }}>
        <div style={{
          background: T.card, border: `1px solid ${T.border}`,
          borderRadius: 18, padding: '14px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ color: T.dim, fontSize: 10, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase' }}>
              {lang === 'th' ? 'เวอร์ชั่น' : 'Version'}
            </div>
            <div style={{
              color: T.text, fontSize: 14, fontWeight: 700, marginTop: 2,
              fontFamily: 'JetBrains Mono, ui-monospace, monospace',
            }}>v{version}</div>
          </div>
          {updateAvailable ? (
            <button onClick={() => location.reload()} style={{
              padding: '8px 14px', borderRadius: 12,
              background: `linear-gradient(135deg, ${T.accent}, ${T.accent3})`,
              border: 'none', color: '#fff', fontSize: 12, fontWeight: 700,
              cursor: 'pointer', letterSpacing: 0.3,
            }}>{lang === 'th' ? 'อัปเดตเลย' : 'Update now'}</button>
          ) : (
            <div style={{
              padding: '6px 12px', borderRadius: 12,
              background: 'rgba(0,224,183,0.14)',
              color: T.accent2, fontSize: 11, fontWeight: 700, letterSpacing: 0.3,
            }}>{lang === 'th' ? 'ล่าสุด' : 'Up to date'}</div>
          )}
        </div>
      </div>
    </div>
  );
}

function Ring({ pct }) {
  const size = 72, stroke = 8, r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <defs>
        <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={T.accent}/>
          <stop offset="100%" stopColor={T.accent3}/>
        </linearGradient>
      </defs>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="url(#ringGrad)" strokeWidth={stroke}
        strokeDasharray={c} strokeDashoffset={c * (1 - pct)} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}/>
      <text x={size/2} y={size/2 + 5} textAnchor="middle" fill={T.text} fontSize="16" fontWeight="700">{Math.round(pct * 100)}%</text>
    </svg>
  );
}

function BigStat({ label, value, icon }) {
  return (
    <div style={{
      background: T.card, border: `1px solid ${T.border}`,
      borderRadius: 18, padding: '14px 14px',
    }}>
      <div style={{
        width: 30, height: 30, borderRadius: 8,
        background: 'rgba(255,255,255,0.04)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>{icon}</div>
      <div style={{ color: T.muted, fontSize: 10, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase', marginTop: 8 }}>
        {label}
      </div>
      <div style={{ color: T.text, fontSize: 20, fontWeight: 700, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
    </div>
  );
}
