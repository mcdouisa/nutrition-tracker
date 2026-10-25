'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  getPrograms, savePrograms, getActiveProgramId, setActiveProgramId,
  getSessions, getCompletedDaysThisWeek, setCurrentWorkout,
  syncProgramsToFirestore, loadProgramsFromFirestore, getFreshPrograms,
  PROGRAM_TYPES, publishProgram, unpublishProgram,
} from '../../lib/workoutSync';
import { useAuth } from '../../lib/AuthContext';
import { DumbbellIcon, RunIcon, YogaIcon, PersonIcon, GlobeIcon, SparklesIcon } from '../../lib/icons';
import { AppTabBar, PageHeader, TAB_BAR_SPACE } from '../components/AppChrome';
import { aiFetch } from '../../lib/aiFetch';
import { C, font } from '../../lib/theme'

// Maps workout type keys → SVG icon component
function ProgramTypeIcon({ type, size = 22, color = 'currentColor' }) {
  if (type === 'strength') return <DumbbellIcon size={size} color={color} strokeWidth={1.75} />
  if (type === 'running')  return <RunIcon size={size} color={color} strokeWidth={1.75} />
  if (type === 'stretching') return <YogaIcon size={size} color={color} strokeWidth={1.75} />
  return <PersonIcon size={size} color={color} strokeWidth={1.75} /> // bodyweight default
}

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────

const GRAD_OPTIONS = [
  { grad: '#15171A', accent: '#7CC8FF' },
  { grad: '#15171A', accent: '#B8F06A' },
  { grad: '#15171A', accent: '#E58A5C' },
  { grad: '#15171A', accent: '#B9A3FF' },
  { grad: '#15171A', accent: '#F2C94C' },
];

function ProgressRing({ pct = 0, size = 76, sw = 5 }) {
  const r = (size - sw) / 2, circ = 2 * Math.PI * r;
  const dash = circ - (pct / 100) * circ;
  return (
    <div style={{ position:'relative', width:size, height:size, flexShrink:0 }}>
      <svg width={size} height={size} style={{ transform:'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.border} strokeWidth={sw}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.accent} strokeWidth={sw}
          strokeDasharray={circ} strokeDashoffset={dash} strokeLinecap="round"
          style={{ filter: 'none', transition:'stroke-dashoffset 0.6s ease' }}/>
      </svg>
      <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:1 }}>
        <span style={{ fontFamily:font.body, fontWeight:700, fontSize:15, color:C.white, lineHeight:1 }}>{pct}%</span>
        <span style={{ fontFamily:font.body, fontWeight:500, fontSize:9, color:C.muted, lineHeight:1, letterSpacing: 0 }}>Done</span>
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
  const [newType,        setNewType]        = useState('strength');
  const [showAiBuilder,  setShowAiBuilder]  = useState(false);
  const [aiPrompt,       setAiPrompt]       = useState('');
  const [aiLoading,      setAiLoading]      = useState(false);
  const [aiError,        setAiError]        = useState('');
  const [aiPreview,      setAiPreview]      = useState(null); // parsed program preview
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [expandedSession, setExpandedSession] = useState(null);
  const [inProgressWorkout, setInProgressWorkout] = useState(null);

  useEffect(() => {
    const progs = getPrograms();
    const activeId = getActiveProgramId();
    setPrograms(progs);
    setActivePId(activeId);
    setSessions(getSessions());

    // Check for an in-progress workout the user navigated away from
    try {
      const saved = JSON.parse(localStorage.getItem('lytz-workout-inprogress') || 'null');
      if (saved?.programId && saved?.dayId) setInProgressWorkout(saved);
    } catch (_) {}
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

  async function createProgram() {
    if (!newName.trim() || newDays.length === 0) return;
    const id = `prog-${Date.now()}`;
    const program = {
      id, type: newType, name: newName.trim(), description: newDesc.trim(),
      createdAt: new Date().toISOString(),
      days: newDays.map((d, i) => ({
        id: `${id}-d${i + 1}`, dayNumber: i + 1, name: d.name,
        grad: GRAD_OPTIONS[i % 5].grad, accent: GRAD_OPTIONS[i % 5].accent,
        exercises: [],
      })),
    };
    const base = await getFreshPrograms(user?.uid);
    const updated = [...base, program];
    setPrograms(updated);
    savePrograms(updated);
    setActiveProgramId(id);
    setActivePId(id);
    if (user) syncProgramsToFirestore(user.uid, updated);
    setShowCreateModal(false);
    setNewName(''); setNewDesc(''); setNewDays([{ name: 'Day 1' }]); setNewType('strength');
  }

  function addDayToForm() {
    if (!newDayName.trim()) return;
    setNewDays(prev => [...prev, { name: newDayName.trim() }]);
    setNewDayName('');
    setShowAddDay(false);
  }

  async function buildWithAI() {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    setAiError('');
    setAiPreview(null);
    try {
      const res = await aiFetch('/api/workout-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiPrompt }),
      });
      const data = await res.json();
      if (data.error) { setAiError(data.error); return; }
      setAiPreview(data.program);
    } catch (e) {
      setAiError(e?.message === 'Sign in to use AI features.' ? e.message : 'Network error. Please try again.');
    } finally {
      setAiLoading(false);
    }
  }

  async function togglePublic(programId) {
    const base = await getFreshPrograms(user?.uid);
    const prog = base.find(p => p.id === programId);
    if (!prog) return;
    const nowPublic = !prog.isPublic;
    const updated = base.map(p => p.id === programId ? { ...p, isPublic: nowPublic } : p);
    setPrograms(updated);
    savePrograms(updated);
    if (user) {
      syncProgramsToFirestore(user.uid, updated);
      if (nowPublic) await publishProgram(user.uid, { ...prog, isPublic: true });
      else await unpublishProgram(programId);
    }
  }

  async function saveAiProgram() {
    if (!aiPreview) return;
    const id = `prog-${Date.now()}`;
    const program = {
      id,
      name: aiPreview.name || 'AI Program',
      description: aiPreview.description || '',
      createdAt: new Date().toISOString(),
      days: (aiPreview.days || []).map((d, i) => ({
        id: `${id}-d${i+1}`,
        dayNumber: i + 1,
        name: d.name,
        grad: GRAD_OPTIONS[i % 5].grad,
        accent: GRAD_OPTIONS[i % 5].accent,
        exercises: (d.exercises || []).map((ex, ei) => ({
          id: `${id}-d${i+1}-e${ei+1}`,
          name: ex.name,
          sets: (ex.sets || []).map(s => ({
            type: s.type || 'working',
            reps: s.reps || '8-10',
            weight: s.weight || '',
            rest: s.rest || '90',
          })),
        })),
      })),
    };
    const base = await getFreshPrograms(user?.uid);
    const updated = [...base, program];
    setPrograms(updated);
    savePrograms(updated);
    setActiveProgramId(id);
    setActivePId(id);
    if (user) syncProgramsToFirestore(user.uid, updated);
    setShowAiBuilder(false);
    setAiPrompt('');
    setAiPreview(null);
  }

  return (
    <div style={{ fontFamily:font.body, background:C.bg, minHeight:'100dvh', color:C.white, overflowX:'hidden' }}>
      <style>{`
        
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{display:none}
        button{cursor:pointer;font-family:inherit}
        input,textarea{outline:none;font-family:inherit}
      `}</style>

      {/* HEADER */}
      <PageHeader
        title="Train"
        right={<>
          <button onClick={() => router.push('/workout/discover')} aria-label="Discover programs" style={{ width:44, height:44, display:'flex', alignItems:'center', justifyContent:'center', borderRadius:'50%', background:C.card, border:'none', color:C.white }}>
            <GlobeIcon size={18} strokeWidth={1.75} />
          </button>
          <button onClick={() => setShowAiBuilder(true)} aria-label="Build a program with AI" style={{ width:44, height:44, display:'flex', alignItems:'center', justifyContent:'center', borderRadius:'50%', background:C.card, border:'none', color:C.white }}>
            <SparklesIcon size={18} strokeWidth={1.75} />
          </button>
          <button onClick={() => setShowProgramMenu(true)} style={{
            height:36, background:C.card, border:'none', borderRadius:999, padding:'0 12px',
            fontSize:13, fontWeight:500, color:C.soft, display:'flex', alignItems:'center', gap:4,
          }}>
            Programs
            <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
        </>}
      />

      <main style={{ padding:`8px 16px ${TAB_BAR_SPACE}`, maxWidth:600, margin:'0 auto' }}>

        {/* RESUME BANNER — shown when user navigated away mid-workout */}
        {inProgressWorkout && (
          <div style={{
            background:C.accentBg,
            border:'1px solid rgba(184,240,106,0.35)', borderRadius:16,
            padding:'14px 16px', marginBottom:16,
            display:'flex', alignItems:'center', justifyContent:'space-between', gap:12,
          }}>
            <div>
              <div style={{ fontSize:11, fontWeight:700, color:C.success, letterSpacing: 0, marginBottom:3 }}>Workout in progress</div>
              <div style={{ fontSize:14, fontWeight:600, color:C.white }}>You left mid-workout — pick up where you left off</div>
            </div>
            <div style={{ display:'flex', gap:8, flexShrink:0 }}>
              <button onClick={() => router.push('/workout/log')} style={{
                background:`${C.success}`, border:'none',
                borderRadius:10, padding:'10px 18px',
                fontFamily:font.heading, fontSize:15, fontWeight:700, letterSpacing: 0, color:'#0B0C0E', cursor:'pointer',
              }}>Resume</button>
              <button onClick={() => { localStorage.removeItem('lytz-workout-inprogress'); setInProgressWorkout(null); }} style={{
                background:'none', border:`1px solid ${C.border}`,
                borderRadius:10, padding:'10px 12px', fontSize:13, color:C.muted, cursor:'pointer',
              }}>Discard</button>
            </div>
          </div>
        )}

        {activeProgram ? (
          <>
            {/* ACTIVE PROGRAM HERO */}
            <div style={{
              background:'#15171A',
              border:`1px solid ${C.border}`, borderRadius:22, padding:'20px 20px 16px',
              marginBottom:28, position:'relative', overflow:'hidden',
            }}>
              <div style={{ position:'absolute', top:-50, right:-50, width:200, height:200, borderRadius:'50%', background: 'none', pointerEvents:'none' }}/>
              <div style={{ position:'absolute', bottom:-30, left:10, width:140, height:140, borderRadius:'50%', background: 'none', pointerEvents:'none' }}/>

              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:18 }}>
                <div style={{ flex:1 }}>
                  <div style={{
                    display:'inline-flex', alignItems:'center', gap:6,
                    background:C.accentBg, border:`1px solid rgba(184,240,106,0.3)`,
                    borderRadius:6, padding:'3px 10px', marginBottom:10,
                  }}>
                    <div style={{ width:6, height:6, borderRadius:'50%', background:C.accent }}/>
                    <span style={{ fontFamily:font.body, fontSize:10, fontWeight:700, color:C.accent, letterSpacing: 0 }}>Active program</span>
                  </div>
                  <h2 style={{ fontFamily:font.heading, fontWeight: 600, fontSize:24, letterSpacing:0, lineHeight:1.15, marginBottom:4, color:C.white }}>
                    {activeProgram.name}
                  </h2>
                  <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                    {activeProgram.description && (
                      <p style={{ fontSize:12, color:C.muted, fontWeight:500 }}>{activeProgram.description}</p>
                    )}
                    {(() => { const pt = PROGRAM_TYPES[activeProgram.type || 'strength']; return (
                      <span style={{ fontSize:11, color:C.muted, fontWeight:600, display:'flex', alignItems:'center', gap:4 }}><ProgramTypeIcon type={activeProgram.type || 'strength'} size={11} color={C.muted} /> {pt?.label}</span>
                    ); })()}
                    {activeProgram.isPublic && <span style={{ fontSize:11, color:C.success, fontWeight:700 }}>Public</span>}
                  </div>
                </div>
                <ProgressRing pct={pct}/>
              </div>

              <div style={{ display:'flex', gap:16 }}>
                {[
                  { value: totalDays, label: 'Days', color: C.accent },
                  { value: doneDays,  label: 'This week', color: C.success },
                  { value: sessions.filter(s => s.programId === activeProgram.id).length, label: 'Total', color: C.white },
                ].map((stat, i, arr) => (
                  <div key={stat.label} style={{ display:'flex', alignItems:'stretch', gap:16 }}>
                    <div>
                      <div style={{ fontFamily:font.heading, fontWeight: 600, fontSize:26, color:stat.color, lineHeight:1 }}>{stat.value}</div>
                      <div style={{ fontSize:10, fontWeight:700, color:C.muted, letterSpacing: 0 }}>{stat.label}</div>
                    </div>
                    {i < arr.length - 1 && <div style={{ width:1, background:C.border }}/>}
                  </div>
                ))}
              </div>
            </div>

            {/* WORKOUT DAYS */}
            <h4 style={{ fontFamily:font.heading, fontWeight:700, fontSize:13, letterSpacing: 0, color:C.muted, marginBottom:12 }}>
              Workout days
            </h4>
            <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:32 }}>
              {activeProgram.days.map((day, dayIdx) => {
                const done = completedThisWeek.has(day.id);
                // Colors come from position, not the saved program, so older programs match the current palette
                const dayAccent = GRAD_OPTIONS[dayIdx % GRAD_OPTIONS.length].accent;
                return (
                  <button key={day.id} onClick={() => openDay(day)} style={{
                    background: done ? C.successBg : C.card,
                    border:`1px solid ${done ? 'rgba(184,240,106,0.3)' : C.border}`,
                    borderRadius:16, overflow:'hidden', textAlign:'left', cursor:'pointer',
                  }}>
                    <div style={{ padding:'16px 18px', display:'flex', alignItems:'center', gap:14 }}>
                      <div style={{
                        width:44, height:44, borderRadius:12, flexShrink:0,
                        background: done ? 'rgba(184,240,106,0.2)' : `${dayAccent}22`,
                        border:`1.5px solid ${done ? 'rgba(184,240,106,0.5)' : `${dayAccent}55`}`,
                        display:'flex', alignItems:'center', justifyContent:'center',
                        fontFamily:font.heading, fontWeight: 600, fontSize:18,
                        color: done ? C.success : dayAccent,
                      }}>
                        {done
                          ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.success} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                          : day.dayNumber}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:10, fontWeight:700, color: done ? C.success : dayAccent, letterSpacing: 0, marginBottom:3 }}>
                          DAY {day.dayNumber}{done ? ' · COMPLETE' : ''}
                        </div>
                        <div style={{ fontFamily:font.heading, fontWeight: 600, fontSize:22, letterSpacing:0.5, lineHeight:1, color:C.white }}>
                          {day.name}
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

            {/* SESSION HISTORY */}
            {sessions.length > 0 && (
              <>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
                  <h4 style={{ fontFamily:font.heading, fontWeight:700, fontSize:13, letterSpacing: 0, color:C.muted, margin:0 }}>
                    Workout history
                  </h4>
                  {sessions.length > 3 && (
                    <button onClick={() => setShowAllHistory(h => !h)} style={{
                      background:'none', border:`1px solid ${C.border}`, borderRadius:8,
                      padding:'4px 10px', fontSize:11, fontWeight:700, color:C.muted, cursor:'pointer',
                    }}>{showAllHistory ? 'Show Less' : `View All (${sessions.length})`}</button>
                  )}
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {(showAllHistory ? sessions : sessions.slice(0, 3)).map((s) => {
                    const isExpanded = expandedSession === s.id;
                    return (
                      <div key={s.id} style={{ background:C.card, border:`1px solid ${isExpanded ? 'rgba(184,240,106,0.4)' : C.border}`, borderRadius:13, overflow:'hidden' }}>
                        <button onClick={() => setExpandedSession(isExpanded ? null : s.id)} style={{
                          width:'100%', background:'none', border:'none', cursor:'pointer',
                          padding:'12px 14px', display:'flex', alignItems:'center', gap:12, textAlign:'left',
                        }}>
                          <div style={{ width:38, height:38, borderRadius:10, flexShrink:0, background:C.accentBg, border:`1px solid rgba(184,240,106,0.25)`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="2" strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                          </div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:14, fontWeight:600, color:C.white, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.dayName}</div>
                            <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>
                              {new Date(s.date).toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' })}
                              {s.duration ? ` · ${Math.round(s.duration / 60)} min` : ''}
                              {s.exercises ? ` · ${s.exercises.length} exercises` : ''}
                            </div>
                          </div>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink:0, transform: isExpanded ? 'rotate(180deg)' : 'none', transition:'transform 0.2s' }}><polyline points="6 9 12 15 18 9"/></svg>
                        </button>
                        {isExpanded && s.exercises && (
                          <div style={{ borderTop:`1px solid ${C.border}`, padding:'12px 14px', display:'flex', flexDirection:'column', gap:10 }}>
                            {s.exercises.map((ex, ei) => {
                              const loggedSets = ex.sets?.filter(st => st.logged) || [];
                              return (
                                <div key={ei}>
                                  <div style={{ fontSize:12, fontWeight:700, color:C.white, marginBottom:6 }}>{ex.name}</div>
                                  <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                                    {loggedSets.map((st, si) => (
                                      <div key={si} style={{ display:'flex', gap:8, fontSize:12, color:C.muted }}>
                                        <span style={{ color:C.faint, minWidth:18 }}>#{si+1}</span>
                                        {st.reps && st.weight ? (
                                          <span>{st.reps} reps · <span style={{ color:C.accent }}>{st.weight}</span></span>
                                        ) : st.distance ? (
                                          <span>{st.distance} mi{st.time ? ` · ${st.time}` : ''}</span>
                                        ) : st.duration ? (
                                          <span>{st.duration}s {st.sides === 'each' ? 'each side' : ''}</span>
                                        ) : <span>Logged</span>}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        ) : (
          <div style={{ textAlign:'center', padding:'60px 20px' }}>
            <div style={{ marginBottom:16, display:'flex', justifyContent:'center' }}><DumbbellIcon size={52} color="rgba(242,201,76,0.4)" strokeWidth={1.25} /></div>
            <h3 style={{ fontFamily:font.heading, fontSize:24, fontWeight:700, marginBottom:8 }}>No Programs Yet</h3>
            <p style={{ color:C.muted, fontSize:14, marginBottom:24 }}>Create your first workout program to get started.</p>
            <button onClick={() => setShowCreateModal(true)} style={{
              background:`${C.accent}`,
              border:'none', borderRadius:14, padding:'14px 32px',
              fontFamily:font.heading, fontSize:18, fontWeight:700, letterSpacing: 0,
              color:'#0B0C0E', boxShadow: 'none',
            }}>Create program</button>
          </div>
        )}
      </main>

      {/* BOTTOM NAV */}
      <AppTabBar current="train" />

      {/* PROGRAM MENU SHEET */}
      {showProgramMenu && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', backdropFilter:'blur(6px)', zIndex:200, display:'flex', alignItems:'flex-end', justifyContent:'center' }}
          onClick={() => setShowProgramMenu(false)}>
          <div style={{ background:C.card, borderRadius:'20px 20px 0 0', width:'100%', maxWidth:600, padding:'20px 20px 40px' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ width:36, height:4, background:C.border, borderRadius:2, margin:'0 auto 20px' }}/>
            <h3 style={{ fontFamily:font.heading, fontWeight:700, fontSize:18, letterSpacing: 0, marginBottom:16, color:C.white }}>Programs</h3>
            <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:16 }}>
              {programs.map((p) => {
                const pt = PROGRAM_TYPES[p.type || 'strength'];
                return (
                  <div key={p.id} style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <button onClick={() => switchProgram(p.id)} style={{
                      flex:1, background: p.id === activeProgramId ? C.accentBg : C.card2,
                      border:`1px solid ${p.id === activeProgramId ? 'rgba(184,240,106,0.4)' : C.border}`,
                      borderRadius:12, padding:'12px 14px',
                      display:'flex', alignItems:'center', justifyContent:'space-between',
                      color: p.id === activeProgramId ? C.accent : C.white,
                      fontSize:14, fontWeight:600, textAlign:'left', cursor:'pointer',
                    }}>
                      <span style={{ display:'flex', alignItems:'center', gap:5 }}><ProgramTypeIcon type={p.type || 'strength'} size={13} color="currentColor" /> {p.name}</span>
                      <span style={{ fontSize:11, color:C.muted }}>{p.days.length}d</span>
                    </button>
                    <button onClick={() => togglePublic(p.id)} title={p.isPublic ? 'Make private' : 'Make public'} style={{
                      width:40, height:40, borderRadius:10, flexShrink:0, cursor:'pointer',
                      background: p.isPublic ? 'rgba(184,240,106,0.12)' : C.card2,
                      border:`1px solid ${p.isPublic ? 'rgba(184,240,106,0.4)' : C.border}`,
                      fontSize:15, lineHeight:1, display:'flex', alignItems:'center', justifyContent:'center',
                    }}>{p.isPublic ? 'Public' : 'Private'}</button>
                  </div>
                );
              })}
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
            <h3 style={{ fontFamily:font.heading, fontWeight: 600, fontSize:24, letterSpacing: 0, marginBottom:20, color:C.white }}>New program</h3>

            <div style={{ marginBottom:14 }}>
              <label style={{ display:'block', fontSize:11, fontWeight:700, color:C.muted, letterSpacing: 0, marginBottom:6 }}>Program name</label>
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Push / Pull / Legs"
                style={{ width:'100%', background:C.card2, border:`1px solid ${C.border}`, borderRadius:10, padding:'11px 14px', fontSize:15, color:C.white }}/>
            </div>

            <div style={{ marginBottom:20 }}>
              <label style={{ display:'block', fontSize:11, fontWeight:700, color:C.muted, letterSpacing: 0, marginBottom:6 }}>DESCRIPTION (optional)</label>
              <input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="e.g. 5-day strength split"
                style={{ width:'100%', background:C.card2, border:`1px solid ${C.border}`, borderRadius:10, padding:'11px 14px', fontSize:14, color:C.white }}/>
            </div>

            {/* TYPE SELECTOR */}
            <div style={{ marginBottom:20 }}>
              <label style={{ display:'block', fontSize:11, fontWeight:700, color:C.muted, letterSpacing: 0, marginBottom:10 }}>Workout type</label>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                {Object.entries(PROGRAM_TYPES).map(([id, t]) => (
                  <button key={id} onClick={() => setNewType(id)} style={{
                    background: newType === id ? `rgba(184,240,106,0.12)` : C.card2,
                    border:`1.5px solid ${newType === id ? C.accent : C.border}`,
                    borderRadius:12, padding:'12px 10px', textAlign:'left', cursor:'pointer',
                  }}>
                    <div style={{ marginBottom:6, display:'flex' }}><ProgramTypeIcon type={id} size={22} color={newType === id ? '#B8F06A' : C.muted} /></div>
                    <div style={{ fontSize:13, fontWeight:700, color: newType === id ? C.accent : C.white, marginBottom:2 }}>{t.label}</div>
                    <div style={{ fontSize:10, color:C.muted, lineHeight:1.3 }}>{t.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom:24 }}>
              <label style={{ display:'block', fontSize:11, fontWeight:700, color:C.muted, letterSpacing: 0, marginBottom:10 }}>Workout days</label>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {newDays.map((d, i) => (
                  <div key={i} style={{
                    background:GRAD_OPTIONS[i % 5].grad, border:`1px solid ${C.border}`,
                    borderRadius:10, padding:'10px 14px',
                    display:'flex', alignItems:'center', justifyContent:'space-between',
                  }}>
                    <span style={{ fontSize:14, fontWeight:600, color:C.white }}>
                      <span style={{ color:GRAD_OPTIONS[i%5].accent, marginRight:8, fontFamily:font.heading, fontWeight: 600 }}>{i+1}</span>
                      {d.name}
                    </span>
                    <button onClick={() => setNewDays(prev => prev.filter((_,idx) => idx !== i))} style={{
                      background:'rgba(255,107,61,0.15)', border:'none', borderRadius:6,
                      width:26, height:26, color:'#FF6B3D', fontSize:18, lineHeight:1,
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
                    background:C.accentBg, border:`1px solid rgba(184,240,106,0.4)`,
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
                background: newName.trim() && newDays.length > 0 ? C.accent : C.card2,
                border:'none', borderRadius:12, padding:'13px',
                fontFamily:font.heading, fontSize:18, fontWeight:700, letterSpacing: 0, color:newName.trim() && newDays.length > 0 ? C.accentInk : C.muted,
                boxShadow: newName.trim() ? `0 4px 20px ${C.accentGlow}` : 'none',
              }}>Create</button>
            </div>
          </div>
        </div>
      )}

      {/* AI BUILDER MODAL */}
      {showAiBuilder && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.88)', backdropFilter:'blur(8px)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' }}
          onClick={() => { if (!aiLoading) { setShowAiBuilder(false); setAiPreview(null); setAiError(''); } }}>
          <div style={{ background:C.card, borderRadius:22, width:'100%', maxWidth:500, padding:'28px 24px', maxHeight:'88vh', overflowY:'auto' }}
            onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
              <div>
                <h3 style={{ fontFamily:font.heading, fontWeight: 600, fontSize:22, color:C.white, letterSpacing: 0 }}>AI program builder</h3>
                <p style={{ fontSize:12, color:C.muted, marginTop:2 }}>Describe your workout and AI will build it</p>
              </div>
            </div>

            {!aiPreview ? (
              <>
                <div style={{ marginBottom:16 }}>
                  <label style={{ display:'block', fontSize:11, fontWeight:700, color:C.muted, letterSpacing: 0, marginBottom:8 }}>Describe your program</label>
                  <textarea
                    value={aiPrompt}
                    onChange={e => setAiPrompt(e.target.value)}
                    placeholder={"e.g. I do a 5-day Push Pull Legs split. Push day is chest, shoulders, triceps with bench press 4x6-8, overhead press 4x8, lateral raises 3x15, tricep pushdowns 3x12. Pull day is back and biceps..."}
                    rows={6}
                    style={{
                      width:'100%', background:C.card2, border:`1px solid ${C.border}`,
                      borderRadius:12, padding:'14px', fontSize:14, color:C.white,
                      lineHeight:'1.5', resize:'vertical', outline:'none', fontFamily:font.body,
                    }}
                  />
                </div>

                {aiError && (
                  <div style={{ background:'rgba(255,107,61,0.1)', border:'1px solid rgba(255,107,61,0.3)', borderRadius:10, padding:'10px 14px', marginBottom:14, fontSize:13, color:'#FF6B3D' }}>
                    {aiError}
                  </div>
                )}

                <div style={{ display:'flex', gap:10 }}>
                  <button onClick={() => { setShowAiBuilder(false); setAiError(''); }} style={{
                    flex:1, background:'none', border:`1px solid ${C.border}`,
                    borderRadius:12, padding:'13px', color:C.muted, fontSize:14, fontWeight:600, cursor:'pointer',
                  }}>Cancel</button>
                  <button onClick={buildWithAI} disabled={!aiPrompt.trim() || aiLoading} style={{
                    flex:2,
                    background: aiPrompt.trim() && !aiLoading ? '#B9A3FF' : C.faint,
                    border:'none', borderRadius:12, padding:'13px',
                    fontFamily:font.heading, fontSize:18, fontWeight:700, letterSpacing: 0, color:C.white, cursor:'pointer',
                    display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                  }}>
                    {aiLoading ? (
                      <>
                        <div style={{ width:16, height:16, borderRadius:'50%', border:'2px solid rgba(255,255,255,0.3)', borderTopColor:C.white, animation:'spin 0.7s linear infinite' }}/>
                        Building...
                      </>
                    ) : 'Build program'}
                  </button>
                </div>
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              </>
            ) : (
              <>
                {/* Preview */}
                <div style={{ background:'rgba(184,240,106,0.08)', border:'1px solid rgba(184,240,106,0.25)', borderRadius:12, padding:'14px 16px', marginBottom:16 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:C.success, letterSpacing: 0, marginBottom:4 }}>PROGRAM READY</div>
                  <div style={{ fontFamily:font.heading, fontWeight: 600, fontSize:22, color:C.white }}>{aiPreview.name}</div>
                  {aiPreview.description && <div style={{ fontSize:13, color:C.muted, marginTop:3 }}>{aiPreview.description}</div>}
                </div>

                <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:20 }}>
                  {(aiPreview.days || []).map((d, i) => (
                    <div key={i} style={{
                      background:GRAD_OPTIONS[i%5].grad, border:`1px solid ${C.border}`,
                      borderRadius:12, padding:'12px 14px',
                    }}>
                      <div style={{ fontSize:12, fontWeight:700, color:GRAD_OPTIONS[i%5].accent, letterSpacing: 0, marginBottom:2 }}>DAY {i+1}</div>
                      <div style={{ fontFamily:font.heading, fontWeight: 600, fontSize:18, color:C.white }}>{d.name}</div>
                      <div style={{ fontSize:12, color:C.muted, marginTop:3 }}>
                        {(d.exercises||[]).length} exercises · {(d.exercises||[]).reduce((s,e) => s+(e.sets||[]).length, 0)} sets
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ display:'flex', gap:10 }}>
                  <button onClick={() => setAiPreview(null)} style={{
                    flex:1, background:'none', border:`1px solid ${C.border}`,
                    borderRadius:12, padding:'13px', color:C.muted, fontSize:14, fontWeight:600, cursor:'pointer',
                  }}>Regenerate</button>
                  <button onClick={saveAiProgram} style={{
                    flex:2, background:`${C.success}`,
                    border:'none', borderRadius:12, padding:'13px',
                    fontFamily:font.heading, fontSize:18, fontWeight:700, letterSpacing: 0, color:'#0B0C0E', cursor:'pointer',
                  }}>Save program</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
