'use client'

import { useState } from 'react'

// Science-backed recommendations
const RECOMMENDATIONS = {
  water: {
    male:   { sedentary: 96,  light: 104, moderate: 112, active: 120 },
    female: { sedentary: 64,  light: 72,  moderate: 80,  active: 88  },
    other:  { sedentary: 80,  light: 88,  moderate: 96,  active: 104 }
  },
  calories: {
    male: {
      '18-25': { sedentary: 2400, light: 2600, moderate: 2800, active: 3000 },
      '26-35': { sedentary: 2400, light: 2600, moderate: 2800, active: 3000 },
      '36-45': { sedentary: 2200, light: 2400, moderate: 2600, active: 2800 },
      '46-55': { sedentary: 2200, light: 2400, moderate: 2600, active: 2800 },
      '56+':   { sedentary: 2000, light: 2200, moderate: 2400, active: 2600 }
    },
    female: {
      '18-25': { sedentary: 2000, light: 2200, moderate: 2400, active: 2600 },
      '26-35': { sedentary: 1800, light: 2000, moderate: 2200, active: 2400 },
      '36-45': { sedentary: 1800, light: 2000, moderate: 2200, active: 2400 },
      '46-55': { sedentary: 1800, light: 2000, moderate: 2200, active: 2400 },
      '56+':   { sedentary: 1600, light: 1800, moderate: 2000, active: 2200 }
    },
    other: {
      '18-25': { sedentary: 2200, light: 2400, moderate: 2600, active: 2800 },
      '26-35': { sedentary: 2100, light: 2300, moderate: 2500, active: 2700 },
      '36-45': { sedentary: 2000, light: 2200, moderate: 2400, active: 2600 },
      '46-55': { sedentary: 2000, light: 2200, moderate: 2400, active: 2600 },
      '56+':   { sedentary: 1800, light: 2000, moderate: 2200, active: 2400 }
    }
  },
  protein: {
    'lose-weight':    0.8,
    'gain-muscle':    1.0,
    'maintain':       0.7,
    'improve-habits': 0.7
  }
}

const WORKOUT_TYPES = [
  { key: 'strength',   icon: '🏋️', label: 'Strength', desc: 'Barbell, dumbbells, sets & reps' },
  { key: 'bodyweight', icon: '💪', label: 'Bodyweight', desc: 'No equipment needed' },
  { key: 'running',    icon: '🏃', label: 'Running', desc: 'Miles, pace & cardio' },
  { key: 'stretching', icon: '🧘', label: 'Flexibility', desc: 'Yoga, mobility & recovery' },
]

// Shared style helpers
const S = {
  btn: (active) => ({
    padding: '12px',
    backgroundColor: active ? '#0A84FF' : '#242424',
    color: active ? '#fff' : '#AAAAAA',
    border: `2px solid ${active ? '#0A84FF' : '#2C2C2C'}`,
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
  }),
  backBtn: {
    flex: 1,
    padding: '14px',
    backgroundColor: '#242424',
    color: '#FFFFFF',
    border: '2px solid #2C2C2C',
    borderRadius: '8px',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  nextBtn: (disabled) => ({
    flex: 2,
    padding: '14px',
    backgroundColor: disabled ? '#2C2C2C' : '#0A84FF',
    color: disabled ? '#666666' : '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '15px',
    fontWeight: '600',
    cursor: disabled ? 'not-allowed' : 'pointer',
  }),
  input: {
    width: '100%',
    padding: '12px',
    fontSize: '14px',
    border: '2px solid #2C2C2C',
    borderRadius: '8px',
    fontFamily: 'inherit',
    backgroundColor: '#242424',
    color: '#FFFFFF',
    outline: 'none',
    boxSizing: 'border-box',
  },
  card: (accent) => ({
    padding: '16px',
    backgroundColor: '#1A1A1A',
    borderRadius: '10px',
    borderLeft: `4px solid ${accent || '#0A84FF'}`,
  }),
  label: {
    display: 'block',
    fontSize: '14px',
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: '8px',
  },
}

export default function Onboarding({ onComplete, onSkip }) {
  const [step, setStep] = useState(1)
  const [profile, setProfile] = useState({
    age: '',
    gender: '',
    activity: '',
    goal: '',
    weight: '',
    workoutType: '',
  })
  const [selectedHabits, setSelectedHabits] = useState([])
  const [customHabit, setCustomHabit] = useState('')
  const [customGoals, setCustomGoals] = useState(null)
  const [selectedOptionalMetrics, setSelectedOptionalMetrics] = useState({
    fiber: true,
    carbs: true,
    fat: true,
  })

  const totalSteps = 6

  const getRecommendations = () => {
    if (!profile.age || !profile.gender || !profile.activity || !profile.goal) return null
    const water    = RECOMMENDATIONS.water[profile.gender][profile.activity]
    const calories = RECOMMENDATIONS.calories[profile.gender][profile.age][profile.activity]
    let protein = null
    if (profile.weight && RECOMMENDATIONS.protein[profile.goal]) {
      protein = Math.round(parseInt(profile.weight) * RECOMMENDATIONS.protein[profile.goal])
    }
    return {
      water,
      calories,
      protein,
      fiber: 30,
      carbs: Math.round(calories * 0.5 / 4),
      fat:   Math.round(calories * 0.3 / 9),
    }
  }

  const recommendations = customGoals || getRecommendations()

  const handleNext = () => {
    if (step === 2) setCustomGoals(getRecommendations())
    setStep(step + 1)
  }

  const handleComplete = () => {
    onComplete({
      profile,
      habits: selectedHabits,
      goals: recommendations,
      optionalMetrics: selectedOptionalMetrics,
    })
  }

  const toggleHabit = (habit) => {
    const key = typeof habit === 'string' ? habit : habit.key
    const obj = typeof habit === 'string' ? { key: habit, label: habit } : habit
    const has = selectedHabits.some(h => (typeof h === 'string' ? h : h.key) === key)
    setSelectedHabits(has
      ? selectedHabits.filter(h => (typeof h === 'string' ? h : h.key) !== key)
      : [...selectedHabits, obj]
    )
  }

  const isHabitSelected = (key) =>
    selectedHabits.some(h => (typeof h === 'string' ? h : h.key) === key)

  const addCustomHabit = () => {
    if (!customHabit.trim()) return
    const newHabit = {
      key:   customHabit.trim().toLowerCase().replace(/\s+/g, '-'),
      label: customHabit.trim(),
      icon:  '📝',
    }
    setSelectedHabits([...selectedHabits, newHabit])
    setCustomHabit('')
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 10000, padding: '20px',
    }}>
      <div style={{
        backgroundColor: '#1A1A1A',
        borderRadius: '16px',
        maxWidth: '600px',
        width: '100%',
        maxHeight: '90vh',
        overflow: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
        position: 'relative',
      }}>
        {/* Skip button */}
        {onSkip && (
          <button onClick={onSkip} style={{
            position: 'absolute', top: '12px', right: '12px',
            width: '32px', height: '32px', borderRadius: '50%',
            border: 'none', backgroundColor: '#242424', color: '#888888',
            fontSize: '16px', cursor: 'pointer', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 1,
          }}>✕</button>
        )}

        {/* Progress bar */}
        <div style={{ height: '4px', backgroundColor: '#242424', borderRadius: '16px 16px 0 0' }}>
          <div style={{
            height: '100%',
            width: `${(step / totalSteps) * 100}%`,
            backgroundColor: '#0A84FF',
            borderRadius: '16px 0 0 0',
            transition: 'width 0.3s',
          }} />
        </div>

        <div style={{ padding: '32px' }}>

          {/* ── Step 1: Welcome ───────────────────────────────────────── */}
          {step === 1 && (
            <div>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>👋</div>
              <h2 style={{ margin: '0 0 12px', fontSize: '24px', fontWeight: '700', color: '#FFFFFF' }}>
                Welcome to Lytz!
              </h2>
              <p style={{ margin: '0 0 24px', fontSize: '15px', color: '#888888', lineHeight: '1.6' }}>
                Your all-in-one daily health tracker. Track nutrition, workouts, water, habits, and more — all personalized to your goals.
              </p>
              <div style={{ backgroundColor: '#242424', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
                <h3 style={{ margin: '0 0 12px', fontSize: '16px', fontWeight: '600', color: '#FFFFFF' }}>
                  Everything in one place:
                </h3>
                <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: '#888888', lineHeight: '2' }}>
                  <li>🤖 AI-powered food logging — just describe what you ate</li>
                  <li>🏋️ Workout tracker — programs, logging & progressive overload</li>
                  <li>💧 Daily water intake</li>
                  <li>✅ Custom habit checklist</li>
                  <li>📊 Custom nutrition metrics (calories, protein, carbs, etc.)</li>
                  <li>📈 Weekly reports & PDF exports</li>
                </ul>
              </div>
              <p style={{ margin: '0 0 24px', fontSize: '14px', color: '#666666' }}>
                Let's set up your profile to get personalized recommendations.
              </p>
              <button onClick={handleNext} style={{
                width: '100%', padding: '14px',
                backgroundColor: '#0A84FF', color: '#fff',
                border: 'none', borderRadius: '8px',
                fontSize: '15px', fontWeight: '600', cursor: 'pointer',
              }}>
                Get Started
              </button>
            </div>
          )}

          {/* ── Step 2: Profile ───────────────────────────────────────── */}
          {step === 2 && (
            <div>
              <h2 style={{ margin: '0 0 8px', fontSize: '24px', fontWeight: '700', color: '#FFFFFF' }}>
                Tell us about yourself
              </h2>
              <p style={{ margin: '0 0 24px', fontSize: '14px', color: '#888888' }}>
                This helps us recommend personalized daily targets.
              </p>

              {/* Age */}
              <div style={{ marginBottom: '20px' }}>
                <label style={S.label}>Age Range</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  {['18-25', '26-35', '36-45', '46-55', '56+'].map(age => (
                    <button key={age} onClick={() => setProfile({ ...profile, age })} style={S.btn(profile.age === age)}>
                      {age}
                    </button>
                  ))}
                </div>
              </div>

              {/* Gender */}
              <div style={{ marginBottom: '20px' }}>
                <label style={S.label}>Gender</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  {[{ key: 'male', label: 'Male' }, { key: 'female', label: 'Female' }, { key: 'other', label: 'Other' }].map(g => (
                    <button key={g.key} onClick={() => setProfile({ ...profile, gender: g.key })} style={S.btn(profile.gender === g.key)}>
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Activity Level */}
              <div style={{ marginBottom: '20px' }}>
                <label style={S.label}>Activity Level</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {[
                    { key: 'sedentary', label: 'Sedentary',        desc: 'Little to no exercise' },
                    { key: 'light',     label: 'Lightly Active',   desc: 'Exercise 1–3 days/week' },
                    { key: 'moderate',  label: 'Moderately Active',desc: 'Exercise 3–5 days/week' },
                    { key: 'active',    label: 'Very Active',      desc: 'Exercise 6–7 days/week' },
                  ].map(a => (
                    <button key={a.key} onClick={() => setProfile({ ...profile, activity: a.key })}
                      style={{ ...S.btn(profile.activity === a.key), textAlign: 'left', fontSize: '13px' }}>
                      <div>{a.label}</div>
                      <div style={{ fontSize: '11px', fontWeight: '400', marginTop: '4px', opacity: 0.7 }}>{a.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Primary Goal */}
              <div style={{ marginBottom: '20px' }}>
                <label style={S.label}>Primary Goal</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {[
                    { key: 'lose-weight',    label: 'Lose Weight',    icon: '⬇️' },
                    { key: 'gain-muscle',    label: 'Gain Muscle',    icon: '💪' },
                    { key: 'maintain',       label: 'Maintain Health',icon: '⚖️' },
                    { key: 'improve-habits', label: 'Improve Habits', icon: '✨' },
                  ].map(g => (
                    <button key={g.key} onClick={() => setProfile({ ...profile, goal: g.key })} style={S.btn(profile.goal === g.key)}>
                      <span style={{ marginRight: '6px' }}>{g.icon}</span>{g.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Weight (optional) */}
              <div style={{ marginBottom: '24px' }}>
                <label style={S.label}>Current Weight — lbs (optional)</label>
                <input
                  type="number"
                  value={profile.weight}
                  onChange={e => setProfile({ ...profile, weight: e.target.value })}
                  placeholder="e.g., 165"
                  style={S.input}
                />
                <div style={{ fontSize: '12px', color: '#666666', marginTop: '4px' }}>
                  Used to calculate your personalized protein target
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={() => setStep(1)} style={S.backBtn}>Back</button>
                <button
                  onClick={handleNext}
                  disabled={!profile.age || !profile.gender || !profile.activity || !profile.goal}
                  style={S.nextBtn(!profile.age || !profile.gender || !profile.activity || !profile.goal)}
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Recommended Goals ─────────────────────────────── */}
          {step === 3 && recommendations && (
            <div>
              <h2 style={{ margin: '0 0 8px', fontSize: '24px', fontWeight: '700', color: '#FFFFFF' }}>
                Your Recommended Goals
              </h2>
              <p style={{ margin: '0 0 24px', fontSize: '14px', color: '#888888' }}>
                Based on your profile. You can fine-tune these anytime in Settings.
              </p>

              <div style={{ marginBottom: '8px', fontSize: '13px', fontWeight: '600', color: '#888888' }}>Core Metrics</div>

              <div style={{ backgroundColor: 'rgba(48,209,88,0.1)', border: '1px solid rgba(48,209,88,0.35)', borderRadius: '12px', padding: '16px', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '16px' }}>💧</span>
                  <span style={{ fontSize: '14px', fontWeight: '600', color: '#30D158' }}>Water: {recommendations.water} oz/day</span>
                </div>
                <div style={{ fontSize: '12px', color: '#30D158', opacity: 0.8 }}>Recommended for your activity level</div>
              </div>

              <div style={{ backgroundColor: 'rgba(10,132,255,0.1)', border: '1px solid rgba(10,132,255,0.35)', borderRadius: '12px', padding: '16px', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '16px' }}>🔥</span>
                  <span style={{ fontSize: '14px', fontWeight: '600', color: '#0A84FF' }}>Calories: {recommendations.calories} Cal/day</span>
                </div>
                <div style={{ fontSize: '12px', color: '#0A84FF', opacity: 0.8 }}>Maintenance level for your profile</div>
              </div>

              {recommendations.protein && (
                <div style={{ backgroundColor: 'rgba(255,159,10,0.1)', border: '1px solid rgba(255,159,10,0.35)', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '16px' }}>🥩</span>
                    <span style={{ fontSize: '14px', fontWeight: '600', color: '#FF9F0A' }}>Protein: {recommendations.protein}g/day</span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#FF9F0A', opacity: 0.8 }}>
                    Based on your {profile.goal.replace(/-/g, ' ')} goal
                  </div>
                </div>
              )}

              <div style={{ marginBottom: '8px', marginTop: '20px', fontSize: '13px', fontWeight: '600', color: '#888888' }}>
                Optional Metrics (uncheck to skip)
              </div>

              {[
                { key: 'fiber', label: 'Fiber',         value: recommendations.fiber, unit: 'g', icon: '🌾', color: '#30D158',  border: 'rgba(48,209,88,0.35)',   bg: 'rgba(48,209,88,0.1)'   },
                { key: 'carbs', label: 'Carbohydrates', value: recommendations.carbs, unit: 'g', icon: '🍞', color: '#FF9F0A',  border: 'rgba(255,159,10,0.35)', bg: 'rgba(255,159,10,0.1)' },
                { key: 'fat',   label: 'Fat',           value: recommendations.fat,   unit: 'g', icon: '🥑', color: '#BF5AF2',  border: 'rgba(191,90,242,0.35)', bg: 'rgba(191,90,242,0.1)' },
              ].map(metric => (
                <div key={metric.key} onClick={() => setSelectedOptionalMetrics({ ...selectedOptionalMetrics, [metric.key]: !selectedOptionalMetrics[metric.key] })}
                  style={{
                    backgroundColor: selectedOptionalMetrics[metric.key] ? metric.bg : '#242424',
                    border: `2px solid ${selectedOptionalMetrics[metric.key] ? metric.border : '#2C2C2C'}`,
                    borderRadius: '12px', padding: '14px', marginBottom: '8px',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', transition: 'all 0.2s',
                  }}>
                  <input type="checkbox" checked={selectedOptionalMetrics[metric.key]} onChange={() => {}} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                  <span style={{ fontSize: '20px' }}>{metric.icon}</span>
                  <div style={{ flex: 1, fontSize: '14px', fontWeight: '600', color: selectedOptionalMetrics[metric.key] ? metric.color : '#888888' }}>
                    {metric.label}: {metric.value}{metric.unit}/day
                  </div>
                </div>
              ))}

              <div style={{ backgroundColor: '#242424', borderRadius: '8px', padding: '12px', marginTop: '16px', marginBottom: '24px', fontSize: '12px', color: '#888888', lineHeight: '1.6' }}>
                ℹ️ These are starting points. You can customize any metric in Settings and add your own custom tracking fields.
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={() => setStep(2)} style={S.backBtn}>Back</button>
                <button onClick={handleNext} style={S.nextBtn(false)}>Continue</button>
              </div>
            </div>
          )}

          {/* ── Step 4: Daily Habits ──────────────────────────────────── */}
          {step === 4 && (
            <div>
              <h2 style={{ margin: '0 0 8px', fontSize: '24px', fontWeight: '700', color: '#FFFFFF' }}>
                Choose Daily Habits to Track
              </h2>
              <p style={{ margin: '0 0 20px', fontSize: '14px', color: '#888888' }}>
                Select habits you want to build. You can always edit these later.
              </p>

              {/* Wellness */}
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#888888', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px' }}>Wellness</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                {[
                  { key: 'sleep',       label: 'Get 8 hours of sleep',              icon: '😴' },
                  { key: 'meditate',    label: 'Meditate or practice mindfulness',   icon: '🧘' },
                  { key: 'noscreen',    label: 'No screens 1hr before bed',          icon: '📵' },
                  { key: 'vitamins',    label: 'Take daily vitamins',                icon: '💊' },
                  { key: 'vegetables',  label: 'Eat 5+ servings of vegetables',      icon: '🥦' },
                  { key: 'read',        label: 'Read for 20+ minutes',               icon: '📚' },
                ].map(habit => {
                  const selected = isHabitSelected(habit.key)
                  return (
                    <button key={habit.key} onClick={() => toggleHabit(habit)} style={{
                      padding: '14px 16px', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '12px',
                      backgroundColor: selected ? 'rgba(48,209,88,0.1)' : '#242424',
                      border: `2px solid ${selected ? '#30D158' : '#2C2C2C'}`,
                      borderRadius: '10px', fontSize: '14px', fontWeight: '600', color: '#FFFFFF',
                      cursor: 'pointer', transition: 'all 0.2s',
                    }}>
                      <span style={{ fontSize: '22px' }}>{habit.icon}</span>
                      <span style={{ flex: 1 }}>{habit.label}</span>
                      {selected && <span style={{ color: '#30D158', fontSize: '18px' }}>✓</span>}
                    </button>
                  )
                })}
              </div>

              {/* Fitness */}
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#888888', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px' }}>Fitness</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                {[
                  { key: 'workout',     label: 'Complete a workout',                 icon: '🏋️' },
                  { key: 'steps',       label: 'Walk 10,000 steps',                  icon: '👟' },
                  { key: 'stretch',     label: 'Stretch or do yoga',                 icon: '🤸' },
                  { key: 'cardio',      label: 'Do 20+ minutes of cardio',           icon: '🏃' },
                  { key: 'exercise',    label: 'Exercise for 30+ minutes',           icon: '⚡' },
                ].map(habit => {
                  const selected = isHabitSelected(habit.key)
                  return (
                    <button key={habit.key} onClick={() => toggleHabit(habit)} style={{
                      padding: '14px 16px', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '12px',
                      backgroundColor: selected ? 'rgba(10,132,255,0.12)' : '#242424',
                      border: `2px solid ${selected ? '#0A84FF' : '#2C2C2C'}`,
                      borderRadius: '10px', fontSize: '14px', fontWeight: '600', color: '#FFFFFF',
                      cursor: 'pointer', transition: 'all 0.2s',
                    }}>
                      <span style={{ fontSize: '22px' }}>{habit.icon}</span>
                      <span style={{ flex: 1 }}>{habit.label}</span>
                      {selected && <span style={{ color: '#0A84FF', fontSize: '18px' }}>✓</span>}
                    </button>
                  )
                })}
              </div>

              {/* Custom habit */}
              <div style={{ backgroundColor: '#242424', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#FFFFFF', marginBottom: '8px' }}>Add Your Own Habit</div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={customHabit}
                    onChange={e => setCustomHabit(e.target.value)}
                    onKeyPress={e => e.key === 'Enter' && addCustomHabit()}
                    placeholder="e.g., Drink green tea, Journal..."
                    style={{ ...S.input, flex: 1, width: 'auto' }}
                  />
                  <button onClick={addCustomHabit} disabled={!customHabit.trim()} style={{
                    padding: '12px 20px', backgroundColor: customHabit.trim() ? '#0A84FF' : '#2C2C2C',
                    color: customHabit.trim() ? '#fff' : '#666', border: 'none', borderRadius: '8px',
                    fontSize: '14px', fontWeight: '600', cursor: customHabit.trim() ? 'pointer' : 'not-allowed',
                    whiteSpace: 'nowrap',
                  }}>Add</button>
                </div>
              </div>

              <div style={{ backgroundColor: '#242424', borderRadius: '8px', padding: '12px', marginBottom: '24px', fontSize: '12px', color: '#888888' }}>
                {selectedHabits.length === 0 ? 'No habits selected — you can add them later in Settings.' : `${selectedHabits.length} habit${selectedHabits.length !== 1 ? 's' : ''} selected.`}
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={() => setStep(3)} style={S.backBtn}>Back</button>
                <button onClick={handleNext} style={S.nextBtn(false)}>Continue</button>
              </div>
            </div>
          )}

          {/* ── Step 5: Workout Setup ─────────────────────────────────── */}
          {step === 5 && (
            <div>
              <h2 style={{ margin: '0 0 8px', fontSize: '24px', fontWeight: '700', color: '#FFFFFF' }}>
                Set Up Your Workout Tracker
              </h2>
              <p style={{ margin: '0 0 24px', fontSize: '14px', color: '#888888' }}>
                What type of training do you mainly do? We'll highlight the right programs for you on the Discover page.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '24px' }}>
                {WORKOUT_TYPES.map(wt => {
                  const active = profile.workoutType === wt.key
                  return (
                    <button key={wt.key} onClick={() => setProfile({ ...profile, workoutType: active ? '' : wt.key })} style={{
                      padding: '18px 14px', textAlign: 'left',
                      backgroundColor: active ? 'rgba(10,132,255,0.12)' : '#242424',
                      border: `2px solid ${active ? '#0A84FF' : '#2C2C2C'}`,
                      borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s',
                    }}>
                      <div style={{ fontSize: '28px', marginBottom: '8px' }}>{wt.icon}</div>
                      <div style={{ fontSize: '14px', fontWeight: '700', color: active ? '#0A84FF' : '#FFFFFF', marginBottom: '4px' }}>{wt.label}</div>
                      <div style={{ fontSize: '12px', color: '#888888' }}>{wt.desc}</div>
                      {active && (
                        <div style={{ marginTop: '8px', fontSize: '12px', color: '#0A84FF', fontWeight: '600' }}>✓ Selected</div>
                      )}
                    </button>
                  )
                })}
              </div>

              <div style={{ backgroundColor: '#242424', borderRadius: '12px', padding: '16px', marginBottom: '24px' }}>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#FFFFFF', marginBottom: '8px' }}>🗂️ How the Workout Tracker works</div>
                <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: '#888888', lineHeight: '1.9' }}>
                  <li><strong style={{ color: '#AAAAAA' }}>Discover</strong> — Browse 15+ ready-made programs or find ones shared by others</li>
                  <li><strong style={{ color: '#AAAAAA' }}>My Programs</strong> — Save programs to your library and set an active one</li>
                  <li><strong style={{ color: '#AAAAAA' }}>Log Workouts</strong> — Track sets, reps, and weights with a guided logging screen</li>
                  <li><strong style={{ color: '#AAAAAA' }}>Progressive Overload</strong> — Lytz auto-detects when you're ready to add weight</li>
                </ul>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={() => setStep(4)} style={S.backBtn}>Back</button>
                <button onClick={handleNext} style={S.nextBtn(false)}>
                  {profile.workoutType ? 'Continue' : 'Skip for now'}
                </button>
              </div>
            </div>
          )}

          {/* ── Step 6: Feature Tour / All Set ───────────────────────── */}
          {step === 6 && (
            <div>
              <h2 style={{ margin: '0 0 8px', fontSize: '24px', fontWeight: '700', color: '#FFFFFF' }}>
                You're all set! 🎉
              </h2>
              <p style={{ margin: '0 0 24px', fontSize: '14px', color: '#888888' }}>
                Here's a quick overview of everything available to you:
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                <div style={S.card('#0A84FF')}>
                  <div style={{ fontSize: '20px', marginBottom: '6px' }}>🤖</div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#FFFFFF', marginBottom: '4px' }}>AI Food Logging</div>
                  <div style={{ fontSize: '13px', color: '#888888', lineHeight: '1.5' }}>
                    Tap the mic or type what you ate — AI estimates all the nutrition numbers instantly. Works for meals, snacks, and drinks.
                  </div>
                </div>

                <div style={S.card('#30D158')}>
                  <div style={{ fontSize: '20px', marginBottom: '6px' }}>🏋️</div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#FFFFFF', marginBottom: '4px' }}>Workout Tracker</div>
                  <div style={{ fontSize: '13px', color: '#888888', lineHeight: '1.5' }}>
                    Find a program on <strong style={{ color: '#AAAAAA' }}>Discover</strong>, log sets & reps on the <strong style={{ color: '#AAAAAA' }}>Workout</strong> tab, and get automatic progressive overload nudges.
                  </div>
                </div>

                <div style={S.card('#FF9F0A')}>
                  <div style={{ fontSize: '20px', marginBottom: '6px' }}>📊</div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#FFFFFF', marginBottom: '4px' }}>Reports & Insights</div>
                  <div style={{ fontSize: '13px', color: '#888888', lineHeight: '1.5' }}>
                    Weekly summaries, macro breakdowns, meal timing charts, and one-tap PDF export — all on the <strong style={{ color: '#AAAAAA' }}>Reports</strong> page.
                  </div>
                </div>

                <div style={S.card('#BF5AF2')}>
                  <div style={{ fontSize: '20px', marginBottom: '6px' }}>⚙️</div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#FFFFFF', marginBottom: '4px' }}>Fully Customizable</div>
                  <div style={{ fontSize: '13px', color: '#888888', lineHeight: '1.5' }}>
                    Add custom nutrition metrics, create your own habits, save quick-add meals, and build custom workout programs — all from Settings.
                  </div>
                </div>

                <div style={S.card('#FF453A')}>
                  <div style={{ fontSize: '20px', marginBottom: '6px' }}>📅</div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#FFFFFF', marginBottom: '4px' }}>Track Past Days</div>
                  <div style={{ fontSize: '13px', color: '#888888', lineHeight: '1.5' }}>
                    Use the date arrows on the home screen to view and edit any previous day's log.
                  </div>
                </div>
              </div>

              <div style={{ backgroundColor: '#242424', border: '1px solid #2C2C2C', borderRadius: '8px', padding: '12px', marginBottom: '24px', fontSize: '13px', color: '#888888', lineHeight: '1.5' }}>
                💡 <strong style={{ color: '#AAAAAA' }}>Tip:</strong> Start simple — track 1–2 things consistently first. You can always add more later.
              </div>

              <button onClick={handleComplete} style={{
                width: '100%', padding: '16px',
                backgroundColor: '#0A84FF', color: '#fff',
                border: 'none', borderRadius: '8px',
                fontSize: '16px', fontWeight: '600', cursor: 'pointer',
              }}>
                Start Tracking!
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
