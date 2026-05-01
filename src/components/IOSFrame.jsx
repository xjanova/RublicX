import React from 'react';
import { T } from '../theme.js';

export default function IOSFrame({ children }) {
  const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 480px)').matches;
  if (isMobile) {
    return (
      <div style={{
        position: 'fixed', inset: 0,
        background: T.bg,
        overflow: 'hidden',
      }}>
        {children}
      </div>
    );
  }
  return (
    <div style={{
      width: 390, height: 844,
      borderRadius: 56,
      background: '#000',
      padding: 12,
      boxShadow: '0 40px 100px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.1), inset 0 0 0 4px #1a1a1d',
      position: 'relative',
    }}>
      <div style={{
        width: '100%', height: '100%',
        borderRadius: 44,
        background: T.bg,
        overflow: 'hidden',
        position: 'relative',
      }}>
        {/* Dynamic island */}
        <div style={{
          position: 'absolute', top: 11, left: '50%',
          transform: 'translateX(-50%)',
          width: 120, height: 36, borderRadius: 18,
          background: '#000',
          zIndex: 100,
        }}/>
        {/* Status bar */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 56,
          padding: '18px 30px 0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          color: '#fff', fontSize: 14, fontWeight: 600,
          zIndex: 50, pointerEvents: 'none',
        }}>
          <div>9:41</div>
          <div style={{ width: 120 }}/>
          <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
            <svg width="18" height="11" viewBox="0 0 18 11" fill="#fff">
              <rect x="0" y="3" width="3" height="5" rx="0.5"/>
              <rect x="5" y="2" width="3" height="7" rx="0.5"/>
              <rect x="10" y="0" width="3" height="11" rx="0.5"/>
              <rect x="15" y="-1" width="3" height="13" rx="0.5" opacity="0.4"/>
            </svg>
            <svg width="16" height="11" viewBox="0 0 16 11" fill="none">
              <path d="M1 4 a7 7 0 0 1 14 0" stroke="#fff" strokeWidth="1.4" fill="none"/>
              <path d="M4 7 a4 4 0 0 1 8 0" stroke="#fff" strokeWidth="1.4" fill="none"/>
              <circle cx="8" cy="9.5" r="1" fill="#fff"/>
            </svg>
            <div style={{
              width: 25, height: 11, borderRadius: 3,
              border: '1px solid rgba(255,255,255,0.5)',
              padding: 1.5, position: 'relative',
            }}>
              <div style={{ width: '78%', height: '100%', background: '#fff', borderRadius: 1 }}/>
              <div style={{
                position: 'absolute', right: -3, top: 3, width: 1.5, height: 4,
                background: 'rgba(255,255,255,0.5)', borderRadius: '0 1px 1px 0',
              }}/>
            </div>
          </div>
        </div>
        {/* Home indicator */}
        <div style={{
          position: 'absolute', bottom: 8, left: '50%',
          transform: 'translateX(-50%)',
          width: 134, height: 5, borderRadius: 3,
          background: 'rgba(255,255,255,0.4)',
          zIndex: 100, pointerEvents: 'none',
        }}/>
        {/* Screen content */}
        <div style={{ position: 'relative', height: '100%', overflow: 'hidden' }}>
          {children}
        </div>
      </div>
    </div>
  );
}
