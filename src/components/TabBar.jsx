import React from 'react';
import { T } from '../theme.js';
import { HomeIcon, BookIcon, ScanIcon, ClockIcon, UserIcon } from './Icons.jsx';

export default function TabBar({ tab, setTab, t }) {
  const tabs = [
    { id: 'home', label: t.home, icon: HomeIcon },
    { id: 'learn', label: t.learn, icon: BookIcon },
    { id: 'scan', label: t.scan, icon: ScanIcon, primary: true },
    { id: 'timer', label: t.timer, icon: ClockIcon },
    { id: 'profile', label: t.profile, icon: UserIcon },
  ];
  return (
    <div style={{
      position: 'absolute',
      bottom: 24, left: 12, right: 12,
      height: 72,
      borderRadius: 36,
      background: 'rgba(20,22,32,0.78)',
      backdropFilter: 'blur(24px) saturate(180%)',
      WebkitBackdropFilter: 'blur(24px) saturate(180%)',
      border: '0.5px solid rgba(255,255,255,0.08)',
      boxShadow: '0 8px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-around',
      zIndex: 30,
    }}>
      {tabs.map(({ id, label, icon: Icon, primary }) => {
        const active = tab === id;
        if (primary) {
          return (
            <button key={id} onClick={() => setTab(id)} aria-label={label} style={{
              width: 56, height: 56, borderRadius: 28,
              background: `linear-gradient(135deg, ${T.accent} 0%, ${T.accent3} 100%)`,
              border: 'none',
              boxShadow: '0 8px 24px rgba(124,92,255,0.45), inset 0 1px 0 rgba(255,255,255,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
              transform: 'translateY(-12px)',
            }}>
              <Icon color="#fff" size={26} />
            </button>
          );
        }
        return (
          <button key={id} onClick={() => setTab(id)} aria-label={label} style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            color: active ? T.text : T.dim,
            padding: '8px 12px', minWidth: 56,
          }}>
            <Icon color={active ? T.text : T.dim} size={22} />
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.2 }}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
