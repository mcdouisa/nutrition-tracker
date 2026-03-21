'use client';
import { useState } from 'react';
import Link from 'next/link';

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
const C = {
  bg:       '#0D0D0D',
  card:     '#1A1A1A',
  card2:    '#222222',
  border:   '#2C2C2C',
  accent:   '#0A84FF',
  accentBg: 'rgba(10,132,255,0.12)',
  accentGlow:'rgba(10,132,255,0.35)',
  white:    '#FFFFFF',
  muted:    '#888888',
  faint:    '#3A3A3A',
  success:  '#30D158',
};
const font = {
  heading: "'Barlow Condensed', sans-serif",
  body:    "'DM Sans', sans-serif",
};

// ─── DATA ─────────────────────────────────────────────────────────────────────
const EXERCISES = [
  { name: 'Barbell Bench Press',       sets: 4, reps: '6–8',   weight: '185 lbs' },
  { name: 'Incline Dumbbell Press',    sets: 3, reps: '10–12', weight: '70 lbs'  },
  { name: 'Cable Fly',                 sets: 3, reps: '12–15', weight: '40 lbs'  },
  { name: 'Overhead Tricep Extension', sets: 3, reps: '10–12', weight: '90 lbs'  },
  { name: 'Tricep Pushdown',           sets: 3, reps: '12–15', weight: '55 lbs'  },
  { name: 'Dips',                      sets: 3, reps: '8–10',  weight: 'BW'      },
  { name: 'Chest Press Machine',       sets: 3, reps: '10–12', weight: '120 lbs' },
  { name: 'Skull Crushers',            sets: 3, reps: '10–12', weight: '65 lbs'  },
];
const TAGS      = ['Chest', 'Triceps', 'Shoulders'];
const EQUIPMENT = ['Barbell', 'Dumbbells', 'Cable Machine', 'Bench', 'EZ-Bar'];

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function WorkoutDetail() {
  const [favorited, setFavorited] = useState(false);
  const [scheduled, setScheduled] = useState(false);
  const [markedOff, setMarkedOff]  = useState(false);
  const totalSets = EXERCISES.reduce((s, e) => s + e.sets, 0);

  return (
    <div style={{ fontFamily: font.body, background: C.bg, minHeight: '100dvh', color: C.white, overflowX: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;900&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { display: none; }
        button { cursor: pointer; font-family: inherit; }
      `}</style>

      {/* ── HERO HEADER ────────────────────────────────────────────── */}
      <div style={{
        height: 230, position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(160deg,#060d1a 0%,#0e1a30 35%,#111827 65%,#0a0a0a 100%)',
      }}>
        {/* Decorative glows */}
        <div style={{ position: 'absolute', top: -70, left: -50, width: 260, height: 260, borderRadius: '50%', background: 'radial-gradient(circle,rgba(10,132,255,0.14) 0%,transparent 65%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: 0, right: -30, width: 220, height: 200, background: 'radial-gradient(ellipse at 100% 100%,rgba(88,86,214,0.1) 0%,transparent 60%)', pointerEvents: 'none' }} />
        {/* Fine grid texture overlay */}
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.04,
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.5) 1px,transparent 1px)',
          backgroundSize: '32px 32px',
          pointerEvents: 'none',
        }} />

        {/* Top bar */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
          padding: '14px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'linear-gradient(to bottom,rgba(0,0,0,0.55),transparent)',
        }}>
          <Link href="/workout" style={{ textDecoration: 'none' }}>
            <button style={{
              background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)',
              borderRadius: 10, padding: '6px 12px',
              display: 'flex', alignItems: 'center', gap: 5,
              color: C.white, backdropFilter: 'blur(8px)',
            }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
              <span style={{ fontFamily: font.body, fontSize: 13, fontWeight: 600 }}>Back</span>
            </button>
          </Link>

          {/* Circular timer widget */}
          <div style={{
            background: 'rgba(0,0,0,0.55)', border: `1px solid rgba(10,132,255,0.45)`,
            borderRadius: 22, padding: '6px 14px',
            display: 'flex', alignItems: 'center', gap: 7,
            backdropFilter: 'blur(10px)',
            boxShadow: '0 0 24px rgba(10,132,255,0.18)',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="2.2">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
            <span style={{ fontFamily: font.body, fontSize: 13, fontWeight: 700, color: C.accent, letterSpacing: 0.5 }}>60:00</span>
          </div>
        </div>

        {/* Workout title — bottom of hero */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10,
          padding: '0 18px 18px',
          background: 'linear-gradient(to top,rgba(13,13,13,0.95) 0%,rgba(13,13,13,0.4) 60%,transparent 100%)',
        }}>
          <div style={{ marginBottom: 6 }}>
            <span style={{
              background: C.accentBg, border: `1px solid rgba(10,132,255,0.35)`,
              borderRadius: 6, padding: '2px 9px',
              fontSize: 10, fontWeight: 700, color: C.accent, letterSpacing: 2,
            }}>DAY 4</span>
          </div>
          <h1 style={{
            fontFamily: font.heading, fontWeight: 900, fontSize: 40,
            letterSpacing: 1, lineHeight: 1, color: C.white, textTransform: 'uppercase',
          }}>
            CHEST &amp;<br />TRICEPS
          </h1>
        </div>
      </div>

      {/* ── CONTENT ────────────────────────────────────────────────── */}
      <div style={{ padding: '0 16px 100px' }}>

        {/* Muscle group tags */}
        <div style={{ display: 'flex', gap: 8, padding: '14px 0 2px', flexWrap: 'wrap' }}>
          {TAGS.map((tag) => (
            <span key={tag} style={{
              background: C.card, border: `1px solid ${C.border}`,
              borderRadius: 20, padding: '5px 16px',
              fontSize: 12, fontWeight: 600, color: C.white, letterSpacing: 0.5,
            }}>{tag}</span>
          ))}
        </div>

        {/* ── STATS BAR ─────────────────────────────────────────────── */}
        <div style={{
          background: 'linear-gradient(90deg,rgba(10,132,255,0.18),rgba(88,86,214,0.12))',
          border: `1px solid rgba(10,132,255,0.28)`,
          borderRadius: 14, padding: '14px 24px',
          display: 'flex', alignItems: 'stretch',
          margin: '14px 0 20px',
          boxShadow: '0 0 30px rgba(10,132,255,0.08)',
        }}>
          <div style={{ flex: 1, textAlign: 'center', borderRight: `1px solid rgba(10,132,255,0.2)`, paddingRight: 24 }}>
            <div style={{ fontFamily: font.heading, fontWeight: 900, fontSize: 34, color: C.accent, lineHeight: 1 }}>
              {totalSets}
            </div>
            <div style={{ fontFamily: font.body, fontSize: 10, fontWeight: 700, color: C.muted, letterSpacing: 2, marginTop: 3 }}>
              SETS
            </div>
          </div>
          <div style={{ flex: 1, textAlign: 'center', paddingLeft: 24 }}>
            <div style={{ fontFamily: font.heading, fontWeight: 900, fontSize: 34, color: C.accent, lineHeight: 1 }}>
              {EXERCISES.length}
            </div>
            <div style={{ fontFamily: font.body, fontSize: 10, fontWeight: 700, color: C.muted, letterSpacing: 2, marginTop: 3 }}>
              EXERCISES
            </div>
          </div>
        </div>

        {/* Equipment */}
        <div style={{ marginBottom: 22 }}>
          <h4 style={{ fontFamily: font.heading, fontWeight: 700, fontSize: 13, letterSpacing: 2.5, color: C.muted, marginBottom: 10 }}>
            EQUIPMENT
          </h4>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {EQUIPMENT.map((eq) => (
              <span key={eq} style={{
                background: C.card2, border: `1px solid ${C.border}`,
                borderRadius: 8, padding: '5px 13px',
                fontSize: 12, fontWeight: 500, color: C.muted,
              }}>{eq}</span>
            ))}
          </div>
        </div>

        {/* ── ACTION BUTTONS ────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
          {[
            {
              label: 'Favorite', active: favorited,
              onClick: () => setFavorited(f => !f),
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill={favorited ? '#FF453A' : 'none'} stroke={favorited ? '#FF453A' : C.muted} strokeWidth="2">
                  <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
                </svg>
              ),
            },
            {
              label: 'Schedule', active: scheduled,
              onClick: () => setScheduled(s => !s),
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={scheduled ? C.accent : C.muted} strokeWidth="2" strokeLinecap="round">
                  <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
              ),
            },
            {
              label: 'History', active: false,
              onClick: () => {},
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                </svg>
              ),
            },
            {
              label: markedOff ? 'Completed!' : 'Mark Off', active: markedOff,
              onClick: () => setMarkedOff(m => !m),
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={markedOff ? C.success : C.muted} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              ),
            },
          ].map((btn) => (
            <button key={btn.label} onClick={btn.onClick} style={{
              background: btn.active ? C.accentBg : C.card,
              border: `1px solid ${btn.active ? 'rgba(10,132,255,0.35)' : C.border}`,
              borderRadius: 14, padding: '14px 16px',
              display: 'flex', alignItems: 'center', gap: 10,
              color: btn.active ? C.accent : C.muted,
              fontSize: 14, fontWeight: 600,
              transition: 'all 0.15s ease',
            }}>
              {btn.icon}
              {btn.label}
            </button>
          ))}
        </div>

        {/* ── START WORKOUT CTA ─────────────────────────────────────── */}
        <Link href="/workout/log" style={{ textDecoration: 'none' }}>
          <button style={{
            width: '100%',
            background: `linear-gradient(90deg, ${C.accent}, #5856D6)`,
            border: 'none', borderRadius: 15, padding: '16px',
            fontFamily: font.heading, fontSize: 21, fontWeight: 700, letterSpacing: 2,
            color: C.white, marginBottom: 28,
            boxShadow: `0 4px 28px ${C.accentGlow}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill={C.white}>
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
            START WORKOUT
          </button>
        </Link>

        {/* ── EXERCISE LIST ─────────────────────────────────────────── */}
        <h4 style={{ fontFamily: font.heading, fontWeight: 700, fontSize: 14, letterSpacing: 2.5, color: C.muted, marginBottom: 12 }}>
          EXERCISES
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {EXERCISES.map((ex, i) => (
            <div key={i} style={{
              background: C.card, border: `1px solid ${C.border}`,
              borderRadius: 13, padding: '12px 14px',
              display: 'flex', alignItems: 'center', gap: 14,
            }}>
              {/* Number badge */}
              <div style={{
                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                background: C.card2, border: `1px solid ${C.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: font.heading, fontWeight: 900, fontSize: 16, color: C.muted,
              }}>{i + 1}</div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: font.body, fontSize: 14, fontWeight: 600, color: C.white }}>{ex.name}</div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 3, fontWeight: 500 }}>
                  {ex.sets} sets × {ex.reps} reps
                  <span style={{ color: C.faint }}> · </span>
                  {ex.weight}
                </div>
              </div>

              {/* Chevron */}
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.faint} strokeWidth="2" strokeLinecap="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
