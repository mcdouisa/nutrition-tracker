'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
const C = {
  bg:         '#0D0D0D',
  card:       '#1A1A1A',
  card2:      '#242424',
  border:     '#2C2C2C',
  accent:     '#0A84FF',
  accentBg:   'rgba(10,132,255,0.12)',
  accentGlow: 'rgba(10,132,255,0.4)',
  white:      '#FFFFFF',
  muted:      '#888888',
  faint:      '#3A3A3A',
  success:    '#30D158',
  successBg:  'rgba(48,209,88,0.12)',
};
const font = {
  heading: "'Barlow Condensed', sans-serif",
  body:    "'DM Sans', sans-serif",
  mono:    "'Courier New', 'Roboto Mono', monospace",
};

// ─── SET TYPE CONFIGS ─────────────────────────────────────────────────────────
const SET_TYPES = {
  working: { label: 'W', color: '#0A84FF', bg: 'rgba(10,132,255,0.15)',  name: 'Working Set' },
  drop:    { label: 'D', color: '#FF9F0A', bg: 'rgba(255,159,10,0.15)', name: 'Drop Set'    },
  amrap:   { label: 'A', color: '#BF5AF2', bg: 'rgba(191,90,242,0.15)', name: 'AMRAP'       },
};

const EXERCISES = ['Bench Press', 'Incline DB Press', 'Cable Fly', 'Tricep Pushdown', 'Dips'];

const INITIAL_SETS = [
  { id: 1, type: 'working', reps: '8',   weight: '185', rest: '90s',  logged: false },
  { id: 2, type: 'working', reps: '8',   weight: '185', rest: '90s',  logged: false },
  { id: 3, type: 'working', reps: '6',   weight: '195', rest: '120s', logged: false },
  { id: 4, type: 'drop',    reps: '10',  weight: '155', rest: '60s',  logged: false },
  { id: 5, type: 'amrap',   reps: '∞',   weight: '135', rest: '90s',  logged: false },
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function fmtTime(s) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}

// ─── REST TIMER OVERLAY ───────────────────────────────────────────────────────
function RestTimer({ total, onDone }) {
  const [rem, setRem] = useState(total);
  useEffect(() => {
    if (rem <= 0) { onDone(); return; }
    const t = setTimeout(() => setRem(r => r - 1), 1000);
    return () => clearTimeout(t);
  }, [rem, onDone]);
  const pct = ((total - rem) / total) * 100;
  const size = 110, sw = 7, r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ - (pct / 100) * circ;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(10px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: C.card, border: `1px solid ${C.border}`,
        borderRadius: 24, padding: '32px 40px',
        textAlign: 'center', minWidth: 260,
        boxShadow: '0 0 70px rgba(0,0,0,0.7)',
      }}>
        <p style={{ fontFamily: font.body, fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: 2.5, marginBottom: 22 }}>
          REST TIME
        </p>

        {/* Ring */}
        <div style={{ position: 'relative', width: size, height: size, margin: '0 auto 24px' }}>
          <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
            <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.border} strokeWidth={sw}/>
            <circle cx={size/2} cy={size/2} r={r} fill="none"
              stroke={C.accent} strokeWidth={sw}
              strokeDasharray={circ} strokeDashoffset={dash}
              strokeLinecap="round"
              style={{ filter: `drop-shadow(0 0 7px ${C.accent})`, transition: 'stroke-dashoffset 1s linear' }}
            />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
            <span style={{ fontFamily: font.heading, fontWeight: 900, fontSize: 32, color: C.white, lineHeight: 1 }}>{rem}</span>
            <span style={{ fontFamily: font.body, fontSize: 10, fontWeight: 600, color: C.muted, letterSpacing: 1 }}>SECS</span>
          </div>
        </div>

        <button onClick={onDone} style={{
          background: C.accentBg, border: `1px solid rgba(10,132,255,0.3)`,
          borderRadius: 11, padding: '10px 32px',
          fontFamily: font.body, fontSize: 14, fontWeight: 700, color: C.accent, cursor: 'pointer',
        }}>
          Skip Rest
        </button>
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function WorkoutLog() {
  const [sets, setSets]           = useState(INITIAL_SETS);
  const [elapsed, setElapsed]     = useState(0);
  const [useKg, setUseKg]         = useState(false);
  const [restTimer, setRestTimer] = useState(null);
  const [activeEx, setActiveEx]   = useState(0);

  // Session clock
  useEffect(() => {
    const t = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const logSet = (id) => {
    const set = sets.find(s => s.id === id);
    if (!set || set.logged) return;
    setSets(prev => prev.map(s => s.id === id ? { ...s, logged: true } : s));
    const secs = parseInt(set.rest) || 60;
    setRestTimer(secs);
  };

  const updateSet = (id, field, value) =>
    setSets(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));

  const addSet = () => {
    const newId = Math.max(...sets.map(s => s.id)) + 1;
    setSets(prev => [...prev, { id: newId, type: 'working', reps: '8', weight: '135', rest: '90s', logged: false }]);
  };

  const loggedCount = sets.filter(s => s.logged).length;
  const allDone = loggedCount === sets.length;

  return (
    <div style={{ fontFamily: font.body, background: C.bg, minHeight: '100dvh', color: C.white, overflowX: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;900&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { display: none; }
        button { cursor: pointer; font-family: inherit; }
        input  { outline: none; border: none; background: transparent; text-align: center; font-family: inherit; }
        input::-webkit-outer-spin-button, input::-webkit-inner-spin-button { -webkit-appearance: none; }
        input[type=number] { -moz-appearance: textfield; }
      `}</style>

      {restTimer && <RestTimer total={restTimer} onDone={() => setRestTimer(null)} />}

      {/* ── TOP BAR ─────────────────────────────────────────────────── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: `${C.bg}f2`, backdropFilter: 'blur(14px)',
        borderBottom: `1px solid ${C.border}`,
        padding: '10px 16px',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <Link href="/workout/detail" style={{ textDecoration: 'none' }}>
          <button style={{
            background: C.card2, border: `1px solid ${C.border}`,
            borderRadius: 10, padding: '7px 10px', color: C.white, lineHeight: 0,
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
        </Link>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: font.body, fontSize: 10, fontWeight: 700, color: C.muted, letterSpacing: 2 }}>NOW LOGGING</div>
          <div style={{ fontFamily: font.heading, fontWeight: 900, fontSize: 21, letterSpacing: 0.5, lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {EXERCISES[activeEx]}
          </div>
        </div>

        {/* Session timer */}
        <div style={{
          background: C.card, border: `1px solid ${C.border}`,
          borderRadius: 11, padding: '6px 12px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0,
        }}>
          <span style={{ fontFamily: font.mono, fontSize: 17, fontWeight: 700, color: C.accent, lineHeight: 1 }}>
            {fmtTime(elapsed)}
          </span>
          <span style={{ fontFamily: font.body, fontSize: 9, color: C.muted, fontWeight: 700, letterSpacing: 1 }}>TOTAL</span>
        </div>
      </header>

      {/* ── PROGRESS BAR ──────────────────────────────────────────────── */}
      <div style={{ padding: '10px 16px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: C.muted }}>{loggedCount} / {sets.length} sets logged</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: allDone ? C.success : C.accent }}>
            {Math.round((loggedCount / sets.length) * 100)}%
          </span>
        </div>
        <div style={{ height: 3, background: C.border, borderRadius: 2, overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 2,
            width: `${(loggedCount / sets.length) * 100}%`,
            background: allDone
              ? `linear-gradient(90deg, ${C.success}, #20b857)`
              : `linear-gradient(90deg, ${C.accent}, #5856D6)`,
            boxShadow: `0 0 8px ${allDone ? C.success : C.accent}77`,
            transition: 'width 0.45s ease',
          }} />
        </div>
      </div>

      {/* ── EXERCISE TABS ─────────────────────────────────────────────── */}
      <div style={{ padding: '10px 16px 0', display: 'flex', gap: 8, overflowX: 'auto' }}>
        {EXERCISES.map((ex, i) => (
          <button key={i} onClick={() => setActiveEx(i)} style={{
            flexShrink: 0,
            background: activeEx === i ? C.accentBg : C.card,
            border: `1px solid ${activeEx === i ? 'rgba(10,132,255,0.4)' : C.border}`,
            borderRadius: 10, padding: '6px 14px',
            fontSize: 11, fontWeight: 600,
            color: activeEx === i ? C.accent : C.muted,
            whiteSpace: 'nowrap',
            boxShadow: activeEx === i ? `0 0 12px rgba(10,132,255,0.15)` : 'none',
          }}>
            {ex}
          </button>
        ))}
      </div>

      {/* ── MAIN CONTENT ──────────────────────────────────────────────── */}
      <main style={{ padding: '14px 16px 160px' }}>

        {/* Column headers */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '40px 1fr 1fr 58px 46px',
          gap: 8, padding: '0 6px 8px',
          borderBottom: `1px solid ${C.border}`,
          marginBottom: 6,
        }}>
          {['TYPE', 'REPS', `WT (${useKg ? 'KG' : 'LBS'})`, 'REST', ''].map((h, i) => (
            <span key={i} style={{
              fontFamily: font.body, fontSize: 9, fontWeight: 700,
              color: C.muted, letterSpacing: 1.5, textAlign: 'center',
            }}>{h}</span>
          ))}
        </div>

        {/* Set rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {sets.map((set, idx) => {
            const type = SET_TYPES[set.type];
            return (
              <div key={set.id} style={{
                display: 'grid',
                gridTemplateColumns: '40px 1fr 1fr 58px 46px',
                gap: 8, alignItems: 'center',
                background: set.logged ? C.successBg : C.card,
                border: `1px solid ${set.logged ? 'rgba(48,209,88,0.28)' : C.border}`,
                borderRadius: 13, padding: '9px 6px',
                transition: 'all 0.25s ease',
              }}>

                {/* Type badge */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: type.bg, border: `1.5px solid ${type.color}44`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{ fontFamily: font.heading, fontWeight: 900, fontSize: 13, color: type.color }}>{type.label}</span>
                  </div>
                </div>

                {/* Reps input */}
                <div style={{
                  background: C.card2, border: `1px solid ${C.border}`,
                  borderRadius: 9, padding: '7px 4px', textAlign: 'center',
                }}>
                  <input
                    value={set.reps}
                    onChange={e => updateSet(set.id, 'reps', e.target.value)}
                    style={{
                      width: '100%', fontFamily: font.mono,
                      fontSize: 15, fontWeight: 700,
                      color: set.logged ? C.success : C.white,
                    }}
                  />
                </div>

                {/* Weight input */}
                <div style={{
                  background: C.card2, border: `1px solid ${C.border}`,
                  borderRadius: 9, padding: '7px 4px', textAlign: 'center',
                }}>
                  <input
                    type="number"
                    value={set.weight}
                    onChange={e => updateSet(set.id, 'weight', e.target.value)}
                    style={{
                      width: '100%', fontFamily: font.mono,
                      fontSize: 15, fontWeight: 700,
                      color: set.logged ? C.success : C.white,
                    }}
                  />
                </div>

                {/* Rest */}
                <div style={{ textAlign: 'center' }}>
                  <span style={{ fontFamily: font.mono, fontSize: 12, fontWeight: 600, color: C.muted }}>{set.rest}</span>
                </div>

                {/* Log button */}
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <button
                    onClick={() => logSet(set.id)}
                    disabled={set.logged}
                    style={{
                      width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                      background: set.logged
                        ? C.successBg
                        : `linear-gradient(135deg, ${C.accent}, #5856D6)`,
                      border: set.logged ? `2px solid rgba(48,209,88,0.45)` : 'none',
                      boxShadow: set.logged ? 'none' : `0 0 16px ${C.accentGlow}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: font.heading, fontWeight: 900, fontSize: 15,
                      color: set.logged ? C.success : C.white,
                      transition: 'all 0.2s ease',
                      cursor: set.logged ? 'default' : 'pointer',
                    }}
                  >
                    {set.logged ? (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.success} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    ) : idx + 1}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Add set */}
        <button onClick={addSet} style={{
          width: '100%', marginTop: 12,
          background: 'none', border: `1px dashed ${C.faint}`,
          borderRadius: 13, padding: '12px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          fontSize: 13, fontWeight: 600, color: C.muted,
          transition: 'border-color 0.15s ease',
        }}>
          <span style={{ fontSize: 20, lineHeight: 1, fontWeight: 300 }}>+</span>
          Add Set
        </button>

        {/* Legend */}
        <div style={{ display: 'flex', gap: 18, marginTop: 20, justifyContent: 'center', flexWrap: 'wrap' }}>
          {Object.entries(SET_TYPES).map(([, t]) => (
            <div key={t.name} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <div style={{
                width: 20, height: 20, borderRadius: '50%',
                background: t.bg, border: `1.5px solid ${t.color}44`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontFamily: font.heading, fontWeight: 900, fontSize: 10, color: t.color }}>{t.label}</span>
              </div>
              <span style={{ fontFamily: font.body, fontSize: 11, color: C.muted, fontWeight: 500 }}>{t.name}</span>
            </div>
          ))}
        </div>
      </main>

      {/* ── BOTTOM ACTION BAR ─────────────────────────────────────────── */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
        background: `${C.card}f8`, backdropFilter: 'blur(16px)',
        borderTop: `1px solid ${C.border}`,
        padding: '12px 16px',
        paddingBottom: 'max(env(safe-area-inset-bottom), 12px)',
        display: 'flex', gap: 12, alignItems: 'center',
      }}>
        {/* kg / lbs toggle */}
        <div style={{
          background: C.card2, border: `1px solid ${C.border}`,
          borderRadius: 11, padding: 3, display: 'flex', flexShrink: 0,
        }}>
          {['LBS', 'KG'].map(unit => {
            const isActive = unit === 'KG' ? useKg : !useKg;
            return (
              <button key={unit} onClick={() => setUseKg(unit === 'KG')} style={{
                background: isActive ? C.accent : 'none',
                border: 'none', borderRadius: 8, padding: '7px 15px',
                fontSize: 12, fontWeight: 700,
                color: isActive ? C.white : C.muted,
                transition: 'all 0.15s ease',
                boxShadow: isActive ? `0 0 12px ${C.accentGlow}` : 'none',
              }}>{unit}</button>
            );
          })}
        </div>

        {/* Done button */}
        <Link href="/workout/detail" style={{ flex: 1, textDecoration: 'none' }}>
          <button style={{
            width: '100%',
            background: allDone
              ? `linear-gradient(90deg, ${C.success}, #20c55e)`
              : `linear-gradient(90deg, ${C.accent}, #5856D6)`,
            border: 'none', borderRadius: 13, padding: '14px',
            fontFamily: font.heading, fontSize: 19, fontWeight: 700, letterSpacing: 2,
            color: C.white,
            boxShadow: `0 4px 22px ${allDone ? 'rgba(48,209,88,0.4)' : C.accentGlow}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            transition: 'background 0.3s ease, box-shadow 0.3s ease',
          }}>
            {allDone ? (
              <>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                WORKOUT DONE
              </>
            ) : (
              <>DONE  ✓</>
            )}
          </button>
        </Link>
      </div>
    </div>
  );
}
