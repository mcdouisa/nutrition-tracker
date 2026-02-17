'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AIChatModal } from './ai-chat-modal'
import { useAuth } from '../lib/AuthContext'
import {
  saveTodayData,
  loadTodayData,
  loadDayData,
  saveUserSettings,
  loadUserSettings,
  saveHistoryEntry,
  toLocalDateStr,
  migrateLocalStorageToFirestore,
  needsMigration,
  subscribeTodayData,
  subscribeUserSettings,
  saveFeedback,
  updateUserProfile
} from '../lib/dataSync'

export default function NutritionTracker() {
  const { user, loading: authLoading, signOut, isConfigured } = useAuth()
  const router = useRouter()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [syncStatus, setSyncStatus] = useState('') // 'syncing', 'synced', 'error', ''
  const [migrating, setMigrating] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [splashMinTime, setSplashMinTime] = useState(true) // minimum splash display
  const isRemoteUpdate = useRef(false) // Track if update came from real-time listener
  const cloudLoadSucceeded = useRef(false) // Track if cloud data was loaded successfully
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
  const [showNutritionLog, setShowNutritionLog] = useState(false)
  const [editingMetric, setEditingMetric] = useState(null) // index of metric being edited
  const [editMetricValue, setEditMetricValue] = useState('')

  // AI Chat modal
  const [showChat, setShowChat] = useState(false)
  const [chatMessages, setChatMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [isThinking, setIsThinking] = useState(false)

  // Current date for tracking
  const [currentDate, setCurrentDate] = useState('')
  const [dataLoaded, setDataLoaded] = useState(false)
  const [reloadKey, setReloadKey] = useState(0) // Increment to force data reload (e.g. day change)

  // Previous day checklist navigation
  const [checklistViewDate, setChecklistViewDate] = useState(null) // null = today, YYYY-MM-DD for past
  const [pastDayChecklist, setPastDayChecklist] = useState(null) // checklist items for past day
  const [loadingPastDay, setLoadingPastDay] = useState(false)

  // Ensure splash screen shows for at least 1 second
  useEffect(() => {
    const timer = setTimeout(() => setSplashMinTime(false), 1000)
    return () => clearTimeout(timer)
  }, [])

  // Sync data to cloud when user is logged in
  const syncToCloud = useCallback(async (data, settings = null) => {
    if (!user) return

    setSyncStatus('syncing')
    try {
      await saveTodayData(user.uid, data)
      // Also save to history collection so reports page can find it
      await saveHistoryEntry(user.uid, data.date, data)
      if (settings) {
        await saveUserSettings(user.uid, settings)
      }
      setSyncStatus('synced')
      setTimeout(() => setSyncStatus(''), 2000)
    } catch (error) {
      console.error('Sync error:', error)
      setSyncStatus('error')
      setTimeout(() => setSyncStatus(''), 3000)
    }
  }, [user])

  // Load data - from cloud if logged in, otherwise from localStorage
  // Also sets up real-time listeners for multi-device sync
  useEffect(() => {
    let unsubscribeData = () => {}
    let unsubscribeSettings = () => {}
    let cancelled = false // Prevents stale async calls from updating state after user changes

    // Reset dataLoaded to prevent stale saves during user transitions
    setDataLoaded(false)
    cloudLoadSucceeded.current = false

    const loadData = async () => {
      const today = new Date().toDateString()
      setCurrentDate(today)

      // Reset daily values first (prevents bleed between users or days)
      setWater(0)
      setWaterHistory([])
      setNutritionHistory([])

      // If user is logged in (including anonymous), load from cloud
      if (user && isConfigured) {
        // Check if we need to migrate localStorage data
        if (needsMigration()) {
          setMigrating(true)
          await migrateLocalStorageToFirestore(user.uid)
          if (cancelled) return
          setMigrating(false)
        }

        // Track real (non-anonymous) user profiles for admin dashboard
        if (!user.isAnonymous) {
          updateUserProfile(user.uid, user.email, user.metadata?.creationTime)
        }

        // Load settings from cloud (definitions only - strip daily values)
        const cloudSettings = await loadUserSettings(user.uid)
        if (cancelled) return
        if (cloudSettings) {
          if (cloudSettings.checklistItems) {
            setChecklistItems(cloudSettings.checklistItems.map(item => ({ ...item, checked: false })))
          }
          if (cloudSettings.nutritionMetrics) {
            setNutritionMetrics(cloudSettings.nutritionMetrics.map(m => ({ ...m, value: 0 })))
          }
          if (cloudSettings.waterButtons) setWaterButtons(cloudSettings.waterButtons)
          if (cloudSettings.waterGoal) setWaterGoal(cloudSettings.waterGoal)
          if (cloudSettings.meals) setMeals(cloudSettings.meals)
        }

        // Load today's data from cloud (checks both dailyData and history collections)
        try {
          const cloudData = await loadTodayData(user.uid)
          if (cancelled) return
          cloudLoadSucceeded.current = true
          if (cloudData) {
            if (cloudData.checklistItems) setChecklistItems(cloudData.checklistItems)
            if (cloudData.nutritionMetrics) setNutritionMetrics(cloudData.nutritionMetrics)
            if (cloudData.water !== undefined) setWater(cloudData.water)
            if (cloudData.waterHistory) setWaterHistory(cloudData.waterHistory)
            if (cloudData.nutritionHistory) setNutritionHistory(cloudData.nutritionHistory)
            // Reconcile: write back to dailyData so the real-time listener stays in sync
            // (data may have come from the history collection if dailyData was stale)
            await saveTodayData(user.uid, cloudData)
          }
        } catch (error) {
          console.error('Failed to load today data from cloud:', error)
          // Don't set cloudLoadSucceeded — prevents saving zeros over real data
        }

        if (cancelled) return

        // Set up real-time listeners for multi-device sync
        unsubscribeData = subscribeTodayData(user.uid, (data) => {
          // subscribeTodayData already listens to dailyData/{YYYY-MM-DD} for today,
          // so any data received is guaranteed to be today's data
          if (data) {
            cloudLoadSucceeded.current = true // Real-time data confirmed, safe to save
            isRemoteUpdate.current = true
            if (data.checklistItems) setChecklistItems(data.checklistItems)
            if (data.nutritionMetrics) setNutritionMetrics(data.nutritionMetrics)
            if (data.water !== undefined) setWater(data.water)
            if (data.waterHistory) setWaterHistory(data.waterHistory)
            if (data.nutritionHistory) setNutritionHistory(data.nutritionHistory)
            // Reset flag after state updates
            setTimeout(() => { isRemoteUpdate.current = false }, 100)
          }
        })

        unsubscribeSettings = subscribeUserSettings(user.uid, (settings) => {
          if (settings) {
            isRemoteUpdate.current = true
            // For checklist items, only update the structure (names) not the checked state
            // The checked state comes from daily data, not settings
            if (settings.checklistItems) {
              setChecklistItems(current => {
                // Merge settings items with current checked states
                return settings.checklistItems.map((settingsItem, index) => ({
                  ...settingsItem,
                  // Preserve checked state from current if same item exists
                  checked: current[index]?.name === settingsItem.name ? current[index].checked : false
                }))
              })
            }
            if (settings.nutritionMetrics) {
              setNutritionMetrics(current => {
                // Merge settings definitions with current daily values
                return settings.nutritionMetrics.map((settingsMetric, index) => ({
                  ...settingsMetric,
                  value: current[index]?.key === settingsMetric.key ? (current[index].value || 0) : 0
                }))
              })
            }
            if (settings.waterButtons) setWaterButtons(settings.waterButtons)
            if (settings.waterGoal) setWaterGoal(settings.waterGoal)
            if (settings.meals) setMeals(settings.meals)
            setTimeout(() => { isRemoteUpdate.current = false }, 100)
          }
        })

        setDataLoaded(true)
        return
      }

      // Fallback to localStorage
      // Load settings definitions (strip daily values)
      const storedChecklist = localStorage.getItem('checklist-items')
      if (storedChecklist) {
        setChecklistItems(JSON.parse(storedChecklist).map(item => ({ ...item, checked: false })))
      }

      const storedMetrics = localStorage.getItem('nutrition-metrics')
      if (storedMetrics) {
        setNutritionMetrics(JSON.parse(storedMetrics).map(m => ({ ...m, value: 0 })))
      }

      const storedWaterButtons = localStorage.getItem('water-buttons')
      if (storedWaterButtons) {
        setWaterButtons(JSON.parse(storedWaterButtons))
      }

      const storedWaterGoal = localStorage.getItem('water-goal')
      if (storedWaterGoal) {
        setWaterGoal(Number(storedWaterGoal))
      }

      const storedMeals = localStorage.getItem('custom-meals')
      if (storedMeals) {
        setMeals(JSON.parse(storedMeals))
      }

      // Load today's daily data (this has the actual values)
      const stored = localStorage.getItem('nutrition-data')
      if (stored) {
        const data = JSON.parse(stored)
        if (data.date === today) {
          // Today's data - load with values
          if (data.checklistItems) setChecklistItems(data.checklistItems)
          if (data.nutritionMetrics) setNutritionMetrics(data.nutritionMetrics)
          setWater(data.water || 0)
          setWaterHistory(data.waterHistory || [])
          setNutritionHistory(data.nutritionHistory || [])
        } else {
          // Previous day - save to history and clear stale data
          saveToHistory(data)
          localStorage.removeItem('nutrition-data')
        }
      }

      setDataLoaded(true)
    }

    if (!authLoading) {
      loadData()
    }

    // Cleanup listeners on unmount or user change
    return () => {
      cancelled = true
      unsubscribeData()
      unsubscribeSettings()
    }
  }, [user, authLoading, isConfigured, reloadKey])

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

  // Save data whenever it changes
  useEffect(() => {
    if (!currentDate || !dataLoaded) return // Don't save until we've loaded

    // Skip syncing if this update came from a remote listener
    if (isRemoteUpdate.current) return

    const today = new Date().toDateString()

    // Day has changed since we loaded data - trigger a fresh reload
    // instead of saving stale data under the new day's date
    if (today !== currentDate) {
      setReloadKey(k => k + 1)
      return
    }

    const data = {
      date: today,
      checklistItems,
      nutritionMetrics,
      water,
      waterHistory,
      nutritionHistory
    }

    // Always save to localStorage as backup
    localStorage.setItem('nutrition-data', JSON.stringify(data))
    saveToHistory(data)

    // Sync to cloud if user is logged in and cloud load succeeded
    // This prevents saving zeros to cloud if the initial load failed
    if (user && cloudLoadSucceeded.current) {
      syncToCloud(data)
    }
  }, [checklistItems, nutritionMetrics, water, waterHistory, nutritionHistory, currentDate, dataLoaded, user, syncToCloud])

  // Toggle checklist item
  const toggleChecklistItem = (index) => {
    const updated = [...checklistItems]
    updated[index] = { ...updated[index], checked: !updated[index].checked }
    setChecklistItems(updated)
  }

  // Navigate checklist to a different day
  const navigateChecklistDay = async (direction) => {
    const today = toLocalDateStr()

    let targetDate
    if (checklistViewDate === null) {
      // Currently viewing today
      if (direction === 'back') {
        const d = new Date()
        d.setDate(d.getDate() - 1)
        targetDate = toLocalDateStr(d)
      } else {
        return // Already on today, can't go forward
      }
    } else {
      const parts = checklistViewDate.split('-')
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
      d.setDate(d.getDate() + (direction === 'back' ? -1 : 1))
      targetDate = toLocalDateStr(d)

      // Don't go forward past today
      if (targetDate >= today && direction === 'forward') {
        setChecklistViewDate(null)
        setPastDayChecklist(null)
        return
      }

      // Limit to 7 days back
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      if (d < sevenDaysAgo) return
    }

    setLoadingPastDay(true)
    try {
      let dayData = null

      // Try cloud first if logged in
      if (user && isConfigured) {
        dayData = await loadDayData(user.uid, targetDate)
      }

      // Fall back to localStorage history
      if (!dayData) {
        const historyStr = localStorage.getItem('nutrition-history')
        if (historyStr) {
          const history = JSON.parse(historyStr)
          // History uses toDateString format, need to match
          const parts = targetDate.split('-')
          const targetObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
          const entry = history.find(h => {
            if (h.date === targetDate) return true
            try { return new Date(h.date).toDateString() === targetObj.toDateString() } catch { return false }
          })
          if (entry) dayData = entry
        }
      }

      // Build checklist from saved data, falling back to current items structure
      const savedChecklist = dayData?.checklistItems || []
      const merged = checklistItems.map(item => {
        const saved = savedChecklist.find(s => s.name === item.name)
        return { ...item, checked: saved ? saved.checked : false }
      })

      setChecklistViewDate(targetDate)
      setPastDayChecklist(merged)
    } catch (error) {
      console.error('Error loading past day:', error)
    } finally {
      setLoadingPastDay(false)
    }
  }

  // Toggle a past day's checklist item and save
  const togglePastChecklistItem = async (index) => {
    if (!pastDayChecklist || !checklistViewDate) return

    const updated = [...pastDayChecklist]
    updated[index] = { ...updated[index], checked: !updated[index].checked }
    setPastDayChecklist(updated)

    // Save to cloud
    if (user && isConfigured) {
      const dayData = await loadDayData(user.uid, checklistViewDate)
      const saveData = {
        ...(dayData || {}),
        checklistItems: updated,
        date: checklistViewDate
      }
      await saveHistoryEntry(user.uid, checklistViewDate, saveData)
    }

    // Save to localStorage history
    const historyStr = localStorage.getItem('nutrition-history')
    if (historyStr) {
      const history = JSON.parse(historyStr)
      const parts = checklistViewDate.split('-')
      const targetObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
      const idx = history.findIndex(h => {
        if (h.date === checklistViewDate) return true
        try { return new Date(h.date).toDateString() === targetObj.toDateString() } catch { return false }
      })
      if (idx >= 0) {
        history[idx].checklistItems = updated
        localStorage.setItem('nutrition-history', JSON.stringify(history))
      } else {
        history.push({
          date: checklistViewDate,
          checklistItems: updated,
          nutritionMetrics: [],
          water: 0
        })
        localStorage.setItem('nutrition-history', JSON.stringify(history))
      }
    }
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

  // Undo last nutrition entry (supports both single and AI batch entries)
  const undoNutrition = () => {
    if (nutritionHistory.length === 0) return

    const lastEntry = nutritionHistory[nutritionHistory.length - 1]
    const updated = [...nutritionMetrics]

    if (lastEntry.estimates) {
      // Undo AI batch entry - reverse all metrics at once
      updated.forEach((metric, index) => {
        if (lastEntry.estimates[metric.key]) {
          updated[index] = {
            ...metric,
            value: Math.max(0, (metric.value || 0) - lastEntry.estimates[metric.key])
          }
        }
      })
    } else if (lastEntry.metricIndex !== undefined && updated[lastEntry.metricIndex]) {
      // Undo single metric entry
      updated[lastEntry.metricIndex] = {
        ...updated[lastEntry.metricIndex],
        value: Math.max(0, (updated[lastEntry.metricIndex].value || 0) - (lastEntry.value || 0))
      }
    } else if (lastEntry.metrics && Array.isArray(lastEntry.metrics)) {
      // Old-format AI entry - restore the pre-addition snapshot values
      lastEntry.metrics.forEach((oldMetric, i) => {
        if (updated[i] && oldMetric.key && updated[i].key === oldMetric.key) {
          updated[i] = { ...updated[i], value: oldMetric.value || 0 }
        }
      })
    }

    setNutritionMetrics(updated)
    setNutritionHistory(nutritionHistory.slice(0, -1))
  }

  // Remove a specific nutrition entry by index
  const removeNutritionEntry = (entryIndex) => {
    const entry = nutritionHistory[entryIndex]
    if (!entry) return

    const updated = [...nutritionMetrics]

    if (entry.estimates) {
      // Remove AI batch entry (new format)
      updated.forEach((metric, i) => {
        if (entry.estimates[metric.key]) {
          updated[i] = {
            ...metric,
            value: Math.max(0, (metric.value || 0) - entry.estimates[metric.key])
          }
        }
      })
    } else if (entry.metricIndex !== undefined && updated[entry.metricIndex]) {
      // Remove single metric entry
      updated[entry.metricIndex] = {
        ...updated[entry.metricIndex],
        value: Math.max(0, (updated[entry.metricIndex].value || 0) - (entry.value || 0))
      }
    } else if (entry.metrics && Array.isArray(entry.metrics)) {
      // Old-format AI entry - restore the pre-addition snapshot values
      entry.metrics.forEach((oldMetric, i) => {
        if (updated[i] && oldMetric.key && updated[i].key === oldMetric.key) {
          updated[i] = { ...updated[i], value: oldMetric.value || 0 }
        }
      })
    }

    setNutritionMetrics(updated)
    setNutritionHistory(nutritionHistory.filter((_, i) => i !== entryIndex))
  }

  // Save directly edited metric value
  const saveMetricEdit = (metricIndex) => {
    const newValue = parseInt(editMetricValue) || 0
    const updated = [...nutritionMetrics]
    updated[metricIndex] = { ...updated[metricIndex], value: Math.max(0, newValue) }
    setNutritionMetrics(updated)
    setEditingMetric(null)
    setEditMetricValue('')
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

  // Settings functions - save to localStorage and sync to cloud
  const saveChecklistItems = (items) => {
    localStorage.setItem('checklist-items', JSON.stringify(items))
    setChecklistItems(items)
    if (user) {
      saveUserSettings(user.uid, { checklistItems: items })
    }
  }

  const saveNutritionMetrics = (metrics) => {
    localStorage.setItem('nutrition-metrics', JSON.stringify(metrics))
    setNutritionMetrics(metrics)
    if (user) {
      saveUserSettings(user.uid, { nutritionMetrics: metrics })
    }
  }

  const saveWaterButtons = (buttons) => {
    localStorage.setItem('water-buttons', JSON.stringify(buttons))
    setWaterButtons(buttons)
    if (user) {
      saveUserSettings(user.uid, { waterButtons: buttons })
    }
  }

  const saveWaterGoal = (goal) => {
    localStorage.setItem('water-goal', String(goal))
    setWaterGoal(goal)
    if (user) {
      saveUserSettings(user.uid, { waterGoal: goal })
    }
  }

  const saveMeals = (mealsData) => {
    localStorage.setItem('custom-meals', JSON.stringify(mealsData))
    setMeals(mealsData)
    if (user) {
      saveUserSettings(user.uid, { meals: mealsData })
    }
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
2. Your estimates for the EXACT amount they described

CRITICAL: Calculate nutrition for the EXACT quantity the user specifies, NOT the standard serving size. If they say "4 skittles", calculate for exactly 4 individual skittles, not a full bag or standard serving. If they say "half a sandwich", calculate for half. Always match the user's described portion precisely.

Always end your response with nutrition data in this exact JSON format on its own line:
NUTRITION_DATA: ${JSON.stringify(metricsKeys)}

Replace the 0s with your numerical estimates for the EXACT amount described.`

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

    // Store as batch entry so undo can reverse all metrics at once
    setNutritionHistory([...nutritionHistory, { estimates, timestamp: Date.now() }])
    setNutritionMetrics(updated)
  }

  // Show loading state (with minimum 1s splash)
  if (authLoading || migrating || splashMinTime) {
    return (
      <div style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: '#fefefe',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <img src="/logo.png" alt="Lytz" style={{ width: 'min(380px, 92vw)', height: 'auto', display: 'block' }} />
      </div>
    )
  }

  // Show login prompt for anonymous users (and null user if anonymous sign-in failed)
  const skipAuth = typeof window !== 'undefined' && localStorage.getItem('skip-auth') === 'true'
  if ((!user || user.isAnonymous) && isConfigured && !skipAuth) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#fefefe',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px 0'
      }}>
        <div style={{
          maxWidth: '420px',
          width: '100%',
          textAlign: 'center'
        }}>
          <img src="/logo.png" alt="Lytz" style={{ width: '100%', maxWidth: '420px', height: 'auto', display: 'block', marginBottom: '8px' }} />
          <div style={{ padding: '0 24px 32px' }}>
          <p style={{
            margin: '0 0 24px 0',
            fontSize: '14px',
            color: '#666',
            lineHeight: '1.5'
          }}>
            Track your daily nutrition, water intake, and healthy habits with cloud sync across all your devices.
          </p>
          <button
            onClick={() => router.push('/login')}
            style={{
              width: '100%',
              padding: '14px',
              backgroundColor: '#5f8a8f',
              border: 'none',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              marginBottom: '12px'
            }}
          >
            Sign In / Create Account
          </button>
          <button
            onClick={() => {
              // Allow using without account by setting a flag
              localStorage.setItem('skip-auth', 'true')
              window.location.reload()
            }}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: 'transparent',
              border: '1px solid #e0e0e0',
              borderRadius: '8px',
              color: '#666',
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            Continue without account
          </button>
          <p style={{
            margin: '16px 0 0 0',
            fontSize: '12px',
            color: '#999'
          }}>
            Your data may be lost if the app is removed. Create an account to keep it safe.
          </p>
          </div>{/* end padding wrapper */}
        </div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#fafafa',
      padding: '16px 12px',
      paddingBottom: '32px'
    }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{
          marginBottom: '24px',
          paddingBottom: '16px',
          borderBottom: '1px solid #e0e0e0'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '12px'
          }}>
            <div>
              <h1 style={{
                margin: '0 0 4px 0',
                fontSize: '22px',
                fontWeight: '600',
                color: '#1a1a1a',
                letterSpacing: '-0.5px'
              }}>
                Daily Tracker
              </h1>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span style={{
                  color: '#666',
                  fontSize: '13px',
                  fontWeight: '400',
                  letterSpacing: '0'
                }}>
                  {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </span>
                {syncStatus && (
                  <span style={{
                    fontSize: '11px',
                    color: syncStatus === 'synced' ? '#10b981' : syncStatus === 'error' ? '#ef4444' : '#666',
                    fontWeight: '500'
                  }}>
                    {syncStatus === 'syncing' ? 'Syncing...' : syncStatus === 'synced' ? 'Synced' : 'Sync error'}
                  </span>
                )}
              </div>
            </div>

            {/* User Account Button */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => user ? setShowUserMenu(!showUserMenu) : router.push('/login')}
                style={{
                  padding: '8px 12px',
                  backgroundColor: user ? '#f0fdf4' : '#fff',
                  border: '1px solid',
                  borderColor: user ? '#86efac' : '#e0e0e0',
                  borderRadius: '8px',
                  color: user ? '#166534' : '#666',
                  fontSize: '12px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {user ? (
                  <>
                    <span style={{ fontSize: '14px' }}>{'☁️'}</span>
                    <span>Synced</span>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: '14px' }}>{'👤'}</span>
                    <span>Sign In</span>
                  </>
                )}
              </button>

              {/* User Menu Dropdown */}
              {showUserMenu && user && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '4px',
                  backgroundColor: '#fff',
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  minWidth: '180px',
                  zIndex: 100,
                  overflow: 'hidden'
                }}>
                  <div style={{
                    padding: '12px 14px',
                    borderBottom: '1px solid #e0e0e0',
                    backgroundColor: '#fafafa'
                  }}>
                    <div style={{ fontSize: '11px', color: '#999', marginBottom: '2px' }}>
                      Signed in as
                    </div>
                    <div style={{
                      fontSize: '13px',
                      color: '#1a1a1a',
                      fontWeight: '500',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {user.email}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setShowUserMenu(false)
                      setSettingsTab('feedback')
                      setShowSettings(true)
                    }}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      backgroundColor: 'transparent',
                      border: 'none',
                      borderBottom: '1px solid #e0e0e0',
                      color: '#5f8a8f',
                      fontSize: '13px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    Send Feedback
                  </button>
                  <button
                    onClick={async () => {
                      setSigningOut(true)
                      // Save current data before signing out
                      const today = new Date().toDateString()
                      const data = {
                        date: today,
                        checklistItems,
                        nutritionMetrics,
                        water,
                        waterHistory,
                        nutritionHistory
                      }
                      try {
                        await saveTodayData(user.uid, data)
                        await saveHistoryEntry(user.uid, data.date, data)
                        // Save settings with definitions only (no daily values)
                        await saveUserSettings(user.uid, {
                          checklistItems: checklistItems.map(item => ({ ...item, checked: false })),
                          nutritionMetrics: nutritionMetrics.map(m => {
                            const { value, ...rest } = m
                            return rest
                          }),
                          waterButtons,
                          waterGoal,
                          meals
                        })
                      } catch (e) {
                        console.error('Error saving before logout:', e)
                      }
                      // Clear localStorage to prevent data bleed to next user
                      localStorage.removeItem('nutrition-data')
                      localStorage.removeItem('nutrition-history')
                      localStorage.removeItem('firebase-migrated')
                      await signOut()
                      setSigningOut(false)
                      setShowUserMenu(false)
                    }}
                    disabled={signingOut}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      backgroundColor: 'transparent',
                      border: 'none',
                      color: signingOut ? '#999' : '#ef4444',
                      fontSize: '13px',
                      fontWeight: '500',
                      cursor: signingOut ? 'not-allowed' : 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    {signingOut ? 'Saving & signing out...' : 'Sign Out'}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '8px'
          }}>
            <button
              onClick={() => setShowChat(true)}
              style={{
                padding: '10px 8px',
                backgroundColor: '#5f8a8f',
                border: 'none',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '12px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.15s',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                whiteSpace: 'nowrap'
              }}
            >
              🤖 AI
            </button>
            <Link
              href="/reports"
              style={{
                padding: '10px 8px',
                backgroundColor: '#fff',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                color: '#1a1a1a',
                fontSize: '12px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.15s',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              Reports
            </Link>
            <button
              onClick={() => setShowSettings(true)}
              style={{
                padding: '10px 8px',
                backgroundColor: '#fff',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                color: '#1a1a1a',
                fontSize: '12px',
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
          <div style={{ marginBottom: '24px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '12px'
            }}>
              <h2 style={{
                margin: 0,
                fontSize: '12px',
                fontWeight: '600',
                color: '#999',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                Daily Habits
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={() => navigateChecklistDay('back')}
                  disabled={loadingPastDay}
                  style={{
                    background: 'none',
                    border: '1px solid #e0e0e0',
                    borderRadius: '6px',
                    padding: '2px 8px',
                    fontSize: '14px',
                    color: '#999',
                    cursor: 'pointer',
                    lineHeight: 1
                  }}
                >
                  ‹
                </button>
                {checklistViewDate !== null && (() => {
                  const parts = checklistViewDate.split('-')
                  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
                  const today = new Date()
                  today.setHours(0,0,0,0)
                  const yesterday = new Date(today)
                  yesterday.setDate(yesterday.getDate() - 1)
                  const label = d.toDateString() === yesterday.toDateString()
                    ? 'Yesterday'
                    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                  return (
                    <span style={{ fontSize: '11px', color: '#5f8a8f', fontWeight: '600' }}>
                      {label}
                    </span>
                  )
                })()}
                {checklistViewDate === null && (
                  <span style={{ fontSize: '11px', color: '#999', fontWeight: '500' }}>
                    Today
                  </span>
                )}
                <button
                  onClick={() => {
                    if (checklistViewDate !== null) {
                      navigateChecklistDay('forward')
                    }
                  }}
                  disabled={checklistViewDate === null || loadingPastDay}
                  style={{
                    background: 'none',
                    border: '1px solid #e0e0e0',
                    borderRadius: '6px',
                    padding: '2px 8px',
                    fontSize: '14px',
                    color: checklistViewDate === null ? '#ddd' : '#999',
                    cursor: checklistViewDate === null ? 'default' : 'pointer',
                    lineHeight: 1
                  }}
                >
                  ›
                </button>
              </div>
            </div>
            {checklistViewDate !== null && (
              <div style={{
                padding: '6px 12px',
                marginBottom: '8px',
                backgroundColor: '#f0f7f8',
                borderRadius: '8px',
                fontSize: '11px',
                color: '#5f8a8f',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <span>Viewing past day — changes will be saved</span>
                <button
                  onClick={() => { setChecklistViewDate(null); setPastDayChecklist(null) }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#5f8a8f',
                    fontWeight: '600',
                    fontSize: '11px',
                    cursor: 'pointer',
                    padding: '0 0 0 8px'
                  }}
                >
                  Back to Today
                </button>
              </div>
            )}
            {loadingPastDay ? (
              <div style={{ textAlign: 'center', padding: '20px', color: '#999', fontSize: '13px' }}>
                Loading...
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: checklistItems.length === 1 ? '1fr' : 'repeat(2, 1fr)',
                gap: '8px'
              }}>
                {(checklistViewDate !== null && pastDayChecklist ? pastDayChecklist : checklistItems).map((item, i) => (
                  <button
                    key={i}
                    onClick={() => checklistViewDate !== null ? togglePastChecklistItem(i) : toggleChecklistItem(i)}
                    style={{
                      padding: '12px 14px',
                      backgroundColor: '#fff',
                      border: '1px solid',
                      borderColor: item.checked ? '#5f8a8f' : '#e0e0e0',
                      borderRadius: '10px',
                      color: item.checked ? '#5f8a8f' : '#666',
                      fontSize: '13px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: item.checked ? '0 2px 8px rgba(0,0,0,0.08)' : '0 1px 2px rgba(0,0,0,0.04)'
                    }}
                  >
                    <div style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      border: item.checked ? 'none' : '2px solid #d0d0d0',
                      backgroundColor: item.checked ? '#5f8a8f' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontSize: '10px',
                      flexShrink: 0
                    }}>
                      {item.checked && '✓'}
                    </div>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.name}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Water Tracker */}
        {waterButtons.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <h2 style={{
              margin: '0 0 12px 0',
              fontSize: '12px',
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
              padding: '20px 16px',
              border: '1px solid #e0e0e0',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
            }}>
              <div style={{
                display: 'flex',
                gap: '24px',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '20px'
              }}>
                {/* Water Bottle Visualization */}
                {waterGoal > 0 && (() => {
                  const fillPercent = Math.min(water / waterGoal, 1)
                  // Bottle body goes from y=30 (top) to y=190 (bottom) = 160 units
                  const bottleBottom = 190
                  const fillableHeight = 160
                  const waterHeight = fillPercent * fillableHeight
                  const waterTop = bottleBottom - waterHeight
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
                    fontSize: '48px',
                    fontWeight: '600',
                    color: '#1a1a1a',
                    marginBottom: '2px',
                    letterSpacing: '-2px'
                  }}>
                    {water}
                  </div>
                  <div style={{
                    fontSize: '12px',
                    color: '#999',
                    fontWeight: '500',
                    letterSpacing: '0.5px',
                    marginBottom: waterGoal > 0 ? '4px' : '0'
                  }}>
                    oz consumed
                  </div>
                  {waterGoal > 0 && (
                    <div style={{
                      fontSize: '12px',
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
                gap: '6px',
                justifyContent: 'center',
                flexWrap: 'wrap',
                marginBottom: '12px'
              }}>
                {waterButtons.map((amount, i) => (
                  <button
                    key={i}
                    onClick={() => addWater(amount)}
                    style={{
                      padding: '10px 16px',
                      backgroundColor: '#f5f5f5',
                      border: '1px solid #e0e0e0',
                      borderRadius: '8px',
                      color: '#1a1a1a',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      minWidth: '60px'
                    }}
                  >
                    +{amount}
                  </button>
                ))}
              </div>
              {waterHistory.length > 0 && (
                <div style={{ textAlign: 'center' }}>
                  <button onClick={undoWater} style={{
                    padding: '6px 12px',
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: '#999',
                    fontSize: '12px',
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
          <div style={{ marginBottom: '24px' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '12px'
            }}>
              <h2 style={{
                margin: '0',
                fontSize: '12px',
                fontWeight: '600',
                color: '#999',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                Nutrition
              </h2>
              {nutritionHistory.length > 0 && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={undoNutrition} style={{
                    padding: '4px 10px',
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: '#999',
                    fontSize: '12px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    textDecoration: 'underline'
                  }}>
                    Undo
                  </button>
                  <button onClick={() => setShowNutritionLog(!showNutritionLog)} style={{
                    padding: '4px 10px',
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: showNutritionLog ? '#1a1a1a' : '#999',
                    fontSize: '12px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    textDecoration: 'underline'
                  }}>
                    {showNutritionLog ? 'Hide Log' : 'Log'}
                  </button>
                </div>
              )}
            </div>

            {/* Nutrition Entry Log */}
            {showNutritionLog && nutritionHistory.length > 0 && (
              <div style={{
                marginBottom: '12px',
                backgroundColor: '#fff',
                border: '1px solid #e0e0e0',
                borderRadius: '10px',
                overflow: 'hidden'
              }}>
                <div style={{
                  padding: '10px 14px',
                  backgroundColor: '#fafafa',
                  borderBottom: '1px solid #e0e0e0',
                  fontSize: '11px',
                  fontWeight: '600',
                  color: '#666',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Today&apos;s Entries ({nutritionHistory.length})
                </div>
                {[...nutritionHistory].reverse().map((entry, reverseIdx) => {
                  const entryIndex = nutritionHistory.length - 1 - reverseIdx
                  const time = new Date(entry.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

                  let description = ''
                  let entryType = 'Manual'
                  if (entry.estimates) {
                    // AI batch entry (new format)
                    entryType = 'AI Estimate'
                    const parts = nutritionMetrics
                      .filter(m => entry.estimates[m.key])
                      .map(m => `${m.name}: ${entry.estimates[m.key]}${m.unit ? ` ${m.unit}` : ''}`)
                    description = parts.join(', ')
                  } else if (entry.metricIndex !== undefined) {
                    // Single metric entry
                    const metric = nutritionMetrics[entry.metricIndex]
                    if (metric) {
                      description = `${metric.name}: +${entry.value}${metric.unit ? ` ${metric.unit}` : ''}`
                    }
                  } else {
                    // Old-format AI entry
                    entryType = 'AI Estimate'
                    description = 'Added via AI (legacy entry)'
                  }

                  return (
                    <div key={entryIndex} style={{
                      padding: '10px 14px',
                      borderBottom: reverseIdx < nutritionHistory.length - 1 ? '1px solid #f0f0f0' : 'none',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: '13px',
                          color: '#1a1a1a',
                          fontWeight: '500',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {entryType}
                          <span style={{ color: '#999', fontWeight: '400', marginLeft: '6px', fontSize: '11px' }}>{time}</span>
                        </div>
                        <div style={{
                          fontSize: '12px',
                          color: '#666',
                          marginTop: '2px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {description}
                        </div>
                      </div>
                      <button
                        onClick={() => removeNutritionEntry(entryIndex)}
                        style={{
                          padding: '4px 10px',
                          backgroundColor: '#fef2f2',
                          border: '1px solid #fecaca',
                          borderRadius: '6px',
                          color: '#ef4444',
                          fontSize: '11px',
                          fontWeight: '500',
                          cursor: 'pointer',
                          flexShrink: 0
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            <div style={{
              display: 'grid',
              gridTemplateColumns: nutritionMetrics.length === 1 ? '1fr' : 'repeat(2, 1fr)',
              gap: '8px'
            }}>
              {nutritionMetrics.map((metric, i) => {
                const goalType = metric.goalType || 'min'
                const value = metric.value || 0
                const goal = metric.goal || 0
                const goalMax = metric.goalMax || 0
                const isEditing = editingMetric === i

                // Calculate progress and colors based on goal type
                let progress = 0
                let fillColor = '#f0f9ff'
                let statusColor = '#999'
                let goalLabel = ''

                if (goal > 0) {
                  if (goalType === 'min') {
                    progress = Math.min(value / goal * 100, 100)
                    fillColor = progress >= 100 ? '#dcfce7' : '#f0f9ff'
                    statusColor = progress >= 100 ? '#10b981' : '#999'
                    goalLabel = `Goal: ${goal}+`
                  } else if (goalType === 'max') {
                    progress = Math.min(value / goal * 100, 100)
                    const ratio = value / goal
                    if (ratio > 1) {
                      fillColor = '#fee2e2'
                      statusColor = '#ef4444'
                    } else if (ratio > 0.8) {
                      fillColor = '#fef9c3'
                      statusColor = '#f59e0b'
                    } else {
                      fillColor = '#dcfce7'
                      statusColor = '#10b981'
                    }
                    goalLabel = `Limit: ${goal}`
                  } else if (goalType === 'range' && goalMax > 0) {
                    progress = Math.min(value / goalMax * 100, 100)
                    if (value >= goal && value <= goalMax) {
                      fillColor = '#dcfce7'
                      statusColor = '#10b981'
                    } else if (value < goal) {
                      fillColor = '#f0f9ff'
                      statusColor = '#999'
                    } else {
                      fillColor = '#fee2e2'
                      statusColor = '#ef4444'
                    }
                    goalLabel = `Range: ${goal}–${goalMax}`
                  }
                }

                return (
                  <div key={i} onClick={() => {
                    if (!isEditing) {
                      setEditingMetric(i)
                      setEditMetricValue(String(value))
                    }
                  }} style={{
                    padding: '16px',
                    backgroundColor: '#fff',
                    border: isEditing ? '1px solid #3b82f6' : '1px solid #e0e0e0',
                    borderRadius: '10px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                    position: 'relative',
                    overflow: 'hidden',
                    cursor: isEditing ? 'default' : 'pointer'
                  }}>
                    {/* Progress background */}
                    {goal > 0 && (
                      <div style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: `${progress}%`,
                        backgroundColor: fillColor,
                        transition: 'height 0.3s ease, background-color 0.3s ease',
                        zIndex: 0
                      }} />
                    )}

                    <div style={{ position: 'relative', zIndex: 1 }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        marginBottom: '8px'
                      }}>
                        {metric.icon && (
                          <span style={{ fontSize: '14px' }}>{metric.icon}</span>
                        )}
                        <div style={{
                          fontSize: '11px',
                          color: '#999',
                          fontWeight: '500',
                          letterSpacing: '0.5px'
                        }}>
                          {metric.name}
                        </div>
                      </div>
                      {isEditing ? (
                        <div onClick={(e) => e.stopPropagation()}>
                          <input
                            type="number"
                            value={editMetricValue}
                            onChange={(e) => setEditMetricValue(e.target.value)}
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveMetricEdit(i)
                              if (e.key === 'Escape') { setEditingMetric(null); setEditMetricValue('') }
                            }}
                            style={{
                              width: '100%',
                              fontSize: '24px',
                              fontWeight: '600',
                              color: '#1a1a1a',
                              border: 'none',
                              borderBottom: '2px solid #3b82f6',
                              outline: 'none',
                              padding: '2px 0',
                              backgroundColor: 'transparent',
                              boxSizing: 'border-box',
                              minWidth: 0
                            }}
                          />
                          <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                            <button onClick={() => saveMetricEdit(i)} style={{
                              flex: 1, padding: '6px', backgroundColor: '#10b981', border: 'none',
                              borderRadius: '4px', color: '#fff', fontSize: '11px', fontWeight: '600', cursor: 'pointer'
                            }}>Save</button>
                            <button onClick={() => { setEditingMetric(null); setEditMetricValue('') }} style={{
                              flex: 1, padding: '6px', backgroundColor: '#f5f5f5', border: '1px solid #e0e0e0',
                              borderRadius: '4px', color: '#666', fontSize: '11px', fontWeight: '500', cursor: 'pointer'
                            }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div style={{
                            fontSize: '28px',
                            fontWeight: '600',
                            color: '#1a1a1a',
                            letterSpacing: '-1px'
                          }}>
                            {value}
                            {metric.unit && <span style={{ fontSize: '14px', color: '#999', fontWeight: '500' }}> {metric.unit}</span>}
                          </div>
                          {goal > 0 && (
                            <div style={{
                              marginTop: '4px',
                              fontSize: '11px',
                              color: '#666',
                              fontWeight: '500'
                            }}>
                              {goalLabel}
                              <span style={{
                                marginLeft: '6px',
                                color: statusColor,
                                fontWeight: '600'
                              }}>
                                {goalType === 'max' ? (
                                  value > goal ? `Over by ${value - goal}` : `${goal - value} left`
                                ) : goalType === 'range' && goalMax > 0 ? (
                                  value < goal ? `${goal - value} to go` : value > goalMax ? `Over by ${value - goalMax}` : 'In range'
                                ) : (
                                  `${Math.round(progress)}%`
                                )}
                              </span>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Quick Add Meals — only shown when at least one meal is configured */}
        {meals.some(m => m) && <div style={{ marginBottom: '24px' }}>
          <h2 style={{
            margin: '0 0 12px 0',
            fontSize: '12px',
            fontWeight: '600',
            color: '#999',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            Quick Add
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '8px',
            marginBottom: '12px'
          }}>
            {meals.map((meal, i) => (
              meal ? (
                <button
                  key={i}
                  onClick={() => addMeal(meal)}
                  style={{
                    padding: '14px 12px',
                    backgroundColor: '#fff',
                    border: '1px solid #e0e0e0',
                    borderRadius: '10px',
                    color: '#1a1a1a',
                    fontSize: '13px',
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
                    gap: '6px',
                    marginBottom: '4px'
                  }}>
                    {meal.icon && (
                      <span style={{ fontSize: '16px' }}>{meal.icon}</span>
                    )}
                    <div style={{
                      fontSize: '13px',
                      fontWeight: '500',
                      color: '#1a1a1a',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {meal.name}
                    </div>
                  </div>
                  <div style={{
                    fontSize: '11px',
                    color: '#999',
                    lineHeight: '1.4',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {nutritionMetrics.map((metric) =>
                      meal[metric.key] ? `${meal[metric.key]}${metric.unit || ''}` : ''
                    ).filter(Boolean).join(' • ')}
                  </div>
                </button>
              ) : null
            ))}
          </div>

          {/* Custom Entry */}
          {nutritionMetrics.length > 0 && (
            <div style={{
              padding: '16px',
              backgroundColor: '#fff',
              border: '1px solid #e0e0e0',
              borderRadius: '10px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
            }}>
              <div style={{
                fontSize: '12px',
                color: '#999',
                marginBottom: '12px',
                fontWeight: '500',
                letterSpacing: '0.5px'
              }}>
                Custom Entry
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '8px',
                marginBottom: '12px'
              }}>
                {nutritionMetrics.map((metric, i) => (
                  <input
                    key={i}
                    type="number"
                    placeholder={metric.name}
                    value={customValues[metric.key] || ''}
                    onChange={(e) => setCustomValues({ ...customValues, [metric.key]: e.target.value })}
                    style={{
                      padding: '10px 12px',
                      backgroundColor: '#fafafa',
                      border: '1px solid #e0e0e0',
                      borderRadius: '8px',
                      color: '#1a1a1a',
                      fontSize: '16px',
                      fontWeight: '500',
                      width: '100%',
                      boxSizing: 'border-box'
                    }}
                  />
                ))}
              </div>
              <button onClick={addCustomEntry} style={{
                width: '100%',
                padding: '10px',
                backgroundColor: '#5f8a8f',
                border: 'none',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}>
                Add Entry
              </button>
            </div>
          )}
        </div>}

        {/* Empty State Message */}
        {checklistItems.length === 0 && nutritionMetrics.length === 0 && waterButtons.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: '60px 24px',
            backgroundColor: '#fff',
            borderRadius: '12px',
            border: '1px solid #e0e0e0'
          }}>
            <div style={{
              fontSize: '48px',
              marginBottom: '20px',
              opacity: 0.2
            }}>
              📊
            </div>
            <div style={{
              fontSize: '18px',
              fontWeight: '600',
              color: '#1a1a1a',
              marginBottom: '6px'
            }}>
              Ready to Track
            </div>
            <div style={{
              fontSize: '14px',
              color: '#999',
              marginBottom: '20px'
            }}>
              Configure your tracker to get started
            </div>
            <button
              onClick={() => setShowSettings(true)}
              style={{
                padding: '10px 20px',
                backgroundColor: '#5f8a8f',
                border: 'none',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '14px',
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
          user={user}
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
          metrics={nutritionMetrics}
          onInputChange={setChatInput}
          onSend={sendChatMessage}
          onAddEstimates={addEstimatedNutrition}
          onClose={() => setShowChat(false)}
        />
      )}
    </div>
  )
}

// Water Bottle Component with delayed wave animation (smaller for mobile)
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
        width="80"
        height="150"
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
              height={200 - waterTop}
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
        marginTop: '8px',
        fontSize: '11px',
        color: isFull ? '#10b981' : '#666',
        fontWeight: '500'
      }}>
        {Math.round(fillPercent * 100)}% {isFull && '🎉'}
      </div>
    </div>
  )
}

// Settings Modal Component (mobile optimized)
function SettingsModal({
  user,
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
    setTempMetrics([...tempMetrics, { name: '', key: '', unit: '', value: 0, goal: 0, goalType: 'min', goalMax: 0, icon: '📊' }])
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
    setTempWater([...tempWater, ''])
  }

  const updateWaterButton = (index, value) => {
    const updated = [...tempWater]
    updated[index] = value === '' ? '' : (parseInt(value) || 0)
    setTempWater(updated)
  }

  const removeWaterButton = (index) => {
    setTempWater(tempWater.filter((_, i) => i !== index))
  }

  const moveWaterButton = (index, direction) => {
    const newIndex = index + direction
    if (newIndex < 0 || newIndex >= tempWater.length) return
    const updated = [...tempWater]
    const temp = updated[index]
    updated[index] = updated[newIndex]
    updated[newIndex] = temp
    setTempWater(updated)
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
      alignItems: 'flex-end',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: '#fff',
        borderRadius: '16px 16px 0 0',
        width: '100%',
        maxWidth: '700px',
        maxHeight: '90vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 -4px 30px rgba(0,0,0,0.2)'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #e0e0e0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h2 style={{
            margin: 0,
            fontSize: '18px',
            fontWeight: '600',
            color: '#1a1a1a',
            letterSpacing: '-0.3px'
          }}>
            Settings
          </h2>
          <button
            onClick={onClose}
            style={{
              padding: '6px 14px',
              backgroundColor: '#f5f5f5',
              border: 'none',
              borderRadius: '6px',
              color: '#666',
              fontSize: '13px',
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
          gap: '2px',
          padding: '12px 16px 0 16px',
          borderBottom: '1px solid #e0e0e0',
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch'
        }}>
          {[
            { id: 'checklist', label: 'Habits' },
            { id: 'nutrition', label: 'Nutrition' },
            { id: 'water', label: 'Water' },
            { id: 'meals', label: 'Meals' },
            { id: 'feedback', label: 'Feedback' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setSettingsTab(tab.id)}
              style={{
                padding: '8px 14px',
                backgroundColor: 'transparent',
                border: 'none',
                borderBottom: settingsTab === tab.id ? '2px solid #5f8a8f' : '2px solid transparent',
                color: settingsTab === tab.id ? '#5f8a8f' : '#999',
                fontSize: '13px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.15s',
                marginBottom: '-1px',
                whiteSpace: 'nowrap',
                flexShrink: 0
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
          padding: '20px 16px',
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
              onMove={moveWaterButton}
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

          {settingsTab === 'feedback' && (
            <FeedbackForm user={user} />
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 20px',
          borderTop: '1px solid #e0e0e0',
          backgroundColor: '#fff',
          display: 'flex',
          gap: '8px',
          paddingBottom: '24px'
        }}>
          <button
            onClick={() => {
              onResetDay()
              onClose()
            }}
            style={{
              padding: '10px 14px',
              backgroundColor: 'transparent',
              border: '1px solid #ef4444',
              borderRadius: '8px',
              color: '#ef4444',
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            Reset
          </button>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: '10px 14px',
              backgroundColor: '#f5f5f5',
              border: 'none',
              borderRadius: '8px',
              color: '#666',
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            style={{
              flex: 1,
              padding: '10px 14px',
              backgroundColor: '#5f8a8f',
              border: 'none',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

// Feedback Form Component
function FeedbackForm({ user }) {
  const [type, setType] = useState('bug')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async () => {
    if (!message.trim() || !user) return
    setSending(true)
    try {
      await saveFeedback(user.uid, user.email, { type, message: message.trim() })
      setSent(true)
      setMessage('')
      setTimeout(() => setSent(false), 3000)
    } catch (e) {
      console.error('Feedback error:', e)
    } finally {
      setSending(false)
    }
  }

  if (!user) {
    return (
      <div style={{ textAlign: 'center', padding: '32px 16px', color: '#999' }}>
        <div style={{ fontSize: '32px', marginBottom: '12px' }}>💬</div>
        <div style={{ fontSize: '14px', fontWeight: '500', color: '#666' }}>Sign in to send feedback</div>
        <div style={{ fontSize: '12px', marginTop: '4px' }}>
          Create an account to report bugs or request features.
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#666', marginBottom: '8px' }}>
          Type
        </label>
        <div style={{ display: 'flex', gap: '8px' }}>
          {[
            { id: 'bug', label: 'Bug Report' },
            { id: 'feature', label: 'Feature Request' },
            { id: 'other', label: 'Other' }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setType(t.id)}
              style={{
                flex: 1,
                padding: '10px 12px',
                backgroundColor: type === t.id ? '#5f8a8f' : '#fff',
                border: '1px solid',
                borderColor: type === t.id ? '#5f8a8f' : '#e0e0e0',
                borderRadius: '8px',
                color: type === t.id ? '#fff' : '#666',
                fontSize: '12px',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#666', marginBottom: '6px' }}>
          Message
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={type === 'bug' ? 'Describe the bug and steps to reproduce it...' : type === 'feature' ? 'Describe the feature you\'d like to see...' : 'Tell us what\'s on your mind...'}
          style={{
            width: '100%',
            minHeight: '120px',
            padding: '12px 14px',
            backgroundColor: '#fff',
            border: '1px solid #e0e0e0',
            borderRadius: '8px',
            color: '#1a1a1a',
            fontSize: '14px',
            fontFamily: 'inherit',
            resize: 'vertical',
            boxSizing: 'border-box',
            outline: 'none'
          }}
        />
      </div>

      {sent && (
        <div style={{
          backgroundColor: '#f0fdf4',
          border: '1px solid #bbf7d0',
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '16px',
          color: '#166534',
          fontSize: '13px',
          fontWeight: '500'
        }}>
          Thanks for your feedback! We'll review it soon.
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={!message.trim() || sending}
        style={{
          width: '100%',
          padding: '14px',
          backgroundColor: message.trim() && !sending ? '#5f8a8f' : '#e0e0e0',
          border: 'none',
          borderRadius: '8px',
          color: message.trim() && !sending ? '#fff' : '#999',
          fontSize: '14px',
          fontWeight: '600',
          cursor: message.trim() && !sending ? 'pointer' : 'not-allowed'
        }}
      >
        {sending ? 'Sending...' : 'Submit Feedback'}
      </button>
    </div>
  )
}

// Checklist Settings Component
function ChecklistSettings({ items, onAdd, onUpdate, onRemove }) {
  return (
    <div>
      <div style={{ fontSize: '13px', color: '#666', marginBottom: '16px' }}>
        Add daily habits to track
      </div>

      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
          <input
            type="text"
            value={item.name}
            onChange={(e) => onUpdate(i, e.target.value)}
            placeholder="Habit name"
            style={{
              flex: 1,
              minWidth: 0,
              padding: '10px 12px',
              backgroundColor: '#fff',
              border: '1px solid #e0e0e0',
              borderRadius: '8px',
              color: '#1a1a1a',
              fontSize: '16px',
              fontWeight: '500',
              boxSizing: 'border-box'
            }}
          />
          <button
            onClick={() => onRemove(i)}
            style={{
              padding: '10px 12px',
              backgroundColor: '#f5f5f5',
              border: 'none',
              borderRadius: '8px',
              color: '#999',
              fontSize: '13px',
              cursor: 'pointer',
              fontWeight: '500'
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
          padding: '10px',
          marginTop: '8px',
          backgroundColor: '#fff',
          border: '1px dashed #d0d0d0',
          borderRadius: '8px',
          color: '#666',
          fontSize: '13px',
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
      <div style={{ fontSize: '13px', color: '#666', marginBottom: '16px' }}>
        Add nutrition metrics with optional goals
      </div>

      {metrics.map((metric, i) => (
        <div key={i} style={{
          padding: '14px',
          backgroundColor: '#fff',
          border: '1px solid #e0e0e0',
          borderRadius: '10px',
          marginBottom: '10px'
        }}>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
            <select
              value={metric.icon || '📊'}
              onChange={(e) => onUpdate(i, 'icon', e.target.value)}
              style={{
                padding: '8px',
                backgroundColor: '#fafafa',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                fontSize: '16px',
                cursor: 'pointer',
                width: '50px'
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
              placeholder="Name (e.g., Calories)"
              style={{
                flex: 1,
                minWidth: 0,
                padding: '10px 12px',
                backgroundColor: '#fafafa',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                color: '#1a1a1a',
                fontSize: '16px',
                fontWeight: '500',
                boxSizing: 'border-box'
              }}
            />
            <button
              onClick={() => onRemove(i)}
              style={{
                padding: '10px 12px',
                backgroundColor: '#f5f5f5',
                border: 'none',
                borderRadius: '8px',
                color: '#999',
                fontSize: '13px',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              ✕
            </button>
          </div>
          <div style={{ marginBottom: '8px' }}>
            <label style={{ fontSize: '10px', color: '#999', marginBottom: '4px', display: 'block' }}>
              Unit
            </label>
            <input
              type="text"
              value={metric.unit}
              onChange={(e) => onUpdate(i, 'unit', e.target.value)}
              placeholder="g, cal, etc"
              style={{
                width: '100%',
                padding: '8px 10px',
                backgroundColor: '#fafafa',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                color: '#1a1a1a',
                fontSize: '16px',
                boxSizing: 'border-box'
              }}
            />
          </div>
          <div style={{ marginBottom: '8px' }}>
            <label style={{ fontSize: '10px', color: '#999', marginBottom: '4px', display: 'block' }}>
              Goal Type
            </label>
            <div style={{ display: 'flex', gap: '4px' }}>
              {[
                { id: 'min', label: 'At Least' },
                { id: 'max', label: 'Under' },
                { id: 'range', label: 'Range' }
              ].map(gt => (
                <button
                  key={gt.id}
                  type="button"
                  onClick={() => onUpdate(i, 'goalType', gt.id)}
                  style={{
                    flex: 1,
                    padding: '8px 6px',
                    backgroundColor: (metric.goalType || 'min') === gt.id ? '#5f8a8f' : '#fafafa',
                    border: '1px solid',
                    borderColor: (metric.goalType || 'min') === gt.id ? '#5f8a8f' : '#e0e0e0',
                    borderRadius: '6px',
                    color: (metric.goalType || 'min') === gt.id ? '#fff' : '#666',
                    fontSize: '12px',
                    fontWeight: '500',
                    cursor: 'pointer'
                  }}
                >
                  {gt.label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: (metric.goalType || 'min') === 'range' ? '1fr 1fr' : '1fr', gap: '6px' }}>
            <div>
              <label style={{ fontSize: '10px', color: '#999', marginBottom: '2px', display: 'block' }}>
                {(metric.goalType || 'min') === 'range' ? 'Min Goal' : (metric.goalType || 'min') === 'max' ? 'Max Limit' : 'Daily Goal'}
              </label>
              <input
                type="number"
                value={metric.goal || ''}
                onChange={(e) => onUpdate(i, 'goal', parseInt(e.target.value) || 0)}
                placeholder="Optional"
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  backgroundColor: '#fafafa',
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px',
                  color: '#1a1a1a',
                  fontSize: '16px',
                  boxSizing: 'border-box'
                }}
              />
            </div>
            {(metric.goalType || 'min') === 'range' && (
              <div>
                <label style={{ fontSize: '10px', color: '#999', marginBottom: '2px', display: 'block' }}>
                  Max Goal
                </label>
                <input
                  type="number"
                  value={metric.goalMax || ''}
                  onChange={(e) => onUpdate(i, 'goalMax', parseInt(e.target.value) || 0)}
                  placeholder="Upper limit"
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    backgroundColor: '#fafafa',
                    border: '1px solid #e0e0e0',
                    borderRadius: '8px',
                    color: '#1a1a1a',
                    fontSize: '16px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            )}
          </div>
        </div>
      ))}

      <button
        onClick={onAdd}
        style={{
          width: '100%',
          padding: '10px',
          marginTop: '8px',
          backgroundColor: '#fff',
          border: '1px dashed #d0d0d0',
          borderRadius: '8px',
          color: '#666',
          fontSize: '13px',
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
function WaterSettings({ buttons, goal, onGoalChange, onAdd, onUpdate, onRemove, onMove }) {
  return (
    <div>
      <div style={{ fontSize: '11px', color: '#666', marginBottom: '6px', fontWeight: '500' }}>
        Daily Water Goal
      </div>
      <input
        type="number"
        value={goal || ''}
        onChange={(e) => onGoalChange(Number(e.target.value))}
        placeholder="Enter daily goal in ounces"
        style={{
          width: '100%',
          padding: '10px 12px',
          backgroundColor: '#fff',
          border: '1px solid #e0e0e0',
          borderRadius: '8px',
          color: '#1a1a1a',
          fontSize: '16px',
          marginBottom: '20px',
          boxSizing: 'border-box'
        }}
      />

      <div style={{ fontSize: '11px', color: '#666', marginBottom: '12px', fontWeight: '500' }}>
        Bottle Sizes (ounces) — drag to reorder
      </div>

      {buttons.map((amount, i) => (
        <div key={i} style={{ display: 'flex', gap: '6px', marginBottom: '8px', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <button
              onClick={() => onMove(i, -1)}
              disabled={i === 0}
              style={{
                padding: '2px 8px',
                backgroundColor: i === 0 ? '#f5f5f5' : '#fff',
                border: '1px solid #e0e0e0',
                borderRadius: '4px',
                color: i === 0 ? '#ccc' : '#666',
                fontSize: '10px',
                cursor: i === 0 ? 'default' : 'pointer',
                lineHeight: '1'
              }}
            >
              ▲
            </button>
            <button
              onClick={() => onMove(i, 1)}
              disabled={i === buttons.length - 1}
              style={{
                padding: '2px 8px',
                backgroundColor: i === buttons.length - 1 ? '#f5f5f5' : '#fff',
                border: '1px solid #e0e0e0',
                borderRadius: '4px',
                color: i === buttons.length - 1 ? '#ccc' : '#666',
                fontSize: '10px',
                cursor: i === buttons.length - 1 ? 'default' : 'pointer',
                lineHeight: '1'
              }}
            >
              ▼
            </button>
          </div>
          <input
            type="number"
            value={amount === 0 ? '' : amount}
            onChange={(e) => onUpdate(i, e.target.value)}
            placeholder="Ounces"
            style={{
              flex: 1,
              minWidth: 0,
              padding: '10px 12px',
              backgroundColor: '#fff',
              border: '1px solid #e0e0e0',
              borderRadius: '8px',
              color: '#1a1a1a',
              fontSize: '16px',
              boxSizing: 'border-box'
            }}
          />
          <button
            onClick={() => onRemove(i)}
            style={{
              padding: '10px 14px',
              backgroundColor: '#fff',
              border: '1px solid #e0e0e0',
              borderRadius: '8px',
              color: '#ff3333',
              fontSize: '13px',
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
          padding: '10px',
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
        + ADD SIZE
      </button>
    </div>
  )
}

// Meal Settings Component
function MealSettings({ meals, metrics, onUpdate, onRemove }) {
  const mealIcons = ['🍽️', '🍕', '🍔', '🥗', '🍜', '🍱', '🥪', '🌮', '🌯', '🥙', '🍳', '🥞', '🍞', '🥐', '🥓']

  return (
    <div>
      <div style={{ fontSize: '13px', color: '#666', marginBottom: '16px' }}>
        Configure quick-add meal presets
      </div>

      {metrics.length === 0 && (
        <div style={{
          padding: '30px 16px',
          textAlign: 'center',
          color: '#999',
          fontSize: '13px',
          backgroundColor: '#fff',
          borderRadius: '10px',
          border: '1px solid #e0e0e0'
        }}>
          Add nutrition metrics first
        </div>
      )}

      {metrics.length > 0 && meals.map((meal, i) => (
        <div key={i} style={{
          padding: '14px',
          backgroundColor: '#fff',
          border: '1px solid #e0e0e0',
          borderRadius: '10px',
          marginBottom: '10px'
        }}>
          <div style={{ display: 'flex', gap: '6px', marginBottom: meal ? '12px' : '0' }}>
            {meal && (
              <select
                value={meal?.icon || '🍽️'}
                onChange={(e) => onUpdate(i, 'icon', e.target.value)}
                style={{
                  padding: '8px',
                  backgroundColor: '#fafafa',
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px',
                  fontSize: '16px',
                  cursor: 'pointer',
                  width: '50px'
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
              placeholder={`Meal ${i + 1}`}
              style={{
                flex: 1,
                minWidth: 0,
                padding: '10px 12px',
                backgroundColor: '#fafafa',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                color: '#1a1a1a',
                fontSize: '16px',
                fontWeight: '500',
                boxSizing: 'border-box'
              }}
            />
            {meal && (
              <button
                onClick={() => onRemove(i)}
                style={{
                  padding: '10px 12px',
                  backgroundColor: '#f5f5f5',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#999',
                  fontSize: '13px',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                ✕
              </button>
            )}
          </div>

          {meal && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
              {metrics.map((metric) => (
                <div key={metric.key}>
                  <label style={{
                    fontSize: '10px',
                    color: '#999',
                    marginBottom: '2px',
                    display: 'block'
                  }}>
                    {metric.name}
                  </label>
                  <input
                    type="number"
                    value={meal[metric.key] || ''}
                    onChange={(e) => onUpdate(i, metric.key, parseInt(e.target.value) || 0)}
                    placeholder="0"
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      backgroundColor: '#fafafa',
                      border: '1px solid #e0e0e0',
                      borderRadius: '8px',
                      color: '#1a1a1a',
                      fontSize: '16px',
                      boxSizing: 'border-box'
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
