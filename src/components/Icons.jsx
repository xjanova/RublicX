// All UI icons — sourced from rublicx.zip handoff (screens-base.jsx)
import React from 'react';

export const HomeIcon = ({ size = 22, color = '#fff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M3 11l9-7 9 7v9a2 2 0 01-2 2h-4v-7H9v7H5a2 2 0 01-2-2v-9z" stroke={color} strokeWidth="1.7" strokeLinejoin="round"/>
  </svg>
);
export const BookIcon = ({ size = 22, color = '#fff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M4 5a2 2 0 012-2h12v18H6a2 2 0 01-2-2V5z" stroke={color} strokeWidth="1.7"/>
    <path d="M8 7h6M8 11h6" stroke={color} strokeWidth="1.7" strokeLinecap="round"/>
  </svg>
);
export const ScanIcon = ({ size = 22, color = '#fff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M4 8V6a2 2 0 012-2h2M16 4h2a2 2 0 012 2v2M20 16v2a2 2 0 01-2 2h-2M8 20H6a2 2 0 01-2-2v-2" stroke={color} strokeWidth="2" strokeLinecap="round"/>
    <rect x="8" y="8" width="8" height="8" rx="1.2" stroke={color} strokeWidth="1.6"/>
  </svg>
);
export const ClockIcon = ({ size = 22, color = '#fff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.7"/>
    <path d="M12 7v5l3 2" stroke={color} strokeWidth="1.7" strokeLinecap="round"/>
  </svg>
);
export const UserIcon = ({ size = 22, color = '#fff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="8" r="4" stroke={color} strokeWidth="1.7"/>
    <path d="M4 21c0-4 4-7 8-7s8 3 8 7" stroke={color} strokeWidth="1.7" strokeLinecap="round"/>
  </svg>
);
export const PlayIcon = ({ size = 18, color = '#fff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}><path d="M7 4l13 8-13 8V4z"/></svg>
);
export const PauseIcon = ({ size = 18, color = '#fff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <rect x="6" y="4" width="4" height="16" rx="1"/>
    <rect x="14" y="4" width="4" height="16" rx="1"/>
  </svg>
);
export const ArrowRight = ({ size = 16, color = '#fff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M5 12h14M13 6l6 6-6 6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
export const FlameIcon = ({ size = 16, color = '#FFB627' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M12 2c-2 4 1 6 1 9 0 2-1 3-2 3-1 0-2-1-2-2 0-2 1-3 1-4-2 1-4 4-4 7 0 4 3 7 6 7s7-3 7-7c0-5-3-9-7-13z"/>
  </svg>
);
export const TrophyIcon = ({ size = 16, color = '#FFB627' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M8 4h8v5a4 4 0 01-8 0V4zM5 6H3v2a3 3 0 003 3M19 6h2v2a3 3 0 01-3 3M9 18h6M10 14v4M14 14v4" stroke={color} strokeWidth="1.7" strokeLinecap="round"/>
  </svg>
);
export const SparkIcon = ({ size = 16, color = '#7C5CFF' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M12 2l1.6 5.4L19 9l-5.4 1.6L12 16l-1.6-5.4L5 9l5.4-1.6L12 2z"/>
  </svg>
);
export const ChevronLeftIcon = ({ size = 18, color = '#fff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M15 18l-6-6 6-6" stroke={color} strokeWidth="2" strokeLinecap="round"/>
  </svg>
);
export const InfoIcon = ({ size = 20, color = '#fff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.6"/>
    <path d="M12 11v6M12 7.5h0.01" stroke={color} strokeWidth="2" strokeLinecap="round"/>
  </svg>
);
export const CheckIcon = ({ size = 18, color = '#fff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M5 12l5 5L20 7" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
export const LockIcon = ({ size = 16, color = 'rgba(245,246,250,0.35)' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="5" y="11" width="14" height="9" rx="2" stroke={color} strokeWidth="1.7"/>
    <path d="M8 11V8a4 4 0 018 0v3" stroke={color} strokeWidth="1.7"/>
  </svg>
);
export const CameraIcon = ({ size = 18, color = '#fff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="13" r="4" stroke={color} strokeWidth="2"/>
    <path d="M3 8a2 2 0 012-2h2l1.5-2h7L17 6h2a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" stroke={color} strokeWidth="2" strokeLinejoin="round"/>
  </svg>
);
export const PrevIcon = ({ size = 14, color = '#fff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M19 4l-12 8 12 8V4zM5 4h2v16H5V4z"/>
  </svg>
);
export const NextIcon = ({ size = 14, color = '#fff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M5 4l12 8-12 8V4zM17 4h2v16h-2V4z"/>
  </svg>
);
export const GlobeIcon = ({ size = 16, color = '#fff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.6"/>
    <path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18" stroke={color} strokeWidth="1.6"/>
  </svg>
);
