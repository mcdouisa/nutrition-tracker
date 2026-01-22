'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { AIChatModal } from './ai-chat-modal'

export default function NutritionTracker() {
  // Customizable checklist items (empty by default)
  const [checklistItems, setChecklistItems] = useState([])

  // Customizable nutrition metrics (empty by default)
  const [nutritionMetrics, setNutritionMetrics] = useState([])

  // Water tracking
  const [water, setWater] = useState(0)
  const [waterButtons, setWaterButtons] = useState([])
  const [waterGoal, setWaterGoal] = useState(0)

  // Meal slots
  const [meals, setMeals] = useState([null, null, null, null])

  // Custom entry values
  const [customValues, setCustomValues] = useState({})

  // History for undo
  const [nutritionHistory, setNutritionHistory] = useState([])
  const [waterHistory, setWaterHistory] = useState([])

  // Settings modal
  const [showSettings, setShowSettings] = useState(false)
  const [settingsTab, setSettingsTab] = useState('checklist') // checklist, nutrition, water, meals

  // AI Chat modal
  const [showChat, setShowChat] = useState(false)
  const [chatMessages, setChatMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [isThinking, setIsThinking] = useState(false)

  // Current date for tracking
  const [currentDate, setCurrentDate] = useState('')

  // Load data from localStorage on mount
  useEffect(() => {
    const today = new Date().toDateString()
    setCurrentDate(today)

    // Load checklist items
    const storedChecklist = localStorage.getItem('checklist-items')
    if (storedChecklist) {
      setChecklistItems(JSON.parse(storedChecklist))
    }

    // Load nutrition metrics
    const storedMetrics = localStorage.getItem('nutrition-metrics')
    if (storedMetrics) {
      setNutritionMetrics(JSON.parse(storedMetrics))
    }

    // Load water buttons
    const storedWaterButtons = localStorage.getItem('water-buttons')
    if (storedWaterButtons) {
      setWaterButtons(JSON.parse(storedWaterButtons))
    }

    // Load water goal
    const storedWaterGoal = localStorage.getItem('water-goal')
    if (storedWaterGoal) {
      setWaterGoal(Number(storedWaterGoal))
    }

    // Load meals
    const storedMeals = localStorage.getItem('custom-meals')
    if (storedMeals) {
      setMeals(JSON.parse(storedMeals))
    }

    // Load today's data
    const stored = localStorage.getItem('nutrition-data')
    if (stored) {
      const data = JSON.parse(stored)
      if (data.date === today) {
        setChecklistItems(data.checklistItems || [])
        setNutritionMetrics(data.nutritionMetrics || [])
        setWater(data.water || 0)
        setWaterHistory(data.waterHistory || [])
        setNutritionHistory(data.nutritionHistory || [])
      } else {
        // It's a new day - save yesterday's data to history before resetting
        saveToHistory(data)
      }
    }
  }, [])

  // Save to history function
  const saveToHistory = (dayData) => {
    if (!dayData || !dayData.date) return

    // Check if any data was tracked
    const hasNutrition = dayData.nutritionMetrics?.some(m => m.value > 0)
    const hasWater = dayData.water > 0
    const hasChecklist = dayData.checklistItems?.some(i => i.checked)

    if (!hasNutrition && !hasWater && !hasChecklist) return

    // Load existing history
    const existingHistory = localStorage.getItem('nutrition-history')
    let history = existingHistory ? JSON.parse(existingHistory) : []

    // Check if this date already exists in history
    const dateIndex = history.findIndex(h => h.date === dayData.date)
    if (dateIndex >= 0) {
      // Update existing entry
      history[dateIndex] = {
        date: dayData.date,
        nutritionMetrics: dayData.nutritionMetrics,
        water: dayData.water,
        checklistItems: dayData.checklistItems
      }
    } else {
      // Add new entry
      history.push({
        date: dayData.date,
        nutritionMetrics: dayData.nutritionMetrics,
        water: dayData.water,
        checklistItems: dayData.checklistItems
      })
    }

    // Keep only last 365 days
    if (history.length > 365) {
      history = history.slice(-365)
    }

    localStorage.setItem('nutrition-history', JSON.stringify(history))
  }

  // Save data to localStorage whenever it changes
  useEffect(() => {
    if (!currentDate) return // Don't save until we've loaded

    const today = new Date().toDateString()
    const data = {
      date: today,
      checklistItems,
      nutritionMetrics,
      water,
      waterHistory,
      nutritionHistory
    }
    localStorage.setItem('nutrition-data', JSON.stringify(data))

    // Also save to history for today (so reports show current day)
    saveToHistory(data)
  }, [checklistItems, nutritionMetrics, water, waterHistory, nutritionHistory, currentDate])

  // Toggle checklist item
  const toggleChecklistItem = (index) => {
    const updated = [...checklistItems]
    updated[index] = { ...updated[index], checked: !updated[index].checked }
    setChecklistItems(updated)
  }

  // Add water
  const addWater = (amount) => {
    setWaterHistory([...waterHistory, { amount, timestamp: Date.now() }])
    setWater(water + amount)
  }

  // Undo water
  const undoWater = () => {
    if (waterHistory.length === 0) return
    const lastEntry = waterHistory[waterHistory.length - 1]
    setWater(water - lastEntry.amount)
    setWaterHistory(waterHistory.slice(0, -1))
  }

  // Add to nutrition metric
  const addToMetric = (metricIndex, value) => {
    if (!value || value === 0) return

    const updated = [...nutritionMetrics]
    updated[metricIndex] = {
      ...updated[metricIndex],
      value: (updated[metricIndex].value || 0) + value
    }
    setNutritionMetrics(updated)

    // Add to history for undo
    setNutritionHistory([
      ...nutritionHistory,
      { metricIndex, value, timestamp: Date.now() }
    ])
  }

  // Undo last nutrition entry
  const undoNutrition = () => {
    if (nutritionHistory.length === 0) return

    const lastEntry = nutritionHistory[nutritionHistory.length - 1]
    const updated = [...nutritionMetrics]
    updated[lastEntry.metricIndex] = {
      ...updated[lastEntry.metricIndex],
      value: (updated[lastEntry.metricIndex].value || 0) - lastEntry.value
    }
    setNutritionMetrics(updated)
    setNutritionHistory(nutritionHistory.slice(0, -1))
  }

  // Add meal
  const addMeal = (meal) => {
    nutritionMetrics.forEach((metric, index) => {
      if (meal[metric.key]) {
        addToMetric(index, meal[metric.key])
      }
    })
  }

  // Add custom entry - batch all values together
  const addCustomEntry = () => {
    const updates = []
    const updatedMetrics = nutritionMetrics.map((metric, index) => {
      const value = parseInt(customValues[metric.key]) || 0
      if (value > 0) {
        updates.push({ metricIndex: index, value, timestamp: Date.now() })
        return { ...metric, value: (metric.value || 0) + value }
      }
      return metric
    })

    if (updates.length > 0) {
      setNutritionMetrics(updatedMetrics)
      setNutritionHistory([...nutritionHistory, ...updates])
    }
    setCustomValues({})
  }

  // Reset day
  const resetDay = () => {
    if (!confirm('Reset all tracking for today?')) return

    const resetChecklist = checklistItems.map(item => ({ ...item, checked: false }))
    const resetMetrics = nutritionMetrics.map(metric => ({ ...metric, value: 0 }))

    setChecklistItems(resetChecklist)
    setNutritionMetrics(resetMetrics)
    setWater(0)
    setWaterHistory([])
    setNutritionHistory([])
  }

  // Settings functions
  const saveChecklistItems = (items) => {
    localStorage.setItem('checklist-items', JSON.stringify(items))
    setChecklistItems(items)
  }

  const saveNutritionMetrics = (metrics) => {
    localStorage.setItem('nutrition-metrics', JSON.stringify(metrics))
    setNutritionMetrics(metrics)
  }

  const saveWaterButtons = (buttons) => {
    localStorage.setItem('water-buttons', JSON.stringify(buttons))
    setWaterButtons(buttons)
  }

  const saveWaterGoal = (goal) => {
    localStorage.setItem('water-goal', String(goal))
    setWaterGoal(goal)
  }

  const saveMeals = (mealsData) => {
    localStorage.setItem('custom-meals', JSON.stringify(mealsData))
    setMeals(mealsData)
  }

  // AI Chat functions using Groq API (free tier)
  const sendChatMessage = async () => {
    if (!chatInput.trim()) return

    const userMessage = { role: 'user', content: chatInput }
    setChatMessages([...chatMessages, userMessage])
    setChatInput('')
    setIsThinking(true)

    try {
      const metricsInfo = nutritionMetrics.length > 0
        ? nutritionMetrics.map(m => `${m.name} (${m.unit})`).join(', ')
        : 'calories, protein, carbs, fat'

      const metricsKeys = nutritionMetrics.length > 0
        ? Object.fromEntries(nutritionMetrics.map(m => [m.key, 0]))
        : { calories: 0, protein: 0, carbs: 0, fat: 0 }

      const systemPrompt = `You are a helpful nutrition assistant. The user is tracking these metrics: ${metricsInfo}.

When the user describes a meal or food, provide:
1. A brief, friendly response about the nutritional content
2. Your estimates for the food described

IMPORTANT: Always end your response with nutrition data in this exact JSON format on its own line:
NUTRITION_DATA: ${JSON.stringify(metricsKeys)}

Replace the 0s with your numerical estimates. Be accurate but reasonable with portion sizes.`

      // Build messages array for chat completion
      const messages = [
        { role: 'system', content: systemPrompt },
        ...chatMessages.slice(-6).map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        { role: 'user', content: chatInput }
      ]

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get response')
      }

      let assistantMessage = data.content || ''

      // Check if the response contains nutrition data
      const nutritionMatch = assistantMessage.match(/NUTRITION_DATA:\s*(\{[^}]+\})/i)
      let estimates = null
      let displayMessage = assistantMessage

      if (nutritionMatch) {
        try {
          estimates = JSON.parse(nutritionMatch[1])
          displayMessage = assistantMessage.replace(/NUTRITION_DATA:\s*\{[^}]+\}/i, '').trim()
        } catch (e) {
          console.error('Failed to parse nutrition data:', e)
        }
      }

      setChatMessages([
        ...chatMessages,
        userMessage,
        { role: 'assistant', content: displayMessage, estimates }
      ])
    } catch (error) {
      console.error('Chat error:', error)
      setChatMessages([
        ...chatMessages,
        userMessage,
        { role: 'assistant', content: error.message.includes('API key')
          ? 'AI Assistant not configured. Add GROQ_API_KEY to your environment variables. Get a free key at groq.com'
          : 'Sorry, I encountered an error. Please try again in a moment!' }
      ])
    } finally {
      setIsThinking(false)
    }
  }

  const addEstimatedNutrition = (estimates) => {
    const updated = nutritionMetrics.map(metric => ({
      ...metric,
      value: (metric.value || 0) + (estimates[metric.key] || 0)
    }))

    setNutritionHistory([...nutritionHistory, { metrics: nutritionMetrics, timestamp: Date.now() }])
    setNutritionMetrics(updated)
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#fafafa',
      padding: '40px 20px'
    }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{
          marginBottom: '48px',
          paddingBottom: '24px',
          borderBottom: '1px solid #e0e0e0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start'
        }}>
          <div>
            <h1 style={{
              margin: '0 0 8px 0',
              fontSize: '32px',
              fontWeight: '600',
              color: '#1a1a1a',
              letterSpacing: '-0.5px'
            }}>
              Daily Tracker
            </h1>
            <div style={{
              color: '#666',
              fontSize: '15px',
              fontWeight: '400',
              letterSpacing: '0'
            }}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setShowChat(true)}
              style={{
                padding: '10px 20px',
                backgroundColor: '#1a1a1a',
                border: 'none',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.15s',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
              }}
            >
              🤖 AI Assistant
            </button>
            <Link
              href="/reports"
              style={{
                padding: '10px 20px',
                backgroundColor: '#fff',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                color: '#1a1a1a',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.15s',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                textDecoration: 'none',
                display: 'inline-block'
              }}
            >
              Reports
            </Link>
            <button
              onClick={() => setShowSettings(true)}
              style={{
                padding: '10px 20px',
                backgroundColor: '#fff',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                color: '#1a1a1a',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.15s',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
              }}
            >
              Settings
            </button>
          </div>
        </div>

        {/* Daily Checklist */}
        {checklistItems.length > 0 && (
          <div style={{ marginBottom: '40px' }}>
            <h2 style={{
              margin: '0 0 16px 0',
              fontSize: '13px',
              fontWeight: '600',
              color: '#999',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Daily Habits
            </h2>
            <div style={{
              display: 'grid',
              gridTemplateColumns: checklistItems.length <= 2 ? `repeat(${checklistItems.length}, 1fr)` : 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '12px'
            }}>
              {checklistItems.map((item, i) => (
                <button
                  key={i}
                  onClick={() => toggleChecklistItem(i)}
                  style={{
                    padding: '16px 20px',
                    backgroundColor: '#fff',
                    border: '1px solid',
                    borderColor: item.checked ? '#1a1a1a' : '#e0e0e0',
                    borderRadius: '10px',
                    color: item.checked ? '#1a1a1a' : '#666',
                    fontSize: '15px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    boxShadow: item.checked ? '0 2px 8px rgba(0,0,0,0.08)' : '0 1px 2px rgba(0,0,0,0.04)'
                  }}
                >
                  <div style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    border: item.checked ? 'none' : '2px solid #d0d0d0',
                    backgroundColor: item.checked ? '#1a1a1a' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontSize: '12px',
                    flexShrink: 0
                  }}>
                    {item.checked && '✓'}
                  </div>
                  {item.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Water Tracker */}
        {waterButtons.length > 0 && (
          <div style={{ marginBottom: '40px' }}>
            <h2 style={{
              margin: '0 0 16px 0',
              fontSize: '13px',
              fontWeight: '600',
              color: '#999',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Hydration
            </h2>
            <div style={{
              backgroundColor: '#fff',
              borderRadius: '12px',
              padding: '32px',
              border: '1px solid #e0e0e0',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
            }}>
              <div style={{
                display: 'flex',
                gap: '48px',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '32px'
              }}>
{/* Water Bottle Visualization */}
                {waterGoal > 0 && (() => {
                  const fillPercent = Math.min(water / waterGoal, 1)
                  const waterHeight = fillPercent * 160
                  const waterTop = 190 - waterHeight
                  const isFull = fillPercent >= 1
                  return (
                    <WaterBottle
                      waterTop={waterTop}
                      waterHeight={waterHeight}
                      water={water}
                      fillPercent={fillPercent}
                      isFull={isFull}
                    />
                  )
                })()}

                {/* Stats */}
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    fontSize: '64px',
                    fontWeight: '600',
                    color: '#1a1a1a',
                    marginBottom: '4px',
                    letterSpacing: '-2px'
                  }}>
                    {water}
                  </div>
                  <div style={{
                    fontSize: '14px',
                    color: '#999',
                    fontWeight: '500',
                    letterSpacing: '0.5px',
                    marginBottom: waterGoal > 0 ? '8px' : '0'
                  }}>
                    oz consumed
                  </div>
                  {waterGoal > 0 && (
                    <div style={{
                      fontSize: '13px',
                      color: '#666',
                      fontWeight: '500'
                    }}>
                      Goal: {waterGoal} oz
                    </div>
                  )}
                </div>
              </div>

              <div style={{
                display: 'flex',
                gap: '8px',
                justifyContent: 'center',
                marginBottom: '16px'
              }}>
                {waterButtons.map((amount, i) => (
                  <button
                    key={i}
                    onClick={() => addWater(amount)}
                    style={{
                      padding: '12px 24px',
                      backgroundColor: '#f5f5f5',
                      border: '1px solid #e0e0e0',
                      borderRadius: '8px',
                      color: '#1a1a1a',
                      fontSize: '15px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      transition: 'all 0.15s'
                    }}
                  >
                    +{amount}
                  </button>
                ))}
              </div>
              {waterHistory.length > 0 && (
                <div style={{ textAlign: 'center' }}>
                  <button onClick={undoWater} style={{
                    padding: '8px 16px',
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: '#999',
                    fontSize: '13px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    textDecoration: 'underline'
                  }}>
                    Undo
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Nutrition Totals */}
        {nutritionMetrics.length > 0 && (
          <div style={{ marginBottom: '40px' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px'
            }}>
              <h2 style={{
                margin: '0',
                fontSize: '13px',
                fontWeight: '600',
                color: '#999',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                Nutrition
              </h2>
              {nutritionHistory.length > 0 && (
                <button onClick={undoNutrition} style={{
                  padding: '6px 12px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: '#999',
                  fontSize: '13px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  textDecoration: 'underline'
                }}>
                  Undo
                </button>
              )}
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns:
                nutritionMetrics.length === 1 ? '1fr' :
                nutritionMetrics.length === 2 ? 'repeat(2, 1fr)' :
                nutritionMetrics.length === 3 ? 'repeat(3, 1fr)' :
                'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '12px'
            }}>
              {nutritionMetrics.map((metric, i) => {
                const progress = metric.goal > 0 ? Math.min((metric.value || 0) / metric.goal * 100, 100) : 0
                return (
                  <div key={i} style={{
                    padding: '24px',
                    backgroundColor: '#fff',
                    border: '1px solid #e0e0e0',
                    borderRadius: '10px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                    position: 'relative',
                    overflow: 'hidden'
                  }}>
                    {/* Progress background */}
                    {metric.goal > 0 && (
                      <div style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: `${progress}%`,
                        backgroundColor: '#f0f9ff',
                        transition: 'height 0.3s ease',
                        zIndex: 0
                      }} />
                    )}

                    <div style={{ position: 'relative', zIndex: 1 }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '12px'
                      }}>
                        {metric.icon && (
                          <span style={{ fontSize: '16px' }}>{metric.icon}</span>
                        )}
                        <div style={{
                          fontSize: '13px',
                          color: '#999',
                          fontWeight: '500',
                          letterSpacing: '0.5px'
                        }}>
                          {metric.name}
                        </div>
                      </div>
                      <div style={{
                        fontSize: '36px',
                        fontWeight: '600',
                        color: '#1a1a1a',
                        letterSpacing: '-1px'
                      }}>
                        {metric.value || 0}
                        {metric.unit && <span style={{ fontSize: '18px', color: '#999', fontWeight: '500' }}> {metric.unit}</span>}
                      </div>
                      {metric.goal > 0 && (
                        <div style={{
                          marginTop: '8px',
                          fontSize: '13px',
                          color: '#666',
                          fontWeight: '500'
                        }}>
                          Goal: {metric.goal} {metric.unit}
                          <span style={{
                            marginLeft: '8px',
                            color: progress >= 100 ? '#10b981' : '#999',
                            fontWeight: '600'
                          }}>
                            {Math.round(progress)}%
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Quick Add Meals */}
        <div style={{ marginBottom: '40px' }}>
          <h2 style={{
            margin: '0 0 16px 0',
            fontSize: '13px',
            fontWeight: '600',
            color: '#999',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            Quick Add
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '12px',
            marginBottom: '16px'
          }}>
            {meals.map((meal, i) => (
              meal ? (
                <button
                  key={i}
                  onClick={() => addMeal(meal)}
                  style={{
                    padding: '20px',
                    backgroundColor: '#fff',
                    border: '1px solid #e0e0e0',
                    borderRadius: '10px',
                    color: '#1a1a1a',
                    fontSize: '15px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '8px'
                  }}>
                    {meal.icon && (
                      <span style={{ fontSize: '20px' }}>{meal.icon}</span>
                    )}
                    <div style={{ fontSize: '15px', fontWeight: '500', color: '#1a1a1a' }}>
                      {meal.name}
                    </div>
                  </div>
                  <div style={{ fontSize: '13px', color: '#999', lineHeight: '1.5' }}>
                    {nutritionMetrics.map((metric, idx) =>
                      meal[metric.key] ? `${meal[metric.key]}${metric.unit || ''} ${metric.name}` : ''
                    ).filter(Boolean).join(' • ')}
                  </div>
                </button>
              ) : (
                <div
                  key={i}
                  style={{
                    padding: '20px',
                    backgroundColor: '#fafafa',
                    border: '1px dashed #d0d0d0',
                    borderRadius: '10px',
                    color: '#ccc',
                    fontSize: '13px',
                    textAlign: 'center',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: '500'
                  }}
                >
                  Empty Slot
                </div>
              )
            ))}
          </div>

          {/* Custom Entry */}
          {nutritionMetrics.length > 0 && (
            <div style={{
              padding: '24px',
              backgroundColor: '#fff',
              border: '1px solid #e0e0e0',
              borderRadius: '10px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
            }}>
              <div style={{
                fontSize: '13px',
                color: '#999',
                marginBottom: '16px',
                fontWeight: '500',
                letterSpacing: '0.5px'
              }}>
                Custom Entry
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${Math.min(nutritionMetrics.length, 2)}, 1fr)`,
                gap: '12px',
                marginBottom: '16px'
              }}>
                {nutritionMetrics.map((metric, i) => (
                  <input
                    key={i}
                    type="number"
                    placeholder={metric.name}
                    value={customValues[metric.key] || ''}
                    onChange={(e) => setCustomValues({ ...customValues, [metric.key]: e.target.value })}
                    style={{
                      padding: '12px 16px',
                      backgroundColor: '#fafafa',
                      border: '1px solid #e0e0e0',
                      borderRadius: '8px',
                      color: '#1a1a1a',
                      fontSize: '15px',
                      fontWeight: '500'
                    }}
                  />
                ))}
              </div>
              <button onClick={addCustomEntry} style={{
                width: '100%',
                padding: '12px',
                backgroundColor: '#1a1a1a',
                border: 'none',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '15px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}>
                Add Entry
              </button>
            </div>
          )}
        </div>

        {/* Empty State Message */}
        {checklistItems.length === 0 && nutritionMetrics.length === 0 && waterButtons.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: '80px 40px',
            backgroundColor: '#fff',
            borderRadius: '12px',
            border: '1px solid #e0e0e0'
          }}>
            <div style={{
              fontSize: '56px',
              marginBottom: '24px',
              opacity: 0.2
            }}>
              📊
            </div>
            <div style={{
              fontSize: '20px',
              fontWeight: '600',
              color: '#1a1a1a',
              marginBottom: '8px'
            }}>
              Ready to Track
            </div>
            <div style={{
              fontSize: '15px',
              color: '#999',
              marginBottom: '24px'
            }}>
              Configure your tracker to get started
            </div>
            <button
              onClick={() => setShowSettings(true)}
              style={{
                padding: '12px 24px',
                backgroundColor: '#1a1a1a',
                border: 'none',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '15px',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              Open Settings
            </button>
          </div>
        )}
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal
          checklistItems={checklistItems}
          nutritionMetrics={nutritionMetrics}
          waterButtons={waterButtons}
          waterGoal={waterGoal}
          meals={meals}
          onSaveChecklist={saveChecklistItems}
          onSaveNutrition={saveNutritionMetrics}
          onSaveWater={saveWaterButtons}
          onSaveWaterGoal={saveWaterGoal}
          onSaveMeals={saveMeals}
          onResetDay={resetDay}
          onClose={() => setShowSettings(false)}
          settingsTab={settingsTab}
          setSettingsTab={setSettingsTab}
        />
      )}

      {/* AI Chat Modal */}
      {showChat && (
        <AIChatModal
          messages={chatMessages}
          input={chatInput}
          isThinking={isThinking}
          onInputChange={setChatInput}
          onSend={sendChatMessage}
          onAddEstimates={addEstimatedNutrition}
          onClose={() => setShowChat(false)}
        />
      )}
    </div>
  )
}

// Water Bottle Component with delayed wave animation
function WaterBottle({ waterTop, waterHeight, water, fillPercent, isFull }) {
  const [showWaves, setShowWaves] = useState(true)
  const [displayedWaterTop, setDisplayedWaterTop] = useState(waterTop)

  // When water changes, hide waves and wait for fill animation to complete
  useEffect(() => {
    setShowWaves(false)

    // Show waves after the fill animation completes (1.5s)
    const timer = setTimeout(() => {
      setDisplayedWaterTop(waterTop)
      setShowWaves(true)
    }, 1600)

    return () => clearTimeout(timer)
  }, [water])

  return (
    <div style={{ textAlign: 'center' }}>
      <style>{`
        @keyframes waveFlow {
          0% { transform: translateX(0); }
          100% { transform: translateX(-25px); }
        }
      `}</style>
      <svg
        width="120"
        height="200"
        viewBox="0 0 120 200"
        style={{ display: 'block', overflow: 'hidden' }}
      >
        <defs>
          <clipPath id="bottleClip">
            <path d="M 40 20 L 40 10 L 80 10 L 80 20 L 85 30 L 85 180 Q 85 190 75 190 L 45 190 Q 35 190 35 180 L 35 30 Z" />
          </clipPath>
        </defs>

        {/* Bottle outline */}
        <path
          d="M 40 20 L 40 10 L 80 10 L 80 20 L 85 30 L 85 180 Q 85 190 75 190 L 45 190 Q 35 190 35 180 L 35 30 Z"
          fill="none"
          stroke="#e0e0e0"
          strokeWidth="2"
        />

        {/* Water fill */}
        {water > 0 && (
          <g clipPath="url(#bottleClip)">
            {/* Main water body */}
            <rect
              x="30"
              y={waterTop + 3}
              width="60"
              height={waterHeight + 10}
              fill="#7dd3fc"
              style={{ transition: 'y 1.5s ease-out, height 1.5s ease-out' }}
            />

            {/* Animated wave on top - only shows after fill completes */}
            {showWaves && (
              <g style={{
                animation: 'waveFlow 4s linear infinite',
              }}>
                <path
                  d={`M 10 ${displayedWaterTop + 3}
                      Q 17 ${displayedWaterTop}, 25 ${displayedWaterTop + 3}
                      T 40 ${displayedWaterTop + 3}
                      T 55 ${displayedWaterTop + 3}
                      T 70 ${displayedWaterTop + 3}
                      T 85 ${displayedWaterTop + 3}
                      T 100 ${displayedWaterTop + 3}
                      T 115 ${displayedWaterTop + 3}
                      T 130 ${displayedWaterTop + 3}
                      L 130 ${displayedWaterTop + 10}
                      L 10 ${displayedWaterTop + 10} Z`}
                  fill="#7dd3fc"
                />
              </g>
            )}

            {/* Subtle highlight for depth */}
            <rect
              x="38"
              y={waterTop + 10}
              width="6"
              height={Math.max(waterHeight - 15, 0)}
              fill="#a5f3fc"
              opacity="0.5"
              rx="3"
              style={{ transition: 'y 1.5s ease-out, height 1.5s ease-out' }}
            />
          </g>
        )}

        {/* Cap */}
        <rect x="40" y="10" width="40" height="10" fill="#e0e0e0" rx="2" />
      </svg>
      <div style={{
        marginTop: '12px',
        fontSize: '13px',
        color: isFull ? '#10b981' : '#666',
        fontWeight: '500'
      }}>
        {Math.round(fillPercent * 100)}% of goal {isFull && '🎉'}
      </div>
    </div>
  )
}

// Settings Modal Component
function SettingsModal({
  checklistItems,
  nutritionMetrics,
  waterButtons,
  waterGoal,
  meals,
  onSaveChecklist,
  onSaveNutrition,
  onSaveWater,
  onSaveWaterGoal,
  onSaveMeals,
  onResetDay,
  onClose,
  settingsTab,
  setSettingsTab
}) {
  const [tempChecklist, setTempChecklist] = useState([...checklistItems])
  const [tempMetrics, setTempMetrics] = useState([...nutritionMetrics])
  const [tempWater, setTempWater] = useState([...waterButtons])
  const [tempWaterGoal, setTempWaterGoal] = useState(waterGoal)
  const [tempMeals, setTempMeals] = useState([...meals])

  const addChecklistItem = () => {
    setTempChecklist([...tempChecklist, { name: '', checked: false }])
  }

  const updateChecklistItem = (index, name) => {
    const updated = [...tempChecklist]
    updated[index] = { ...updated[index], name }
    setTempChecklist(updated)
  }

  const removeChecklistItem = (index) => {
    setTempChecklist(tempChecklist.filter((_, i) => i !== index))
  }

  const addNutritionMetric = () => {
    setTempMetrics([...tempMetrics, { name: '', key: '', unit: '', value: 0, goal: 0, icon: '📊' }])
  }

  const updateNutritionMetric = (index, field, value) => {
    const updated = [...tempMetrics]
    updated[index] = { ...updated[index], [field]: value }
    setTempMetrics(updated)
  }

  const removeNutritionMetric = (index) => {
    setTempMetrics(tempMetrics.filter((_, i) => i !== index))
  }

  const addWaterButton = () => {
    setTempWater([...tempWater, 0])
  }

  const updateWaterButton = (index, value) => {
    const updated = [...tempWater]
    updated[index] = parseInt(value) || 0
    setTempWater(updated)
  }

  const removeWaterButton = (index) => {
    setTempWater(tempWater.filter((_, i) => i !== index))
  }

  const updateMeal = (index, field, value) => {
    const updated = [...tempMeals]
    if (!updated[index]) updated[index] = { name: '' }
    updated[index] = { ...updated[index], [field]: value }
    setTempMeals(updated)
  }

  const removeMeal = (index) => {
    const updated = [...tempMeals]
    updated[index] = null
    setTempMeals(updated)
  }

  const handleSave = () => {
    // Clean up checklist items
    const cleanChecklist = tempChecklist.filter(item => item.name.trim() !== '')

    // Clean up nutrition metrics and auto-generate keys
    const cleanMetrics = tempMetrics
      .filter(metric => metric.name.trim() !== '')
      .map(metric => ({
        ...metric,
        key: metric.key || metric.name.toLowerCase().replace(/\s+/g, '_'),
        value: metric.value || 0
      }))

    // Clean up water buttons
    const cleanWater = tempWater.filter(amount => amount > 0)

    onSaveChecklist(cleanChecklist)
    onSaveNutrition(cleanMetrics)
    onSaveWater(cleanWater)
    onSaveWaterGoal(tempWaterGoal)
    onSaveMeals(tempMeals)
    onClose()
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.4)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: '#fff',
        borderRadius: '12px',
        maxWidth: '700px',
        width: '100%',
        maxHeight: '85vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
      }}>
        {/* Header */}
        <div style={{
          padding: '24px 28px',
          borderBottom: '1px solid #e0e0e0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h2 style={{
            margin: 0,
            fontSize: '20px',
            fontWeight: '600',
            color: '#1a1a1a',
            letterSpacing: '-0.3px'
          }}>
            Settings
          </h2>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              backgroundColor: '#f5f5f5',
              border: 'none',
              borderRadius: '6px',
              color: '#666',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            Close
          </button>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex',
          gap: '4px',
          padding: '16px 28px 0 28px',
          borderBottom: '1px solid #e0e0e0'
        }}>
          {[
            { id: 'checklist', label: 'Habits' },
            { id: 'nutrition', label: 'Nutrition' },
            { id: 'water', label: 'Water' },
            { id: 'meals', label: 'Meals' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setSettingsTab(tab.id)}
              style={{
                padding: '10px 20px',
                backgroundColor: 'transparent',
                border: 'none',
                borderBottom: settingsTab === tab.id ? '2px solid #1a1a1a' : '2px solid transparent',
                color: settingsTab === tab.id ? '#1a1a1a' : '#999',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.15s',
                marginBottom: '-1px'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '28px',
          backgroundColor: '#fafafa'
        }}>
          {settingsTab === 'checklist' && (
            <ChecklistSettings
              items={tempChecklist}
              onAdd={addChecklistItem}
              onUpdate={updateChecklistItem}
              onRemove={removeChecklistItem}
            />
          )}

          {settingsTab === 'nutrition' && (
            <NutritionSettings
              metrics={tempMetrics}
              onAdd={addNutritionMetric}
              onUpdate={updateNutritionMetric}
              onRemove={removeNutritionMetric}
            />
          )}

          {settingsTab === 'water' && (
            <WaterSettings
              buttons={tempWater}
              goal={tempWaterGoal}
              onGoalChange={setTempWaterGoal}
              onAdd={addWaterButton}
              onUpdate={updateWaterButton}
              onRemove={removeWaterButton}
            />
          )}

          {settingsTab === 'meals' && (
            <MealSettings
              meals={tempMeals}
              metrics={tempMetrics}
              onUpdate={updateMeal}
              onRemove={removeMeal}
            />
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '20px 28px',
          borderTop: '1px solid #e0e0e0',
          backgroundColor: '#fff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <button
            onClick={() => {
              onResetDay()
              onClose()
            }}
            style={{
              padding: '10px 20px',
              backgroundColor: 'transparent',
              border: '1px solid #ef4444',
              borderRadius: '8px',
              color: '#ef4444',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            Reset Today
          </button>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={onClose}
              style={{
                padding: '10px 20px',
                backgroundColor: '#f5f5f5',
                border: 'none',
              borderRadius: '8px',
              color: '#666',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            style={{
              padding: '10px 24px',
              backgroundColor: '#1a1a1a',
              border: 'none',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            Save Changes
          </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Checklist Settings Component
function ChecklistSettings({ items, onAdd, onUpdate, onRemove }) {
  return (
    <div>
      <div style={{ fontSize: '14px', color: '#666', marginBottom: '20px' }}>
        Add daily habits you want to track (vitamins, exercise, meditation, etc.)
      </div>

      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <input
            type="text"
            value={item.name}
            onChange={(e) => onUpdate(i, e.target.value)}
            placeholder="Habit name"
            style={{
              flex: 1,
              padding: '12px 16px',
              backgroundColor: '#fff',
              border: '1px solid #e0e0e0',
              borderRadius: '8px',
              color: '#1a1a1a',
              fontSize: '15px',
              fontWeight: '500'
            }}
          />
          <button
            onClick={() => onRemove(i)}
            style={{
              padding: '12px 16px',
              backgroundColor: '#f5f5f5',
              border: 'none',
              borderRadius: '8px',
              color: '#999',
              fontSize: '14px',
              cursor: 'pointer',
              fontWeight: '500'
            }}
          >
            Remove
          </button>
        </div>
      ))}

      <button
        onClick={onAdd}
        style={{
          width: '100%',
          padding: '12px',
          marginTop: '12px',
          backgroundColor: '#fff',
          border: '1px dashed #d0d0d0',
          borderRadius: '8px',
          color: '#666',
          fontSize: '14px',
          fontWeight: '500',
          cursor: 'pointer'
        }}
      >
        + Add Habit
      </button>
    </div>
  )
}

// Nutrition Settings Component
function NutritionSettings({ metrics, onAdd, onUpdate, onRemove }) {
  // Common food/nutrition emojis to choose from
  const iconOptions = ['📊', '🔥', '💪', '🥩', '🥚', '🥛', '🍗', '🥤', '🧈', '🥜', '🌾']

  return (
    <div>
      <div style={{ fontSize: '14px', color: '#666', marginBottom: '20px' }}>
        Add nutrition metrics to track with optional daily goals
      </div>

      {metrics.map((metric, i) => (
        <div key={i} style={{
          padding: '20px',
          backgroundColor: '#fff',
          border: '1px solid #e0e0e0',
          borderRadius: '10px',
          marginBottom: '12px'
        }}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <select
              value={metric.icon || '📊'}
              onChange={(e) => onUpdate(i, 'icon', e.target.value)}
              style={{
                padding: '10px',
                backgroundColor: '#fafafa',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                fontSize: '18px',
                cursor: 'pointer',
                width: '60px'
              }}
            >
              {iconOptions.map(icon => (
                <option key={icon} value={icon}>{icon}</option>
              ))}
            </select>
            <input
              type="text"
              value={metric.name}
              onChange={(e) => onUpdate(i, 'name', e.target.value)}
              placeholder="Metric name (e.g., Calories)"
              style={{
                flex: 1,
                padding: '12px 16px',
                backgroundColor: '#fafafa',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                color: '#1a1a1a',
                fontSize: '15px',
                fontWeight: '500'
              }}
            />
            <button
              onClick={() => onRemove(i)}
              style={{
                padding: '12px 16px',
                backgroundColor: '#f5f5f5',
                border: 'none',
                borderRadius: '8px',
                color: '#999',
                fontSize: '14px',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              Remove
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
            <div>
              <label style={{ fontSize: '11px', color: '#999', marginBottom: '4px', display: 'block' }}>
                Unit
              </label>
              <input
                type="text"
                value={metric.unit}
                onChange={(e) => onUpdate(i, 'unit', e.target.value)}
                placeholder="g, cal, etc"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  backgroundColor: '#fafafa',
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px',
                  color: '#1a1a1a',
                  fontSize: '14px'
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: '11px', color: '#999', marginBottom: '4px', display: 'block' }}>
                Daily Goal
              </label>
              <input
                type="number"
                value={metric.goal || ''}
                onChange={(e) => onUpdate(i, 'goal', parseInt(e.target.value) || 0)}
                placeholder="Optional"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  backgroundColor: '#fafafa',
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px',
                  color: '#1a1a1a',
                  fontSize: '14px'
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: '11px', color: '#999', marginBottom: '4px', display: 'block' }}>
                Key (optional)
              </label>
              <input
                type="text"
                value={metric.key}
                onChange={(e) => onUpdate(i, 'key', e.target.value)}
                placeholder="Auto"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  backgroundColor: '#fafafa',
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px',
                  color: '#1a1a1a',
                  fontSize: '14px'
                }}
              />
            </div>
          </div>
        </div>
      ))}

      <button
        onClick={onAdd}
        style={{
          width: '100%',
          padding: '12px',
          marginTop: '12px',
          backgroundColor: '#fff',
          border: '1px dashed #d0d0d0',
          borderRadius: '8px',
          color: '#666',
          fontSize: '14px',
          fontWeight: '500',
          cursor: 'pointer'
        }}
      >
        + Add Metric
      </button>
    </div>
  )
}

// Water Settings Component
function WaterSettings({ buttons, goal, onGoalChange, onAdd, onUpdate, onRemove }) {
  return (
    <div>
      <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px', fontWeight: '500' }}>
        Daily Water Goal
      </div>
      <input
        type="number"
        value={goal || ''}
        onChange={(e) => onGoalChange(Number(e.target.value))}
        placeholder="Enter daily goal in ounces"
        style={{
          width: '100%',
          padding: '12px',
          backgroundColor: '#fff',
          border: '1px solid #e0e0e0',
          borderRadius: '8px',
          color: '#1a1a1a',
          fontSize: '14px',
          marginBottom: '24px'
        }}
      />

      <div style={{ fontSize: '12px', color: '#666', marginBottom: '16px', fontWeight: '500' }}>
        Water Bottle Sizes (in ounces)
      </div>

      {buttons.map((amount, i) => (
        <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
          <input
            type="number"
            value={amount}
            onChange={(e) => onUpdate(i, e.target.value)}
            placeholder="Ounces"
            style={{
              flex: 1,
              padding: '12px',
              backgroundColor: '#fff',
              border: '1px solid #e0e0e0',
              borderRadius: '8px',
              color: '#1a1a1a',
              fontSize: '14px'
            }}
          />
          <button
            onClick={() => onRemove(i)}
            style={{
              padding: '12px 16px',
              backgroundColor: '#fff',
              border: '1px solid #e0e0e0',
              borderRadius: '8px',
              color: '#ff3333',
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            ✕
          </button>
        </div>
      ))}

      <button
        onClick={onAdd}
        style={{
          width: '100%',
          padding: '12px',
          marginTop: '8px',
          backgroundColor: 'rgba(0, 217, 255, 0.05)',
          border: '1px dashed rgba(0, 217, 255, 0.3)',
          borderRadius: '6px',
          color: '#00D9FF',
          fontSize: '12px',
          fontWeight: '600',
          cursor: 'pointer',
          letterSpacing: '1px'
        }}
      >
        + ADD BOTTLE SIZE
      </button>
    </div>
  )
}

// Meal Settings Component
function MealSettings({ meals, metrics, onUpdate, onRemove }) {
  const mealIcons = ['🍽️', '🍕', '🍔', '🥗', '🍜', '🍱', '🥪', '🌮', '🌯', '🥙', '🍳', '🥞', '🍞', '🥐', '🥓']

  return (
    <div>
      <div style={{ fontSize: '14px', color: '#666', marginBottom: '20px' }}>
        Configure quick-add meal presets
      </div>

      {metrics.length === 0 && (
        <div style={{
          padding: '40px 20px',
          textAlign: 'center',
          color: '#999',
          fontSize: '14px',
          backgroundColor: '#fff',
          borderRadius: '10px',
          border: '1px solid #e0e0e0'
        }}>
          Add nutrition metrics first to configure meals
        </div>
      )}

      {metrics.length > 0 && meals.map((meal, i) => (
        <div key={i} style={{
          padding: '20px',
          backgroundColor: '#fff',
          border: '1px solid #e0e0e0',
          borderRadius: '10px',
          marginBottom: '12px'
        }}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: meal ? '16px' : '0' }}>
            {meal && (
              <select
                value={meal?.icon || '🍽️'}
                onChange={(e) => onUpdate(i, 'icon', e.target.value)}
                style={{
                  padding: '10px',
                  backgroundColor: '#fafafa',
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px',
                  fontSize: '18px',
                  cursor: 'pointer',
                  width: '60px'
                }}
              >
                {mealIcons.map(icon => (
                  <option key={icon} value={icon}>{icon}</option>
                ))}
              </select>
            )}
            <input
              type="text"
              value={meal?.name || ''}
              onChange={(e) => onUpdate(i, 'name', e.target.value)}
              placeholder={`Meal ${i + 1} (optional)`}
              style={{
                flex: 1,
                padding: '12px 16px',
                backgroundColor: '#fafafa',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                color: '#1a1a1a',
                fontSize: '15px',
                fontWeight: '500'
              }}
            />
            {meal && (
              <button
                onClick={() => onRemove(i)}
                style={{
                  padding: '12px 16px',
                  backgroundColor: '#f5f5f5',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#999',
                  fontSize: '14px',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                Remove
              </button>
            )}
          </div>

          {meal && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
              {metrics.map((metric) => (
                <div key={metric.key}>
                  <label style={{
                    fontSize: '11px',
                    color: '#999',
                    marginBottom: '4px',
                    display: 'block'
                  }}>
                    {metric.name} {metric.unit && `(${metric.unit})`}
                  </label>
                  <input
                    type="number"
                    value={meal[metric.key] || ''}
                    onChange={(e) => onUpdate(i, metric.key, parseInt(e.target.value) || 0)}
                    placeholder="0"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      backgroundColor: '#fafafa',
                      border: '1px solid #e0e0e0',
                      borderRadius: '8px',
                      color: '#1a1a1a',
                      fontSize: '14px'
                    }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
