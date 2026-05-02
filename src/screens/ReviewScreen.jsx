// ReviewScreen — sits between ScanScreen and SolverScreen so the user can fix any cells the
// scanner mis-identified (lighting / glare / similar colors). Layout: an unfolded cube net,
// each cell tappable → highlights → color picker assigns the chosen color. Validation: each
// of the 6 standard cube colors must appear exactly N² times before the "Solve" CTA enables.
import React from 'react';
import { T, FACE_COLORS } from '../theme.js';
import { useI18n, FACE_LABELS } from '../i18n.jsx';
import { ChevronLeftIcon, CheckIcon, ArrowRight } from '../components/Icons.jsx';
import { HEX_BY_FACE } from '../lib/cube.js';

const FACE_ORDER = ['U', 'R', 'F', 'D', 'L', 'B'];

export default function ReviewScreen({ scanResult, onConfirm, onRescan, onBack }) {
  const { t, lang } = useI18n();
  const n = scanResult?.size || 3;
  const initialFaces = scanResult?.faces || emptyFaces(n);

  const [faces, setFaces] = React.useState(() => deepClone(initialFaces));
  const [selected, setSelected] = React.useState(null); // { face, idx }

  React.useEffect(() => {
    setFaces(deepClone(initialFaces));
    setSelected(null);
  }, [scanResult]);

  const counts = countColors(faces);
  const expected = n * n;
  const invalid = HEX_BY_FACE.filter((c) => counts[c] !== expected);
  const isValid = invalid.length === 0;

  const onCellTap = (face, idx) => {
    setSelected({ face, idx });
  };

  const onColorPick = (hex) => {
    if (!selected) return;
    setFaces((prev) => {
      const next = deepClone(prev);
      next[selected.face][selected.idx] = hex;
      return next;
    });
    // Auto-advance selection to the next cell so users can edit a row quickly.
    setSelected((s) => {
      if (!s) return s;
      const total = n * n;
      const nextIdx = s.idx + 1 < total ? s.idx + 1 : null;
      if (nextIdx !== null) return { face: s.face, idx: nextIdx };
      return null;
    });
  };

  const reset = () => {
    setFaces(deepClone(initialFaces));
    setSelected(null);
  };

  const cellSize = n <= 3 ? 22 : n === 4 ? 17 : 14;

  return (
    <div className="scrollable" style={{
      paddingTop: 56, paddingBottom: 130,
      background: T.bg, minHeight: '100%',
      position: 'relative', overflowY: 'auto', height: '100%',
    }}>
      {/* Header */}
      <div style={{
        padding: '8px 24px 0',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <button onClick={onBack || onRescan} style={{
          width: 36, height: 36, borderRadius: 18,
          background: T.card, border: `1px solid ${T.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
        }}>
          <ChevronLeftIcon color={T.text} />
        </button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ color: T.dim, fontSize: 11, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase' }}>
            {t.review}
          </div>
          <div style={{ color: T.text, fontSize: 18, fontWeight: 700, marginTop: 2 }}>
            {t.reviewTitle}
          </div>
        </div>
        <div style={{ width: 36 }} />
      </div>

      <div style={{
        padding: '12px 24px 0',
        color: T.muted, fontSize: 12, lineHeight: 1.5, textAlign: 'center',
      }}>
        {t.reviewSub}
      </div>

      {/* Cube net (cross layout) */}
      <div style={{
        padding: '20px 16px 0',
        display: 'flex', justifyContent: 'center',
      }}>
        <CubeNetEditor
          faces={faces}
          n={n}
          cellSize={cellSize}
          selected={selected}
          onCellTap={onCellTap}
        />
      </div>

      {/* Color counts with explicit short/extra deltas */}
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ color: T.dim, fontSize: 10, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 8, paddingLeft: 4 }}>
          {t.counts} · {t.expected} {expected}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          {HEX_BY_FACE.map((hex) => {
            const c = counts[hex] || 0;
            const delta = c - expected;
            const ok = delta === 0;
            const tag = delta > 0
              ? (lang === 'th' ? `+${delta} เกิน` : `+${delta} extra`)
              : delta < 0
                ? (lang === 'th' ? `${delta} ขาด` : `${delta} short`)
                : (lang === 'th' ? 'พอดี' : 'ok');
            return (
              <div key={hex} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                padding: '8px 10px', borderRadius: 14,
                background: ok ? 'rgba(0,224,183,0.10)' : 'rgba(255,77,109,0.12)',
                border: `1px solid ${ok ? 'rgba(0,224,183,0.4)' : 'rgba(255,77,109,0.5)'}`,
                minWidth: 64,
              }}>
                <div style={{
                  width: 18, height: 18, borderRadius: 4,
                  background: hex,
                  boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,0.3)',
                }} />
                <span style={{
                  color: ok ? T.accent2 : '#FF4D6D',
                  fontSize: 13, fontWeight: 700,
                  fontFamily: 'JetBrains Mono, ui-monospace, monospace',
                }}>{c}/{expected}</span>
                <span style={{
                  color: ok ? T.accent2 : '#FF4D6D',
                  fontSize: 9, fontWeight: 700, letterSpacing: 0.3,
                }}>{tag}</span>
              </div>
            );
          })}
        </div>
        {!isValid && (
          <div style={{
            marginTop: 14,
            background: 'rgba(255,77,109,0.10)',
            border: '1px solid rgba(255,77,109,0.35)',
            borderRadius: 14,
            padding: '12px 14px',
          }}>
            <div style={{
              color: '#FF4D6D', fontSize: 11, fontWeight: 700,
              letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 6,
            }}>
              {lang === 'th' ? '⚠ ตรวจสอบสีต่อไปนี้' : '⚠ Recheck these colors'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {HEX_BY_FACE.map((hex) => {
                const delta = (counts[hex] || 0) - expected;
                if (delta === 0) return null;
                const colorName = colorLabel(hex, lang);
                const msg = delta > 0
                  ? (lang === 'th'
                      ? `${colorName} เกินมา ${delta} ช่อง — แตะช่องที่ไม่ใช่ ${colorName} แล้วเปลี่ยนสี`
                      : `${colorName} has ${delta} extra cell${delta > 1 ? 's' : ''} — tap a non-${colorName} cell that's wrong and recolor`)
                  : (lang === 'th'
                      ? `${colorName} ขาดอีก ${-delta} ช่อง — มีช่องสีอื่นที่ควรเป็น ${colorName}`
                      : `${colorName} needs ${-delta} more — some cell currently a different color should be ${colorName}`);
                return (
                  <div key={hex} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    color: T.text, fontSize: 12, lineHeight: 1.4,
                  }}>
                    <div style={{
                      width: 12, height: 12, borderRadius: 3, flexShrink: 0,
                      background: hex,
                      boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,0.3)',
                    }} />
                    <span>{msg}</span>
                  </div>
                );
              })}
            </div>
            <div style={{
              marginTop: 8, color: T.muted, fontSize: 10, lineHeight: 1.4,
            }}>
              {lang === 'th'
                ? 'ผลรวมของทุกสีต้องเท่ากับ ' + (expected * 6) + ' (' + expected + ' ช่อง × 6 หน้า) จึงจะแก้ได้จริง'
                : 'All colors must total ' + (expected * 6) + ' (' + expected + ' cells × 6 faces) for the cube to be solvable'}
            </div>
          </div>
        )}
      </div>

      {/* Color picker */}
      <div style={{
        padding: '20px 16px 0',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
      }}>
        <div style={{ color: T.dim, fontSize: 10, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase' }}>
          {selected
            ? `${t.pickColor} · ${FACE_LABELS[lang][selected.face]} (${selected.idx + 1})`
            : t.pickColor}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {HEX_BY_FACE.map((hex) => (
            <button
              key={hex}
              onClick={() => onColorPick(hex)}
              disabled={!selected}
              style={{
                width: 44, height: 44, borderRadius: 12,
                background: hex,
                border: '1px solid rgba(255,255,255,0.15)',
                cursor: selected ? 'pointer' : 'default',
                opacity: selected ? 1 : 0.4,
                transition: 'opacity 0.2s, transform 0.1s',
                boxShadow: selected ? '0 4px 12px rgba(0,0,0,0.4)' : 'none',
              }}
              aria-label={hex}
            />
          ))}
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ padding: '20px 16px 0', display: 'flex', gap: 8 }}>
        <button onClick={reset} style={{
          flex: 1, padding: '14px 16px', borderRadius: 16,
          background: T.card, border: `1px solid ${T.border}`,
          color: T.muted, fontSize: 13, fontWeight: 700, letterSpacing: 0.3,
          cursor: 'pointer',
        }}>{t.resetEdits}</button>
        <button onClick={onRescan} style={{
          flex: 1, padding: '14px 16px', borderRadius: 16,
          background: T.card, border: `1px solid ${T.border}`,
          color: T.muted, fontSize: 13, fontWeight: 700, letterSpacing: 0.3,
          cursor: 'pointer',
        }}>{t.rescan}</button>
      </div>
      <div style={{ padding: '10px 16px 0' }}>
        <button
          onClick={() => isValid && onConfirm?.({ size: n, faces })}
          disabled={!isValid}
          style={{
            width: '100%', height: 52, borderRadius: 16,
            background: isValid
              ? `linear-gradient(135deg, ${T.accent2} 0%, #00B894 100%)`
              : T.cardHi,
            border: 'none',
            color: isValid ? '#fff' : T.dim,
            fontSize: 15, fontWeight: 700, letterSpacing: 0.3,
            cursor: isValid ? 'pointer' : 'not-allowed',
            boxShadow: isValid ? '0 8px 24px rgba(0,224,183,0.4)' : 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            opacity: isValid ? 1 : 0.6,
          }}>
          <CheckIcon /> {t.confirmSolve}
          <ArrowRight color={isValid ? '#fff' : T.dim} />
        </button>
      </div>
    </div>
  );
}

function CubeNetEditor({ faces, n, cellSize, selected, onCellTap }) {
  const gap = 2;
  const faceSize = cellSize * n + gap * (n - 1);
  const renderFace = (face) => (
    <div style={{
      width: faceSize + 8,
      height: faceSize + 8,
      padding: 4,
      borderRadius: 10,
      background: 'rgba(255,255,255,0.04)',
      border: `1px solid ${T.border}`,
      display: 'grid',
      gridTemplateColumns: `repeat(${n}, ${cellSize}px)`,
      gridTemplateRows: `repeat(${n}, ${cellSize}px)`,
      gap,
      boxSizing: 'border-box',
    }}>
      {(faces[face] || new Array(n * n).fill('#222')).map((hex, idx) => {
        const isSel = selected && selected.face === face && selected.idx === idx;
        return (
          <button
            key={idx}
            onClick={() => onCellTap(face, idx)}
            style={{
              width: cellSize, height: cellSize,
              borderRadius: 4,
              background: hex,
              border: isSel ? `2px solid ${T.accent2}` : '1px solid rgba(0,0,0,0.25)',
              padding: 0,
              cursor: 'pointer',
              boxShadow: isSel
                ? `0 0 0 2px ${T.accent2}66, 0 4px 10px rgba(0,224,183,0.4)`
                : 'inset 0 -2px 4px rgba(0,0,0,0.15), inset 0 2px 4px rgba(255,255,255,0.18)',
              transform: isSel ? 'scale(1.08)' : 'scale(1)',
              transition: 'transform 0.12s, box-shadow 0.12s',
            }}
            aria-label={`${face}${idx}`}
          />
        );
      })}
    </div>
  );

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(4, ${faceSize + 8 + gap}px)`,
      gridTemplateRows: `repeat(3, ${faceSize + 8 + gap}px)`,
      gap: gap,
      justifyContent: 'center',
    }}>
      <div />
      {renderFace('U')}
      <div />
      <div />
      {renderFace('L')}
      {renderFace('F')}
      {renderFace('R')}
      {renderFace('B')}
      <div />
      {renderFace('D')}
      <div />
      <div />
    </div>
  );
}

// Helpers
function emptyFaces(n) {
  const out = {};
  for (const f of FACE_ORDER) out[f] = new Array(n * n).fill(HEX_BY_FACE[0]);
  return out;
}

function deepClone(faces) {
  const out = {};
  for (const k of Object.keys(faces)) out[k] = (faces[k] || []).slice();
  return out;
}

function countColors(faces) {
  const counts = {};
  for (const hex of HEX_BY_FACE) counts[hex] = 0;
  for (const f of FACE_ORDER) {
    const arr = faces[f] || [];
    for (const c of arr) {
      if (counts[c] !== undefined) counts[c]++;
    }
  }
  return counts;
}

// Friendly per-color names so the recheck panel reads naturally in either language.
function colorLabel(hex, lang) {
  const map = {
    th: { '#FFFFFF': 'ขาว', '#B71234': 'แดง', '#009B48': 'เขียว', '#FFD500': 'เหลือง', '#FF5800': 'ส้ม', '#0046AD': 'น้ำเงิน' },
    en: { '#FFFFFF': 'White', '#B71234': 'Red', '#009B48': 'Green', '#FFD500': 'Yellow', '#FF5800': 'Orange', '#0046AD': 'Blue' },
  };
  return (map[lang] || map.en)[hex] || hex;
}
