'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  getPrograms, savePrograms, getActiveProgramId, setActiveProgramId,
  getSessions, getCompletedDaysThisWeek, setCurrentWorkout,
  syncProgramsToFirestore, loadProgramsFromFirestore,
} from '../../lib/workoutSync';
import { useAuth } from '../../lib/AuthContext';

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
  successBg:  'rgba(48,209,88,0.1)',
};
const font = { heading: "'Barlow Condensed', sans-serif", body: "'DM Sans', sans-serif" };

const GRAD_OPTIONS = [
  { grad: 'linear-gradient(135deg,#0a1628,#1a2744)', accent: '#0A84FF' },
  { grad: 'linear-gradient(135deg,#0a2818,#183a22)', accent: '#30D158' },
  { grad: 'linear-gradient(135deg,#280a0a,#3a1010)', accent: '#FF453A' },
  { grad: 'linear-gradient(135deg,#1a0a28,#2a1440)', accent: '#BF5AF2' },
  { grad: 'linear-gradient(135deg,#28180a,#3a2810)', accent: '#FF9F0A' },
];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'GOOD MORNING';
  if (h < 17) return 'GOOD AFTERNOON';
  return 'GOOD EVENING';
}

function ProgressRing({ pct = 0, size = 76, sw = 5 }) {
  const r = (size - sw) / 2, circ = 2 * Math.PI * r;
  const dash = circ - (pct / 100) * circ;
  return (
    <div style={{ position:'relative', width:size, height:size, flexShrink:0 }}>
      <svg width={size} height={size} style={{ transform:'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.border} strokeWidth={sw}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.accent} strokeWidth={sw}
          strokeDasharray={circ} strokeDashoffset={dash} strokeLinecap="round"
          style={{ filter:`drop-shadow(0 0 5px ${C.accent}99)`, transition:'stroke-dashoffset 0.6s ease' }}/>
      </svg>
      <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:1 }}>
        <span style={{ fontFamily:font.body, fontWeight:700, fontSize:15, color:C.white, lineHeight:1 }}>{pct}%</span>
        <span style={{ fontFamily:font.body, fontWeight:500, fontSize:9, color:C.muted, lineHeight:1, letterSpacing:1 }}>DONE</span>
      </div>
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function WorkoutHome() {
  const router = useRouter();
  const { user } = useAuth();

  const [programs,        setPrograms]        = useState([]);
  const [activeProgramId, setActivePId]       = useState(null);
  const [sessions,        setSessions]        = useState([]);
  const [showProgramMenu, setShowProgramMenu] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddDay,      setShowAddDay]      = useState(false);
  const [newName,         setNewName]         = useState('');
  const [newDesc,         setNewDesc]         = useState('');
  const [newDays,         setNewDays]         = useState([{ name: 'Day 1' }]);
  const [newDayName,      setNewDayName]      = useState('');

  useEffect(() => {
    const progs = getPrograms();
    const activeId = getActiveProgramId();
    setPrograms(progs);
    setActivePId(activeId);
    setSessions(getSessions());
  }, []);

  useEffect(() => {
    if (!user) return;
    loadProgramsFromFirestore(user.uid).then((remote) => {
      if (remote && remote.length > 0) {
        setPrograms(remote);
        savePrograms(remote);
      }
    });
  }, [user]);

  const activeProgram     = programs.find(p => p.id === activeProgramId) || programs[0];
  const completedThisWeek = activeProgram ? getCompletedDaysThisWeek(sessions, activeProgram.id) : new Set();
  const totalDays         = activeProgram?.days?.length || 0;
  const doneDays          = completedThisWeek.size;
  const pct               = totalDays > 0 ? Math.round((doneDays / totalDays) * 100) : 0;
  const recentSessions    = sessions.slice(0, 3);

  function openDay(day) {
    setCurrentWorkout(activeProgram.id, day.id);
    router.push('/workout/detail');
  }

  function switchProgram(id) {
    setActiveProgramId(id);
    setActivePId(id);
    setShowProgramMenu(false);
  }

  function createProgram() {
    if (!newName.trim() || newDays.length === 0) return;
    const id = `prog-${Date.now()}`;
    const program = {
      id, name: newName.trim(), description: newDesc.trim(),
      createdAt: new Date().toISOString(),
      days: newDays.map((d, i) => ({
        id: `${id}-d${i + 1}`, dayNumber: i + 1, name: d.name,
        grad: GRAD_OPTIONS[i % 5].grad, accent: GRAD_OPTIONS[i % 5].accent,
        exercises: [],
      })),
    };
    const updated = [...programs, program];
    setPrograms(updated);
    savePrograms(updated);
    setActiveProgramId(id);
    setActivePId(id);
    if (user) syncProgramsToFirestore(user.uid, updated);
    setShowCreateModal(false);
    setNewName(''); setNewDesc(''); setNewDays([{ name: 'Day 1' }]);
  }

  function addDayToForm() {
    if (!newDayName.trim()) return;
    setNewDays(prev => [...prev, { name: newDayName.trim() }]);
    setNewDayName('');
    setShowAddDay(false);
  }

  return (
    <div style={{ fontFamily:font.body, background:C.bg, minHeight:'100dvh', color:C.white, overflowX:'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;900&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{display:none}
        button{cursor:pointer;font-family:inherit}
        input,textarea{outline:none;font-family:inherit}
      `}</style>

      {/* HEADER */}
      <header style={{
        position:'sticky', top:0, zIndex:50,
        background:`${C.bg}ee`, backdropFilter:'blur(16px)',
        borderBottom:`1px solid ${C.border}`,
        padding:'12px 20px', display:'flex', alignItems:'center', justifyContent:'space-between',
      }}>
        <button onClick={() => router.push('/')} style={{ background:'none', border:'none', padding:4, lineHeight:0 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.white} strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6"  x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="15" y2="18"/>
          </svg>
        </button>
        <span style={{ fontFamily:font.heading, fontWeight:900, fontSize:22, letterSpacing:4, color:C.white }}>LYTZ</span>
        <button onClick={() => setShowProgramMenu(true)} style={{
          background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:'6px 12px',
          fontSize:12, fontWeight:600, color:C.muted, display:'flex', alignItems:'center', gap:5,
        }}>
          Programs
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
      </header>

      <main style={{ padding:'20px 16px 120px' }}>
        <div style={{ marginBottom:22 }}>
          <p style={{ color:C.muted, fontSize:12, fontWeight:600, letterSpacing:2, marginBottom:4 }}>{greeting()}</p>
          <h1 style={{ fontFamily:font.heading, fontWeight:900, fontSize:36, letterSpacing:1, lineHeight:1 }}>
            READY TO<br/>TRAIN?
          </h1>
        </div>

        {activeProgram ? (
          <>
            {/* ACTIVE PROGRAM HERO */}
            <div style={{
              background:'linear-gradient(145deg,#0a0f1e 0%,#111827 55%,#0d0d0d 100%)',
              border:`1px solid ${C.border}`, borderRadius:22, padding:'20px 20px 16px',
              marginBottom:28, position:'relative', overflow:'hidden',
            }}>
              <div style={{ position:'absolute', top:-50, right:-50, width:200, height:200, borderRadius:'50%', background:'radial-gradient(circle,rgba(10,132,255,0.09) 0%,transparent 70%)', pointerEvents:'none' }}/>
              <div style={{ position:'absolute', bottom:-30, left:10, width:140, height:140, borderRadius:'50%', background:'radial-gradient(circle,rgba(88,86,214,0.07) 0%,transparent 70%)', pointerEvents:'none' }}/>

              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:18 }}>
                <div style={{ flex:1 }}>
                  <div style={{
                    display:'inline-flex', alignItems:'center', gap:6,
                    background:C.accentBg, border:`1px solid rgba(10,132,255,0.3)`,
                    borderRadius:6, padding:'3px 10px', marginBottom:10,
                  }}>
                    <div style={{ width:6, height:6, borderRadius:'50%', background:C.accent, boxShadow:`0 0 6px ${C.accent}` }}/>
                    <span style={{ fontFamily:font.body, fontSize:10, fontWeight:700, color:C.accent, letterSpacing:2 }}>ACTIVE PROGRAM</span>
                  </div>
                  <h2 style={{ fontFamily:font.heading, fontWeight:900, fontSize:28, letterSpacing:0.5, lineHeight:1.1, marginBottom:4, color:C.white }}>
                    {activeProgram.name.toUpperCase()}
                  </h2>
                  {activeProgram.description && (
                    <p style={{ fontSize:12, color:C.muted, fontWeight:500 }}>{activeProgram.description}</p>
                  )}
                </div>
                <ProgressRing pct={pct}/>
              </div>

              <div style={{ display:'flex', gap:16 }}>
                {[
                  { value: totalDays, label: 'DAYS', color: C.accent },
                  { value: doneDays,  label: 'THIS WEEK', color: C.success },
                  { value: sessions.filter(s => s.programId === activeProgram.id).length, label: 'TOTAL', color: C.white },
                ].map((stat, i, arr) => (
                  <div key={stat.label} style={{ display:'flex', alignItems:'stretch', gap:16 }}>
                    <div>
                      <div style={{ fontFamily:font.heading, fontWeight:900, fontSize:26, color:stat.color, lineHeight:1 }}>{stat.value}</div>
                      <div style={{ fontSize:10, fontWeight:700, color:C.muted, letterSpacing:1.5 }}>{stat.label}</div>
                    </div>
                    {i < arr.length - 1 && <div style={{ width:1, background:C.border }}/>}
                  </div>
                ))}
              </div>
            </div>

            {/* WORKOUT DAYS */}
            <h4 style={{ fontFamily:font.heading, fontWeight:700, fontSize:13, letterSpacing:2.5, color:C.muted, marginBottom:12 }}>
              WORKOUT DAYS
            </h4>
            <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:32 }}>
              {activeProgram.days.map((day) => {
                const done = completedThisWeek.has(day.id);
                return (
                  <button key={day.id} onClick={() => openDay(day)} style={{
                    background: done ? C.successBg : day.grad,
                    border:`1px solid ${done ? 'rgba(48,209,88,0.3)' : C.border}`,
                    borderRadius:16, overflow:'hidden', textAlign:'left', cursor:'pointer',
                  }}>
                    <div style={{ padding:'16px 18px', display:'flex', alignItems:'center', gap:14 }}>
                      <div style={{
                        width:44, height:44, borderRadius:12, flexShrink:0,
                        background: done ? 'rgba(48,209,88,0.2)' : `${day.accent}22`,
                        border:`1.5px solid ${done ? 'rgba(48,209,88,0.5)' : `${day.accent}55`}`,
                        display:'flex', alignItems:'center', justifyContent:'center',
                        fontFamily:font.heading, fontWeight:900, fontSize:18,
                        color: done ? C.success : day.accent,
                      }}>
                        {done
                          ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.success} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                          : day.dayNumber}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:10, fontWeight:700, color: done ? C.success : day.accent, letterSpacing:1.5, marginBottom:3 }}>
                          DAY {day.dayNumber}{done ? ' · COMPLETE' : ''}
                        </div>
                        <div style={{ fontFamily:font.heading, fontWeight:900, fontSize:22, letterSpacing:0.5, lineHeight:1, color:C.white }}>
                          {day.name.toUpperCase()}
                        </div>
                        <div style={{ fontSize:12, color:C.muted, marginTop:4, fontWeight:500 }}>
                          {day.exercises.length === 0
                            ? 'Tap to add exercises'
                            : `${day.exercises.length} exercises · ${day.exercises.reduce((s, e) => s + e.sets.length, 0)} sets`}
                        </div>
                      </div>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.faint} strokeWidth="2" strokeLinecap="round">
                        <polyline points="9 18 15 12 9 6"/>
                      </svg>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* RECENT SESSIONS */}
            {recentSessions.length > 0 && (
              <>
                <h4 style={{ fontFamily:font.heading, fontWeight:700, fontSize:13, letterSpacing:2.5, color:C.muted, marginBottom:12 }}>
                  RECENT SESSIONS
                </h4>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {recentSessions.map((s) => (
                    <div key={s.id} style={{
                      background:C.card, border:`1px solid ${C.border}`,
                      borderRadius:13, padding:'12px 14px',
                      display:'flex', alignItems:'center', gap:12,
                    }}>
                      <div style={{
                        width:38, height:38, borderRadius:10, flexShrink:0,
                        background:C.accentBg, border:`1px solid rgba(10,132,255,0.25)`,
                        display:'flex', alignItems:'center', justifyContent:'center',
                      }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="2" strokeLinecap="round">
                          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                        </svg>
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:14, fontWeight:600, color:C.white, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                          {s.dayName}
                        </div>
                        <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>
                          {new Date(s.date).toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' })}
                          {s.duration ? ` · ${Math.round(s.duration / 60)} min` : ''}
                        </div>
                      </div>
                      <span style={{ fontSize:13, fontWeight:700, color:C.success }}>✓</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <div style={{ textAlign:'center', padding:'60px 20px' }}>
            <div style={{ fontSize:48, marginBottom:16 }}>🏋️</div>
            <h3 style={{ fontFamily:font.heading, fontSize:24, fontWeight:700, marginBottom:8 }}>No Programs Yet</h3>
            <p style={{ color:C.muted, fontSize:14, marginBottom:24 }}>Create your first workout program to get started.</p>
            <button onClick={() => setShowCreateModal(true)} style={{
              background:`linear-gradient(90deg, ${C.accent}, #5856D6)`,
              border:'none', borderRadius:14, padding:'14px 32px',
              fontFamily:font.heading, fontSize:18, fontWeight:700, letterSpacing:1.5,
              color:C.white, boxShadow:`0 4px 24px ${C.accentGlow}`,
            }}>CREATE PROGRAM</button>
          </div>
        )}
      </main>

      {/* BOTTOM NAV */}
      <nav style={{
        position:'fixed', bottom:0, left:0, right:0, zIndex:50,
        background:`${C.bg}f5`, backdropFilter:'blur(20px)',
        borderTop:`1px solid ${C.border}`,
        display:'flex', justifyContent:'space-around',
        padding:'10px 0 max(10px, env(safe-area-inset-bottom))',
      }}>
        <button onClick={() => router.push('/')} style={{ background:'none', border:'none', display:'flex', flexDirection:'column', alignItems:'center', gap:3, padding:'4px 20px' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill={C.faint}><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
          <span style={{ fontSize:10, fontWeight:600, color:C.muted, letterSpacing:0.5 }}>Home</span>
        </button>
        <button style={{ background:'none', border:'none', display:'flex', flexDirection:'column', alignItems:'center', gap:3, padding:'4px 20px' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="10" width="4" height="4" rx="1"/><rect x="18" y="10" width="4" height="4" rx="1"/>
            <rect x="5" y="8" width="3" height="8" rx="1"/><rect x="16" y="8" width="3" height="8" rx="1"/>
            <line x1="8" y1="12" x2="16" y2="12"/>
          </svg>
          <span style={{ fontSize:10, fontWeight:600, color:C.accent, letterSpacing:0.5 }}>Workout</span>
        </button>
      </nav>

      {/* PROGRAM MENU SHEET */}
      {showProgramMenu && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', backdropFilter:'blur(6px)', zIndex:200, display:'flex', alignItems:'flex-end', justifyContent:'center' }}
          onClick={() => setShowProgramMenu(false)}>
          <div style={{ background:C.card, borderRadius:'20px 20px 0 0', width:'100%', maxWidth:600, padding:'20px 20px 40px' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ width:36, height:4, background:C.border, borderRadius:2, margin:'0 auto 20px' }}/>
            <h3 style={{ fontFamily:font.heading, fontWeight:700, fontSize:18, letterSpacing:1, marginBottom:16, color:C.white }}>PROGRAMS</h3>
            <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:16 }}>
              {programs.map((p) => (
                <button key={p.id} onClick={() => switchProgram(p.id)} style={{
                  background: p.id === activeProgramId ? C.accentBg : C.card2,
                  border:`1px solid ${p.id === activeProgramId ? 'rgba(10,132,255,0.4)' : C.border}`,
                  borderRadius:12, padding:'14px 16px',
                  display:'flex', alignItems:'center', justifyContent:'space-between',
                  color: p.id === activeProgramId ? C.accent : C.white,
                  fontSize:14, fontWeight:600, textAlign:'left',
                }}>
                  <span>{p.name}</span>
                  <span style={{ fontSize:12, color:C.muted }}>{p.days.length} days</span>
                </button>
              ))}
            </div>
            <button onClick={() => { setShowProgramMenu(false); setShowCreateModal(true); }} style={{
              width:'100%', background:'none', border:`1px dashed ${C.border}`,
              borderRadius:12, padding:'13px', color:C.muted, fontSize:14, fontWeight:600,
              display:'flex', alignItems:'center', justifyContent:'center', gap:8,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              New Program
            </button>
          </div>
        </div>
      )}

      {/* CREATE PROGRAM MODAL */}
      {showCreateModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', backdropFilter:'blur(8px)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' }}
          onClick={() => setShowCreateModal(false)}>
          <div style={{ background:C.card, borderRadius:22, width:'100%', maxWidth:480, padding:'28px 24px', maxHeight:'85vh', overflowY:'auto' }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ fontFamily:font.heading, fontWeight:900, fontSize:24, letterSpacing:1, marginBottom:20, color:C.white }}>NEW PROGRAM</h3>

            <div style={{ marginBottom:14 }}>
              <label style={{ display:'block', fontSize:11, fontWeight:700, color:C.muted, letterSpacing:1.5, marginBottom:6 }}>PROGRAM NAME</label>
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Push / Pull / Legs"
                style={{ width:'100%', background:C.card2, border:`1px solid ${C.border}`, borderRadius:10, padding:'11px 14px', fontSize:15, color:C.white }}/>
            </div>

            <div style={{ marginBottom:20 }}>
              <label style={{ display:'block', fontSize:11, fontWeight:700, color:C.muted, letterSpacing:1.5, marginBottom:6 }}>DESCRIPTION (optional)</label>
              <input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="e.g. 5-day strength split"
                style={{ width:'100%', background:C.card2, border:`1px solid ${C.border}`, borderRadius:10, padding:'11px 14px', fontSize:14, color:C.white }}/>
            </div>

            <div style={{ marginBottom:24 }}>
              <label style={{ display:'block', fontSize:11, fontWeight:700, color:C.muted, letterSpacing:1.5, marginBottom:10 }}>WORKOUT DAYS</label>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {newDays.map((d, i) => (
                  <div key={i} style={{
                    background:GRAD_OPTIONS[i % 5].grad, border:`1px solid ${C.border}`,
                    borderRadius:10, padding:'10px 14px',
                    display:'flex', alignItems:'center', justifyContent:'space-between',
                  }}>
                    <span style={{ fontSize:14, fontWeight:600, color:C.white }}>
                      <span style={{ color:GRAD_OPTIONS[i%5].accent, marginRight:8, fontFamily:font.heading, fontWeight:900 }}>{i+1}</span>
                      {d.name}
                    </span>
                    <button onClick={() => setNewDays(prev => prev.filter((_,idx) => idx !== i))} style={{
                      background:'rgba(255,69,58,0.15)', border:'none', borderRadius:6,
                      width:26, height:26, color:'#FF453A', fontSize:18, lineHeight:1,
                      display:'flex', alignItems:'center', justifyContent:'center',
                    }}>×</button>
                  </div>
                ))}
              </div>

              {showAddDay ? (
                <div style={{ display:'flex', gap:8, marginTop:8 }}>
                  <input value={newDayName} onChange={e => setNewDayName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addDayToForm()}
                    placeholder="e.g. Chest & Triceps" autoFocus
                    style={{ flex:1, background:C.card2, border:`1px solid ${C.accent}55`, borderRadius:10, padding:'9px 12px', fontSize:14, color:C.white }}/>
                  <button onClick={addDayToForm} style={{
                    background:C.accentBg, border:`1px solid rgba(10,132,255,0.4)`,
                    borderRadius:10, padding:'9px 16px', color:C.accent, fontWeight:700, fontSize:14,
                  }}>Add</button>
                </div>
              ) : (
                <button onClick={() => setShowAddDay(true)} style={{
                  width:'100%', background:'none', border:`1px dashed ${C.border}`,
                  borderRadius:10, padding:'10px', color:C.muted, fontSize:13, fontWeight:600,
                  marginTop:8, display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                  Add Day
                </button>
              )}
            </div>

            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setShowCreateModal(false)} style={{
                flex:1, background:'none', border:`1px solid ${C.border}`,
                borderRadius:12, padding:'13px', color:C.muted, fontSize:14, fontWeight:600,
              }}>Cancel</button>
              <button onClick={createProgram} disabled={!newName.trim() || newDays.length === 0} style={{
                flex:2,
                background: newName.trim() && newDays.length > 0 ? `linear-gradient(90deg, ${C.accent}, #5856D6)` : C.faint,
                border:'none', borderRadius:12, padding:'13px',
                fontFamily:font.heading, fontSize:18, fontWeight:700, letterSpacing:1, color:C.white,
                boxShadow: newName.trim() ? `0 4px 20px ${C.accentGlow}` : 'none',
              }}>CREATE</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
