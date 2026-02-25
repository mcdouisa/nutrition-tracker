'use client'

import { useState } from 'react'

// Science-backed recommendations
const RECOMMENDATIONS = {
  water: {
    male: { sedentary: 96, light: 104, moderate: 112, active: 120 },
    female: { sedentary: 64, light: 72, moderate: 80, active: 88 },
    other: { sedentary: 80, light: 88, moderate: 96, active: 104 }
  },
  calories: {
    male: {
      '18-25': { sedentary: 2400, light: 2600, moderate: 2800, active: 3000 },
      '26-35': { sedentary: 2400, light: 2600, moderate: 2800, active: 3000 },
      '36-45': { sedentary: 2200, light: 2400, moderate: 2600, active: 2800 },
      '46-55': { sedentary: 2200, light: 2400, moderate: 2600, active: 2800 },
      '56+': { sedentary: 2000, light: 2200, moderate: 2400, active: 2600 }
    },
    female: {
      '18-25': { sedentary: 2000, light: 2200, moderate: 2400, active: 2600 },
      '26-35': { sedentary: 1800, light: 2000, moderate: 2200, active: 2400 },
      '36-45': { sedentary: 1800, light: 2000, moderate: 2200, active: 2400 },
      '46-55': { sedentary: 1800, light: 2000, moderate: 2200, active: 2400 },
      '56+': { sedentary: 1600, light: 1800, moderate: 2000, active: 2200 }
    },
    other: {
      '18-25': { sedentary: 2200, light: 2400, moderate: 2600, active: 2800 },
      '26-35': { sedentary: 2100, light: 2300, moderate: 2500, active: 2700 },
      '36-45': { sedentary: 2000, light: 2200, moderate: 2400, active: 2600 },
      '46-55': { sedentary: 2000, light: 2200, moderate: 2400, active: 2600 },
      '56+': { sedentary: 1800, light: 2000, moderate: 2200, active: 2400 }
    }
  },
  protein: {
    'lose-weight': 0.8,    // 0.8g per lb body weight
    'gain-muscle': 1.0,    // 1.0g per lb body weight
    'maintain': 0.7,       // 0.7g per lb body weight
    'improve-habits': 0.7  // 0.7g per lb body weight
  }
}

export default function Onboarding({ onComplete }) {
  const [step, setStep] = useState(1)
  const [profile, setProfile] = useState({
    age: '',
    gender: '',
    activity: '',
    goal: '',
    weight: ''
  })
  const [selectedHabits, setSelectedHabits] = useState([])
  const [customHabit, setCustomHabit] = useState('')
  const [customGoals, setCustomGoals] = useState(null)
  const [selectedOptionalMetrics, setSelectedOptionalMetrics] = useState({
    fiber: true,
    carbs: true,
    fat: true
  })

  const totalSteps = 5

  // Calculate recommendations based on profile
  const getRecommendations = () => {
    if (!profile.age || !profile.gender || !profile.activity || !profile.goal) {
      return null
    }

    const activityKey = profile.activity
    const water = RECOMMENDATIONS.water[profile.gender][activityKey]
    const calories = RECOMMENDATIONS.calories[profile.gender][profile.age][activityKey]

    let protein = null
    if (profile.weight && RECOMMENDATIONS.protein[profile.goal]) {
      protein = Math.round(parseInt(profile.weight) * RECOMMENDATIONS.protein[profile.goal])
    }

    return {
      water,
      calories,
      protein,
      fiber: 30, // Standard recommendation
      carbs: Math.round(calories * 0.5 / 4), // 50% of calories from carbs
      fat: Math.round(calories * 0.3 / 9) // 30% of calories from fat
    }
  }

  const recommendations = customGoals || getRecommendations()

  const handleNext = () => {
    if (step === 2) {
      // Calculate recommendations when moving from profile to goals
      const recs = getRecommendations()
      setCustomGoals(recs)
    }
    setStep(step + 1)
  }

  const handleComplete = () => {
    onComplete({
      profile,
      habits: selectedHabits,
      goals: recommendations,
      optionalMetrics: selectedOptionalMetrics
    })
  }

  const toggleHabit = (habit) => {
    const habitKey = typeof habit === 'string' ? habit : habit.key
    const habitObj = typeof habit === 'string' ? { key: habit, label: habit } : habit

    const isSelected = selectedHabits.some(h => (typeof h === 'string' ? h : h.key) === habitKey)

    if (isSelected) {
      setSelectedHabits(selectedHabits.filter(h => (typeof h === 'string' ? h : h.key) !== habitKey))
    } else {
      setSelectedHabits([...selectedHabits, habitObj])
    }
  }

  const addCustomHabit = () => {
    if (customHabit.trim()) {
      const newHabit = {
        key: customHabit.trim().toLowerCase().replace(/\s+/g, '-'),
        label: customHabit.trim(),
        icon: '📝'
      }
      setSelectedHabits([...selectedHabits, newHabit])
      setCustomHabit('')
    }
  }

  const isHabitSelected = (habitKey) => {
    return selectedHabits.some(h => (typeof h === 'string' ? h : h.key) === habitKey)
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: '#fff',
        borderRadius: '16px',
        maxWidth: '600px',
        width: '100%',
        maxHeight: '90vh',
        overflow: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
      }}>
        {/* Progress bar */}
        <div style={{
          height: '4px',
          backgroundColor: '#f0f0f0',
          borderRadius: '16px 16px 0 0'
        }}>
          <div style={{
            height: '100%',
            width: `${(step / totalSteps) * 100}%`,
            backgroundColor: '#5f8a8f',
            borderRadius: '16px 0 0 0',
            transition: 'width 0.3s'
          }} />
        </div>

        <div style={{ padding: '32px' }}>
          {/* Step 1: Welcome */}
          {step === 1 && (
            <div>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>👋</div>
              <h2 style={{ margin: '0 0 12px 0', fontSize: '24px', fontWeight: '700', color: '#1a1a1a' }}>
                Welcome to Lytz!
              </h2>
              <p style={{ margin: '0 0 24px 0', fontSize: '15px', color: '#666', lineHeight: '1.6' }}>
                Your all-in-one daily health tracker. Track nutrition, water, habits, and more - all customizable to your goals.
              </p>
              <div style={{
                backgroundColor: '#f8f9fa',
                borderRadius: '12px',
                padding: '20px',
                marginBottom: '24px'
              }}>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '600', color: '#1a1a1a' }}>
                  What you can track:
                </h3>
                <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: '#666', lineHeight: '1.8' }}>
                  <li>📊 Custom nutrition metrics (calories, protein, carbs, etc.)</li>
                  <li>💧 Daily water intake</li>
                  <li>✅ Daily habit checklist</li>
                  <li>🤖 AI-powered food logging (just describe what you ate!)</li>
                  <li>📈 Weekly reports and PDF exports</li>
                  <li>📅 View and edit past days</li>
                </ul>
              </div>
              <p style={{ margin: '0 0 24px 0', fontSize: '14px', color: '#999' }}>
                Let's set up your profile to get personalized recommendations.
              </p>
              <button
                onClick={handleNext}
                style={{
                  width: '100%',
                  padding: '14px',
                  backgroundColor: '#5f8a8f',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '15px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Get Started
              </button>
            </div>
          )}

          {/* Step 2: Profile Setup */}
          {step === 2 && (
            <div>
              <h2 style={{ margin: '0 0 8px 0', fontSize: '24px', fontWeight: '700', color: '#1a1a1a' }}>
                Tell us about yourself
              </h2>
              <p style={{ margin: '0 0 24px 0', fontSize: '14px', color: '#666' }}>
                This helps us recommend healthy goals based on science-backed guidelines.
              </p>

              {/* Age */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#333', marginBottom: '8px' }}>
                  Age Range
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  {['18-25', '26-35', '36-45', '46-55', '56+'].map((age) => (
                    <button
                      key={age}
                      onClick={() => setProfile({ ...profile, age })}
                      style={{
                        padding: '12px',
                        backgroundColor: profile.age === age ? '#5f8a8f' : '#f8f9fa',
                        color: profile.age === age ? '#fff' : '#333',
                        border: `2px solid ${profile.age === age ? '#5f8a8f' : '#e0e0e0'}`,
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      {age}
                    </button>
                  ))}
                </div>
              </div>

              {/* Gender */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#333', marginBottom: '8px' }}>
                  Gender
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  {[
                    { key: 'male', label: 'Male' },
                    { key: 'female', label: 'Female' },
                    { key: 'other', label: 'Other' }
                  ].map((g) => (
                    <button
                      key={g.key}
                      onClick={() => setProfile({ ...profile, gender: g.key })}
                      style={{
                        padding: '12px',
                        backgroundColor: profile.gender === g.key ? '#5f8a8f' : '#f8f9fa',
                        color: profile.gender === g.key ? '#fff' : '#333',
                        border: `2px solid ${profile.gender === g.key ? '#5f8a8f' : '#e0e0e0'}`,
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Activity Level */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#333', marginBottom: '8px' }}>
                  Activity Level
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {[
                    { key: 'sedentary', label: 'Sedentary', desc: 'Little to no exercise' },
                    { key: 'light', label: 'Lightly Active', desc: 'Exercise 1-3 days/week' },
                    { key: 'moderate', label: 'Moderately Active', desc: 'Exercise 3-5 days/week' },
                    { key: 'active', label: 'Very Active', desc: 'Exercise 6-7 days/week' }
                  ].map((a) => (
                    <button
                      key={a.key}
                      onClick={() => setProfile({ ...profile, activity: a.key })}
                      style={{
                        padding: '12px',
                        backgroundColor: profile.activity === a.key ? '#5f8a8f' : '#f8f9fa',
                        color: profile.activity === a.key ? '#fff' : '#333',
                        border: `2px solid ${profile.activity === a.key ? '#5f8a8f' : '#e0e0e0'}`,
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.2s'
                      }}
                    >
                      <div>{a.label}</div>
                      <div style={{
                        fontSize: '11px',
                        fontWeight: '400',
                        marginTop: '4px',
                        opacity: 0.8
                      }}>
                        {a.desc}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Primary Goal */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#333', marginBottom: '8px' }}>
                  Primary Goal
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {[
                    { key: 'lose-weight', label: 'Lose Weight', icon: '⬇️' },
                    { key: 'gain-muscle', label: 'Gain Muscle', icon: '💪' },
                    { key: 'maintain', label: 'Maintain Health', icon: '⚖️' },
                    { key: 'improve-habits', label: 'Improve Habits', icon: '✨' }
                  ].map((g) => (
                    <button
                      key={g.key}
                      onClick={() => setProfile({ ...profile, goal: g.key })}
                      style={{
                        padding: '12px',
                        backgroundColor: profile.goal === g.key ? '#5f8a8f' : '#f8f9fa',
                        color: profile.goal === g.key ? '#fff' : '#333',
                        border: `2px solid ${profile.goal === g.key ? '#5f8a8f' : '#e0e0e0'}`,
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      <span style={{ marginRight: '6px' }}>{g.icon}</span>
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Optional Weight (for protein calculation) */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#333', marginBottom: '8px' }}>
                  Current Weight (optional, for protein recommendation)
                </label>
                <input
                  type="number"
                  value={profile.weight}
                  onChange={(e) => setProfile({ ...profile, weight: e.target.value })}
                  placeholder="e.g., 150"
                  style={{
                    width: '100%',
                    padding: '12px',
                    fontSize: '14px',
                    border: '2px solid #e0e0e0',
                    borderRadius: '8px',
                    fontFamily: 'inherit'
                  }}
                />
                <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
                  Used to calculate personalized protein goals
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => setStep(1)}
                  style={{
                    flex: 1,
                    padding: '14px',
                    backgroundColor: '#f8f9fa',
                    color: '#333',
                    border: '2px solid #e0e0e0',
                    borderRadius: '8px',
                    fontSize: '15px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Back
                </button>
                <button
                  onClick={handleNext}
                  disabled={!profile.age || !profile.gender || !profile.activity || !profile.goal}
                  style={{
                    flex: 2,
                    padding: '14px',
                    backgroundColor: (!profile.age || !profile.gender || !profile.activity || !profile.goal) ? '#ccc' : '#5f8a8f',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '15px',
                    fontWeight: '600',
                    cursor: (!profile.age || !profile.gender || !profile.activity || !profile.goal) ? 'not-allowed' : 'pointer'
                  }}
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Recommended Goals */}
          {step === 3 && recommendations && (
            <div>
              <h2 style={{ margin: '0 0 8px 0', fontSize: '24px', fontWeight: '700', color: '#1a1a1a' }}>
                Your Recommended Goals
              </h2>
              <p style={{ margin: '0 0 24px 0', fontSize: '14px', color: '#666' }}>
                Based on your profile, here are science-backed daily targets. You can adjust these anytime in Settings.
              </p>

              {/* Core metrics (always included) */}
              <div style={{ marginBottom: '8px', fontSize: '13px', fontWeight: '600', color: '#666' }}>
                Core Metrics
              </div>

              <div style={{
                backgroundColor: '#f0fdf4',
                border: '1px solid #86efac',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '16px' }}>💧</span>
                  <span style={{ fontSize: '14px', fontWeight: '600', color: '#166534' }}>
                    Water: {recommendations.water} oz/day
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: '#166534', opacity: 0.8 }}>
                  Recommended for your activity level
                </div>
              </div>

              <div style={{
                backgroundColor: '#eff6ff',
                border: '1px solid #93c5fd',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '16px' }}>🔥</span>
                  <span style={{ fontSize: '14px', fontWeight: '600', color: '#1e40af' }}>
                    Calories: {recommendations.calories} Cal/day
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: '#1e40af', opacity: 0.8 }}>
                  Maintenance level for your profile
                </div>
              </div>

              {recommendations.protein && (
                <div style={{
                  backgroundColor: '#fef3c7',
                  border: '1px solid #fcd34d',
                  borderRadius: '12px',
                  padding: '16px',
                  marginBottom: '20px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '16px' }}>🥩</span>
                    <span style={{ fontSize: '14px', fontWeight: '600', color: '#92400e' }}>
                      Protein: {recommendations.protein}g/day
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#92400e', opacity: 0.8 }}>
                    Based on your {profile.goal.replace('-', ' ')} goal
                  </div>
                </div>
              )}

              {/* Optional metrics with checkboxes */}
              <div style={{ marginBottom: '8px', marginTop: '20px', fontSize: '13px', fontWeight: '600', color: '#666' }}>
                Optional Metrics (uncheck to skip)
              </div>

              {[
                { key: 'fiber', label: 'Fiber', value: recommendations.fiber, unit: 'g', icon: '🌾', color: '#059669', bg: '#d1fae5' },
                { key: 'carbs', label: 'Carbohydrates', value: recommendations.carbs, unit: 'g', icon: '🍞', color: '#d97706', bg: '#fed7aa' },
                { key: 'fat', label: 'Fat', value: recommendations.fat, unit: 'g', icon: '🥑', color: '#7c3aed', bg: '#e9d5ff' }
              ].map((metric) => (
                <div
                  key={metric.key}
                  onClick={() => setSelectedOptionalMetrics({
                    ...selectedOptionalMetrics,
                    [metric.key]: !selectedOptionalMetrics[metric.key]
                  })}
                  style={{
                    backgroundColor: selectedOptionalMetrics[metric.key] ? metric.bg : '#f5f5f5',
                    border: `2px solid ${selectedOptionalMetrics[metric.key] ? metric.color : '#e0e0e0'}`,
                    borderRadius: '12px',
                    padding: '14px',
                    marginBottom: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    transition: 'all 0.2s'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedOptionalMetrics[metric.key]}
                    onChange={() => {}}
                    style={{
                      width: '18px',
                      height: '18px',
                      cursor: 'pointer'
                    }}
                  />
                  <span style={{ fontSize: '20px' }}>{metric.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontSize: '14px',
                      fontWeight: '600',
                      color: selectedOptionalMetrics[metric.key] ? metric.color : '#666'
                    }}>
                      {metric.label}: {metric.value}{metric.unit}/day
                    </div>
                  </div>
                </div>
              ))}

              <div style={{
                backgroundColor: '#f8f9fa',
                borderRadius: '8px',
                padding: '12px',
                marginTop: '16px',
                marginBottom: '24px',
                fontSize: '12px',
                color: '#666',
                lineHeight: '1.6'
              }}>
                ℹ️ These are starting points. You can customize any metric in Settings and add your own custom tracking fields.
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => setStep(2)}
                  style={{
                    flex: 1,
                    padding: '14px',
                    backgroundColor: '#f8f9fa',
                    color: '#333',
                    border: '2px solid #e0e0e0',
                    borderRadius: '8px',
                    fontSize: '15px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Back
                </button>
                <button
                  onClick={handleNext}
                  style={{
                    flex: 2,
                    padding: '14px',
                    backgroundColor: '#5f8a8f',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '15px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Daily Habits */}
          {step === 4 && (
            <div>
              <h2 style={{ margin: '0 0 8px 0', fontSize: '24px', fontWeight: '700', color: '#1a1a1a' }}>
                Choose Daily Habits to Track
              </h2>
              <p style={{ margin: '0 0 24px 0', fontSize: '14px', color: '#666' }}>
                Select healthy habits you want to build. Click to select/deselect.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                {[
                  { key: 'exercise', label: 'Exercise (30+ minutes)', icon: '🏃' },
                  { key: 'sleep', label: 'Get 8 hours of sleep', icon: '😴' },
                  { key: 'vegetables', label: 'Eat 5+ servings of vegetables', icon: '🥦' },
                  { key: 'vitamins', label: 'Take daily vitamins', icon: '💊' },
                  { key: 'meditate', label: 'Meditate or practice mindfulness', icon: '🧘' },
                  { key: 'read', label: 'Read for 20+ minutes', icon: '📚' },
                  { key: 'stretch', label: 'Stretch or do yoga', icon: '🤸' },
                  { key: 'noscreen', label: 'No screens 1hr before bed', icon: '📵' }
                ].map((habit) => {
                  const selected = isHabitSelected(habit.key)
                  return (
                    <button
                      key={habit.key}
                      onClick={() => toggleHabit(habit)}
                      style={{
                        padding: '16px',
                        backgroundColor: selected ? '#f0fdf4' : '#fff',
                        border: `2px solid ${selected ? '#10b981' : '#e0e0e0'}`,
                        borderRadius: '10px',
                        fontSize: '14px',
                        fontWeight: '600',
                        color: '#333',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        textAlign: 'left',
                        transition: 'all 0.2s',
                        boxShadow: selected ? '0 0 0 3px rgba(16, 185, 129, 0.1)' : 'none'
                      }}
                    >
                      <span style={{ fontSize: '24px' }}>{habit.icon}</span>
                      <span style={{ flex: 1 }}>{habit.label}</span>
                      {selected && (
                        <span style={{
                          color: '#10b981',
                          fontSize: '20px',
                          fontWeight: '700'
                        }}>✓</span>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Custom habit input */}
              <div style={{
                backgroundColor: '#f8f9fa',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '20px'
              }}>
                <div style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#333',
                  marginBottom: '8px'
                }}>
                  Add Your Own Habit
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={customHabit}
                    onChange={(e) => setCustomHabit(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addCustomHabit()}
                    placeholder="e.g., Drink green tea, Walk 10k steps..."
                    style={{
                      flex: 1,
                      padding: '12px',
                      fontSize: '14px',
                      border: '2px solid #e0e0e0',
                      borderRadius: '8px',
                      fontFamily: 'inherit'
                    }}
                  />
                  <button
                    onClick={addCustomHabit}
                    disabled={!customHabit.trim()}
                    style={{
                      padding: '12px 20px',
                      backgroundColor: customHabit.trim() ? '#5f8a8f' : '#ccc',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: customHabit.trim() ? 'pointer' : 'not-allowed'
                    }}
                  >
                    Add
                  </button>
                </div>
              </div>

              <div style={{
                backgroundColor: '#f8f9fa',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '24px',
                fontSize: '12px',
                color: '#666'
              }}>
                Selected {selectedHabits.length} habit{selectedHabits.length !== 1 ? 's' : ''}. You can always add more or remove these later in Settings.
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => setStep(3)}
                  style={{
                    flex: 1,
                    padding: '14px',
                    backgroundColor: '#f8f9fa',
                    color: '#333',
                    border: '2px solid #e0e0e0',
                    borderRadius: '8px',
                    fontSize: '15px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Back
                </button>
                <button
                  onClick={handleNext}
                  style={{
                    flex: 2,
                    padding: '14px',
                    backgroundColor: '#5f8a8f',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '15px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Step 5: Feature Tour */}
          {step === 5 && (
            <div>
              <h2 style={{ margin: '0 0 8px 0', fontSize: '24px', fontWeight: '700', color: '#1a1a1a' }}>
                You're all set! 🎉
              </h2>
              <p style={{ margin: '0 0 24px 0', fontSize: '14px', color: '#666' }}>
                Here's a quick overview of what you can do:
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
                <div style={{
                  padding: '16px',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '10px',
                  borderLeft: '4px solid #5f8a8f'
                }}>
                  <div style={{ fontSize: '20px', marginBottom: '8px' }}>🤖</div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#1a1a1a', marginBottom: '4px' }}>
                    AI Food Logging
                  </div>
                  <div style={{ fontSize: '13px', color: '#666', lineHeight: '1.5' }}>
                    Just describe what you ate (e.g., "2 eggs and toast") and AI will estimate the nutrition for you.
                  </div>
                </div>

                <div style={{
                  padding: '16px',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '10px',
                  borderLeft: '4px solid #5f8a8f'
                }}>
                  <div style={{ fontSize: '20px', marginBottom: '8px' }}>📅</div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#1a1a1a', marginBottom: '4px' }}>
                    Track Past Days
                  </div>
                  <div style={{ fontSize: '13px', color: '#666', lineHeight: '1.5' }}>
                    Use the date navigation arrows to view and edit data from previous days.
                  </div>
                </div>

                <div style={{
                  padding: '16px',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '10px',
                  borderLeft: '4px solid #5f8a8f'
                }}>
                  <div style={{ fontSize: '20px', marginBottom: '8px' }}>📊</div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#1a1a1a', marginBottom: '4px' }}>
                    Weekly Reports
                  </div>
                  <div style={{ fontSize: '13px', color: '#666', lineHeight: '1.5' }}>
                    Check the Reports page to see your weekly progress and export to PDF.
                  </div>
                </div>

                <div style={{
                  padding: '16px',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '10px',
                  borderLeft: '4px solid #5f8a8f'
                }}>
                  <div style={{ fontSize: '20px', marginBottom: '8px' }}>⚙️</div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#1a1a1a', marginBottom: '4px' }}>
                    Fully Customizable
                  </div>
                  <div style={{ fontSize: '13px', color: '#666', lineHeight: '1.5' }}>
                    Add custom nutrition metrics, habits, or quick-add meals in Settings.
                  </div>
                </div>
              </div>

              <div style={{
                backgroundColor: '#fffbeb',
                border: '1px solid #fcd34d',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '24px',
                fontSize: '13px',
                color: '#92400e',
                lineHeight: '1.5'
              }}>
                💡 <strong>Tip:</strong> Start simple! Focus on tracking 1-2 things consistently rather than trying to track everything at once.
              </div>

              <button
                onClick={handleComplete}
                style={{
                  width: '100%',
                  padding: '16px',
                  backgroundColor: '#5f8a8f',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Start Tracking!
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
