'use client';
import { useState } from 'react';
import Link from 'next/link';

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
const C = {
  bg:         '#0D0D0D',
  card:       '#1A1A1A',
  card2:      '#222222',
  border:     '#2C2C2C',
  accent:     '#0A84FF',
  accentBg:   'rgba(10,132,255,0.12)',
  accentGlow: 'rgba(10,132,255,0.35)',
  white:      '#FFFFFF',
  muted:      '#888888',
  faint:      '#3A3A3A',
  success:    '#30D158',
};
const font = {
  heading: "'Barlow Condensed', sans-serif",
  body:    "'DM Sans', sans-serif",
};

// ─── SVG ICONS ────────────────────────────────────────────────────────────────
const Ico = {
  home: (a) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={a ? C.accent : C.faint}>
      <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
    </svg>
  ),
  dumbbell: (a) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={a ? C.accent : C.faint} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="10" width="4" height="4" rx="1"/>
      <rect x="18" y="10" width="4" height="4" rx="1"/>
      <rect x="5" y="8" width="3" height="8" rx="1"/>
      <rect x="16" y="8" width="3" height="8" rx="1"/>
      <line x1="8" y1="12" x2="16" y2="12"/>
    </svg>
  ),
  friends: (a) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={a ? C.accent : C.faint}>
      <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
    </svg>
  ),
  store: (a) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={a ? C.accent : C.faint}>
      <path d="M7 18c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm10 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zM5.2 5H3V3H1v2h2l3.6 7.59L5.25 15c-.16.28-.25.61-.25.96C5 17.1 5.9 18 7 18h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63H19c.75 0 1.41-.41 1.75-1.03l3.58-6.49A1 1 0 0023.45 5H5.2z"/>
    </svg>
  ),
  person: (a) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={a ? C.accent : C.faint}>
      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
    </svg>
  ),
  bell: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={C.muted}>
      <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>
    </svg>
  ),
  heart: (filled) => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill={filled ? '#FF453A' : 'none'} stroke={filled ? '#FF453A' : C.faint} strokeWidth="2">
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
    </svg>
  ),
  bookmark: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.faint} strokeWidth="2" strokeLinecap="round">
      <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>
    </svg>
  ),
  check: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.success} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  arrowRight: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="5" y1="12" x2="19" y2="12"/>
      <polyline points="12 5 19 12 12 19"/>
    </svg>
  ),
  menu: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.white} strokeWidth="2" strokeLinecap="round">
      <line x1="3" y1="6" x2="21" y2="6"/>
      <line x1="3" y1="12" x2="21" y2="12"/>
      <line x1="3" y1="18" x2="15" y2="18"/>
    </svg>
  ),
};

// ─── CIRCULAR PROGRESS RING ───────────────────────────────────────────────────
function ProgressRing({ pct = 67, size = 76, sw = 5 }) {
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ - (pct / 100) * circ;
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.border} strokeWidth={sw} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={C.accent} strokeWidth={sw}
          strokeDasharray={circ} strokeDashoffset={dash}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 5px ${C.accent}99)` }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 1,
      }}>
        <span style={{ fontFamily: font.body, fontWeight: 700, fontSize: 15, color: C.white, lineHeight: 1 }}>{pct}%</span>
        <span style={{ fontFamily: font.body, fontWeight: 500, fontSize: 9, color: C.muted, lineHeight: 1, letterSpacing: 1 }}>DONE</span>
      </div>
    </div>
  );
}

// ─── WORKOUT DATA ─────────────────────────────────────────────────────────────
const DAYS = [
  { id: 1, day: 1, name: 'Chest & Triceps',   duration: 60, completed: true,  grad: 'linear-gradient(135deg,#0a1628,#1a2744)', accent: '#0A84FF' },
  { id: 2, day: 2, name: 'Back & Biceps',      duration: 55, completed: true,  grad: 'linear-gradient(135deg,#0a2818,#183a22)', accent: '#30D158' },
  { id: 3, day: 3, name: 'Legs & Glutes',      duration: 70, completed: true,  grad: 'linear-gradient(135deg,#280a0a,#3a1010)', accent: '#FF453A' },
  { id: 4, day: 4, name: 'Shoulders & Traps',  duration: 50, completed: false, grad: 'linear-gradient(135deg,#1a0a28,#2a1440)', accent: '#BF5AF2' },
  { id: 5, day: 5, name: 'Arms',               duration: 45, completed: false, grad: 'linear-gradient(135deg,#28180a,#3a2810)', accent: '#FF9F0A' },
];

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function WorkoutHome() {
  const [liked, setLiked] = useState({});

  return (
    <div style={{ fontFamily: font.body, background: C.bg, minHeight: '100dvh', color: C.white, overflowX: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;900&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { display: none; }
        button { cursor: pointer; font-family: inherit; }
      `}</style>

      {/* ── HEADER ─────────────────────────────────────────────────── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: `${C.bg}ee`, backdropFilter: 'blur(16px)',
        borderBottom: `1px solid ${C.border}`,
        padding: '12px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <button style={{ background: 'none', border: 'none', padding: 4, lineHeight: 0 }}>
          {Ico.menu()}
        </button>
        <span style={{ fontFamily: font.heading, fontWeight: 900, fontSize: 22, letterSpacing: 4, color: C.white }}>
          LYTZ
        </span>
        <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
          <button style={{ background: 'none', border: 'none', lineHeight: 0 }}>{Ico.bell()}</button>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'linear-gradient(135deg, #0A84FF, #5856D6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 700, color: C.white, flexShrink: 0,
          }}>I</div>
        </div>
      </header>

      {/* ── SCROLLABLE CONTENT ─────────────────────────────────────── */}
      <main style={{ padding: '20px 16px 100px' }}>

        {/* Greeting */}
        <div style={{ marginBottom: 22 }}>
          <p style={{ color: C.muted, fontSize: 12, fontWeight: 600, letterSpacing: 2, marginBottom: 4 }}>GOOD MORNING</p>
          <h1 style={{ fontFamily: font.heading, fontWeight: 900, fontSize: 36, letterSpacing: 1, lineHeight: 1 }}>
            READY TO<br />TRAIN?
          </h1>
        </div>

        {/* ── ACTIVE PROGRAM HERO CARD ──────────────────────────────── */}
        <div style={{
          background: 'linear-gradient(145deg,#0a0f1e 0%,#111827 55%,#0d0d0d 100%)',
          border: `1px solid ${C.border}`,
          borderRadius: 22,
          padding: '20px 20px 16px',
          marginBottom: 28,
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Ambient glow blobs */}
          <div style={{ position: 'absolute', top: -50, right: -50, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle,rgba(10,132,255,0.09) 0%,transparent 70%)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: -30, left: 10, width: 140, height: 140, borderRadius: '50%', background: 'radial-gradient(circle,rgba(88,86,214,0.07) 0%,transparent 70%)', pointerEvents: 'none' }} />

          {/* Top row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
            <div style={{ flex: 1 }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: C.accentBg, border: `1px solid rgba(10,132,255,0.3)`,
                borderRadius: 6, padding: '3px 10px', marginBottom: 10,
              }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.accent, boxShadow: `0 0 6px ${C.accent}` }} />
                <span style={{ fontFamily: font.body, fontSize: 10, fontWeight: 700, color: C.accent, letterSpacing: 2 }}>ACTIVE PROGRAM</span>
              </div>
              <h2 style={{
                fontFamily: font.heading, fontWeight: 900, fontSize: 36,
                letterSpacing: 1, lineHeight: 1, color: C.white, textTransform: 'uppercase',
              }}>
                POWER<br />BUILDING
              </h2>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
                <span style={{ background: '#242424', borderRadius: 6, padding: '3px 10px', fontSize: 10, fontWeight: 700, color: C.muted, letterSpacing: 1 }}>
                  WEEK 4 OF 12
                </span>
                <span style={{ fontSize: 11, color: C.faint }}>•</span>
                <span style={{ fontSize: 11, color: C.muted, fontWeight: 500 }}>3 days left</span>
              </div>
            </div>
            <ProgressRing pct={67} />
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: C.border, marginBottom: 16 }} />

          {/* Continue CTA */}
          <Link href="/workout/detail" style={{ textDecoration: 'none' }}>
            <button style={{
              width: '100%',
              background: `linear-gradient(90deg, ${C.accent} 0%, #5856D6 100%)`,
              border: 'none', borderRadius: 14, padding: '13px 18px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              boxShadow: `0 4px 22px ${C.accentGlow}`,
              color: C.white,
            }}>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontFamily: font.body, fontSize: 10, fontWeight: 600, opacity: 0.75, marginBottom: 2, letterSpacing: 1 }}>NEXT UP</div>
                <div style={{ fontFamily: font.heading, fontWeight: 700, fontSize: 19, letterSpacing: 0.5 }}>
                  Day 4 — Shoulders
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontFamily: font.body, fontSize: 12, fontWeight: 700, letterSpacing: 1 }}>START</span>
                {Ico.arrowRight()}
              </div>
            </button>
          </Link>
        </div>

        {/* ── THIS WEEK ─────────────────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ fontFamily: font.heading, fontWeight: 700, fontSize: 20, letterSpacing: 2 }}>THIS WEEK</h3>
          <button style={{ background: 'none', border: 'none', color: C.accent, fontSize: 13, fontWeight: 600 }}>
            See All
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {DAYS.map((w) => (
            <Link key={w.id} href="/workout/detail" style={{ textDecoration: 'none' }}>
              <div style={{
                background: C.card,
                border: `1px solid ${C.border}`,
                borderRadius: 16,
                padding: '12px 14px',
                display: 'flex', alignItems: 'center', gap: 14,
              }}>
                {/* Thumbnail */}
                <div style={{
                  width: 60, height: 60, borderRadius: 12, flexShrink: 0,
                  background: w.grad,
                  border: `1px solid ${C.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  position: 'relative', overflow: 'hidden',
                }}>
                  <div style={{
                    position: 'absolute', top: 6, right: 6,
                    width: 22, height: 22, borderRadius: '50%',
                    background: `radial-gradient(circle, ${w.accent}55, transparent)`,
                    filter: 'blur(5px)',
                  }} />
                  <span style={{ fontFamily: font.heading, fontWeight: 900, fontSize: 20, color: w.accent, position: 'relative', zIndex: 1 }}>
                    {w.day}
                  </span>
                  {w.completed && (
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: 'rgba(48,209,88,0.18)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {Ico.check()}
                    </div>
                  )}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: font.heading, fontWeight: 700, fontSize: 17, letterSpacing: 0.5,
                    color: w.completed ? C.muted : C.white,
                    textDecoration: w.completed ? 'line-through' : 'none',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {w.name}
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 5, alignItems: 'center' }}>
                    <span style={{ background: C.card2, borderRadius: 5, padding: '2px 8px', fontSize: 10, fontWeight: 700, color: C.muted, letterSpacing: 1 }}>
                      DAY {w.day}
                    </span>
                    <span style={{ background: C.card2, borderRadius: 5, padding: '2px 8px', fontSize: 10, fontWeight: 700, color: C.muted, letterSpacing: 1 }}>
                      {w.duration} MINS
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
                  <button
                    onClick={e => { e.preventDefault(); setLiked(l => ({ ...l, [w.id]: !l[w.id] })); }}
                    style={{ background: 'none', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, lineHeight: 0 }}
                  >
                    {Ico.heart(liked[w.id])}
                    <span style={{ fontSize: 9, color: C.faint, fontWeight: 600 }}>24</span>
                  </button>
                  <button
                    onClick={e => e.preventDefault()}
                    style={{ background: 'none', border: 'none', lineHeight: 0 }}
                  >
                    {Ico.bookmark()}
                  </button>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </main>

      {/* ── BOTTOM NAV ─────────────────────────────────────────────── */}
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: `${C.card}f8`, backdropFilter: 'blur(16px)',
        borderTop: `1px solid ${C.border}`,
        display: 'flex',
        paddingBottom: 'max(env(safe-area-inset-bottom), 8px)',
        zIndex: 100,
      }}>
        {[
          { label: 'Home',     icon: Ico.home,     active: true  },
          { label: 'Workouts', icon: Ico.dumbbell, active: false },
          { label: 'Friends',  icon: Ico.friends,  active: false },
          { label: 'Market',   icon: Ico.store,    active: false },
          { label: 'Profile',  icon: Ico.person,   active: false },
        ].map((t) => (
          <button key={t.label} style={{
            flex: 1, padding: '10px 0 6px',
            background: 'none', border: 'none',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
          }}>
            <div style={{ filter: t.active ? `drop-shadow(0 0 6px ${C.accent})` : 'none', lineHeight: 0 }}>
              {t.icon(t.active)}
            </div>
            <span style={{ fontSize: 10, fontWeight: t.active ? 700 : 500, color: t.active ? C.accent : C.faint, letterSpacing: 0.5 }}>
              {t.label}
            </span>
          </button>
        ))}
      </nav>
    </div>
  );
}
