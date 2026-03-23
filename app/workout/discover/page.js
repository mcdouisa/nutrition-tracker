'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  getPrograms, savePrograms, getActiveProgramId, setActiveProgramId,
  syncProgramsToFirestore, getPublicPrograms, PROGRAM_TYPES,
} from '../../../lib/workoutSync';
import { useAuth } from '../../../lib/AuthContext';

const C = {
  bg:'#0D0D0D', card:'#1A1A1A', card2:'#222222', border:'#2C2C2C',
  accent:'#0A84FF', accentBg:'rgba(10,132,255,0.12)',
  white:'#FFFFFF', muted:'#888888', faint:'#3A3A3A',
  success:'#30D158', successBg:'rgba(48,209,88,0.1)',
};
const font = { heading:"'Barlow Condensed', sans-serif", body:"'DM Sans', sans-serif" };

const TYPE_COLORS = {
  strength:   '#0A84FF',
  bodyweight: '#30D158',
  running:    '#FF9F0A',
  stretching: '#BF5AF2',
};

const GRAD_OPTIONS = [
  { grad: 'linear-gradient(135deg,#0a1628,#1a2744)', accent: '#0A84FF' },
  { grad: 'linear-gradient(135deg,#0a2818,#183a22)', accent: '#30D158' },
  { grad: 'linear-gradient(135deg,#280a0a,#3a1010)', accent: '#FF453A' },
  { grad: 'linear-gradient(135deg,#1a0a28,#2a1440)', accent: '#BF5AF2' },
  { grad: 'linear-gradient(135deg,#28180a,#3a2810)', accent: '#FF9F0A' },
];

// Demo programs shown when Firebase is not configured
const DEMO_PROGRAMS = [
  {
    id: 'demo-ppl',
    type: 'strength',
    name: 'Push / Pull / Legs',
    description: '5-day strength & hypertrophy split',
    authorId: 'demo',
    isPublic: true,
    days: [
      { id:'demo-d1', dayNumber:1, name:'Chest & Triceps', exercises:[
        { id:'de1', name:'Barbell Bench Press', sets:[{type:'working',reps:'6-8',weight:'185',rest:'90'},{type:'working',reps:'6-8',weight:'185',rest:'90'},{type:'working',reps:'6-8',weight:'185',rest:'90'}]},
        { id:'de2', name:'Incline Dumbbell Press', sets:[{type:'working',reps:'10-12',weight:'70',rest:'75'},{type:'working',reps:'10-12',weight:'70',rest:'75'}]},
        { id:'de3', name:'Tricep Pushdown', sets:[{type:'working',reps:'12-15',weight:'55',rest:'60'},{type:'drop',reps:'15',weight:'40',rest:'45'}]},
      ]},
      { id:'demo-d2', dayNumber:2, name:'Back & Biceps', exercises:[
        { id:'de4', name:'Deadlift', sets:[{type:'working',reps:'4-6',weight:'275',rest:'120'},{type:'working',reps:'4-6',weight:'275',rest:'120'}]},
        { id:'de5', name:'Barbell Row', sets:[{type:'working',reps:'6-8',weight:'165',rest:'90'},{type:'working',reps:'6-8',weight:'165',rest:'90'}]},
        { id:'de6', name:'Barbell Curl', sets:[{type:'working',reps:'10-12',weight:'85',rest:'60'},{type:'drop',reps:'15',weight:'60',rest:'45'}]},
      ]},
      { id:'demo-d3', dayNumber:3, name:'Legs', exercises:[
        { id:'de7', name:'Back Squat', sets:[{type:'working',reps:'5',weight:'225',rest:'120'},{type:'working',reps:'5',weight:'225',rest:'120'},{type:'working',reps:'5',weight:'225',rest:'120'}]},
        { id:'de8', name:'Romanian Deadlift', sets:[{type:'working',reps:'8-10',weight:'185',rest:'90'},{type:'working',reps:'8-10',weight:'185',rest:'90'}]},
        { id:'de9', name:'Leg Press', sets:[{type:'working',reps:'12-15',weight:'360',rest:'90'},{type:'drop',reps:'20',weight:'270',rest:'60'}]},
      ]},
    ],
  },
  {
    id: 'demo-bw',
    type: 'bodyweight',
    name: 'Bodyweight Builder',
    description: 'Full body calisthenics, no equipment needed',
    authorId: 'demo',
    isPublic: true,
    days: [
      { id:'demo-bw1', dayNumber:1, name:'Push', exercises:[
        { id:'bw1', name:'Push-ups', sets:[{type:'working',reps:'15',weight:'BW',rest:'60'},{type:'working',reps:'15',weight:'BW',rest:'60'},{type:'amrap',reps:'∞',weight:'BW',rest:'60'}]},
        { id:'bw2', name:'Pike Push-ups', sets:[{type:'working',reps:'10',weight:'BW',rest:'60'},{type:'working',reps:'10',weight:'BW',rest:'60'}]},
        { id:'bw3', name:'Tricep Dips', sets:[{type:'working',reps:'12',weight:'BW',rest:'60'},{type:'amrap',reps:'∞',weight:'BW',rest:'60'}]},
      ]},
      { id:'demo-bw2', dayNumber:2, name:'Pull', exercises:[
        { id:'bw4', name:'Pull-ups', sets:[{type:'amrap',reps:'∞',weight:'BW',rest:'90'},{type:'amrap',reps:'∞',weight:'BW',rest:'90'},{type:'amrap',reps:'∞',weight:'BW',rest:'90'}]},
        { id:'bw5', name:'Chin-ups', sets:[{type:'working',reps:'8',weight:'BW',rest:'75'},{type:'working',reps:'8',weight:'BW',rest:'75'}]},
        { id:'bw6', name:'Inverted Rows', sets:[{type:'working',reps:'12',weight:'BW',rest:'60'},{type:'working',reps:'12',weight:'BW',rest:'60'}]},
      ]},
      { id:'demo-bw3', dayNumber:3, name:'Legs & Core', exercises:[
        { id:'bw7', name:'Squats', sets:[{type:'working',reps:'20',weight:'BW',rest:'60'},{type:'working',reps:'20',weight:'BW',rest:'60'}]},
        { id:'bw8', name:'Bulgarian Split Squats', sets:[{type:'working',reps:'12',weight:'BW',rest:'75'},{type:'working',reps:'12',weight:'BW',rest:'75'}]},
        { id:'bw9', name:'Plank', sets:[{type:'working',reps:'60s',weight:'BW',rest:'45'},{type:'amrap',reps:'∞',weight:'BW',rest:'45'}]},
      ]},
    ],
  },
  {
    id: 'demo-run',
    type: 'running',
    name: '5K Training Plan',
    description: '4-week beginner running program',
    authorId: 'demo',
    isPublic: true,
    days: [
      { id:'demo-r1', dayNumber:1, name:'Easy Run', exercises:[
        { id:'r1', name:'Warm Up Walk', sets:[{distance:'0.25',pace:'15:00',rest:'0'}]},
        { id:'r2', name:'Easy Jog', sets:[{distance:'2',pace:'10:00',rest:'0'}]},
        { id:'r3', name:'Cool Down Walk', sets:[{distance:'0.25',pace:'15:00',rest:'0'}]},
      ]},
      { id:'demo-r2', dayNumber:2, name:'Intervals', exercises:[
        { id:'r4', name:'Warm Up', sets:[{distance:'0.5',pace:'10:30',rest:'0'}]},
        { id:'r5', name:'Fast Intervals', sets:[{distance:'0.25',pace:'8:00',rest:'120'},{distance:'0.25',pace:'8:00',rest:'120'},{distance:'0.25',pace:'8:00',rest:'120'},{distance:'0.25',pace:'8:00',rest:'120'}]},
        { id:'r6', name:'Cool Down', sets:[{distance:'0.5',pace:'10:30',rest:'0'}]},
      ]},
      { id:'demo-r3', dayNumber:3, name:'Long Run', exercises:[
        { id:'r7', name:'Long Easy Run', sets:[{distance:'3.1',pace:'10:30',rest:'0'}]},
      ]},
    ],
  },
  {
    id: 'demo-stretch',
    type: 'stretching',
    name: 'Morning Mobility',
    description: '20-minute full body stretch routine',
    authorId: 'demo',
    isPublic: true,
    days: [
      { id:'demo-s1', dayNumber:1, name:'Upper Body', exercises:[
        { id:'s1', name:'Chest Opener', sets:[{duration:'30',sides:'both',rest:'10'},{duration:'30',sides:'both',rest:'10'}]},
        { id:'s2', name:'Shoulder Cross', sets:[{duration:'30',sides:'each',rest:'10'},{duration:'30',sides:'each',rest:'10'}]},
        { id:'s3', name:'Neck Roll', sets:[{duration:'20',sides:'both',rest:'10'}]},
        { id:'s4', name:'Tricep Stretch', sets:[{duration:'30',sides:'each',rest:'10'},{duration:'30',sides:'each',rest:'10'}]},
      ]},
      { id:'demo-s2', dayNumber:2, name:'Lower Body', exercises:[
        { id:'s5', name:'Hip Flexor Lunge', sets:[{duration:'45',sides:'each',rest:'10'},{duration:'45',sides:'each',rest:'10'}]},
        { id:'s6', name:'Hamstring Stretch', sets:[{duration:'40',sides:'each',rest:'10'},{duration:'40',sides:'each',rest:'10'}]},
        { id:'s7', name:'Pigeon Pose', sets:[{duration:'60',sides:'each',rest:'15'},{duration:'60',sides:'each',rest:'15'}]},
        { id:'s8', name:'Calf Stretch', sets:[{duration:'30',sides:'each',rest:'10'}]},
      ]},
      { id:'demo-s3', dayNumber:3, name:'Full Body Flow', exercises:[
        { id:'s9', name:'Cat-Cow', sets:[{duration:'60',sides:'both',rest:'10'},{duration:'60',sides:'both',rest:'10'}]},
        { id:'s10', name:'Downward Dog', sets:[{duration:'45',sides:'both',rest:'10'},{duration:'45',sides:'both',rest:'10'}]},
        { id:'s11', name:'Spinal Twist', sets:[{duration:'45',sides:'each',rest:'10'},{duration:'45',sides:'each',rest:'10'}]},
      ]},
    ],
  },
];

export default function DiscoverPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [publicPrograms, setPublicPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [copied, setCopied] = useState(null); // id of recently copied program
  const [myPrograms, setMyPrograms] = useState([]);

  useEffect(() => {
    setMyPrograms(getPrograms());
    getPublicPrograms().then(remote => {
      setPublicPrograms(remote.length > 0 ? remote : DEMO_PROGRAMS);
      setLoading(false);
    }).catch(() => {
      setPublicPrograms(DEMO_PROGRAMS);
      setLoading(false);
    });
  }, []);

  const filtered = filter === 'all'
    ? publicPrograms
    : publicPrograms.filter(p => p.type === filter);

  const alreadyHave = (id) => myPrograms.some(p => p.id === id || p.copiedFromId === id);

  function copyProgram(prog) {
    const newId = `prog-${Date.now()}`;
    const copy = {
      ...prog,
      id: newId,
      copiedFromId: prog.id,
      name: prog.name,
      description: prog.description,
      isPublic: false,
      createdAt: new Date().toISOString(),
      days: prog.days.map((d, i) => ({
        ...d,
        id: `${newId}-d${i+1}`,
        grad: GRAD_OPTIONS[i % 5].grad,
        accent: GRAD_OPTIONS[i % 5].accent,
      })),
    };
    const updated = [...myPrograms, copy];
    setMyPrograms(updated);
    savePrograms(updated);
    setActiveProgramId(newId);
    if (user) syncProgramsToFirestore(user.uid, updated);
    setCopied(prog.id);
    setTimeout(() => setCopied(null), 2500);
  }

  return (
    <div style={{ fontFamily:font.body, background:C.bg, minHeight:'100dvh', color:C.white }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;900&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{display:none}
        button{cursor:pointer;font-family:inherit}
      `}</style>

      {/* HEADER */}
      <header style={{
        position:'sticky', top:0, zIndex:50,
        background:`${C.bg}ee`, backdropFilter:'blur(16px)',
        borderBottom:`1px solid ${C.border}`,
        padding:'12px 20px', display:'flex', alignItems:'center', gap:14,
      }}>
        <button onClick={() => router.push('/workout')} style={{
          background:C.card, border:`1px solid ${C.border}`, borderRadius:10,
          padding:'8px 12px', lineHeight:0, color:C.white,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div style={{ flex:1 }}>
          <p style={{ fontSize:10, fontWeight:700, color:C.muted, letterSpacing:2, marginBottom:1 }}>COMMUNITY</p>
          <h1 style={{ fontFamily:font.heading, fontWeight:900, fontSize:24, letterSpacing:2 }}>DISCOVER</h1>
        </div>
      </header>

      {/* TYPE FILTER TABS */}
      <div style={{ padding:'14px 16px 0', display:'flex', gap:8, overflowX:'auto' }}>
        {[{ id:'all', label:'All', emoji:'💥' }, ...Object.entries(PROGRAM_TYPES).map(([id, t]) => ({ id, label:t.label, emoji:t.emoji }))].map(t => (
          <button key={t.id} onClick={() => setFilter(t.id)} style={{
            flexShrink:0,
            background: filter === t.id ? C.accentBg : C.card,
            border:`1px solid ${filter === t.id ? 'rgba(10,132,255,0.4)' : C.border}`,
            borderRadius:20, padding:'7px 14px',
            fontSize:12, fontWeight:700,
            color: filter === t.id ? C.accent : C.muted,
          }}>
            {t.emoji} {t.label}
          </button>
        ))}
      </div>

      {/* CONTENT */}
      <main style={{ padding:'16px 16px 100px' }}>
        {loading ? (
          <div style={{ display:'flex', justifyContent:'center', padding:'60px 0' }}>
            <div style={{ width:32, height:32, borderRadius:'50%', border:`3px solid ${C.border}`, borderTopColor:C.accent, animation:'spin 0.8s linear infinite' }}/>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign:'center', padding:'60px 20px', color:C.muted }}>
            <div style={{ fontSize:40, marginBottom:12 }}>🔍</div>
            <p style={{ fontSize:15 }}>No public programs yet.</p>
            <p style={{ fontSize:13, marginTop:6 }}>Be the first to publish one!</p>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {filtered.map(prog => {
              const pt = PROGRAM_TYPES[prog.type || 'strength'];
              const typeColor = TYPE_COLORS[prog.type || 'strength'];
              const have = alreadyHave(prog.id);
              const justCopied = copied === prog.id;
              const totalExercises = prog.days.reduce((s, d) => s + (d.exercises?.length || 0), 0);
              const totalSets = prog.days.reduce((s, d) =>
                s + (d.exercises?.reduce((ss, e) => ss + (e.sets?.length || 0), 0) || 0), 0);
              return (
                <div key={prog.id} style={{
                  background:C.card, border:`1px solid ${C.border}`,
                  borderRadius:20, overflow:'hidden',
                }}>
                  {/* Card header with gradient */}
                  <div style={{
                    background:`linear-gradient(135deg, ${typeColor}18, ${typeColor}08)`,
                    borderBottom:`1px solid ${C.border}`,
                    padding:'18px 18px 14px',
                  }}>
                    <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12 }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{
                          display:'inline-flex', alignItems:'center', gap:5,
                          background:`${typeColor}22`, border:`1px solid ${typeColor}44`,
                          borderRadius:6, padding:'2px 8px', marginBottom:8,
                        }}>
                          <span style={{ fontSize:12 }}>{pt?.emoji}</span>
                          <span style={{ fontSize:10, fontWeight:700, color:typeColor, letterSpacing:1.5 }}>
                            {pt?.label?.toUpperCase()}
                          </span>
                        </div>
                        <h3 style={{ fontFamily:font.heading, fontWeight:900, fontSize:24, letterSpacing:0.5, color:C.white, lineHeight:1.1, marginBottom:4 }}>
                          {prog.name.toUpperCase()}
                        </h3>
                        {prog.description && (
                          <p style={{ fontSize:12, color:C.muted, lineHeight:1.4 }}>{prog.description}</p>
                        )}
                      </div>
                    </div>

                    {/* Stats */}
                    <div style={{ display:'flex', gap:16, marginTop:14 }}>
                      {[
                        { v: prog.days.length, l: 'DAYS' },
                        { v: totalExercises, l: 'EXERCISES' },
                        { v: totalSets, l: 'TOTAL SETS' },
                      ].map((stat, i, arr) => (
                        <div key={stat.l} style={{ display:'flex', alignItems:'stretch', gap:16 }}>
                          <div>
                            <div style={{ fontFamily:font.heading, fontWeight:900, fontSize:22, color:typeColor, lineHeight:1 }}>{stat.v}</div>
                            <div style={{ fontSize:9, fontWeight:700, color:C.muted, letterSpacing:1.5 }}>{stat.l}</div>
                          </div>
                          {i < arr.length-1 && <div style={{ width:1, background:C.border }}/>}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Days preview */}
                  <div style={{ padding:'12px 18px', display:'flex', gap:6, overflowX:'auto' }}>
                    {prog.days.map((d, i) => (
                      <div key={d.id} style={{
                        flexShrink:0,
                        background:C.card2, border:`1px solid ${C.border}`,
                        borderRadius:8, padding:'6px 10px',
                      }}>
                        <div style={{ fontSize:9, fontWeight:700, color:C.muted, letterSpacing:1 }}>DAY {d.dayNumber}</div>
                        <div style={{ fontSize:12, fontWeight:600, color:C.white, whiteSpace:'nowrap' }}>{d.name}</div>
                        <div style={{ fontSize:10, color:C.muted }}>{d.exercises?.length || 0} exercises</div>
                      </div>
                    ))}
                  </div>

                  {/* Copy button */}
                  <div style={{ padding:'0 18px 18px' }}>
                    <button onClick={() => !have && copyProgram(prog)} style={{
                      width:'100%', height:48,
                      background: justCopied
                        ? `linear-gradient(90deg, ${C.success}, #20b857)`
                        : have
                          ? C.card2
                          : `linear-gradient(90deg, ${typeColor}, ${typeColor}cc)`,
                      border: have && !justCopied ? `1px solid ${C.border}` : 'none',
                      borderRadius:12,
                      fontFamily:font.heading, fontSize:17, fontWeight:700, letterSpacing:1.5,
                      color: have && !justCopied ? C.muted : C.white,
                      cursor: have ? 'default' : 'pointer',
                      display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                      transition:'all 0.3s ease',
                    }}>
                      {justCopied
                        ? '✓ ADDED TO YOUR PROGRAMS'
                        : have
                          ? '✓ ALREADY IN LIBRARY'
                          : '+ ADD TO MY PROGRAMS'
                      }
                    </button>
                  </div>
                </div>
              );
            })}
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
          <span style={{ fontSize:10, fontWeight:600, color:C.muted }}>Home</span>
        </button>
        <button onClick={() => router.push('/workout')} style={{ background:'none', border:'none', display:'flex', flexDirection:'column', alignItems:'center', gap:3, padding:'4px 20px' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="10" width="4" height="4" rx="1"/><rect x="18" y="10" width="4" height="4" rx="1"/>
            <rect x="5" y="8" width="3" height="8" rx="1"/><rect x="16" y="8" width="3" height="8" rx="1"/>
            <line x1="8" y1="12" x2="16" y2="12"/>
          </svg>
          <span style={{ fontSize:10, fontWeight:600, color:C.muted }}>Workout</span>
        </button>
        <button style={{ background:'none', border:'none', display:'flex', flexDirection:'column', alignItems:'center', gap:3, padding:'4px 20px' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
          <span style={{ fontSize:10, fontWeight:600, color:C.accent }}>Discover</span>
        </button>
      </nav>
    </div>
  );
}
