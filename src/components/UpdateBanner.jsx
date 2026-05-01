// Persistent overlay banner that appears when a new RublicX build is available.
// On first event it starts a 5s countdown then auto-applies the update. The user can:
//   • Tap "Update now" — applies immediately.
//   • Tap "Later" — dismisses for the current session (the banner reappears after a reload anyway).
import React from 'react';
import { T } from '../theme.js';
import { useI18n } from '../i18n.jsx';
import { applyUpdateNow } from '../update.js';
import { SparkIcon } from './Icons.jsx';

const AUTO_APPLY_SECONDS = 5;

export default function UpdateBanner() {
  const { t, lang } = useI18n();
  const [available, setAvailable] = React.useState(false);
  const [countdown, setCountdown] = React.useState(AUTO_APPLY_SECONDS);
  const [paused, setPaused] = React.useState(false);
  const intervalRef = React.useRef(null);

  React.useEffect(() => {
    const onAvail = () => {
      setAvailable(true);
      setCountdown(AUTO_APPLY_SECONDS);
      setPaused(false);
    };
    window.addEventListener('rublicx-update-available', onAvail);
    return () => window.removeEventListener('rublicx-update-available', onAvail);
  }, []);

  React.useEffect(() => {
    if (!available || paused) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(intervalRef.current);
          applyUpdateNow();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [available, paused]);

  if (!available) return null;

  const message = lang === 'th'
    ? `เวอร์ชันใหม่พร้อม — ติดตั้งใน ${countdown} วิ`
    : `New version ready — installing in ${countdown}s`;
  const updateLabel = lang === 'th' ? 'อัปเดตเลย' : 'Update now';
  const laterLabel = lang === 'th' ? 'ภายหลัง' : 'Later';

  return (
    <div style={{
      position: 'fixed',
      top: 'env(safe-area-inset-top, 12px)',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 1000,
      maxWidth: 'min(92vw, 420px)',
      width: 'calc(100% - 24px)',
      background: 'rgba(20,22,32,0.92)',
      backdropFilter: 'blur(24px) saturate(180%)',
      WebkitBackdropFilter: 'blur(24px) saturate(180%)',
      border: `1px solid rgba(124,92,255,0.4)`,
      borderRadius: 18,
      padding: '12px 14px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      boxShadow: '0 16px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(124,92,255,0.2)',
      animation: 'fadeUp 0.36s cubic-bezier(0.4, 0, 0.2, 1) both',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 12, flexShrink: 0,
        background: `linear-gradient(135deg, ${T.accent}, ${T.accent3})`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 4px 12px rgba(124,92,255,0.4)',
      }}>
        <SparkIcon size={18} color="#fff" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: T.text, fontSize: 13, fontWeight: 700, lineHeight: 1.2 }}>
          {message}
        </div>
        <div style={{
          marginTop: 6,
          height: 3, borderRadius: 2,
          background: 'rgba(255,255,255,0.06)',
          overflow: 'hidden',
        }}>
          <div style={{
            width: `${((AUTO_APPLY_SECONDS - countdown) / AUTO_APPLY_SECONDS) * 100}%`,
            height: '100%',
            background: `linear-gradient(90deg, ${T.accent}, ${T.accent3})`,
            transition: 'width 0.95s linear',
          }} />
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
        <button onClick={applyUpdateNow} style={{
          padding: '6px 12px', borderRadius: 10,
          background: `linear-gradient(135deg, ${T.accent}, ${T.accent3})`,
          border: 'none', color: '#fff',
          fontSize: 11, fontWeight: 700, letterSpacing: 0.3,
          cursor: 'pointer', whiteSpace: 'nowrap',
        }}>{updateLabel}</button>
        <button onClick={() => { setPaused(true); setAvailable(false); }} style={{
          padding: '4px 12px', borderRadius: 10,
          background: 'transparent',
          border: `1px solid ${T.border}`,
          color: T.muted,
          fontSize: 10, fontWeight: 600, letterSpacing: 0.3,
          cursor: 'pointer',
        }}>{laterLabel}</button>
      </div>
    </div>
  );
}
