'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  getPrograms, savePrograms, getCurrentWorkout,
  syncProgramsToFirestore,
} from '../../../lib/workoutSync';
import { useAuth } from '../../../lib/AuthContext';

const C = {
  bg:'#0D0D0D', card:'#1A1A1A', card2:'#222222', border:'#2C2C2C',
  accent:'#0A84FF', accentBg:'rgba(10,132,255,0.12)', accentGlow:'rgba(10,132,255,0.35)',
  white:'#FFFFFF', muted:'#888888', faint:'#3A3A3A', success:'#30D158',
  danger:'#FF453A', dangerBg:'rgba(255,69,58,0.12)',
};
const font = { heading:"'Barlow Condensed', sans-serif", body:"'DM Sans', sans-serif" };
const SET_COLORS = { working:'#0A84FF', drop:'#FF9F0A', amrap:'#BF5AF2' };
const SET_LABELS = { working:'W', drop:'D', amrap:'A' };

// ─── EXERCISE MODAL (add + edit) ──────────────────────────────────────────────
function ExerciseModal({ initial, onSave, onClose }) {
  const [name, setName] = useState(initial?.name || '');
  const [sets, setSets] = useState(
    initial?.sets?.length
      ? initial.sets.map(s => ({ ...s }))
      : [{ type:'working', reps:'8-10', weight:'', rest:'90' }]
  );

  function updateSet(i, field, val) {
    setSets(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: val } : s));
  }
  function addSet() {
    const last = sets[sets.length - 1];
    setSets(prev => [...prev, { type: last?.type || 'working', reps: last?.reps || '8-10', weight: last?.weight || '', rest: last?.rest || '90' }]);
  }
  function removeSet(i) {
    if (sets.length === 1) return;
    setSets(prev => prev.filter((_, idx) => idx !== i));
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.88)', backdropFilter:'blur(8px)', zIndex:300, display:'flex', alignItems:'flex-end', justifyContent:'center' }}
      onClick={onClose}>
      <div style={{ background:C.card, borderRadius:'22px 22px 0 0', width:'100%', maxWidth:600, padding:'24px 20px 40px', maxHeight:'92vh', overflowY:'auto' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ width:36, height:4, background:C.border, borderRadius:2, margin:'0 auto 20px' }}/>
        <h3 style={{ fontFamily:font.heading, fontWeight:900, fontSize:22, letterSpacing:1, marginBottom:18, color:C.white }}>
          {initial ? 'EDIT EXERCISE' : 'ADD EXERCISE'}
        </h3>

        {/* Name */}
        <div style={{ marginBottom:16 }}>
          <label style={{ display:'block', fontSize:11, fontWeight:700, color:C.muted, letterSpacing:1.5, marginBottom:6 }}>EXERCISE NAME</label>
          <input value={name} onChange={e => setName(e.target.value)}
            placeholder="e.g. Barbell Bench Press" autoFocus
            style={{ width:'100%', background:C.card2, border:`1px solid ${C.border}`, borderRadius:10, padding:'12px 14px', fontSize:15, color:C.white, outline:'none' }}/>
        </div>

        {/* Sets */}
        <div style={{ marginBottom:16 }}>
          <label style={{ display:'block', fontSize:11, fontWeight:700, color:C.muted, letterSpacing:1.5, marginBottom:10 }}>SETS</label>

          {/* Column headers */}
          <div style={{ display:'grid', gridTemplateColumns:'32px 1fr 80px 72px 36px', gap:6, marginBottom:8, padding:'0 2px' }}>
            {['#', 'TYPE', 'REPS', 'WT (lbs)', ''].map(h => (
              <span key={h} style={{ fontSize:10, fontWeight:700, color:C.muted, letterSpacing:1 }}>{h}</span>
            ))}
          </div>

          {sets.map((s, i) => (
            <div key={i} style={{ display:'grid', gridTemplateColumns:'32px 1fr 80px 72px 36px', gap:6, marginBottom:8, alignItems:'center' }}>
              <span style={{ fontFamily:font.heading, fontWeight:900, fontSize:14, color:C.muted, textAlign:'center' }}>{i+1}</span>
              <select value={s.type} onChange={e => updateSet(i, 'type', e.target.value)} style={{
                background:C.card2, border:`1px solid ${SET_COLORS[s.type]}55`,
                borderRadius:8, padding:'9px 6px', fontSize:12, fontWeight:700,
                color:SET_COLORS[s.type], outline:'none',
              }}>
                <option value="working">Working</option>
                <option value="drop">Drop</option>
                <option value="amrap">AMRAP</option>
              </select>
              <input value={s.reps} onChange={e => updateSet(i, 'reps', e.target.value)}
                placeholder="8-10"
                style={{ background:C.card2, border:`1px solid ${C.border}`, borderRadius:8, padding:'9px 6px', fontSize:13, color:C.white, textAlign:'center', outline:'none' }}/>
              <input value={s.weight} onChange={e => updateSet(i, 'weight', e.target.value)}
                placeholder="—"
                style={{ background:C.card2, border:`1px solid ${C.border}`, borderRadius:8, padding:'9px 6px', fontSize:13, color:C.white, textAlign:'center', outline:'none' }}/>
              <button onClick={() => removeSet(i)} disabled={sets.length === 1} style={{
                background:'none', border:`1px solid ${sets.length === 1 ? C.faint : 'rgba(255,69,58,0.4)'}`,
                borderRadius:8, width:36, height:36, color: sets.length === 1 ? C.faint : C.danger, fontSize:18,
                display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer',
              }}>×</button>
            </div>
          ))}

          {/* Rest time row */}
          <div style={{ marginTop:4, marginBottom:12 }}>
            <label style={{ display:'block', fontSize:11, fontWeight:700, color:C.muted, letterSpacing:1.5, marginBottom:6 }}>REST (seconds, applies to all sets)</label>
            <input value={sets[0]?.rest || '90'} onChange={e => setSets(prev => prev.map(s => ({ ...s, rest: e.target.value })))}
              placeholder="90"
              style={{ width:'100px', background:C.card2, border:`1px solid ${C.border}`, borderRadius:8, padding:'9px 12px', fontSize:14, color:C.white, textAlign:'center', outline:'none' }}/>
          </div>

          <button onClick={addSet} style={{
            width:'100%', background:'none', border:`1px dashed ${C.border}`,
            borderRadius:8, padding:'10px', color:C.muted, fontSize:13, fontWeight:600,
            display:'flex', alignItems:'center', justifyContent:'center', gap:6, cursor:'pointer',
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Add Set
          </button>
        </div>

        <div style={{ display:'flex', gap:10 }}>
          <button onClick={onClose} style={{
            flex:1, background:'none', border:`1px solid ${C.border}`,
            borderRadius:12, padding:'13px', color:C.muted, fontSize:14, fontWeight:600, cursor:'pointer',
          }}>Cancel</button>
          <button onClick={() => name.trim() && onSave(name.trim(), sets)} disabled={!name.trim()} style={{
            flex:2,
            background: name.trim() ? `linear-gradient(90deg,${C.accent},#5856D6)` : C.faint,
            border:'none', borderRadius:12, padding:'13px',
            fontFamily:font.heading, fontSize:18, fontWeight:700, letterSpacing:1, color:C.white, cursor:'pointer',
          }}>SAVE</button>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function WorkoutDetail() {
  const router = useRouter();
  const { user } = useAuth();

  const [program,       setProgram]       = useState(null);
  const [day,           setDay]           = useState(null);
  const [exMenu,        setExMenu]        = useState(null);  // index of exercise with open menu
  const [editingEx,     setEditingEx]     = useState(null);  // null = add, index = edit
  const [showAddEx,     setShowAddEx]     = useState(false);
  const [editingDayName, setEditingDayName] = useState(false);
  const [tempDayName,   setTempDayName]   = useState('');

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

  // ── Persistence helpers ───────────────────────────────────────────────────
  function persist(updatedDay) {
    const programs = getPrograms();
    const pi = programs.findIndex(p => p.id === program.id);
    if (pi === -1) return;
    const di = programs[pi].days.findIndex(d => d.id === updatedDay.id);
    if (di === -1) return;
    programs[pi].days[di] = updatedDay;
    savePrograms(programs);
    setDay(updatedDay);
    setProgram({ ...program, days: programs[pi].days });
    if (user) syncProgramsToFirestore(user.uid, programs);
  }

  // ── Exercise actions ──────────────────────────────────────────────────────
  function saveExercise(name, sets, editIdx) {
    const exercises = [...(day.exercises || [])];
    if (editIdx != null) {
      exercises[editIdx] = { ...exercises[editIdx], name, sets };
    } else {
      exercises.push({ id:`ex-${Date.now()}`, name, sets });
    }
    persist({ ...day, exercises });
    setShowAddEx(false);
    setEditingEx(null);
    setExMenu(null);
  }

  function deleteExercise(idx) {
    persist({ ...day, exercises: day.exercises.filter((_, i) => i !== idx) });
    setExMenu(null);
  }

  function moveExercise(idx, dir) {
    const exs = [...day.exercises];
    const target = idx + dir;
    if (target < 0 || target >= exs.length) return;
    [exs[idx], exs[target]] = [exs[target], exs[idx]];
    persist({ ...day, exercises: exs });
    setExMenu(null);
  }

  // ── Day name editing ──────────────────────────────────────────────────────
  function saveDayName() {
    if (!tempDayName.trim()) { setEditingDayName(false); return; }
    persist({ ...day, name: tempDayName.trim() });
    setEditingDayName(false);
  }

  if (!day) return (
    <div style={{ background:C.bg, minHeight:'100dvh', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:32, height:32, borderRadius:'50%', border:`3px solid ${C.border}`, borderTopColor:C.accent, animation:'spin 0.8s linear infinite' }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  const totalSets = day.exercises.reduce((s, e) => s + e.sets.length, 0);

  return (
    <div style={{ fontFamily:font.body, background:C.bg, minHeight:'100dvh', color:C.white, overflowX:'hidden' }}
      onClick={() => exMenu !== null && setExMenu(null)}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;900&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{display:none}
        button{cursor:pointer;font-family:inherit}
        input,select{outline:none;font-family:inherit}
      `}</style>

      {/* CINEMATIC HERO */}
      <div style={{
        height:220, position:'relative', overflow:'hidden',
        background: day.grad || 'linear-gradient(160deg,#060d1a 0%,#0e1a30 35%,#111827 65%,#0a0a0a 100%)',
      }}>
        <div style={{ position:'absolute', top:-70, left:-50, width:260, height:260, borderRadius:'50%', background:`radial-gradient(circle,${day.accent || C.accent}22 0%,transparent 65%)`, pointerEvents:'none' }}/>
        <div style={{ position:'absolute', bottom:0, right:-30, width:220, height:200, background:'radial-gradient(ellipse at 100% 100%,rgba(88,86,214,0.1) 0%,transparent 60%)', pointerEvents:'none' }}/>
        <div style={{ position:'absolute', inset:0, opacity:0.04, backgroundImage:'linear-gradient(rgba(255,255,255,0.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.5) 1px,transparent 1px)', backgroundSize:'32px 32px', pointerEvents:'none' }}/>

        {/* Top bar */}
        <div style={{ position:'absolute', top:0, left:0, right:0, zIndex:10, padding:'14px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', background:'linear-gradient(to bottom,rgba(0,0,0,0.55),transparent)' }}>
          <button onClick={() => router.push('/workout')} style={{ background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.14)', borderRadius:10, padding:'6px 12px', display:'flex', alignItems:'center', gap:5, color:C.white, backdropFilter:'blur(8px)' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
            <span style={{ fontSize:13, fontWeight:600 }}>Back</span>
          </button>
          {/* Edit day name button */}
          <button onClick={() => { setTempDayName(day.name); setEditingDayName(true); }} style={{ background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.14)', borderRadius:10, padding:'8px 12px', backdropFilter:'blur(8px)', display:'flex', alignItems:'center', gap:6, color:C.white, fontSize:13, fontWeight:600 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Rename
          </button>
        </div>

        {/* Title */}
        <div style={{ position:'absolute', bottom:0, left:0, right:0, zIndex:10, padding:'0 18px 18px', background:'linear-gradient(to top,rgba(13,13,13,0.95) 0%,rgba(13,13,13,0.4) 60%,transparent 100%)' }}>
          <span style={{ background:`${day.accent || C.accent}22`, border:`1px solid ${day.accent || C.accent}55`, borderRadius:6, padding:'2px 9px', fontSize:10, fontWeight:700, color:day.accent || C.accent, letterSpacing:2, display:'inline-block', marginBottom:6 }}>
            DAY {day.dayNumber}
          </span>
          <h1 style={{ fontFamily:font.heading, fontWeight:900, fontSize:38, letterSpacing:1, lineHeight:1, color:C.white, textTransform:'uppercase' }}>
            {day.name}
          </h1>
        </div>
      </div>

      {/* CONTENT */}
      <div style={{ padding:'0 16px 140px' }}>

        {/* STATS BAR */}
        {day.exercises.length > 0 && (
          <div style={{ background:`linear-gradient(90deg,${day.accent || C.accent}2a,rgba(88,86,214,0.12))`, border:`1px solid ${day.accent || C.accent}44`, borderRadius:14, padding:'14px 24px', display:'flex', alignItems:'stretch', margin:'16px 0 20px' }}>
            <div style={{ flex:1, textAlign:'center', borderRight:`1px solid ${day.accent || C.accent}33`, paddingRight:24 }}>
              <div style={{ fontFamily:font.heading, fontWeight:900, fontSize:34, color:day.accent || C.accent, lineHeight:1 }}>{totalSets}</div>
              <div style={{ fontSize:10, fontWeight:700, color:C.muted, letterSpacing:2, marginTop:3 }}>SETS</div>
            </div>
            <div style={{ flex:1, textAlign:'center', paddingLeft:24 }}>
              <div style={{ fontFamily:font.heading, fontWeight:900, fontSize:34, color:day.accent || C.accent, lineHeight:1 }}>{day.exercises.length}</div>
              <div style={{ fontSize:10, fontWeight:700, color:C.muted, letterSpacing:2, marginTop:3 }}>EXERCISES</div>
            </div>
          </div>
        )}

        {/* START WORKOUT */}
        {day.exercises.length > 0 && (
          <button onClick={() => router.push('/workout/log')} style={{
            width:'100%', background:`linear-gradient(90deg,${day.accent || C.accent},#5856D6)`,
            border:'none', borderRadius:15, padding:'16px',
            fontFamily:font.heading, fontSize:21, fontWeight:700, letterSpacing:2,
            color:C.white, marginBottom:24, boxShadow:`0 4px 28px ${day.accent || C.accentGlow}55`,
            display:'flex', alignItems:'center', justifyContent:'center', gap:10,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill={C.white}><polygon points="5 3 19 12 5 21 5 3"/></svg>
            START WORKOUT
          </button>
        )}

        {/* EXERCISE LIST HEADER */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
          <h4 style={{ fontFamily:font.heading, fontWeight:700, fontSize:13, letterSpacing:2.5, color:C.muted }}>EXERCISES</h4>
          <button onClick={() => { setEditingEx(null); setShowAddEx(true); }} style={{
            background:C.accentBg, border:`1px solid rgba(10,132,255,0.35)`,
            borderRadius:8, padding:'6px 14px', fontSize:12, fontWeight:700, color:C.accent,
            display:'flex', alignItems:'center', gap:5,
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add Exercise
          </button>
        </div>

        {/* EXERCISE CARDS */}
        {day.exercises.length === 0 ? (
          <div style={{ textAlign:'center', padding:'40px 20px', border:`1px dashed ${C.border}`, borderRadius:16 }}>
            <div style={{ fontSize:36, marginBottom:12 }}>💪</div>
            <p style={{ color:C.muted, fontSize:14 }}>No exercises yet. Add some to get started.</p>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {day.exercises.map((ex, i) => (
              <div key={ex.id} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:16, overflow:'visible', position:'relative' }}>

                {/* Exercise header */}
                <div style={{ padding:'14px 14px 10px', display:'flex', alignItems:'center', gap:12 }}>
                  {/* Number + reorder */}
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, flexShrink:0 }}>
                    <button onClick={() => moveExercise(i, -1)} disabled={i === 0} style={{
                      background:'none', border:'none', padding:'2px 6px', color: i === 0 ? C.faint : C.muted, lineHeight:1,
                    }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="18 15 12 9 6 15"/></svg>
                    </button>
                    <div style={{ width:34, height:34, borderRadius:9, background:C.card2, border:`1px solid ${C.border}`, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:font.heading, fontWeight:900, fontSize:16, color:C.muted }}>
                      {i + 1}
                    </div>
                    <button onClick={() => moveExercise(i, 1)} disabled={i === day.exercises.length - 1} style={{
                      background:'none', border:'none', padding:'2px 6px', color: i === day.exercises.length - 1 ? C.faint : C.muted, lineHeight:1,
                    }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
                    </button>
                  </div>

                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:15, fontWeight:600, color:C.white }}>{ex.name}</div>
                    <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>
                      {ex.sets.length} sets · {ex.sets.map(s => SET_LABELS[s.type] || 'W').join(', ')}
                    </div>
                  </div>

                  {/* ··· menu button */}
                  <button onClick={e => { e.stopPropagation(); setExMenu(exMenu === i ? null : i); }} style={{
                    background: exMenu === i ? C.accentBg : 'none',
                    border:`1px solid ${exMenu === i ? 'rgba(10,132,255,0.3)' : 'transparent'}`,
                    borderRadius:8, padding:'6px 8px', lineHeight:0, color:C.muted,
                  }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <circle cx="12" cy="5" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="19" r="1" fill="currentColor"/>
                    </svg>
                  </button>
                </div>

                {/* Dropdown menu */}
                {exMenu === i && (
                  <div style={{ position:'absolute', right:12, top:48, zIndex:100, background:C.card2, border:`1px solid ${C.border}`, borderRadius:12, overflow:'hidden', minWidth:160, boxShadow:'0 8px 32px rgba(0,0,0,0.5)' }}
                    onClick={e => e.stopPropagation()}>
                    <button onClick={() => { setEditingEx(i); setShowAddEx(true); setExMenu(null); }} style={{ width:'100%', background:'none', border:'none', padding:'12px 16px', textAlign:'left', fontSize:14, fontWeight:600, color:C.white, display:'flex', alignItems:'center', gap:10 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      Edit Exercise
                    </button>
                    <div style={{ height:1, background:C.border }}/>
                    <button onClick={() => { moveExercise(i, -1); }} disabled={i === 0} style={{ width:'100%', background:'none', border:'none', padding:'12px 16px', textAlign:'left', fontSize:14, fontWeight:600, color: i === 0 ? C.faint : C.muted, display:'flex', alignItems:'center', gap:10 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="18 15 12 9 6 15"/></svg>
                      Move Up
                    </button>
                    <button onClick={() => { moveExercise(i, 1); }} disabled={i === day.exercises.length - 1} style={{ width:'100%', background:'none', border:'none', padding:'12px 16px', textAlign:'left', fontSize:14, fontWeight:600, color: i === day.exercises.length - 1 ? C.faint : C.muted, display:'flex', alignItems:'center', gap:10 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
                      Move Down
                    </button>
                    <div style={{ height:1, background:C.border }}/>
                    <button onClick={() => deleteExercise(i)} style={{ width:'100%', background:'none', border:'none', padding:'12px 16px', textAlign:'left', fontSize:14, fontWeight:700, color:C.danger, display:'flex', alignItems:'center', gap:10 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.danger} strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                      Delete
                    </button>
                  </div>
                )}

                {/* Set breakdown */}
                <div style={{ borderTop:`1px solid ${C.border}`, padding:'10px 14px 14px' }}>
                  <div style={{ display:'grid', gridTemplateColumns:'24px 1fr 1fr 1fr 60px', gap:6, marginBottom:6 }}>
                    {['', 'TYPE', 'REPS', 'WEIGHT', 'REST'].map(h => (
                      <span key={h} style={{ fontSize:9, fontWeight:700, color:C.muted, letterSpacing:1 }}>{h}</span>
                    ))}
                  </div>
                  {ex.sets.map((set, si) => {
                    const col = SET_COLORS[set.type] || C.accent;
                    return (
                      <div key={si} style={{ display:'grid', gridTemplateColumns:'24px 1fr 1fr 1fr 60px', gap:6, marginBottom:6, alignItems:'center' }}>
                        <span style={{ fontFamily:font.heading, fontWeight:900, fontSize:12, color:C.muted, textAlign:'center' }}>{si+1}</span>
                        <span style={{ background:`${col}22`, border:`1px solid ${col}44`, borderRadius:6, padding:'4px 0', textAlign:'center', fontSize:11, fontWeight:700, color:col }}>
                          {SET_LABELS[set.type] || 'W'} · {set.type}
                        </span>
                        <span style={{ fontSize:13, fontWeight:600, color:C.white, textAlign:'center' }}>{set.reps || '—'}</span>
                        <span style={{ fontSize:13, fontWeight:600, color:C.muted, textAlign:'center' }}>
                          {set.weight === 'BW' ? 'BW' : set.weight ? `${set.weight}` : '—'}
                        </span>
                        <span style={{ fontSize:11, fontWeight:600, color:C.faint, textAlign:'center' }}>{set.rest || '90'}s</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {day.exercises.length === 0 && (
          <button onClick={() => { setEditingEx(null); setShowAddEx(true); }} style={{
            width:'100%', marginTop:16,
            background:`linear-gradient(90deg,${C.accent},#5856D6)`,
            border:'none', borderRadius:15, padding:'16px',
            fontFamily:font.heading, fontSize:20, fontWeight:700, letterSpacing:2,
            color:C.white, boxShadow:`0 4px 28px ${C.accentGlow}`,
            display:'flex', alignItems:'center', justifyContent:'center', gap:10,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            ADD FIRST EXERCISE
          </button>
        )}
      </div>

      {/* ADD / EDIT EXERCISE MODAL */}
      {showAddEx && (
        <ExerciseModal
          initial={editingEx != null ? day.exercises[editingEx] : null}
          onSave={(name, sets) => saveExercise(name, sets, editingEx)}
          onClose={() => { setShowAddEx(false); setEditingEx(null); }}
        />
      )}

      {/* RENAME DAY MODAL */}
      {editingDayName && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', backdropFilter:'blur(8px)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}
          onClick={() => setEditingDayName(false)}>
          <div style={{ background:C.card, borderRadius:20, width:'100%', maxWidth:420, padding:'28px 24px' }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ fontFamily:font.heading, fontWeight:900, fontSize:22, letterSpacing:1, marginBottom:16, color:C.white }}>RENAME DAY</h3>
            <input
              value={tempDayName} onChange={e => setTempDayName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveDayName()}
              autoFocus
              style={{ width:'100%', background:C.card2, border:`1px solid ${C.accent}55`, borderRadius:10, padding:'13px 14px', fontSize:16, color:C.white, outline:'none', marginBottom:16 }}
            />
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setEditingDayName(false)} style={{ flex:1, background:'none', border:`1px solid ${C.border}`, borderRadius:12, padding:'13px', color:C.muted, fontSize:14, fontWeight:600, cursor:'pointer' }}>Cancel</button>
              <button onClick={saveDayName} style={{ flex:2, background:`linear-gradient(90deg,${C.accent},#5856D6)`, border:'none', borderRadius:12, padding:'13px', fontFamily:font.heading, fontSize:18, fontWeight:700, letterSpacing:1, color:C.white, cursor:'pointer' }}>SAVE</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
