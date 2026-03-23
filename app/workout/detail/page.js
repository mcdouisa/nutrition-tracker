'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  getPrograms, savePrograms, getCurrentWorkout, setCurrentWorkout,
  syncProgramsToFirestore,
} from '../../../lib/workoutSync';
import { useAuth } from '../../../lib/AuthContext';

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
const font = { heading: "'Barlow Condensed', sans-serif", body: "'DM Sans', sans-serif" };

const SET_TYPES   = ['working', 'drop', 'amrap'];
const SET_COLORS  = { working: '#0A84FF', drop: '#FF9F0A', amrap: '#BF5AF2' };
const SET_LABELS  = { working: 'W', drop: 'D', amrap: 'A' };

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function WorkoutDetail() {
  const router = useRouter();
  const { user } = useAuth();

  const [program,       setProgram]       = useState(null);
  const [day,           setDay]           = useState(null);
  const [favorited,     setFavorited]     = useState(false);
  const [showAddEx,     setShowAddEx]     = useState(false);
  const [showEditEx,    setShowEditEx]    = useState(null); // exercise index
  const [confirmDelete, setConfirmDelete] = useState(null); // exercise index

  // New exercise form
  const [exName,    setExName]    = useState('');
  const [exSets,    setExSets]    = useState([
    { type: 'working', reps: '8-10', weight: '', rest: '90' },
  ]);

  useEffect(() => {
    const ctx = getCurrentWorkout();
    if (!ctx) { router.replace('/workout'); return; }
    const programs = getPrograms();
    const prog = programs.find(p => p.id === ctx.programId);
    if (!prog) { router.replace('/workout'); return; }
    const d = prog.days.find(d => d.id === ctx.dayId);
    if (!d) { router.replace('/workout'); return; }
    setProgram(prog);
    setDay(d);
  }, []);

  function saveExercises(updatedExercises) {
    const programs = getPrograms();
    const progIdx  = programs.findIndex(p => p.id === program.id);
    if (progIdx === -1) return;
    const dayIdx = programs[progIdx].days.findIndex(d => d.id === day.id);
    if (dayIdx === -1) return;
    programs[progIdx].days[dayIdx].exercises = updatedExercises;
    savePrograms(programs);
    setDay({ ...day, exercises: updatedExercises });
    if (user) syncProgramsToFirestore(user.uid, programs);
  }

  function addExercise() {
    if (!exName.trim()) return;
    const newEx = {
      id: `ex-${Date.now()}`,
      name: exName.trim(),
      sets: exSets.map(s => ({ ...s })),
    };
    const updated = [...(day.exercises || []), newEx];
    saveExercises(updated);
    setShowAddEx(false);
    setExName('');
    setExSets([{ type: 'working', reps: '8-10', weight: '', rest: '90' }]);
  }

  function deleteExercise(idx) {
    const updated = day.exercises.filter((_, i) => i !== idx);
    saveExercises(updated);
    setConfirmDelete(null);
  }

  function addSetToForm() {
    setExSets(prev => [...prev, { type: 'working', reps: '8-10', weight: '', rest: '90' }]);
  }

  function updateFormSet(i, field, val) {
    setExSets(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: val } : s));
  }

  function removeFormSet(i) {
    if (exSets.length === 1) return;
    setExSets(prev => prev.filter((_, idx) => idx !== i));
  }

  function startWorkout() {
    router.push('/workout/log');
  }

  if (!day) {
    return (
      <div style={{ background: C.bg, minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', border: `3px solid ${C.border}`, borderTopColor: C.accent, animation: 'spin 0.8s linear infinite' }}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  const totalSets = day.exercises.reduce((s, e) => s + e.sets.length, 0);

  return (
    <div style={{ fontFamily: font.body, background: C.bg, minHeight: '100dvh', color: C.white, overflowX: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;900&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{display:none}
        button{cursor:pointer;font-family:inherit}
        input,select{outline:none;font-family:inherit}
      `}</style>

      {/* CINEMATIC HERO */}
      <div style={{
        height: 220, position: 'relative', overflow: 'hidden',
        background: day.grad || 'linear-gradient(160deg,#060d1a 0%,#0e1a30 35%,#111827 65%,#0a0a0a 100%)',
      }}>
        <div style={{ position:'absolute', top:-70, left:-50, width:260, height:260, borderRadius:'50%', background:`radial-gradient(circle,${day.accent || C.accent}22 0%,transparent 65%)`, pointerEvents:'none' }}/>
        <div style={{ position:'absolute', bottom:0, right:-30, width:220, height:200, background:'radial-gradient(ellipse at 100% 100%,rgba(88,86,214,0.1) 0%,transparent 60%)', pointerEvents:'none' }}/>
        <div style={{ position:'absolute', inset:0, opacity:0.04,
          backgroundImage:'linear-gradient(rgba(255,255,255,0.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.5) 1px,transparent 1px)',
          backgroundSize:'32px 32px', pointerEvents:'none' }}/>

        {/* Top bar */}
        <div style={{
          position:'absolute', top:0, left:0, right:0, zIndex:10, padding:'14px 16px',
          display:'flex', alignItems:'center', justifyContent:'space-between',
          background:'linear-gradient(to bottom,rgba(0,0,0,0.55),transparent)',
        }}>
          <button onClick={() => router.push('/workout')} style={{
            background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.14)',
            borderRadius:10, padding:'6px 12px',
            display:'flex', alignItems:'center', gap:5, color:C.white, backdropFilter:'blur(8px)',
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
            <span style={{ fontSize:13, fontWeight:600 }}>Back</span>
          </button>

          <button onClick={() => setFavorited(f => !f)} style={{
            background: favorited ? 'rgba(255,69,58,0.2)' : 'rgba(255,255,255,0.08)',
            border: `1px solid ${favorited ? 'rgba(255,69,58,0.5)' : 'rgba(255,255,255,0.14)'}`,
            borderRadius:10, padding:'8px', lineHeight:0, backdropFilter:'blur(8px)',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill={favorited ? '#FF453A' : 'none'} stroke={favorited ? '#FF453A' : C.white} strokeWidth="2">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
            </svg>
          </button>
        </div>

        {/* Title */}
        <div style={{
          position:'absolute', bottom:0, left:0, right:0, zIndex:10,
          padding:'0 18px 18px',
          background:'linear-gradient(to top,rgba(13,13,13,0.95) 0%,rgba(13,13,13,0.4) 60%,transparent 100%)',
        }}>
          <span style={{
            background:`${day.accent || C.accent}22`, border:`1px solid ${day.accent || C.accent}55`,
            borderRadius:6, padding:'2px 9px',
            fontSize:10, fontWeight:700, color: day.accent || C.accent, letterSpacing:2,
            display:'inline-block', marginBottom:6,
          }}>DAY {day.dayNumber}</span>
          <h1 style={{ fontFamily:font.heading, fontWeight:900, fontSize:38, letterSpacing:1, lineHeight:1, color:C.white, textTransform:'uppercase' }}>
            {day.name}
          </h1>
        </div>
      </div>

      {/* CONTENT */}
      <div style={{ padding:'0 16px 120px' }}>

        {/* STATS BAR */}
        {day.exercises.length > 0 && (
          <div style={{
            background:`linear-gradient(90deg,${day.accent || C.accent}2a,rgba(88,86,214,0.12))`,
            border:`1px solid ${day.accent || C.accent}44`,
            borderRadius:14, padding:'14px 24px',
            display:'flex', alignItems:'stretch',
            margin:'16px 0 20px',
          }}>
            <div style={{ flex:1, textAlign:'center', borderRight:`1px solid ${day.accent || C.accent}33`, paddingRight:24 }}>
              <div style={{ fontFamily:font.heading, fontWeight:900, fontSize:34, color: day.accent || C.accent, lineHeight:1 }}>{totalSets}</div>
              <div style={{ fontSize:10, fontWeight:700, color:C.muted, letterSpacing:2, marginTop:3 }}>SETS</div>
            </div>
            <div style={{ flex:1, textAlign:'center', paddingLeft:24 }}>
              <div style={{ fontFamily:font.heading, fontWeight:900, fontSize:34, color: day.accent || C.accent, lineHeight:1 }}>{day.exercises.length}</div>
              <div style={{ fontSize:10, fontWeight:700, color:C.muted, letterSpacing:2, marginTop:3 }}>EXERCISES</div>
            </div>
          </div>
        )}

        {/* START WORKOUT */}
        {day.exercises.length > 0 && (
          <button onClick={startWorkout} style={{
            width:'100%',
            background:`linear-gradient(90deg, ${day.accent || C.accent}, #5856D6)`,
            border:'none', borderRadius:15, padding:'16px',
            fontFamily:font.heading, fontSize:21, fontWeight:700, letterSpacing:2,
            color:C.white, marginBottom:24,
            boxShadow:`0 4px 28px ${day.accent || C.accentGlow}55`,
            display:'flex', alignItems:'center', justifyContent:'center', gap:10,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill={C.white}><polygon points="5 3 19 12 5 21 5 3"/></svg>
            START WORKOUT
          </button>
        )}

        {/* EXERCISE LIST */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
          <h4 style={{ fontFamily:font.heading, fontWeight:700, fontSize:13, letterSpacing:2.5, color:C.muted }}>
            EXERCISES
          </h4>
          <button onClick={() => setShowAddEx(true)} style={{
            background:C.accentBg, border:`1px solid rgba(10,132,255,0.35)`,
            borderRadius:8, padding:'5px 12px',
            fontSize:12, fontWeight:700, color:C.accent,
            display:'flex', alignItems:'center', gap:5,
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Add
          </button>
        </div>

        {day.exercises.length === 0 ? (
          <div style={{ textAlign:'center', padding:'40px 20px', border:`1px dashed ${C.border}`, borderRadius:16 }}>
            <div style={{ fontSize:36, marginBottom:12 }}>💪</div>
            <p style={{ color:C.muted, fontSize:14 }}>No exercises yet. Add some to get started.</p>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {day.exercises.map((ex, i) => (
              <div key={ex.id} style={{
                background:C.card, border:`1px solid ${C.border}`,
                borderRadius:14, overflow:'hidden',
              }}>
                {/* Exercise header */}
                <div style={{ padding:'12px 14px', display:'flex', alignItems:'center', gap:12 }}>
                  <div style={{
                    width:38, height:38, borderRadius:10, flexShrink:0,
                    background:C.card2, border:`1px solid ${C.border}`,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontFamily:font.heading, fontWeight:900, fontSize:16, color:C.muted,
                  }}>{i + 1}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:15, fontWeight:600, color:C.white }}>{ex.name}</div>
                    <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>
                      {ex.sets.length} sets
                    </div>
                  </div>
                  <button onClick={() => setConfirmDelete(confirmDelete === i ? null : i)} style={{
                    background:'none', border:'none', padding:'4px', lineHeight:0, color:C.muted,
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>
                    </svg>
                  </button>
                </div>

                {/* Delete confirm */}
                {confirmDelete === i && (
                  <div style={{ padding:'0 14px 12px', display:'flex', gap:8 }}>
                    <button onClick={() => setConfirmDelete(null)} style={{
                      flex:1, background:'none', border:`1px solid ${C.border}`, borderRadius:8,
                      padding:'8px', fontSize:13, color:C.muted, fontWeight:600,
                    }}>Keep</button>
                    <button onClick={() => deleteExercise(i)} style={{
                      flex:1, background:'rgba(255,69,58,0.15)', border:'1px solid rgba(255,69,58,0.4)',
                      borderRadius:8, padding:'8px', fontSize:13, color:'#FF453A', fontWeight:700,
                    }}>Delete</button>
                  </div>
                )}

                {/* Set rows */}
                <div style={{ borderTop:`1px solid ${C.border}`, padding:'8px 14px 12px' }}>
                  <div style={{ display:'grid', gridTemplateColumns:'28px 1fr 1fr 1fr', gap:6, marginBottom:6, padding:'0 2px' }}>
                    {['', 'TYPE', 'REPS', 'WEIGHT'].map((h) => (
                      <span key={h} style={{ fontSize:9, fontWeight:700, color:C.muted, letterSpacing:1.2 }}>{h}</span>
                    ))}
                  </div>
                  {ex.sets.map((set, si) => {
                    const col = SET_COLORS[set.type] || C.accent;
                    return (
                      <div key={si} style={{ display:'grid', gridTemplateColumns:'28px 1fr 1fr 1fr', gap:6, marginBottom:5, alignItems:'center' }}>
                        <span style={{ fontFamily:font.heading, fontWeight:900, fontSize:12, color:C.muted }}>{si+1}</span>
                        <span style={{
                          background:`${col}22`, border:`1px solid ${col}44`, borderRadius:6,
                          padding:'3px 0', textAlign:'center',
                          fontSize:11, fontWeight:700, color:col,
                        }}>{SET_LABELS[set.type] || 'W'} {set.type}</span>
                        <span style={{ fontSize:13, fontWeight:600, color:C.white, textAlign:'center' }}>{set.reps}</span>
                        <span style={{ fontSize:13, fontWeight:600, color:C.muted, textAlign:'center' }}>
                          {set.weight === 'BW' ? 'BW' : set.weight ? `${set.weight} lbs` : '—'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {day.exercises.length === 0 && (
          <button onClick={() => setShowAddEx(true)} style={{
            width:'100%', marginTop:16,
            background:`linear-gradient(90deg, ${C.accent}, #5856D6)`,
            border:'none', borderRadius:15, padding:'16px',
            fontFamily:font.heading, fontSize:20, fontWeight:700, letterSpacing:2,
            color:C.white, boxShadow:`0 4px 28px ${C.accentGlow}`,
            display:'flex', alignItems:'center', justifyContent:'center', gap:10,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            ADD FIRST EXERCISE
          </button>
        )}
      </div>

      {/* ADD EXERCISE MODAL */}
      {showAddEx && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.88)', backdropFilter:'blur(8px)', zIndex:300, display:'flex', alignItems:'flex-end', justifyContent:'center' }}
          onClick={() => setShowAddEx(false)}>
          <div style={{ background:C.card, borderRadius:'22px 22px 0 0', width:'100%', maxWidth:600, padding:'24px 20px 40px', maxHeight:'90vh', overflowY:'auto' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ width:36, height:4, background:C.border, borderRadius:2, margin:'0 auto 20px' }}/>
            <h3 style={{ fontFamily:font.heading, fontWeight:900, fontSize:22, letterSpacing:1, marginBottom:18, color:C.white }}>ADD EXERCISE</h3>

            {/* Exercise name */}
            <div style={{ marginBottom:16 }}>
              <label style={{ display:'block', fontSize:11, fontWeight:700, color:C.muted, letterSpacing:1.5, marginBottom:6 }}>EXERCISE NAME</label>
              <input value={exName} onChange={e => setExName(e.target.value)}
                placeholder="e.g. Barbell Bench Press" autoFocus
                style={{ width:'100%', background:C.card2, border:`1px solid ${C.border}`, borderRadius:10, padding:'11px 14px', fontSize:15, color:C.white }}/>
            </div>

            {/* Sets */}
            <div style={{ marginBottom:16 }}>
              <label style={{ display:'block', fontSize:11, fontWeight:700, color:C.muted, letterSpacing:1.5, marginBottom:10 }}>SETS</label>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 36px', gap:6, marginBottom:8, padding:'0 4px' }}>
                {['TYPE', 'REPS', 'WEIGHT', ''].map(h => (
                  <span key={h} style={{ fontSize:10, fontWeight:700, color:C.muted, letterSpacing:1 }}>{h}</span>
                ))}
              </div>
              {exSets.map((s, i) => (
                <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 36px', gap:6, marginBottom:8, alignItems:'center' }}>
                  <select value={s.type} onChange={e => updateFormSet(i, 'type', e.target.value)} style={{
                    background:C.card2, border:`1px solid ${SET_COLORS[s.type]}55`, borderRadius:8,
                    padding:'8px 6px', fontSize:12, fontWeight:700,
                    color: SET_COLORS[s.type],
                  }}>
                    <option value="working">Working</option>
                    <option value="drop">Drop</option>
                    <option value="amrap">AMRAP</option>
                  </select>
                  <input value={s.reps} onChange={e => updateFormSet(i, 'reps', e.target.value)}
                    placeholder="8-10"
                    style={{ background:C.card2, border:`1px solid ${C.border}`, borderRadius:8, padding:'8px', fontSize:13, color:C.white, textAlign:'center' }}/>
                  <input value={s.weight} onChange={e => updateFormSet(i, 'weight', e.target.value)}
                    placeholder="lbs"
                    style={{ background:C.card2, border:`1px solid ${C.border}`, borderRadius:8, padding:'8px', fontSize:13, color:C.white, textAlign:'center' }}/>
                  <button onClick={() => removeFormSet(i)} disabled={exSets.length === 1} style={{
                    background:'none', border:`1px solid ${exSets.length === 1 ? C.faint : 'rgba(255,69,58,0.4)'}`,
                    borderRadius:8, width:36, height:36,
                    color: exSets.length === 1 ? C.faint : '#FF453A', fontSize:18,
                    display:'flex', alignItems:'center', justifyContent:'center',
                  }}>×</button>
                </div>
              ))}
              <button onClick={addSetToForm} style={{
                width:'100%', background:'none', border:`1px dashed ${C.border}`,
                borderRadius:8, padding:'8px', color:C.muted, fontSize:13, fontWeight:600,
                display:'flex', alignItems:'center', justifyContent:'center', gap:6,
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Add Set
              </button>
            </div>

            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setShowAddEx(false)} style={{
                flex:1, background:'none', border:`1px solid ${C.border}`,
                borderRadius:12, padding:'13px', color:C.muted, fontSize:14, fontWeight:600,
              }}>Cancel</button>
              <button onClick={addExercise} disabled={!exName.trim()} style={{
                flex:2,
                background: exName.trim() ? `linear-gradient(90deg, ${C.accent}, #5856D6)` : C.faint,
                border:'none', borderRadius:12, padding:'13px',
                fontFamily:font.heading, fontSize:18, fontWeight:700, letterSpacing:1, color:C.white,
              }}>SAVE EXERCISE</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
