'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getPrograms, getCurrentWorkout, saveSession, syncSessionToFirestore } from '../../../lib/workoutSync';
import { useAuth } from '../../../lib/AuthContext';

const C = {
  bg:'#0D0D0D', card:'#1A1A1A', card2:'#242424', border:'#2C2C2C',
  accent:'#0A84FF', accentBg:'rgba(10,132,255,0.12)', accentGlow:'rgba(10,132,255,0.4)',
  white:'#FFFFFF', muted:'#888888', faint:'#3A3A3A',
  success:'#30D158', successBg:'rgba(48,209,88,0.12)',
  danger:'#FF453A', dangerBg:'rgba(255,69,58,0.12)',
};
const font = { heading:"'Barlow Condensed', sans-serif", body:"'DM Sans', sans-serif", mono:"'Courier New', monospace" };
const SET_TYPES = {
  working:{ label:'W', color:'#0A84FF', bg:'rgba(10,132,255,0.15)', name:'Working' },
  drop:   { label:'D', color:'#FF9F0A', bg:'rgba(255,159,10,0.15)', name:'Drop'   },
  amrap:  { label:'A', color:'#BF5AF2', bg:'rgba(191,90,242,0.15)', name:'AMRAP' },
};

function fmtTime(s) {
  const h=Math.floor(s/3600), m=Math.floor((s%3600)/60), sec=s%60;
  if(h>0) return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}

function RestTimer({ total, onDone }) {
  const [rem, setRem] = useState(total);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const iv = setInterval(() => {
      setRem(r => {
        if (r <= 1) { clearInterval(iv); setTimeout(() => onDoneRef.current(), 0); return 0; }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  const pct = ((total - rem) / total) * 100;
  const size=110, sw=7, r=(size-sw)/2, circ=2*Math.PI*r, dash=circ-(pct/100)*circ;

  return (
    <div style={{ position:'fixed', inset:0, zIndex:300, background:'rgba(0,0,0,0.88)', backdropFilter:'blur(10px)', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:24, padding:'32px 40px', textAlign:'center', minWidth:260 }}>
        <p style={{ fontSize:11, fontWeight:700, color:C.muted, letterSpacing:2.5, marginBottom:22 }}>REST TIME</p>
        <div style={{ position:'relative', width:size, height:size, margin:'0 auto 24px' }}>
          <svg width={size} height={size} style={{ transform:'rotate(-90deg)' }}>
            <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.border} strokeWidth={sw}/>
            <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.accent} strokeWidth={sw}
              strokeDasharray={circ} strokeDashoffset={dash} strokeLinecap="round"
              style={{ transition:'stroke-dashoffset 1s linear' }}/>
          </svg>
          <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:2 }}>
            <span style={{ fontFamily:font.heading, fontWeight:900, fontSize:32, color:C.white, lineHeight:1 }}>{rem}</span>
            <span style={{ fontSize:10, fontWeight:600, color:C.muted, letterSpacing:1 }}>SECS</span>
          </div>
        </div>
        <button onClick={() => onDoneRef.current()} style={{
          background:C.accentBg, border:`1px solid rgba(10,132,255,0.3)`,
          borderRadius:11, padding:'12px 40px', fontSize:15, fontWeight:700, color:C.accent, cursor:'pointer',
        }}>Skip Rest</button>
      </div>
    </div>
  );
}

export default function WorkoutLog() {
  const router = useRouter();
  const { user } = useAuth();

  const [program,   setProgram]   = useState(null);
  const [day,       setDay]       = useState(null);
  const [exercises, setExercises] = useState([]);
  const [elapsed,   setElapsed]   = useState(0);
  const [useKg,     setUseKg]     = useState(false);
  const [restTimer, setRestTimer] = useState(null);
  const [activeEx,  setActiveEx]  = useState(0);
  const [showDone,  setShowDone]  = useState(false);

  useEffect(() => {
    const ctx = getCurrentWorkout();
    if (!ctx) { router.replace('/workout'); return; }
    const programs = getPrograms();
    const prog = programs.find(p => p.id === ctx.programId);
    if (!prog) { router.replace('/workout'); return; }
    const d = prog.days.find(d => d.id === ctx.dayId);
    if (!d) { router.replace('/workout'); return; }
    setProgram(prog); setDay(d);
    setExercises(d.exercises.map(ex => ({
      id: ex.id, name: ex.name,
      sets: ex.sets.map((s, i) => ({
        id: i, type: s.type || 'working',
        targetReps: s.reps || '', targetWeight: s.weight || '',
        rest: parseInt(s.rest) || 90,
        actualReps: s.reps?.replace(/[^0-9∞]/g, '') || '',
        actualWeight: s.weight === 'BW' ? 'BW' : (s.weight || ''),
        logged: false,
      })),
    })));
  }, []);

  // Session clock — fixed with setInterval + ref
  const elapsedRef = useRef(0);
  useEffect(() => {
    const iv = setInterval(() => { elapsedRef.current += 1; setElapsed(e => e + 1); }, 1000);
    return () => clearInterval(iv);
  }, []);

  function logSet(exIdx, setId) {
    setExercises(prev => {
      const set = prev[exIdx]?.sets.find(s => s.id === setId);
      if (set && !set.logged) setRestTimer(set.rest || 90);
      return prev.map((ex, ei) => ei !== exIdx ? ex : {
        ...ex,
        sets: ex.sets.map(s => s.id !== setId || s.logged ? s : { ...s, logged: true }),
      });
    });
  }

  function updateSet(exIdx, setId, field, value) {
    setExercises(prev => prev.map((ex, ei) =>
      ei !== exIdx ? ex : { ...ex, sets: ex.sets.map(s => s.id !== setId ? s : { ...s, [field]: value }) }
    ));
  }

  function addSet(exIdx) {
    setExercises(prev => prev.map((ex, ei) => {
      if (ei !== exIdx) return ex;
      const last = ex.sets[ex.sets.length - 1];
      return { ...ex, sets: [...ex.sets, {
        id: Date.now(), type: last?.type || 'working',
        targetReps: last?.targetReps || '8-10', targetWeight: last?.targetWeight || '',
        rest: last?.rest || 90, actualReps: '', actualWeight: '', logged: false,
      }]};
    }));
  }

  function deleteSet(exIdx, setId) {
    setExercises(prev => prev.map((ex, ei) =>
      ei !== exIdx ? ex : { ...ex, sets: ex.sets.filter(s => s.id !== setId) }
    ));
  }

  const totalSets  = exercises.reduce((s, ex) => s + ex.sets.length, 0);
  const loggedSets = exercises.reduce((s, ex) => s + ex.sets.filter(s => s.logged).length, 0);
  const allDone    = totalSets > 0 && loggedSets === totalSets;

  function finishWorkout() {
    if (!day || !program) return;
    const session = {
      id: `session-${Date.now()}`,
      date: new Date().toISOString(),
      programId: program.id, dayId: day.id, dayName: day.name,
      duration: elapsed,
      exercises: exercises.map(ex => ({
        name: ex.name,
        sets: ex.sets.map(s => ({ type:s.type, reps:s.actualReps, weight:s.actualWeight, logged:s.logged })),
      })),
    };
    saveSession(session);
    if (user) syncSessionToFirestore(user.uid, session);
    setShowDone(true);
  }

  if (!day || exercises.length === 0) return (
    <div style={{ background:C.bg, minHeight:'100dvh', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:32, height:32, borderRadius:'50%', border:`3px solid ${C.border}`, borderTopColor:C.accent, animation:'spin 0.8s linear infinite' }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  const currentEx = exercises[activeEx];

  return (
    <div style={{ fontFamily:font.body, background:C.bg, minHeight:'100dvh', color:C.white, overflowX:'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;900&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{display:none}
        button{cursor:pointer;font-family:inherit}
        input{outline:none;border:none;background:transparent;font-family:inherit;color:#fff;width:100%;text-align:center}
        input::placeholder{color:#555}
        input::-webkit-outer-spin-button,input::-webkit-inner-spin-button{-webkit-appearance:none}
        input[type=number]{-moz-appearance:textfield}
      `}</style>

      {restTimer && <RestTimer total={restTimer} onDone={() => setRestTimer(null)}/>}

      {/* DONE OVERLAY */}
      {showDone && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.92)', backdropFilter:'blur(10px)', zIndex:400, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:24, padding:'36px 28px', textAlign:'center', maxWidth:340, width:'100%' }}>
            <div style={{ width:72, height:72, borderRadius:'50%', background:C.successBg, border:`2px solid ${C.success}`, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={C.success} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <h2 style={{ fontFamily:font.heading, fontWeight:900, fontSize:32, letterSpacing:1, marginBottom:8, color:C.white }}>WORKOUT DONE!</h2>
            <p style={{ color:C.muted, fontSize:14, marginBottom:6 }}>{day.name}</p>
            <p style={{ color:C.success, fontSize:16, fontWeight:700, marginBottom:28 }}>{fmtTime(elapsed)} · {loggedSets} sets completed</p>
            <button onClick={() => router.push('/workout')} style={{
              width:'100%', background:`linear-gradient(90deg, ${C.success}, #20b857)`,
              border:'none', borderRadius:14, padding:'16px',
              fontFamily:font.heading, fontSize:20, fontWeight:700, letterSpacing:1.5, color:C.white, cursor:'pointer',
            }}>BACK TO PROGRAMS</button>
          </div>
        </div>
      )}

      {/* TOP BAR */}
      <header style={{
        position:'sticky', top:0, zIndex:50,
        background:`${C.bg}f2`, backdropFilter:'blur(14px)',
        borderBottom:`1px solid ${C.border}`,
        padding:'12px 16px', display:'flex', alignItems:'center', gap:12,
      }}>
        <button onClick={() => router.push('/workout/detail')} style={{
          background:C.card2, border:`1px solid ${C.border}`,
          borderRadius:10, padding:'10px 12px', color:C.white, lineHeight:0,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:10, fontWeight:700, color:C.muted, letterSpacing:2 }}>NOW LOGGING</div>
          <div style={{ fontFamily:font.heading, fontWeight:900, fontSize:22, letterSpacing:0.5, lineHeight:1.1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
            {currentEx?.name || day.name.toUpperCase()}
          </div>
        </div>
        <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:11, padding:'8px 14px', display:'flex', flexDirection:'column', alignItems:'center', flexShrink:0 }}>
          <span style={{ fontFamily:font.mono, fontSize:19, fontWeight:700, color:C.accent, lineHeight:1 }}>{fmtTime(elapsed)}</span>
          <span style={{ fontSize:9, color:C.muted, fontWeight:700, letterSpacing:1 }}>TOTAL</span>
        </div>
      </header>

      {/* PROGRESS BAR */}
      <div style={{ padding:'10px 16px 0' }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
          <span style={{ fontSize:12, fontWeight:600, color:C.muted }}>{loggedSets} / {totalSets} sets</span>
          <span style={{ fontSize:12, fontWeight:700, color: allDone ? C.success : C.accent }}>
            {totalSets > 0 ? Math.round((loggedSets/totalSets)*100) : 0}%
          </span>
        </div>
        <div style={{ height:4, background:C.border, borderRadius:2, overflow:'hidden' }}>
          <div style={{
            height:'100%', borderRadius:2,
            width:`${totalSets > 0 ? (loggedSets/totalSets)*100 : 0}%`,
            background: allDone ? `linear-gradient(90deg,${C.success},#20b857)` : `linear-gradient(90deg,${C.accent},#5856D6)`,
            transition:'width 0.45s ease',
          }}/>
        </div>
      </div>

      {/* EXERCISE TABS */}
      <div style={{ padding:'12px 16px 0', display:'flex', gap:8, overflowX:'auto' }}>
        {exercises.map((ex, i) => {
          const done = ex.sets.length > 0 && ex.sets.every(s => s.logged);
          return (
            <button key={ex.id} onClick={() => setActiveEx(i)} style={{
              flexShrink:0,
              background: activeEx===i ? C.accentBg : C.card,
              border:`1px solid ${activeEx===i ? 'rgba(10,132,255,0.4)' : done ? 'rgba(48,209,88,0.35)' : C.border}`,
              borderRadius:10, padding:'8px 16px',
              fontSize:12, fontWeight:600,
              color: activeEx===i ? C.accent : done ? C.success : C.muted,
              whiteSpace:'nowrap',
            }}>
              {done ? '✓ ' : ''}{ex.name}
            </button>
          );
        })}
      </div>

      {/* KG / LBS */}
      <div style={{ padding:'10px 16px 0', display:'flex', justifyContent:'flex-end' }}>
        <button onClick={() => setUseKg(k => !k)} style={{
          background:C.card, border:`1px solid ${C.border}`, borderRadius:8, padding:'6px 14px',
          fontSize:12, fontWeight:700, color:C.muted, cursor:'pointer',
        }}>{useKg ? '⇄ LBS' : '⇄ KG'}</button>
      </div>

      {/* SET CARDS */}
      <main style={{ padding:'12px 16px 200px', display:'flex', flexDirection:'column', gap:12 }}>
        {currentEx?.sets.map((set, idx) => {
          const type = SET_TYPES[set.type] || SET_TYPES.working;
          if (set.logged) {
            // Compact logged row
            return (
              <div key={set.id} style={{
                background:C.successBg, border:`1px solid rgba(48,209,88,0.25)`,
                borderRadius:14, padding:'12px 16px',
                display:'flex', alignItems:'center', gap:12,
                opacity:0.8,
              }}>
                <div style={{ width:36, height:36, borderRadius:10, background:'rgba(48,209,88,0.2)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.success} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <div style={{ flex:1 }}>
                  <span style={{ fontSize:13, fontWeight:700, color:C.success }}>Set {idx+1} logged</span>
                  <span style={{ fontSize:12, color:C.muted, marginLeft:10 }}>
                    {set.actualReps || set.targetReps} reps · {set.actualWeight || set.targetWeight || '—'} {useKg ? 'kg' : 'lbs'}
                  </span>
                </div>
              </div>
            );
          }
          return (
            <div key={set.id} style={{
              background:C.card, border:`1px solid ${C.border}`,
              borderRadius:18, overflow:'hidden',
            }}>
              {/* Card header */}
              <div style={{ padding:'14px 16px 10px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{
                    width:48, height:48, borderRadius:14, flexShrink:0,
                    background:C.card2, border:`1px solid ${C.border}`,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontFamily:font.heading, fontWeight:900, fontSize:22, color:C.muted,
                  }}>{idx+1}</div>
                  <div style={{
                    background:type.bg, border:`1.5px solid ${type.color}55`,
                    borderRadius:20, padding:'6px 14px',
                    fontSize:13, fontWeight:700, color:type.color,
                  }}>{type.label} · {type.name}</div>
                </div>
                <button onClick={() => deleteSet(activeEx, set.id)} style={{
                  width:44, height:44, borderRadius:12,
                  background:C.dangerBg, border:`1px solid rgba(255,69,58,0.3)`,
                  color:C.danger, fontSize:20, lineHeight:1,
                  display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer',
                }}>×</button>
              </div>

              {/* Inputs */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, padding:'0 16px 14px' }}>
                <div style={{ background:C.card2, border:`1px solid ${C.border}`, borderRadius:12, padding:'12px 8px' }}>
                  <div style={{ fontSize:10, fontWeight:700, color:C.muted, letterSpacing:1.5, textAlign:'center', marginBottom:6 }}>REPS</div>
                  <input
                    type="text" inputMode="numeric"
                    value={set.actualReps}
                    onChange={e => updateSet(activeEx, set.id, 'actualReps', e.target.value)}
                    placeholder={set.targetReps || '—'}
                    style={{ fontSize:30, fontWeight:700, textAlign:'center', color:C.white }}
                  />
                </div>
                <div style={{ background:C.card2, border:`1px solid ${C.border}`, borderRadius:12, padding:'12px 8px' }}>
                  <div style={{ fontSize:10, fontWeight:700, color:C.muted, letterSpacing:1.5, textAlign:'center', marginBottom:6 }}>{useKg ? 'KG' : 'LBS'}</div>
                  <input
                    type="text" inputMode="decimal"
                    value={set.actualWeight}
                    onChange={e => updateSet(activeEx, set.id, 'actualWeight', e.target.value)}
                    placeholder={set.targetWeight || '—'}
                    style={{ fontSize:30, fontWeight:700, textAlign:'center', color:C.white }}
                  />
                </div>
              </div>

              {/* Log button */}
              <div style={{ padding:'0 16px 16px' }}>
                <button onClick={() => logSet(activeEx, set.id)} style={{
                  width:'100%', height:56,
                  background:`linear-gradient(90deg, ${C.accent}, #5856D6)`,
                  border:'none', borderRadius:14,
                  fontFamily:font.heading, fontSize:22, fontWeight:700, letterSpacing:2,
                  color:C.white, cursor:'pointer',
                  display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                  boxShadow:`0 4px 20px rgba(10,132,255,0.3)`,
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  LOG SET
                </button>
              </div>

              {/* Rest time hint */}
              <div style={{ padding:'0 16px 14px', textAlign:'center' }}>
                <span style={{ fontSize:11, color:C.muted }}>Rest after: {set.rest}s</span>
              </div>
            </div>
          );
        })}

        {/* Add set */}
        <button onClick={() => addSet(activeEx)} style={{
          width:'100%', background:'none', border:`2px dashed ${C.border}`,
          borderRadius:16, padding:'18px',
          fontSize:15, fontWeight:600, color:C.muted, cursor:'pointer',
          display:'flex', alignItems:'center', justifyContent:'center', gap:8,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Add Set
        </button>
      </main>

      {/* FINISH BUTTON */}
      <div style={{
        position:'fixed', bottom:0, left:0, right:0, zIndex:50,
        background:`${C.bg}f5`, backdropFilter:'blur(20px)',
        borderTop:`1px solid ${C.border}`,
        padding:'14px 16px max(18px, env(safe-area-inset-bottom))',
      }}>
        <button onClick={finishWorkout} style={{
          width:'100%', height:58,
          background: allDone ? `linear-gradient(90deg,${C.success},#20b857)` : `linear-gradient(90deg,${C.accent},#5856D6)`,
          border:'none', borderRadius:16,
          fontFamily:font.heading, fontSize:22, fontWeight:700, letterSpacing:2,
          color:C.white, cursor:'pointer',
          boxShadow:`0 4px 28px ${allDone ? 'rgba(48,209,88,0.4)' : C.accentGlow}`,
          transition:'all 0.3s ease',
        }}>
          {allDone ? '✓ FINISH WORKOUT' : `FINISH (${loggedSets}/${totalSets})`}
        </button>
      </div>
    </div>
  );
}
