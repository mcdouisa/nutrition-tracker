'use client'

import { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AIChatModal } from './ai-chat-modal'
import Onboarding from './components/Onboarding'
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
  updateUserProfile,
  subscribeNotifications,
  dismissNotification,
  loadArchivedAnnouncements,
  completeOnboarding,
  loadUserProfile
} from '../lib/dataSync'
import {
  BarChartIcon, DumbbellIcon, TargetIcon, InboxIcon,
  CheckSquareIcon, DropletIcon, LeafIcon, ZapIcon,
  SparklesIcon, InfoIcon, CheckCircleIcon, CloseIcon,
  FlameIcon, UtensilsIcon, ChevronDownIcon, ChevronRightIcon
} from '../lib/icons'

// ─── THEME TOKENS ─────────────────────────────────────────────────────────────
const DARK = {
  bg:     '#0D0D0D',
  card:   '#1A1A1A',
  card2:  '#242424',
  border: '#2C2C2C',
  text:   '#FFFFFF',
  muted:  '#888888',
  faint:  '#555555',
}
const LIGHT = {
  bg:     '#F5F5F5',
  card:   '#FFFFFF',
  card2:  '#EBEBEB',
  border: '#E0E0E0',
  text:   '#1A1A1A',
  muted:  '#666666',
  faint:  '#999999',
}

// Theme context — makes T available to all sub-components without prop drilling
const ThemeContext = createContext(DARK)

export default function NutritionTracker() {
  const { user, loading: authLoading, signOut, isConfigured } = useAuth()
  const router = useRouter()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [syncStatus, setSyncStatus] = useState('') // 'syncing', 'synced', 'error', ''
  const [migrating, setMigrating] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [splashMinTime, setSplashMinTime] = useState(true) // minimum splash display

  // ── Theme ────────────────────────────────────────────────────────────────────
  const [darkMode, setDarkMode] = useState(true)
  useEffect(() => {
    const saved = localStorage.getItem('lytz-darkMode')
    if (saved !== null) setDarkMode(saved === 'true')
  }, [])
  const T = darkMode ? DARK : LIGHT
  const toggleTheme = () => {
    const next = !darkMode
    setDarkMode(next)
    localStorage.setItem('lytz-darkMode', String(next))
  }
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
  const [meals, setMeals] = useState([null, null, null, null, null, null, null, null, null, null])

  // Custom entry values
  const [customValues, setCustomValues] = useState({})
  const [customEntryName, setCustomEntryName] = useState('')

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
  const [chatImage, setChatImage] = useState(null)
  const [isThinking, setIsThinking] = useState(false)

  // Notifications
  const [notifications, setNotifications] = useState([])
  const [archivedAnnouncements, setArchivedAnnouncements] = useState([])
  const [showCatchUp, setShowCatchUp] = useState(false)

  // Onboarding
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [checkingOnboarding, setCheckingOnboarding] = useState(true)

  // Yesterday entry prompt
  const [showYesterdayPrompt, setShowYesterdayPrompt] = useState(false)
  const [eveningCutoff, setEveningCutoff] = useState('19:30') // HH:MM 24hr, default 7:30 PM

  // Current date for tracking
  const [currentDate, setCurrentDate] = useState('')
  const [dataLoaded, setDataLoaded] = useState(false)
  const [reloadKey, setReloadKey] = useState(0) // Increment to force data reload (e.g. day change)

  // Page-level date navigation (applies to all sections: habits, water, nutrition)
  const [viewDate, setViewDate] = useState(null) // null = today, YYYY-MM-DD for past
  const [pastDayData, setPastDayData] = useState(null) // Complete snapshot of past day data
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
    let unsubscribeNotifications = () => {}
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
          if (cloudSettings.eveningCutoff) setEveningCutoff(cloudSettings.eveningCutoff)
          if (cloudSettings.meals) {
            // Pad to 10 slots so existing users with 4 slots see the new capacity
            const padded = [...cloudSettings.meals]
            while (padded.length < 10) padded.push(null)
            setMeals(padded)
          }
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

        // Set up real-time listeners for multi-device sync (only when viewing today)
        // When viewing past days, we don't want real-time updates overwriting displayed data
        if (viewDate === null) {
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
        }

        unsubscribeSettings = subscribeUserSettings(user.uid, (settings) => {
          if (settings) {
            isRemoteUpdate.current = true
            // For checklist items, only update the structure (names) not the checked state
            // The checked state comes from daily data, not settings
            if (settings.checklistItems) {
              setChecklistItems(current => {
                // Skip merge if current is empty (initial load not complete yet)
                // This prevents overwriting daily data that's still loading
                if (current.length === 0) return settings.checklistItems.map(item => ({ ...item, checked: false }))

                // Merge settings items with current checked states
                // Match by name, not index, to preserve checked state even if order changes
                return settings.checklistItems.map((settingsItem) => {
                  const existing = current.find(item => item.name === settingsItem.name)
                  return {
                    ...settingsItem,
                    checked: existing?.checked ?? false
                  }
                })
              })
            }
            if (settings.nutritionMetrics) {
              setNutritionMetrics(current => {
                // Skip merge if current is empty (initial load not complete yet)
                // This prevents overwriting daily data that's still loading
                if (current.length === 0) return settings.nutritionMetrics.map(m => ({ ...m, value: 0 }))

                // Merge settings definitions with current daily values
                // Match by key, not index, to preserve values even if order changes
                return settings.nutritionMetrics.map((settingsMetric) => {
                  const existing = current.find(m => m.key === settingsMetric.key)
                  return {
                    ...settingsMetric,
                    value: existing?.value ?? 0
                  }
                })
              })
            }
            if (settings.waterButtons) setWaterButtons(settings.waterButtons)
            if (settings.waterGoal) setWaterGoal(settings.waterGoal)
            if (settings.meals) {
              const padded = [...settings.meals]
              while (padded.length < 10) padded.push(null)
              setMeals(padded)
            }
            setTimeout(() => { isRemoteUpdate.current = false }, 100)
          }
        })

        unsubscribeNotifications = subscribeNotifications(user.uid, async (notifs) => {
          const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          const fresh = [], stale = []
          notifs.forEach(n => {
            const age = new Date(n.createdAt)
            if (age < cutoff) stale.push(n)
            else fresh.push(n)
          })
          // Auto-expire stale notifications (fire-and-forget, mark autoExpired so they're retrievable)
          stale.forEach(n => dismissNotification(user.uid, n.id, true))
          setNotifications(fresh)
          // Reload the archived list whenever fresh subscription fires
          const archived = await loadArchivedAnnouncements(user.uid)
          setArchivedAnnouncements(archived)
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

      const storedCutoff = localStorage.getItem('evening-cutoff')
      if (storedCutoff) {
        setEveningCutoff(storedCutoff)
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
      unsubscribeNotifications()
    }
  }, [user, authLoading, isConfigured, reloadKey, viewDate])

  // Check if user needs onboarding
  useEffect(() => {
    const checkOnboarding = async () => {
      if (authLoading || !user || user.isAnonymous) {
        setCheckingOnboarding(false)
        return
      }

      try {
        const profile = await loadUserProfile(user.uid)

        // Only show onboarding if:
        // 1. User hasn't completed onboarding before
        // 2. User has no existing settings (truly new user)
        if (profile && profile.onboardingCompleted) {
          setShowOnboarding(false)
        } else {
          // Check if user has existing settings
          const settings = await loadUserSettings(user.uid)
          const hasExistingSettings = settings && (
            (settings.nutritionMetrics && settings.nutritionMetrics.length > 0) ||
            (settings.checklistItems && settings.checklistItems.length > 0)
          )

          if (hasExistingSettings) {
            // User has existing settings - don't show onboarding
            setShowOnboarding(false)
            // Mark as completed so we don't check again
            await completeOnboarding(user.uid, { profile: {}, habits: [], goals: {} })
          } else {
            // Truly new user - show onboarding
            setShowOnboarding(true)
          }
        }
      } catch (error) {
        console.error('Error checking onboarding status:', error)
        // If we can't check, don't show onboarding to avoid annoying existing users
        setShowOnboarding(false)
      } finally {
        setCheckingOnboarding(false)
      }
    }

    checkOnboarding()
  }, [user, authLoading])

  // Check if user forgot to log yesterday evening
  useEffect(() => {
    if (!dataLoaded) return
    if (viewDate !== null) return // already viewing a past day
    const today = toLocalDateStr()
    if (localStorage.getItem('yesterday-prompt-shown') === today) return

    // Mark as checked for today immediately — no matter what happens next,
    // the prompt won't appear again until tomorrow
    localStorage.setItem('yesterday-prompt-shown', today)

    const checkYesterday = async () => {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayStr = toLocalDateStr(yesterday)

      let dayData = null
      if (user && isConfigured) {
        dayData = await loadDayData(user.uid, yesterdayStr)
      } else {
        const hist = localStorage.getItem('nutrition-history')
        if (hist) {
          try { dayData = JSON.parse(hist).find(h => h.date === yesterdayStr) } catch (_) {}
        }
      }

      const hist = dayData?.nutritionHistory || []
      const [cutoffH, cutoffM] = eveningCutoff.split(':').map(Number)
      const cutoffMinutes = cutoffH * 60 + cutoffM

      const hadEveningEntry = hist.some(entry => {
        if (!entry.timestamp) return false
        const d = new Date(entry.timestamp)
        return (d.getHours() * 60 + d.getMinutes()) >= cutoffMinutes
      })

      if (!hadEveningEntry) {
        setShowYesterdayPrompt(true)
      }
    }

    checkYesterday()
  }, [dataLoaded]) // eslint-disable-line react-hooks/exhaustive-deps

  // Handle onboarding completion
  const handleOnboardingComplete = async (onboardingData) => {
    setShowOnboarding(false)

    if (!user) return

    try {
      // Save onboarding completion to user profile
      await completeOnboarding(user.uid, onboardingData)

      // Apply selected settings
      const { profile, habits, goals, optionalMetrics } = onboardingData

      // Build nutrition metrics from recommendations
      const newMetrics = []
      if (goals.calories) {
        newMetrics.push({
          key: 'calories',
          name: 'Calories',
          unit: 'Cal',
          goal: goals.calories,
          goalType: 'range',
          goalMax: goals.calories + 200, // +/- 200 cal range
          color: '#ff6b6b'
        })
      }
      if (goals.protein) {
        newMetrics.push({
          key: 'protein',
          name: 'Protein',
          unit: 'g',
          goal: goals.protein,
          goalType: 'min',
          color: '#0A84FF'
        })
      }
      // Only add optional metrics if user selected them
      if (goals.fiber && optionalMetrics?.fiber) {
        newMetrics.push({
          key: 'fiber',
          name: 'Fiber',
          unit: 'g',
          goal: goals.fiber,
          goalType: 'min',
          color: 'rgba(10,132,255,0.25)'
        })
      }
      if (goals.carbs && optionalMetrics?.carbs) {
        newMetrics.push({
          key: 'carbs',
          name: 'Carbs',
          unit: 'g',
          goal: goals.carbs,
          goalType: 'range',
          goalMax: goals.carbs + 50,
          color: '#feca57'
        })
      }
      if (goals.fat && optionalMetrics?.fat) {
        newMetrics.push({
          key: 'fat',
          name: 'Fat',
          unit: 'g',
          goal: goals.fat,
          goalType: 'range',
          goalMax: goals.fat + 20,
          color: '#ff9ff3'
        })
      }

      // Build checklist items from selected habits
      const newHabits = habits.map(habit => ({
        name: habit.label,
        checked: false
      }))

      // Set water goal
      const newWaterGoal = goals.water || 64

      // Set default water buttons
      const defaultWaterButtons = [8, 16, 24, 32]

      // Apply settings
      setNutritionMetrics(newMetrics.map(m => ({ ...m, value: 0 })))
      setChecklistItems(newHabits)
      setWaterGoal(newWaterGoal)
      setWaterButtons(defaultWaterButtons)

      // Save settings to cloud
      await saveUserSettings(user.uid, {
        nutritionMetrics: newMetrics,
        checklistItems: newHabits,
        waterGoal: newWaterGoal,
        waterButtons: defaultWaterButtons
      })

    } catch (error) {
      console.error('Error applying onboarding settings:', error)
    }
  }

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

    // Day has changed since we loaded data - save yesterday's data, then reload
    if (today !== currentDate) {
      // Build yesterday's data using the OLD date
      const yesterdayData = {
        date: currentDate, // Use the old date, not today
        checklistItems,
        nutritionMetrics,
        water,
        waterHistory,
        nutritionHistory
      }

      // Save yesterday's data to localStorage and history
      localStorage.setItem('nutrition-data', JSON.stringify(yesterdayData))
      saveToHistory(yesterdayData)

      // Sync yesterday's data to the correct dated document (NOT today's doc)
      // We bypass syncToCloud here because syncToCloud calls saveTodayData which
      // always writes to today's date, which would corrupt today with yesterday's data
      if (user && cloudLoadSucceeded.current) {
        setSyncStatus('syncing')
        saveHistoryEntry(user.uid, currentDate, yesterdayData)
          .then(() => { setSyncStatus('synced'); setTimeout(() => setSyncStatus(''), 2000) })
          .catch(() => { setSyncStatus('error'); setTimeout(() => setSyncStatus(''), 3000) })
      }

      // Now trigger reload for today
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
    const item = updated[index]
    if ((item.frequency || 'daily') === 'multiple') {
      const target = item.targetCount || 1
      const newCount = ((item.count || 0) + 1) > target ? 0 : (item.count || 0) + 1
      updated[index] = { ...item, count: newCount }
    } else {
      updated[index] = { ...item, checked: !item.checked }
    }
    setChecklistItems(updated)
  }

  // Navigate checklist to a different day
  const navigateDay = async (direction) => {
    const today = toLocalDateStr()

    // Save current data before navigating (prevents data loss)
    if (user && isConfigured) {
      if (viewDate !== null) {
        // Viewing a past day - save that day's data using pastDayData (not today's state)
        if (pastDayData) {
          const currentData = {
            ...pastDayData,
            date: viewDate
          }
          await saveHistoryEntry(user.uid, viewDate, currentData)
        }
      } else {
        // Viewing today - save today's data before navigating away
        const todayData = {
          checklistItems,
          nutritionMetrics,
          water,
          waterHistory,
          nutritionHistory,
          date: today
        }
        await saveTodayData(user.uid, todayData)
        await saveHistoryEntry(user.uid, today, todayData)
      }
    }

    let targetDate
    if (viewDate === null) {
      // Currently viewing today
      if (direction === 'back') {
        const d = new Date()
        d.setDate(d.getDate() - 1)
        targetDate = toLocalDateStr(d)
      } else {
        return // Already on today, can't go forward
      }
    } else {
      const parts = viewDate.split('-')
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
      d.setDate(d.getDate() + (direction === 'back' ? -1 : 1))
      targetDate = toLocalDateStr(d)

      // Don't go forward past today
      if (targetDate >= today && direction === 'forward') {
        setViewDate(null)
        setPastDayData(null)
        return
      }

      // Limit to 30 days back (more generous than 7 days)
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      if (d < thirtyDaysAgo) return
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
          const entry = history.find(h => h.date === targetDate)
          if (entry) dayData = entry
        }
      }

      // Merge loaded data with current structure (for all sections)
      const merged = {
        checklistItems: checklistItems.map(item => {
          const saved = (dayData?.checklistItems || []).find(s => s.name === item.name)
          return { ...item, checked: saved ? saved.checked : false }
        }),
        nutritionMetrics: nutritionMetrics.map(metric => {
          const saved = (dayData?.nutritionMetrics || []).find(m => m.key === metric.key)
          return { ...metric, value: saved ? saved.value : 0 }
        }),
        water: dayData?.water || 0,
        waterHistory: dayData?.waterHistory || [],
        nutritionHistory: dayData?.nutritionHistory || []
      }

      setViewDate(targetDate)
      setPastDayData(merged)
    } catch (error) {
      console.error('Error loading past day:', error)
    } finally {
      setLoadingPastDay(false)
    }
  }

  // Toggle a past day's checklist item and save
  const togglePastChecklistItem = async (index) => {
    if (!pastDayData || !viewDate) return

    const updated = [...pastDayData.checklistItems]
    const item = updated[index]
    if ((item.frequency || 'daily') === 'multiple') {
      const target = item.targetCount || 1
      const newCount = ((item.count || 0) + 1) > target ? 0 : (item.count || 0) + 1
      updated[index] = { ...item, count: newCount }
    } else {
      updated[index] = { ...item, checked: !item.checked }
    }

    // Update pastDayData with new checklist
    setPastDayData({ ...pastDayData, checklistItems: updated })

    // Save to cloud
    if (user && isConfigured) {
      const dayData = await loadDayData(user.uid, viewDate)
      const saveData = {
        ...(dayData || {}),
        checklistItems: updated,
        date: viewDate
      }
      await saveHistoryEntry(user.uid, viewDate, saveData)
    }

    // Save to localStorage history
    const historyStr = localStorage.getItem('nutrition-history')
    if (historyStr) {
      const history = JSON.parse(historyStr)
      const parts = viewDate.split('-')
      const targetObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
      const idx = history.findIndex(h => {
        if (h.date === viewDate) return true
        try { return new Date(h.date).toDateString() === targetObj.toDateString() } catch { return false }
      })
      if (idx >= 0) {
        history[idx].checklistItems = updated
        localStorage.setItem('nutrition-history', JSON.stringify(history))
      } else {
        history.push({
          date: viewDate,
          checklistItems: updated,
          nutritionMetrics: [],
          water: 0
        })
        localStorage.setItem('nutrition-history', JSON.stringify(history))
      }
    }
  }

  // Add water
  const addWater = async (amount) => {
    if (viewDate !== null && pastDayData) {
      // Viewing past day - update pastDayData and save immediately
      const newHistory = [...pastDayData.waterHistory, { amount, timestamp: Date.now() }]
      const newTotal = pastDayData.water + amount

      const updated = {
        ...pastDayData,
        water: newTotal,
        waterHistory: newHistory
      }
      setPastDayData(updated)

      // Save to Firestore immediately
      if (user && isConfigured) {
        const dayData = await loadDayData(user.uid, viewDate)
        const saveData = {
          ...(dayData || {}),
          water: newTotal,
          waterHistory: newHistory,
          date: viewDate
        }
        await saveHistoryEntry(user.uid, viewDate, saveData)
      }
    } else {
      // Viewing today - update current state
      setWaterHistory([...waterHistory, { amount, timestamp: Date.now() }])
      setWater(water + amount)
    }
  }

  // Undo water
  const undoWater = async () => {
    if (viewDate !== null && pastDayData) {
      // Viewing past day - update pastDayData and save immediately
      if (pastDayData.waterHistory.length === 0) return
      const lastEntry = pastDayData.waterHistory[pastDayData.waterHistory.length - 1]
      const newTotal = pastDayData.water - lastEntry.amount
      const newHistory = pastDayData.waterHistory.slice(0, -1)

      const updated = {
        ...pastDayData,
        water: newTotal,
        waterHistory: newHistory
      }
      setPastDayData(updated)

      // Save to Firestore immediately
      if (user && isConfigured) {
        const dayData = await loadDayData(user.uid, viewDate)
        const saveData = {
          ...(dayData || {}),
          water: newTotal,
          waterHistory: newHistory,
          date: viewDate
        }
        await saveHistoryEntry(user.uid, viewDate, saveData)
      }
    } else {
      // Viewing today - update current state
      if (waterHistory.length === 0) return
      const lastEntry = waterHistory[waterHistory.length - 1]
      setWater(water - lastEntry.amount)
      setWaterHistory(waterHistory.slice(0, -1))
    }
  }

  // Add to nutrition metric
  const addToMetric = async (metricIndex, value) => {
    if (!value || value === 0) return

    if (viewDate !== null && pastDayData) {
      // Viewing past day - update pastDayData and save immediately
      const updated = [...pastDayData.nutritionMetrics]
      updated[metricIndex] = {
        ...updated[metricIndex],
        value: (updated[metricIndex].value || 0) + value
      }

      const newHistory = [
        ...pastDayData.nutritionHistory,
        { metricIndex, value, timestamp: Date.now() }
      ]

      const updatedPastDay = {
        ...pastDayData,
        nutritionMetrics: updated,
        nutritionHistory: newHistory
      }
      setPastDayData(updatedPastDay)

      // Save to Firestore immediately
      if (user && isConfigured) {
        const dayData = await loadDayData(user.uid, viewDate)
        const saveData = {
          ...(dayData || {}),
          nutritionMetrics: updated,
          nutritionHistory: newHistory,
          date: viewDate
        }
        await saveHistoryEntry(user.uid, viewDate, saveData)
      }
    } else {
      // Viewing today - update current state
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
  }

  // Undo last nutrition entry (supports both single and AI batch entries)
  const undoNutrition = async () => {
    if (viewDate !== null && pastDayData) {
      // Viewing past day - update pastDayData and save immediately
      if (pastDayData.nutritionHistory.length === 0) return

      const lastEntry = pastDayData.nutritionHistory[pastDayData.nutritionHistory.length - 1]
      const updated = [...pastDayData.nutritionMetrics]

      if (lastEntry.type === 'manual_named' || lastEntry.type === 'manual_unnamed') {
        // Undo named/unnamed manual consolidated entry
        updated.forEach((metric, index) => {
          if (lastEntry.values[metric.key]) {
            updated[index] = {
              ...metric,
              value: Math.max(0, (metric.value || 0) - lastEntry.values[metric.key])
            }
          }
        })
      } else if (lastEntry.estimates) {
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

      const updatedPastDay = {
        ...pastDayData,
        nutritionMetrics: updated,
        nutritionHistory: pastDayData.nutritionHistory.slice(0, -1)
      }
      setPastDayData(updatedPastDay)

      // Save to Firestore immediately
      if (user && isConfigured) {
        const dayData = await loadDayData(user.uid, viewDate)
        const saveData = {
          ...(dayData || {}),
          nutritionMetrics: updated,
          nutritionHistory: pastDayData.nutritionHistory.slice(0, -1),
          date: viewDate
        }
        await saveHistoryEntry(user.uid, viewDate, saveData)
      }
    } else {
      // Viewing today - update current state
      if (nutritionHistory.length === 0) return

      const lastEntry = nutritionHistory[nutritionHistory.length - 1]
      const updated = [...nutritionMetrics]

      if (lastEntry.type === 'manual_named' || lastEntry.type === 'manual_unnamed') {
        // Undo named/unnamed manual consolidated entry
        updated.forEach((metric, index) => {
          if (lastEntry.values[metric.key]) {
            updated[index] = {
              ...metric,
              value: Math.max(0, (metric.value || 0) - lastEntry.values[metric.key])
            }
          }
        })
      } else if (lastEntry.estimates) {
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
  }

  // Remove a specific nutrition entry by index
  const removeNutritionEntry = async (entryIndex) => {
    if (viewDate !== null && pastDayData) {
      // Viewing past day - update pastDayData and save immediately
      const entry = pastDayData.nutritionHistory[entryIndex]
      if (!entry) return

      const updated = [...pastDayData.nutritionMetrics]

      if (entry.type === 'manual_named' || entry.type === 'manual_unnamed') {
        // Remove named/unnamed manual consolidated entry
        updated.forEach((metric, i) => {
          if (entry.values[metric.key]) {
            updated[i] = {
              ...metric,
              value: Math.max(0, (metric.value || 0) - entry.values[metric.key])
            }
          }
        })
      } else if (entry.estimates) {
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

      const updatedPastDay = {
        ...pastDayData,
        nutritionMetrics: updated,
        nutritionHistory: pastDayData.nutritionHistory.filter((_, i) => i !== entryIndex)
      }
      setPastDayData(updatedPastDay)

      // Save to Firestore immediately
      if (user && isConfigured) {
        const dayData = await loadDayData(user.uid, viewDate)
        const saveData = {
          ...(dayData || {}),
          nutritionMetrics: updated,
          nutritionHistory: pastDayData.nutritionHistory.filter((_, i) => i !== entryIndex),
          date: viewDate
        }
        await saveHistoryEntry(user.uid, viewDate, saveData)
      }
    } else {
      // Viewing today - update current state
      const entry = nutritionHistory[entryIndex]
      if (!entry) return

      const updated = [...nutritionMetrics]

      if (entry.type === 'manual_named' || entry.type === 'manual_unnamed') {
        // Remove named/unnamed manual consolidated entry
        updated.forEach((metric, i) => {
          if (entry.values[metric.key]) {
            updated[i] = {
              ...metric,
              value: Math.max(0, (metric.value || 0) - entry.values[metric.key])
            }
          }
        })
      } else if (entry.estimates) {
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
  }

  // Save directly edited metric value
  const saveMetricEdit = async (metricIndex) => {
    const newValue = parseInt(editMetricValue) || 0

    if (viewDate !== null && pastDayData) {
      // Viewing past day - update pastDayData and save immediately
      const updated = [...pastDayData.nutritionMetrics]
      updated[metricIndex] = { ...updated[metricIndex], value: Math.max(0, newValue) }

      const updatedPastDay = {
        ...pastDayData,
        nutritionMetrics: updated
      }
      setPastDayData(updatedPastDay)

      // Save to Firestore immediately
      if (user && isConfigured) {
        const dayData = await loadDayData(user.uid, viewDate)
        const saveData = {
          ...(dayData || {}),
          nutritionMetrics: updated,
          date: viewDate
        }
        await saveHistoryEntry(user.uid, viewDate, saveData)
      }
    } else {
      // Viewing today - update current state
      const updated = [...nutritionMetrics]
      updated[metricIndex] = { ...updated[metricIndex], value: Math.max(0, newValue) }
      setNutritionMetrics(updated)
    }

    setEditingMetric(null)
    setEditMetricValue('')
  }

  // Add meal
  const addMeal = async (meal) => {
    if (viewDate !== null && pastDayData) {
      // Viewing past day - create a single consolidated entry
      const values = {}
      const updatedMetrics = pastDayData.nutritionMetrics.map((metric, index) => {
        const value = meal[metric.key]
        if (value) {
          values[metric.key] = value
          return { ...metric, value: (metric.value || 0) + value }
        }
        return metric
      })

      if (Object.keys(values).length === 0) return

      const newEntry = { type: 'manual_named', name: meal.name || 'Meal', values, timestamp: Date.now() }
      const updatedPastDay = {
        ...pastDayData,
        nutritionMetrics: updatedMetrics,
        nutritionHistory: [...pastDayData.nutritionHistory, newEntry]
      }
      setPastDayData(updatedPastDay)

      if (user && isConfigured) {
        const dayData = await loadDayData(user.uid, viewDate)
        const saveData = {
          ...(dayData || {}),
          nutritionMetrics: updatedMetrics,
          nutritionHistory: [...pastDayData.nutritionHistory, newEntry],
          date: viewDate
        }
        await saveHistoryEntry(user.uid, viewDate, saveData)
      }
    } else {
      // Viewing today - create a single consolidated entry
      const values = {}
      const updated = [...nutritionMetrics]
      nutritionMetrics.forEach((metric, index) => {
        const value = meal[metric.key]
        if (value) {
          values[metric.key] = value
          updated[index] = { ...metric, value: (metric.value || 0) + value }
        }
      })

      if (Object.keys(values).length === 0) return

      const newEntry = { type: 'manual_named', name: meal.name || 'Meal', values, timestamp: Date.now() }
      setNutritionMetrics(updated)
      setNutritionHistory([...nutritionHistory, newEntry])
    }
  }

  // Add custom entry - batch all values together
  const addCustomEntry = async () => {
    if (viewDate !== null && pastDayData) {
      // Viewing past day - update pastDayData and save immediately
      const values = {}
      const updatedMetrics = pastDayData.nutritionMetrics.map((metric) => {
        const value = parseInt(customValues[metric.key]) || 0
        if (value > 0) {
          values[metric.key] = value
          return { ...metric, value: (metric.value || 0) + value }
        }
        return metric
      })

      // Only proceed if at least one value was entered
      if (Object.keys(values).length === 0) return

      // Create ONE consolidated entry
      const newEntry = customEntryName.trim()
        ? {
            type: 'manual_named',
            name: customEntryName.trim(),
            values,
            timestamp: Date.now()
          }
        : {
            type: 'manual_unnamed',
            values,
            timestamp: Date.now()
          }

      const updated = {
        ...pastDayData,
        nutritionMetrics: updatedMetrics,
        nutritionHistory: [...pastDayData.nutritionHistory, newEntry]
      }
      setPastDayData(updated)

      // Save to Firestore immediately
      if (user && isConfigured) {
        const dayData = await loadDayData(user.uid, viewDate)
        const saveData = {
          ...(dayData || {}),
          nutritionMetrics: updatedMetrics,
          nutritionHistory: [...pastDayData.nutritionHistory, newEntry],
          date: viewDate
        }
        await saveHistoryEntry(user.uid, viewDate, saveData)
      }

      // Clear form
      setCustomValues({})
      setCustomEntryName('')
    } else {
      // Viewing today - update current state
      const values = {}
      const updatedMetrics = nutritionMetrics.map((metric) => {
        const value = parseInt(customValues[metric.key]) || 0
        if (value > 0) {
          values[metric.key] = value
          return { ...metric, value: (metric.value || 0) + value }
        }
        return metric
      })

      // Only proceed if at least one value was entered
      if (Object.keys(values).length === 0) return

      setNutritionMetrics(updatedMetrics)

      // Create ONE consolidated entry
      const newEntry = customEntryName.trim()
        ? {
            type: 'manual_named',
            name: customEntryName.trim(),
            values,
            timestamp: Date.now()
          }
        : {
            type: 'manual_unnamed',
            values,
            timestamp: Date.now()
          }

      setNutritionHistory([...nutritionHistory, newEntry])

      // Clear form
      setCustomValues({})
      setCustomEntryName('')
    }
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

  const saveEveningCutoff = (value) => {
    localStorage.setItem('evening-cutoff', value)
    setEveningCutoff(value)
    if (user) {
      saveUserSettings(user.uid, { eveningCutoff: value })
    }
  }

  const formatCutoffTime = (hhmm) => {
    const [h, m] = hhmm.split(':').map(Number)
    const suffix = h >= 12 ? 'PM' : 'AM'
    const hour = h > 12 ? h - 12 : h === 0 ? 12 : h
    return `${hour}:${String(m).padStart(2, '0')} ${suffix}`
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
    if (!chatInput.trim() && !chatImage) return

    const userMessage = {
      role: 'user',
      content: chatInput || 'Analyze this food photo',
      image: chatImage || undefined
    }
    setChatMessages([...chatMessages, userMessage])
    setChatInput('')
    setChatImage(null)
    setIsThinking(true)

    try {
      const metricsInfo = nutritionMetrics.length > 0
        ? nutritionMetrics.map(m => `${m.name} (${m.unit})`).join(', ')
        : 'calories, protein, carbs, fat'

      const metricsKeys = nutritionMetrics.length > 0
        ? Object.fromEntries(nutritionMetrics.map(m => [m.key, 0]))
        : { calories: 0, protein: 0, carbs: 0, fat: 0 }

      const basePrompt = `You are a precise nutrition database assistant. The user is tracking these metrics: ${metricsInfo}.

ACCURACY IS YOUR TOP PRIORITY. Use real nutritional data from official sources (USDA, restaurant websites, food labels). Do not guess or extrapolate wildly.

Rules:
- For branded/restaurant foods (McDonald's, Chick-fil-A, Starbucks, etc.), use their OFFICIAL published nutrition data. Example: Chick-fil-A 12-ct nuggets = 380 cal, so 10 = ~317 cal.
- For generic foods, use USDA database values as your reference.
- Scale linearly from known serving sizes. If a 12-count is X calories, a 10-count is (10/12 * X) calories.
- NEVER inflate calorie estimates. When uncertain, estimate conservatively (lower end).
- Calculate for the EXACT quantity described, not a default serving size.`

      const imagePrompt = chatImage ? `

When analyzing a food photo:
- If it's a nutrition facts label, read the exact values directly from the label. Use the serving size shown unless the user specifies otherwise.
- If it's a photo of food, identify what you see and estimate a typical portion. If the user specified a quantity or amount in their message, use that instead.
- Describe briefly what you identified so the user can confirm it's correct.` : ''

      const systemPrompt = `${basePrompt}${imagePrompt}

When the user describes or shows a meal or food, provide:
1. A brief response with your source or reasoning (e.g. "Based on Chick-fil-A's official data..." or "I can see this is a nutrition label showing...")
2. Your accurate estimates for the EXACT amount described or shown

Always end your response with these two lines:
NUTRITION_DATA: ${JSON.stringify(metricsKeys)}
FOOD_SCORE: {"score": 0, "grade": "?", "label": "?", "reason": "?"}

For NUTRITION_DATA, replace 0s with accurate values for the EXACT amount described.
For FOOD_SCORE: score 0-100 based on nutrient density, processing level, fiber, sugar, sodium, protein quality, and fat quality.
Grades: A (85-100), B (70-84), C (55-69), D (40-54), F (0-39)
Labels: "Excellent" (A), "Good" (B), "Fair" (C), "Poor" (D), "Avoid" (F)
Reason: 5-7 words max — the single most important factor.`

      // Format current user message — use content array when image is present
      const currentUserContent = chatImage
        ? [
            ...(chatInput.trim() ? [{ type: 'text', text: chatInput }] : [{ type: 'text', text: 'Analyze this food and estimate its nutrition.' }]),
            { type: 'image_url', image_url: { url: chatImage } }
          ]
        : chatInput

      // Build messages array — exclude images from history to keep payload small
      const messages = [
        { role: 'system', content: systemPrompt },
        ...chatMessages.slice(-6).map(msg => ({
          role: msg.role,
          content: typeof msg.content === 'string' ? msg.content : msg.content
        })),
        { role: 'user', content: currentUserContent }
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
      let foodScore = null
      let displayMessage = assistantMessage

      if (nutritionMatch) {
        try {
          estimates = JSON.parse(nutritionMatch[1])
          displayMessage = assistantMessage.replace(/NUTRITION_DATA:\s*\{[^}]+\}/i, '').trim()
        } catch (e) {
          console.error('Failed to parse nutrition data:', e)
        }
      }

      const scoreMatch = displayMessage.match(/FOOD_SCORE:\s*(\{[^}]+\})/i)
      if (scoreMatch) {
        try {
          foodScore = JSON.parse(scoreMatch[1])
          displayMessage = displayMessage.replace(/FOOD_SCORE:\s*\{[^}]+\}/i, '').trim()
        } catch (e) {
          console.error('Failed to parse food score:', e)
        }
      }

      setChatMessages([
        ...chatMessages,
        userMessage,
        { role: 'assistant', content: displayMessage, estimates, score: foodScore }
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

  const handleBarcodeResult = ({ name, brand, servingSize, estimates }) => {
    const displayName = brand ? `${brand} ${name}` : name
    const servingNote = servingSize ? ` · ${servingSize}` : ''
    setChatMessages(prev => [
      ...prev,
      { role: 'user', content: `Scanned: ${displayName}` },
      {
        role: 'assistant',
        content: `Found ${displayName}${servingNote}.`,
        estimates,
      },
    ])
  }

  const addEstimatedNutrition = async (estimates, messageIndex) => {
    const timestamp = Date.now()
    const msgScore = messageIndex !== undefined ? chatMessages[messageIndex]?.score : null
    const newEntry = { estimates, score: msgScore || undefined, timestamp }

    if (viewDate !== null && pastDayData) {
      // Viewing past day - update pastDayData and save to Firestore
      const updated = pastDayData.nutritionMetrics.map(metric => ({
        ...metric,
        value: (metric.value || 0) + (estimates[metric.key] || 0)
      }))

      const updatedPastDay = {
        ...pastDayData,
        nutritionMetrics: updated,
        nutritionHistory: [...pastDayData.nutritionHistory, newEntry]
      }
      setPastDayData(updatedPastDay)

      // Save to Firestore immediately
      if (user && isConfigured) {
        const dayData = await loadDayData(user.uid, viewDate)
        const saveData = {
          ...(dayData || {}),
          nutritionMetrics: updated,
          nutritionHistory: [...(dayData?.nutritionHistory || []), newEntry],
          date: viewDate
        }
        await saveHistoryEntry(user.uid, viewDate, saveData)
      }
    } else {
      // Viewing today - update current state
      const updated = nutritionMetrics.map(metric => ({
        ...metric,
        value: (metric.value || 0) + (estimates[metric.key] || 0)
      }))

      setNutritionHistory([...nutritionHistory, newEntry])
      setNutritionMetrics(updated)
    }

    // Mark this message's estimates as added
    if (messageIndex !== undefined) {
      setChatMessages(prev => prev.map((msg, idx) =>
        idx === messageIndex ? { ...msg, added: true } : msg
      ))
    }
  }

  // Show loading state (with minimum 1s splash)
  if (authLoading || migrating || splashMinTime || checkingOnboarding) {
    return (
      <div style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: T.bg,
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
        backgroundColor: T.bg,
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
            color: T.muted,
            lineHeight: '1.5'
          }}>
            Track your daily nutrition, water intake, and healthy habits with cloud sync across all your devices.
          </p>
          <button
            onClick={() => router.push('/login')}
            style={{
              width: '100%',
              padding: '14px',
              backgroundColor: '#0A84FF',
              border: 'none',
              borderRadius: '8px',
              color: '#1A1A1A',
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
              border: `1px solid ${T.border}`,
              borderRadius: '8px',
              color: T.muted,
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
            color: T.faint
          }}>
            Your data may be lost if the app is removed. Create an account to keep it safe.
          </p>
          </div>{/* end padding wrapper */}
        </div>
      </div>
    )
  }

  return (
    <ThemeContext.Provider value={T}>
    <div style={{
      minHeight: '100vh',
      backgroundColor: T.bg,
      padding: '0 0 80px 0',
      fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
      color: T.text,
    }}>
      {/* Onboarding Modal */}
      {showOnboarding && !checkingOnboarding && (
        <Onboarding onComplete={handleOnboardingComplete} onSkip={() => setShowOnboarding(false)} />
      )}

      {/* Yesterday Entry Prompt */}
      {showYesterdayPrompt && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          zIndex: 1100
        }}>
          <div style={{
            backgroundColor: T.card,
            borderRadius: '16px 16px 0 0',
            width: '100%',
            maxWidth: '600px',
            padding: '28px 24px 40px'
          }}>
            <div style={{ fontSize: '36px', textAlign: 'center', marginBottom: '12px' }}>🌙</div>
            <h3 style={{
              margin: '0 0 8px 0',
              fontSize: '17px',
              fontWeight: '600',
              color: T.text,
              textAlign: 'center'
            }}>
              Looks like yesterday was incomplete
            </h3>
            <p style={{
              margin: '0 0 24px 0',
              fontSize: '14px',
              color: T.muted,
              textAlign: 'center',
              lineHeight: '1.5'
            }}>
              No entries were logged after {formatCutoffTime(eveningCutoff)} yesterday.<br />
              Want to go back and fill it in?
            </p>
            <button
              onClick={() => { navigateDay('back'); setShowYesterdayPrompt(false) }}
              style={{
                display: 'block',
                width: '100%',
                padding: '14px',
                background: 'linear-gradient(90deg, #0A84FF, #5856D6)',
                color: '#fff',
                border: 'none',
                borderRadius: '12px',
                fontSize: '15px',
                fontWeight: '700',
                cursor: 'pointer',
                marginBottom: '10px',
                boxShadow: '0 4px 20px rgba(10,132,255,0.35)'
              }}
            >
              Go to Yesterday
            </button>
            <button
              onClick={() => setShowYesterdayPrompt(false)}
              style={{
                display: 'block',
                width: '100%',
                padding: '12px',
                backgroundColor: 'transparent',
                border: `1px solid ${T.border}`,
                borderRadius: '10px',
                fontSize: '14px',
                color: T.muted,
                cursor: 'pointer'
              }}
            >
              Skip for now
            </button>
          </div>
        </div>
      )}

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '0 16px' }}>
        {/* Header */}
        <div style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          backgroundColor: T.bg + 'ee',
          borderBottom: '1px solid ' + T.border,
          marginBottom: '20px',
          padding: '12px 0 14px',
          marginLeft: '-16px',
          marginRight: '-16px',
          paddingLeft: '16px',
          paddingRight: '16px'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '12px'
          }}>
            <div>
              <div style={{ fontSize: '10px', fontWeight: '700', color: T.muted, letterSpacing: '2.5px', marginBottom: '3px', fontFamily: "'Barlow Condensed', sans-serif" }}>
                {greeting()}
              </div>
              <h1 style={{
                margin: '0 0 3px 0',
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: '26px',
                fontWeight: '900',
                color: T.text,
                letterSpacing: '4px',
                textTransform: 'uppercase',
                lineHeight: 1
              }}>
                LYTZ
              </h1>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <span style={{
                  color: T.muted,
                  fontSize: '11px',
                  fontWeight: '600',
                  letterSpacing: '0.5px'
                }}>
                  {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </span>
                {syncStatus && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{
                      width: '6px', height: '6px', borderRadius: '50%',
                      backgroundColor: syncStatus === 'synced' ? '#30D158' : syncStatus === 'error' ? '#FF453A' : '#888888',
                      boxShadow: syncStatus === 'synced' ? '0 0 5px #30D158' : 'none',
                      display: 'inline-block'
                    }}/>
                    <span style={{
                      fontSize: '10px',
                      color: syncStatus === 'synced' ? '#30D158' : syncStatus === 'error' ? '#FF453A' : '#888888',
                      fontWeight: '600'
                    }}>
                      {syncStatus === 'syncing' ? 'Syncing' : syncStatus === 'synced' ? 'Synced' : 'Error'}
                    </span>
                  </span>
                )}
              </div>
            </div>

            {/* Return to Today button — only shown when viewing a past day */}
            {viewDate !== null && (
              <button
                onClick={() => { setViewDate(null); setPastDayData(null) }}
                style={{
                  padding: '8px 14px',
                  background: 'linear-gradient(90deg, #0A84FF, #5856D6)',
                  border: 'none',
                  borderRadius: '10px',
                  color: '#fff',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  letterSpacing: '0.3px',
                  boxShadow: '0 2px 12px rgba(10,132,255,0.4)'
                }}
              >
                Today
              </button>
            )}

            {/* User Account Button */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => user ? setShowUserMenu(!showUserMenu) : router.push('/login')}
                style={{
                  padding: '9px 14px',
                  backgroundColor: user ? 'rgba(48,209,88,0.12)' : T.card,
                  border: '1px solid',
                  borderColor: user ? 'rgba(48,209,88,0.35)' : T.border,
                  borderRadius: '10px',
                  color: user ? '#30D158' : '#888888',
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
                  backgroundColor: T.card,
                  border: `1px solid ${T.border}`,
                  borderRadius: '14px',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                  minWidth: '180px',
                  zIndex: 100,
                  overflow: 'hidden'
                }}>
                  <div style={{
                    padding: '12px 14px',
                    borderBottom: `1px solid ${T.border}`,
                    backgroundColor: T.bg
                  }}>
                    <div style={{ fontSize: '11px', color: T.faint, marginBottom: '2px' }}>
                      Signed in as
                    </div>
                    <div style={{
                      fontSize: '13px',
                      color: T.text,
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
                      setSettingsTab('appSettings')
                      setShowSettings(true)
                    }}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      backgroundColor: 'transparent',
                      border: 'none',
                      borderBottom: `1px solid ${T.border}`,
                      color: T.text,
                      fontSize: '13px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <span>⚙️</span> Settings
                  </button>
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
                      borderBottom: `1px solid ${T.border}`,
                      color: '#0A84FF',
                      fontSize: '13px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    Send Feedback
                  </button>
                  <button
                    onClick={() => {
                      setShowUserMenu(false)
                      setShowOnboarding(true)
                    }}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      backgroundColor: 'transparent',
                      border: 'none',
                      borderBottom: `1px solid ${T.border}`,
                      color: '#0A84FF',
                      fontSize: '13px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    View Tutorial
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
                      color: signingOut ? '#666666' : '#ef4444',
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
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '8px'
          }}>
            <button
              onClick={() => setShowChat(true)}
              style={{
                padding: '11px 8px',
                backgroundColor: showChat ? '#0A84FF' : 'rgba(191,90,242,0.1)',
                border: `1px solid ${showChat ? '#0A84FF' : 'rgba(191,90,242,0.3)'}`,
                borderRadius: '12px',
                color: showChat ? '#fff' : '#BF5AF2',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
                letterSpacing: '0.5px'
              }}
            >
              🤖 AI
            </button>
            <Link
              href="/reports"
              style={{
                padding: '11px 8px',
                backgroundColor: 'rgba(10,132,255,0.1)',
                border: '1px solid rgba(10,132,255,0.3)',
                borderRadius: '12px',
                color: '#0A84FF',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.15s',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                letterSpacing: '0.5px'
              }}
            >
              <BarChartIcon size={14} color="currentColor" strokeWidth={2} /> Reports
            </Link>
            <button
              onClick={() => setShowSettings(true)}
              style={{
                padding: '11px 8px',
                backgroundColor: showSettings ? '#0A84FF' : 'rgba(48,209,88,0.1)',
                border: `1px solid ${showSettings ? '#0A84FF' : 'rgba(48,209,88,0.3)'}`,
                borderRadius: '12px',
                color: showSettings ? '#fff' : '#30D158',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.15s',
                letterSpacing: '0.5px'
              }}
            >
              <TargetIcon size={14} color="currentColor" strokeWidth={2} /> Goals
            </button>
            <Link
              href="/workout"
              style={{
                padding: '11px 8px',
                backgroundColor: 'rgba(255,159,10,0.1)',
                border: '1px solid rgba(255,159,10,0.3)',
                borderRadius: '12px',
                color: '#FF9F0A',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.15s',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                whiteSpace: 'nowrap',
                letterSpacing: '0.5px'
              }}
            >
              <DumbbellIcon size={14} color="currentColor" strokeWidth={2} /> Workout
            </Link>
          </div>
        </div>

        {/* Notification Banners */}
        {notifications.length > 0 && (
          <div style={{ marginBottom: '16px' }}>
            {notifications.map(notif => (
              <NotificationBanner
                key={notif.id}
                notification={notif}
                onDismiss={async () => {
                  await dismissNotification(user.uid, notif.id)
                }}
              />
            ))}
          </div>
        )}

        {/* Catch Up — older archived announcements */}
        {archivedAnnouncements.length > 0 && (
          <div style={{ marginBottom: '16px' }}>
            <button
              onClick={() => setShowCatchUp(v => !v)}
              style={{
                width: '100%',
                padding: '10px 14px',
                backgroundColor: showCatchUp ? 'rgba(10,132,255,0.1)' : T.card,
                border: `1px solid ${showCatchUp ? 'rgba(10,132,255,0.35)' : T.border}`,
                borderRadius: '12px',
                color: showCatchUp ? '#0A84FF' : T.muted,
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                letterSpacing: '0.5px',
                transition: 'all 0.15s'
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <InboxIcon size={14} color="currentColor" strokeWidth={2} />
                <span>{archivedAnnouncements.length} older update{archivedAnnouncements.length !== 1 ? 's' : ''} — Catch up</span>
              </span>
              <span style={{ fontSize: '14px' }}>{showCatchUp ? '▲' : '▼'}</span>
            </button>

            {showCatchUp && (
              <div style={{
                marginTop: '6px',
                backgroundColor: T.card,
                border: `1px solid ${T.border}`,
                borderRadius: '12px',
                overflow: 'hidden'
              }}>
                {archivedAnnouncements.map((notif, i) => {
                  const date = new Date(notif.createdAt)
                  const dateLabel = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                  return (
                    <div key={notif.id} style={{
                      padding: '14px 16px',
                      borderBottom: i < archivedAnnouncements.length - 1 ? `1px solid ${T.border}` : 'none'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <SparklesIcon size={14} color="#0A84FF" strokeWidth={2} />
                          <span style={{
                            fontSize: '12px', fontWeight: '700', color: '#0A84FF',
                            textTransform: 'uppercase', letterSpacing: '0.5px',
                            fontFamily: "'Barlow Condensed', sans-serif"
                          }}>
                            {notif.title || 'Announcement'}
                          </span>
                        </div>
                        <span style={{ fontSize: '11px', color: T.muted }}>{dateLabel}</span>
                      </div>
                      <div style={{ fontSize: '13px', color: T.muted, lineHeight: '1.5' }}>
                        {notif.message.split('\n').map((line, j, arr) =>
                          line.trim() === ''
                            ? <br key={j}/>
                            : <p key={j} style={{ margin: j < arr.length - 1 ? '0 0 4px 0' : 0 }}>{line}</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Page-level Date Navigation */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          backgroundColor: viewDate !== null ? (darkMode ? '#1a1228' : '#f0ebff') : T.card,
          borderRadius: '14px',
          marginBottom: '20px',
          border: `1px solid ${viewDate !== null ? '#BF5AF2' : '#0A84FF'}`
        }}>
          {/* Back arrow */}
          <button
            onClick={() => navigateDay('back')}
            disabled={loadingPastDay}
            style={{
              padding: '8px 12px',
              backgroundColor: 'transparent',
              border: '1px solid #0A84FF',
              borderRadius: '8px',
              color: '#0A84FF',
              fontSize: '18px',
              fontWeight: '700',
              cursor: loadingPastDay ? 'not-allowed' : 'pointer',
              opacity: loadingPastDay ? 0.5 : 1
            }}
          >
            ‹
          </button>

          {/* Date display */}
          <div style={{
            flex: 1,
            textAlign: 'center',
            fontFamily: "'Barlow Condensed', sans-serif",
            fontWeight: '700',
            fontSize: '16px',
            letterSpacing: '1px',
            color: T.text
          }}>
            {loadingPastDay ? (
              'Loading...'
            ) : viewDate !== null ? (
              (() => {
                const parts = viewDate.split('-')
                const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
                const today = new Date()
                today.setHours(0,0,0,0)
                const yesterday = new Date(today)
                yesterday.setDate(yesterday.getDate() - 1)

                if (d.toDateString() === yesterday.toDateString()) {
                  return 'Yesterday'
                }
                return d.toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric'
                })
              })()
            ) : (
              'Today'
            )}
          </div>

          {/* Forward arrow */}
          <button
            onClick={() => navigateDay('forward')}
            disabled={viewDate === null || loadingPastDay}
            style={{
              padding: '8px 12px',
              backgroundColor: 'transparent',
              border: `1px solid ${viewDate === null ? '#ddd' : '#0A84FF'}`,
              borderRadius: '8px',
              color: viewDate === null ? '#ddd' : '#0A84FF',
              fontSize: '18px',
              fontWeight: '700',
              cursor: viewDate === null || loadingPastDay ? 'not-allowed' : 'pointer',
              opacity: viewDate === null || loadingPastDay ? 0.5 : 1
            }}
          >
            ›
          </button>
        </div>

        {/* Daily Checklist */}
        {checklistItems.length > 0 && (
          <div style={{ marginBottom: '28px' }}>
            {(() => {
              const displayItems = viewDate !== null && pastDayData?.checklistItems ? pastDayData.checklistItems : checklistItems
              const completed = displayItems.filter(item => {
                if ((item.frequency || 'daily') === 'multiple') return (item.count || 0) >= (item.targetCount || 1)
                return item.checked
              }).length
              const pct = displayItems.length > 0 ? Math.round(completed / displayItems.length * 100) : 0
              const ringColor = pct === 100 ? '#30D158' : '#0A84FF'
              return (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
                      background: 'rgba(10,132,255,0.12)', border: '1px solid rgba(10,132,255,0.3)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}><CheckSquareIcon size={17} color="#0A84FF" strokeWidth={2} /></div>
                    <h2 style={{
                      margin: 0, fontSize: '13px', fontWeight: '700', color: T.muted,
                      textTransform: 'uppercase', letterSpacing: '2px', fontFamily: "'Barlow Condensed', sans-serif"
                    }}>Daily Habits</h2>
                  </div>
                  <ProgressRing pct={pct} size={52} sw={4} color={ringColor} />
                </div>
              )
            })()}
            {loadingPastDay ? (
              <div style={{ textAlign: 'center', padding: '20px', color: T.muted, fontSize: '13px' }}>
                Loading...
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: checklistItems.length === 1 ? '1fr' : 'repeat(2, 1fr)',
                gap: '8px'
              }}>
                {(viewDate !== null && pastDayData?.checklistItems ? pastDayData?.checklistItems : checklistItems).map((item, i) => {
                  const freq = item.frequency || 'daily'
                  const isMultiple = freq === 'multiple'
                  const isWeekly = freq === 'weekly'
                  const count = item.count || 0
                  const target = item.targetCount || 1
                  const isDone = isMultiple ? count >= target : item.checked
                  return (
                    <button
                      key={i}
                      onClick={() => viewDate !== null ? togglePastChecklistItem(i) : toggleChecklistItem(i)}
                      style={{
                        padding: '14px 14px',
                        backgroundColor: isDone ? 'rgba(10,132,255,0.08)' : T.card,
                        border: '1px solid',
                        borderColor: isDone ? '#0A84FF' : '#2C2C2C',
                        borderRadius: '14px',
                        color: isDone ? '#0A84FF' : '#888888',
                        fontSize: '13px',
                        fontWeight: '500',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        boxShadow: isDone ? '0 2px 8px rgba(0,0,0,0.08)' : '0 1px 2px rgba(0,0,0,0.04)'
                      }}
                    >
                      {isMultiple ? (
                        <div style={{
                          minWidth: '32px',
                          height: '18px',
                          borderRadius: '9px',
                          backgroundColor: isDone ? '#0A84FF' : count > 0 ? '#e8f4f4' : '#f0f0f0',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '10px',
                          fontWeight: '600',
                          color: isDone ? '#fff' : count > 0 ? '#0A84FF' : '#666666',
                          flexShrink: 0,
                          padding: '0 4px'
                        }}>
                          {count}/{target}
                        </div>
                      ) : (
                        <div style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '50%',
                          border: isDone ? 'none' : '2px solid #d0d0d0',
                          backgroundColor: isDone ? '#0A84FF' : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#1A1A1A',
                          fontSize: '10px',
                          flexShrink: 0
                        }}>
                          {isDone && '✓'}
                        </div>
                      )}
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                        {item.name}
                      </span>
                      {isWeekly && (
                        <span style={{ fontSize: '9px', fontWeight: '600', color: T.faint, backgroundColor: T.card2, borderRadius: '4px', padding: '1px 4px', flexShrink: 0 }}>
                          W
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Water Tracker */}
        {waterButtons.length > 0 && (
          <div style={{ marginBottom: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
                background: 'rgba(10,132,255,0.12)', border: '1px solid rgba(10,132,255,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}><DropletIcon size={17} color="#0A84FF" strokeWidth={2} /></div>
              <h2 style={{
                margin: 0, fontSize: '13px', fontWeight: '700', color: T.muted,
                textTransform: 'uppercase', letterSpacing: '2px', fontFamily: "'Barlow Condensed', sans-serif"
              }}>Hydration</h2>
            </div>
            <div style={{
              background: 'linear-gradient(145deg,' + T.card + ' 0%,' + T.card2 + ' 100%)',
              borderRadius: '18px',
              padding: '20px 16px',
              border: `1px solid ${T.border}`,
              boxShadow: 'none'
            }}>
              {(() => {
                // Determine which data to display (past day or today)
                const displayWater = viewDate !== null && pastDayData
                  ? pastDayData.water
                  : water
                const displayWaterHistory = viewDate !== null && pastDayData
                  ? pastDayData.waterHistory
                  : waterHistory

                return (
                  <>
              <div style={{
                display: 'flex',
                gap: '24px',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '20px'
              }}>
                {/* Water Bottle Visualization */}
                {waterGoal > 0 && (() => {
                  const fillPercent = Math.min(displayWater / waterGoal, 1)
                  // Bottle body goes from y=30 (top) to y=190 (bottom) = 160 fillable units
                  const bottleBottom = 190
                  const fillableHeight = 160
                  const waterHeight = fillPercent * fillableHeight
                  const waterTop = bottleBottom - waterHeight
                  const isFull = fillPercent >= 1
                  return (
                    <WaterBottle
                      waterTop={waterTop}
                      waterHeight={waterHeight}
                      water={displayWater}
                      fillPercent={fillPercent}
                      isFull={isFull}
                    />
                  )
                })()}

                {/* Stats */}
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    fontSize: '52px',
                    fontWeight: '900',
                    color: T.text,
                    marginBottom: '2px',
                    letterSpacing: '-1px',
                    fontFamily: "'Barlow Condensed', sans-serif"
                  }}>
                    {displayWater}
                  </div>
                  <div style={{
                    fontSize: '12px',
                    color: T.muted,
                    fontWeight: '500',
                    letterSpacing: '0.5px',
                    marginBottom: waterGoal > 0 ? '4px' : '0'
                  }}>
                    oz consumed
                  </div>
                  {waterGoal > 0 && (
                    <div style={{
                      fontSize: '12px',
                      color: T.muted,
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
                      padding: '12px 18px',
                      backgroundColor: T.card2,
                      border: `1px solid ${T.border}`,
                      borderRadius: '12px',
                      color: T.text,
                      fontSize: '15px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      minWidth: '60px'
                    }}
                  >
                    +{amount}
                  </button>
                ))}
              </div>
              {displayWaterHistory.length > 0 && (
                <div style={{ textAlign: 'center' }}>
                  <button onClick={undoWater} style={{
                    padding: '6px 12px',
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: T.faint,
                    fontSize: '12px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    textDecoration: 'underline'
                  }}>
                    Undo
                  </button>
                </div>
              )}
                  </>
                )
              })()}
            </div>
          </div>
        )}

        {/* Nutrition Totals */}
        {nutritionMetrics.length > 0 && (
          <div style={{ marginBottom: '28px' }}>
            {(() => {
              // Determine which data to display (past day or today)
              const displayNutritionMetrics = viewDate !== null && pastDayData
                ? pastDayData.nutritionMetrics
                : nutritionMetrics
              const displayNutritionHistory = viewDate !== null && pastDayData
                ? pastDayData.nutritionHistory
                : nutritionHistory

              return (
                <>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
                  background: 'rgba(48,209,88,0.12)', border: '1px solid rgba(48,209,88,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}><LeafIcon size={17} color="#30D158" strokeWidth={2} /></div>
                <h2 style={{
                  margin: 0, fontSize: '13px', fontWeight: '700', color: T.muted,
                  textTransform: 'uppercase', letterSpacing: '2px', fontFamily: "'Barlow Condensed', sans-serif"
                }}>Nutrition</h2>
              </div>
              {displayNutritionHistory.length > 0 && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={undoNutrition} style={{
                    padding: '5px 12px',
                    backgroundColor: 'transparent',
                    border: `1px solid ${T.border}`,
                    borderRadius: '20px',
                    color: T.muted,
                    fontSize: '11px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    letterSpacing: '0.3px'
                  }}>
                    Undo
                  </button>
                  <button onClick={() => setShowNutritionLog(!showNutritionLog)} style={{
                    padding: '5px 12px',
                    backgroundColor: showNutritionLog ? 'rgba(10,132,255,0.12)' : 'transparent',
                    border: `1px solid ${showNutritionLog ? 'rgba(10,132,255,0.4)' : T.border}`,
                    borderRadius: '20px',
                    color: showNutritionLog ? '#0A84FF' : T.muted,
                    fontSize: '11px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    letterSpacing: '0.3px'
                  }}>
                    {showNutritionLog ? 'Hide Log' : 'Log'}
                  </button>
                </div>
              )}
            </div>

            {/* Nutrition Entry Log */}
            {showNutritionLog && displayNutritionHistory.length > 0 && (
              <div style={{
                marginBottom: '12px',
                backgroundColor: T.card,
                border: `1px solid ${T.border}`,
                borderRadius: '14px',
                overflow: 'hidden'
              }}>
                <div style={{
                  padding: '10px 14px',
                  backgroundColor: T.bg,
                  borderBottom: `1px solid ${T.border}`,
                  fontSize: '11px',
                  fontWeight: '600',
                  color: T.muted,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Today&apos;s Entries ({displayNutritionHistory.length})
                </div>
                {[...displayNutritionHistory].reverse().map((entry, reverseIdx) => {
                  const entryIndex = displayNutritionHistory.length - 1 - reverseIdx
                  const time = new Date(entry.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

                  // Named/unnamed manual consolidated entry
                  if (entry.type === 'manual_named' || entry.type === 'manual_unnamed') {
                    const valuesList = Object.entries(entry.values).map(([key, value]) => {
                      const metric = displayNutritionMetrics.find(m => m.key === key)
                      return metric ? `${metric.name}: +${value}${metric.unit ? ` ${metric.unit}` : ''}` : null
                    }).filter(Boolean)

                    return (
                      <div key={entryIndex} style={{
                        padding: '10px 14px',
                        borderBottom: reverseIdx < displayNutritionHistory.length - 1 ? `1px solid ${T.border}` : 'none',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {entry.type === 'manual_named' && (
                            <div style={{
                              fontWeight: '600',
                              color: T.text,
                              fontSize: '13px',
                              marginBottom: '2px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}>
                              {entry.name}
                            </div>
                          )}
                          <div style={{
                            fontSize: '12px',
                            color: entry.type === 'manual_named' ? '#888888' : '#FFFFFF',
                            fontWeight: entry.type === 'manual_named' ? '400' : '500',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            {valuesList.join(', ')}
                          </div>
                          <div style={{ fontSize: '11px', color: T.muted, marginTop: '2px' }}>
                            Manual <span style={{ marginLeft: '6px' }}>{time}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => removeNutritionEntry(entryIndex)}
                          style={{
                            padding: '4px 10px',
                            backgroundColor: 'rgba(255,69,58,0.1)',
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
                  }

                  let description = ''
                  let entryType = 'Manual'
                  if (entry.estimates) {
                    // AI batch entry (new format)
                    entryType = 'AI Estimate'
                    const parts = displayNutritionMetrics
                      .filter(m => entry.estimates[m.key])
                      .map(m => `${m.name}: ${entry.estimates[m.key]}${m.unit ? ` ${m.unit}` : ''}`)
                    description = parts.join(', ')
                  } else if (entry.metricIndex !== undefined) {
                    // Single metric entry
                    const metric = displayNutritionMetrics[entry.metricIndex]
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
                      borderBottom: reverseIdx < displayNutritionHistory.length - 1 ? `1px solid ${T.border}` : 'none',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: '13px',
                          color: T.text,
                          fontWeight: '500',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}>
                          {entryType}
                          <span style={{ color: T.muted, fontWeight: '400', fontSize: '11px' }}>{time}</span>
                          {entry.score && (() => {
                            const g = entry.score.grade?.charAt(0)
                            const c = g === 'A' ? '#30D158' : g === 'B' ? '#0A84FF' : g === 'C' ? '#FF9F0A' : '#FF453A'
                            return (
                              <span style={{
                                fontSize: '10px', fontWeight: '700', color: c,
                                backgroundColor: c + '20', border: `1px solid ${c}50`,
                                borderRadius: '4px', padding: '1px 5px', flexShrink: 0,
                              }}>
                                {entry.score.grade}
                              </span>
                            )
                          })()}
                        </div>
                        <div style={{
                          fontSize: '12px',
                          color: T.muted,
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
                          backgroundColor: 'rgba(255,69,58,0.1)',
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
              gridTemplateColumns: displayNutritionMetrics.length === 1 ? '1fr' : 'repeat(2, 1fr)',
              gap: '8px'
            }}>
              {displayNutritionMetrics.map((metric, i) => {
                const goalType = metric.goalType || 'min'
                const value = metric.value || 0
                const goal = metric.goal || 0
                const goalMax = metric.goalMax || 0
                const isEditing = editingMetric === i

                // Calculate progress and colors based on goal type
                let progress = 0
                let fillColor = 'rgba(10,132,255,0.10)'
                let statusColor = T.muted
                let goalLabel = ''

                if (goal > 0) {
                  if (goalType === 'min') {
                    progress = Math.min(value / goal * 100, 100)
                    fillColor = progress >= 100 ? 'rgba(48,209,88,0.12)' : 'rgba(10,132,255,0.10)'
                    statusColor = progress >= 100 ? '#30D158' : T.muted
                    goalLabel = `Goal: ${goal}+`
                  } else if (goalType === 'max') {
                    progress = Math.min(value / goal * 100, 100)
                    const ratio = value / goal
                    if (ratio > 1) {
                      fillColor = 'rgba(255,69,58,0.12)'
                      statusColor = '#FF453A'
                    } else if (ratio > 0.8) {
                      fillColor = 'rgba(255,159,10,0.12)'
                      statusColor = '#FF9F0A'
                    } else {
                      fillColor = 'rgba(48,209,88,0.12)'
                      statusColor = '#30D158'
                    }
                    goalLabel = `Limit: ${goal}`
                  } else if (goalType === 'range' && goalMax > 0) {
                    progress = Math.min(value / goalMax * 100, 100)
                    if (value >= goal && value <= goalMax) {
                      fillColor = 'rgba(48,209,88,0.12)'
                      statusColor = '#30D158'
                    } else if (value < goal) {
                      fillColor = 'rgba(10,132,255,0.10)'
                      statusColor = T.muted
                    } else {
                      fillColor = 'rgba(255,69,58,0.12)'
                      statusColor = '#FF453A'
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
                    padding: '18px',
                    backgroundColor: T.card,
                    border: isEditing ? '1px solid #0A84FF' : `1px solid ${T.border}`,
                    borderRadius: '16px',
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
                          fontSize: '12px',
                          color: T.muted,
                          fontWeight: '600',
                          letterSpacing: '1.5px',
                          textTransform: 'uppercase',
                          fontFamily: "'Barlow Condensed', sans-serif"
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
                              color: T.text,
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
                              flex: 1, padding: '8px', backgroundColor: '#30D158', border: 'none',
                              borderRadius: '8px', color: '#0D0D0D', fontSize: '12px', fontWeight: '700', cursor: 'pointer', letterSpacing: '0.3px'
                            }}>Save</button>
                            <button onClick={() => { setEditingMetric(null); setEditMetricValue('') }} style={{
                              flex: 1, padding: '8px', backgroundColor: 'transparent', border: `1px solid ${T.border}`,
                              borderRadius: '8px', color: T.muted, fontSize: '12px', fontWeight: '600', cursor: 'pointer'
                            }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div style={{
                            fontSize: '32px',
                            fontWeight: '900',
                            color: T.text,
                            fontFamily: "'Barlow Condensed', sans-serif",
                            letterSpacing: '-0.5px'
                          }}>
                            {value}
                            {metric.unit && <span style={{ fontSize: '14px', color: T.muted, fontWeight: '500' }}> {metric.unit}</span>}
                          </div>
                          {goal > 0 && (
                            <div style={{
                              marginTop: '4px',
                              fontSize: '11px',
                              color: T.muted,
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
                </>
              )
            })()}
          </div>
        )}

        {/* Quick Add — meal buttons only when configured; custom entry always shown */}
        {(meals.some(m => m) || nutritionMetrics.length > 0) && <div style={{ marginBottom: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
              background: 'rgba(255,159,10,0.12)', border: '1px solid rgba(255,159,10,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}><ZapIcon size={17} color="#FF9F0A" strokeWidth={2} /></div>
            <h2 style={{
              margin: 0, fontSize: '13px', fontWeight: '700', color: T.muted,
              textTransform: 'uppercase', letterSpacing: '2px', fontFamily: "'Barlow Condensed', sans-serif"
            }}>Quick Add</h2>
          </div>
          {meals.some(m => m) && <div style={{
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
                    backgroundColor: T.card,
                    border: `1px solid ${T.border}`,
                    borderRadius: '14px',
                    color: T.text,
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
                      color: T.text,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {meal.name}
                    </div>
                  </div>
                  <div style={{
                    fontSize: '11px',
                    color: T.faint,
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
          </div>}

          {/* Custom Entry */}
          {nutritionMetrics.length > 0 && (
            <div style={{
              padding: '16px',
              backgroundColor: T.card,
              border: `1px solid ${T.border}`,
              borderRadius: '14px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
            }}>
              <div style={{
                fontSize: '12px',
                color: T.faint,
                marginBottom: '12px',
                fontWeight: '500',
                letterSpacing: '0.5px'
              }}>
                Custom Entry
              </div>
              {/* Optional entry name */}
              <input
                type="text"
                placeholder="Entry name (optional, e.g., 'Chicken Breast')"
                value={customEntryName}
                onChange={(e) => setCustomEntryName(e.target.value)}
                maxLength={50}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  fontSize: '14px',
                  borderRadius: '10px',
                  border: `1px solid ${T.border}`,
                  marginBottom: '12px',
                  backgroundColor: T.bg,
                  color: T.text,
                  boxSizing: 'border-box'
                }}
              />
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
                      backgroundColor: T.bg,
                      border: `1px solid ${T.border}`,
                      borderRadius: '8px',
                      color: T.text,
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
                padding: '12px',
                background: 'linear-gradient(90deg, #0A84FF, #5856D6)',
                border: 'none',
                borderRadius: '10px',
                color: '#fff',
                fontSize: '14px',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.15s',
                letterSpacing: '0.5px',
                fontFamily: "'Barlow Condensed', sans-serif",
                boxShadow: '0 2px 12px rgba(10,132,255,0.35)'
              }}>
                ADD ENTRY
              </button>
            </div>
          )}
        </div>}

        {/* Empty State Message */}
        {checklistItems.length === 0 && nutritionMetrics.length === 0 && waterButtons.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: '60px 24px',
            background: 'linear-gradient(145deg,#0a0f1e 0%,#111827 55%,#0d0d0d 100%)',
            borderRadius: '22px',
            border: `1px solid ${T.border}`,
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: '50%', background: 'radial-gradient(circle,rgba(10,132,255,0.09) 0%,transparent 70%)', pointerEvents: 'none' }}/>
            <div style={{
              marginBottom: '16px',
              display: 'flex', justifyContent: 'center'
            }}>
              <BarChartIcon size={52} color="rgba(10,132,255,0.4)" strokeWidth={1.25} />
            </div>
            <div style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: '28px',
              fontWeight: '900',
              color: T.text,
              letterSpacing: '1px',
              marginBottom: '8px'
            }}>
              READY TO TRACK
            </div>
            <div style={{
              fontSize: '14px',
              color: T.muted,
              marginBottom: '28px',
              lineHeight: '1.5'
            }}>
              Configure your tracker to get started
            </div>
            <button
              onClick={() => setShowSettings(true)}
              style={{
                padding: '12px 28px',
                background: 'linear-gradient(90deg, #0A84FF, #5856D6)',
                border: 'none',
                borderRadius: '14px',
                color: '#fff',
                fontSize: '15px',
                fontWeight: '700',
                cursor: 'pointer',
                fontFamily: "'Barlow Condensed', sans-serif",
                letterSpacing: '1px',
                boxShadow: '0 4px 20px rgba(10,132,255,0.35)'
              }}
            >
              OPEN YOUR GOALS
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
          eveningCutoff={eveningCutoff}
          onSaveChecklist={saveChecklistItems}
          onSaveNutrition={saveNutritionMetrics}
          onSaveWater={saveWaterButtons}
          onSaveWaterGoal={saveWaterGoal}
          onSaveEveningCutoff={saveEveningCutoff}
          onSaveMeals={saveMeals}
          onResetDay={resetDay}
          onClose={() => setShowSettings(false)}
          settingsTab={settingsTab}
          setSettingsTab={setSettingsTab}
          darkMode={darkMode}
          onToggleTheme={toggleTheme}
          onSignOut={async () => {
            setSigningOut(true)
            try {
              await saveTodayData(user.uid, { date: new Date().toDateString(), checklistItems, nutritionMetrics, water, waterHistory, nutritionHistory })
              await signOut()
            } catch(e) { console.error(e) }
            localStorage.removeItem('nutrition-data')
            localStorage.removeItem('nutrition-history')
            localStorage.removeItem('firebase-migrated')
            setSigningOut(false)
            setShowSettings(false)
          }}
        />
      )}

      {/* AI Chat Modal */}
      {showChat && (
        <AIChatModal
          messages={chatMessages}
          input={chatInput}
          pendingImage={chatImage}
          isThinking={isThinking}
          metrics={nutritionMetrics}
          viewDate={viewDate}
          onInputChange={setChatInput}
          onImageSelect={setChatImage}
          onImageClear={() => setChatImage(null)}
          onSend={sendChatMessage}
          onAddEstimates={addEstimatedNutrition}
          onBarcodeResult={handleBarcodeResult}
          onClose={() => setShowChat(false)}
        />
      )}
    </div>
    </ThemeContext.Provider>
  )
}

// Greeting helper
function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'GOOD MORNING'
  if (h < 17) return 'GOOD AFTERNOON'
  return 'GOOD EVENING'
}

// Circular progress ring (mirrors workout platform)
function ProgressRing({ pct = 0, size = 52, sw = 4, color = '#0A84FF' }) {
  const r = (size - sw) / 2
  const circ = 2 * Math.PI * r
  const dash = circ - (pct / 100) * circ
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={sw}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={sw}
          strokeDasharray={circ} strokeDashoffset={dash} strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 4px ${color}99)`, transition: 'stroke-dashoffset 0.6s ease' }}/>
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 13, color: '#fff', lineHeight: 1 }}>{pct}%</span>
      </div>
    </div>
  )
}

// Water Bottle Component — redesigned with gradient fill, glass shine, level marks, adaptive color
function WaterBottle({ waterTop, waterHeight, water, fillPercent, isFull }) {
  const T = useContext(ThemeContext)
  const [showWaves, setShowWaves] = useState(true)
  const [displayedWaterTop, setDisplayedWaterTop] = useState(waterTop)

  useEffect(() => {
    setShowWaves(false)
    const timer = setTimeout(() => {
      setDisplayedWaterTop(waterTop)
      setShowWaves(true)
    }, 1600)
    return () => clearTimeout(timer)
  }, [water])

  // Adaptive colors based on fill level
  const waterTop2  = isFull ? '#5ced8a' : fillPercent > 0.6 ? '#5ac8fa' : '#93c5fd'
  const waterBot   = isFull ? '#20b857' : fillPercent > 0.6 ? '#0A84FF' : '#3b82f6'
  const outlineClr = isFull ? 'rgba(48,209,88,0.7)' : 'rgba(255,255,255,0.14)'
  const glowClr    = isFull ? 'rgba(48,209,88,0.18)' : 'rgba(10,132,255,0.12)'

  // Bottle shape path (same coordinate space as parent calculations)
  const BOTTLE = "M 46 22 L 46 12 Q 46 5 60 5 Q 74 5 74 12 L 74 22 Q 86 27 88 38 L 88 182 Q 88 192 76 192 L 44 192 Q 32 192 32 182 L 32 38 Q 34 27 46 22 Z"

  return (
    <div style={{ textAlign: 'center', position: 'relative', display: 'inline-block' }}>
      <style>{`
        @keyframes waveScroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-40px); }
        }
        @keyframes waveScroll2 {
          0%   { transform: translateX(0); }
          100% { transform: translateX(40px); }
        }
      `}</style>

      {/* Outer glow — grows with fill, blooms green when full */}
      {water > 0 && (
        <div style={{
          position: 'absolute',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '110px', height: '190px',
          borderRadius: '50%',
          background: `radial-gradient(ellipse, ${glowClr} 0%, transparent 70%)`,
          pointerEvents: 'none',
          transition: 'background 1s ease'
        }}/>
      )}

      <svg
        width="88"
        height="160"
        viewBox="0 0 120 200"
        style={{ display: 'block', margin: '0 auto', overflow: 'visible' }}
      >
        <defs>
          <clipPath id="bottleClip">
            <path d={BOTTLE}/>
          </clipPath>
          {/* Gradient for water fill — bottom-to-top */}
          <linearGradient id="waterGrad" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%"   stopColor={waterBot} stopOpacity="1"/>
            <stop offset="100%" stopColor={waterTop2} stopOpacity="0.85"/>
          </linearGradient>
          {/* Glass gloss overlay */}
          <linearGradient id="glassGloss" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%"   stopColor="rgba(255,255,255,0.07)"/>
            <stop offset="100%" stopColor="rgba(255,255,255,0)"/>
          </linearGradient>
        </defs>

        {/* Bottle background (dark, subtle) */}
        <path d={BOTTLE} fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5"/>

        {/* Water fill clipped to bottle */}
        {water > 0 && (
          <g clipPath="url(#bottleClip)">
            {/* Main water body */}
            <rect
              x="28" y={waterTop + 3} width="64" height={200 - waterTop}
              fill="url(#waterGrad)"
              style={{ transition: 'y 1.5s ease-out, height 1.5s ease-out' }}
            />

            {/* Primary wave */}
            {showWaves && (
              <g style={{ animation: 'waveScroll 3s linear infinite' }}>
                <path
                  d={`M -10 ${displayedWaterTop + 3}
                      Q 0  ${displayedWaterTop - 3}, 10 ${displayedWaterTop + 3}
                      T 30 ${displayedWaterTop + 3}
                      T 50 ${displayedWaterTop + 3}
                      T 70 ${displayedWaterTop + 3}
                      T 90 ${displayedWaterTop + 3}
                      T 110 ${displayedWaterTop + 3}
                      T 130 ${displayedWaterTop + 3}
                      L 130 ${displayedWaterTop + 14}
                      L -10 ${displayedWaterTop + 14} Z`}
                  fill={waterTop2}
                  opacity="0.6"
                />
              </g>
            )}

            {/* Secondary wave (opposite direction, slower) */}
            {showWaves && (
              <g style={{ animation: 'waveScroll2 4.5s linear infinite' }}>
                <path
                  d={`M -10 ${displayedWaterTop + 7}
                      Q 5  ${displayedWaterTop + 2}, 20 ${displayedWaterTop + 7}
                      T 50 ${displayedWaterTop + 7}
                      T 80 ${displayedWaterTop + 7}
                      T 110 ${displayedWaterTop + 7}
                      T 140 ${displayedWaterTop + 7}
                      L 140 ${displayedWaterTop + 16}
                      L -10 ${displayedWaterTop + 16} Z`}
                  fill={waterBot}
                  opacity="0.4"
                />
              </g>
            )}

            {/* Inner shine strip — left side */}
            <rect
              x="37" y={waterTop + 10} width="5" height={Math.max(waterHeight - 20, 0)}
              fill="rgba(255,255,255,0.22)" rx="2.5"
              style={{ transition: 'y 1.5s ease-out, height 1.5s ease-out' }}
            />
          </g>
        )}

        {/* Bottle outline — adaptive color */}
        <path
          d={BOTTLE} fill="none"
          stroke={outlineClr} strokeWidth="1.8"
          style={{ transition: 'stroke 0.8s ease' }}
        />

        {/* Glass gloss overlay (always on top) */}
        <path d={BOTTLE} fill="url(#glassGloss)"/>

        {/* Left-edge shine streak */}
        <path
          d="M 38 42 Q 37 110 38 175"
          fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="4" strokeLinecap="round"
        />

        {/* Fill-level tick marks (right side, at 25 / 50 / 75%) */}
        {[
          { pct: 0.25, y: 182 - 0.25 * 160 },
          { pct: 0.50, y: 182 - 0.50 * 160 },
          { pct: 0.75, y: 182 - 0.75 * 160 },
        ].map(({ pct, y }) => (
          <line
            key={pct}
            x1="82" y1={y} x2="87" y2={y}
            stroke={fillPercent >= pct ? outlineClr : 'rgba(255,255,255,0.1)'}
            strokeWidth="1.5" strokeLinecap="round"
            style={{ transition: 'stroke 0.8s ease' }}
          />
        ))}

        {/* Cap */}
        <rect x="47" y="3" width="26" height="9" rx="3"
          fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.2)" strokeWidth="1"/>
        <rect x="50" y="5" width="20" height="5" rx="2" fill="rgba(255,255,255,0.06)"/>
      </svg>

      {/* Percentage label */}
      <div style={{
        marginTop: '6px',
        fontSize: '12px',
        fontWeight: '700',
        fontFamily: "'Barlow Condensed', sans-serif",
        letterSpacing: '1.5px',
        color: isFull ? '#30D158' : water > 0 ? '#0A84FF' : '#3A3A3A',
        transition: 'color 0.8s ease'
      }}>
        {water > 0 ? `${Math.round(fillPercent * 100)}%${isFull ? ' ✓' : ''}` : '—'}
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
  eveningCutoff,
  onSaveChecklist,
  onSaveNutrition,
  onSaveWater,
  onSaveWaterGoal,
  onSaveEveningCutoff,
  onSaveMeals,
  onResetDay,
  onClose,
  settingsTab,
  setSettingsTab,
  darkMode,
  onToggleTheme,
  onSignOut
}) {
  const T = useContext(ThemeContext)
  const [tempChecklist, setTempChecklist] = useState([...checklistItems])
  const [tempMetrics, setTempMetrics] = useState([...nutritionMetrics])
  const [tempWater, setTempWater] = useState([...waterButtons])
  const [tempWaterGoal, setTempWaterGoal] = useState(waterGoal)
  const [tempMeals, setTempMeals] = useState([...meals])
  const contentRef = useRef(null)

  useEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0
  }, [settingsTab])

  const addChecklistItem = () => {
    setTempChecklist([...tempChecklist, { name: '', checked: false, frequency: 'daily', targetCount: 1 }])
  }

  const updateChecklistItem = (index, field, value) => {
    const updated = [...tempChecklist]
    updated[index] = { ...updated[index], [field]: value }
    setTempChecklist(updated)
  }

  const removeChecklistItem = (index) => {
    setTempChecklist(tempChecklist.filter((_, i) => i !== index))
  }

  const moveChecklistItem = (index, direction) => {
    const newIndex = index + direction
    if (newIndex < 0 || newIndex >= tempChecklist.length) return
    const updated = [...tempChecklist]
    const temp = updated[index]
    updated[index] = updated[newIndex]
    updated[newIndex] = temp
    setTempChecklist(updated)
  }

  const addNutritionMetric = (preset = null) => {
    const newMetric = preset
      ? { ...preset, value: 0 }
      : { name: '', key: '', unit: '', value: 0, goal: 0, goalType: 'min', goalMax: 0, icon: '📊' }
    setTempMetrics([...tempMetrics, newMetric])
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
        backgroundColor: T.card,
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
          borderBottom: `1px solid ${T.border}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h2 style={{
            margin: 0,
            fontSize: '18px',
            fontWeight: '600',
            color: T.text,
            letterSpacing: '-0.3px'
          }}>
            Your Goals
          </h2>
          <button
            onClick={onClose}
            style={{
              padding: '6px 14px',
              backgroundColor: T.card2,
              border: 'none',
              borderRadius: '6px',
              color: T.muted,
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
          borderBottom: `1px solid ${T.border}`,
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch'
        }}>
          {[
            { id: 'checklist', label: 'Habits' },
            { id: 'nutrition', label: 'Nutrition' },
            { id: 'water', label: 'Water' },
            { id: 'meals', label: 'Meals' },
            { id: 'feedback', label: 'Feedback' },
            { id: 'appSettings', label: '⚙️ Settings' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setSettingsTab(tab.id)}
              style={{
                padding: '8px 14px',
                backgroundColor: 'transparent',
                border: 'none',
                borderBottom: settingsTab === tab.id ? '2px solid #0A84FF' : '2px solid transparent',
                color: settingsTab === tab.id ? '#0A84FF' : '#666666',
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
        <div ref={contentRef} style={{
          flex: 1,
          overflow: 'auto',
          padding: '20px 16px',
          backgroundColor: T.bg
        }}>
          <div>
          {settingsTab === 'checklist' && (
            <ChecklistSettings
              items={tempChecklist}
              onAdd={addChecklistItem}
              onUpdate={updateChecklistItem}
              onRemove={removeChecklistItem}
              onMove={moveChecklistItem}
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
            <>
              <WaterSettings
                buttons={tempWater}
                goal={tempWaterGoal}
                onGoalChange={setTempWaterGoal}
                onAdd={addWaterButton}
                onUpdate={updateWaterButton}
                onRemove={removeWaterButton}
                onMove={moveWaterButton}
              />
              {/* Evening cutoff reminder setting */}
              <div style={{
                marginTop: '20px',
                padding: '16px',
                backgroundColor: T.card,
                borderRadius: '10px',
                border: `1px solid ${T.border}`
              }}>
                <div style={{ fontSize: '13px', fontWeight: '600', color: T.text, marginBottom: '4px' }}>
                  Evening reminder cutoff
                </div>
                <div style={{ fontSize: '12px', color: T.faint, marginBottom: '10px' }}>
                  If no entries are logged after this time, you'll be reminded the next morning.
                </div>
                <select
                  value={eveningCutoff}
                  onChange={e => onSaveEveningCutoff(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: `1px solid ${T.border}`,
                    borderRadius: '8px',
                    fontSize: '14px',
                    color: T.text,
                    backgroundColor: T.card,
                    cursor: 'pointer'
                  }}
                >
                  <option value="18:00">6:00 PM</option>
                  <option value="18:30">6:30 PM</option>
                  <option value="19:00">7:00 PM</option>
                  <option value="19:30">7:30 PM (default)</option>
                  <option value="20:00">8:00 PM</option>
                  <option value="20:30">8:30 PM</option>
                  <option value="21:00">9:00 PM</option>
                </select>
              </div>
            </>
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

          {settingsTab === 'appSettings' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Appearance */}
              <div style={{ backgroundColor: T.card, border: `1px solid ${T.border}`, borderRadius: '12px', overflow: 'hidden' }}>
                <div style={{ padding: '14px 16px', borderBottom: `1px solid ${T.border}` }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: T.muted, letterSpacing: '1.5px' }}>APPEARANCE</div>
                </div>
                <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: T.text }}>
                      {darkMode ? '🌙 Dark Mode' : '☀️ Light Mode'}
                    </div>
                    <div style={{ fontSize: '12px', color: T.muted, marginTop: '2px' }}>
                      {darkMode ? 'Switch to light theme' : 'Switch to dark theme'}
                    </div>
                  </div>
                  <button
                    onClick={onToggleTheme}
                    style={{
                      width: '52px', height: '30px', borderRadius: '15px', border: 'none', cursor: 'pointer',
                      backgroundColor: darkMode ? '#0A84FF' : T.card2,
                      position: 'relative', transition: 'background-color 0.2s',
                      boxShadow: darkMode ? '0 0 10px rgba(10,132,255,0.4)' : 'none',
                    }}
                  >
                    <div style={{
                      position: 'absolute', top: '3px',
                      left: darkMode ? '25px' : '3px',
                      width: '24px', height: '24px', borderRadius: '50%',
                      backgroundColor: '#fff', transition: 'left 0.2s',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                    }} />
                  </button>
                </div>
              </div>

              {/* Account */}
              {user && (
                <div style={{ backgroundColor: T.card, border: `1px solid ${T.border}`, borderRadius: '12px', overflow: 'hidden' }}>
                  <div style={{ padding: '14px 16px', borderBottom: `1px solid ${T.border}` }}>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: T.muted, letterSpacing: '1.5px' }}>ACCOUNT</div>
                  </div>
                  <div style={{ padding: '14px 16px', borderBottom: `1px solid ${T.border}` }}>
                    <div style={{ fontSize: '11px', color: T.muted, marginBottom: '2px' }}>Signed in as</div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: T.text }}>{user.email}</div>
                  </div>
                  <button
                    onClick={onSignOut}
                    style={{
                      width: '100%', padding: '14px 16px', backgroundColor: 'transparent',
                      border: 'none', color: '#ef4444', fontSize: '14px', fontWeight: '600',
                      cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px'
                    }}
                  >
                    <span>🚪</span> Sign Out
                  </button>
                </div>
              )}
            </div>
          )}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 20px',
          borderTop: `1px solid ${T.border}`,
          backgroundColor: T.card,
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
              backgroundColor: T.card2,
              border: 'none',
              borderRadius: '8px',
              color: T.muted,
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
              backgroundColor: '#0A84FF',
              border: 'none',
              borderRadius: '8px',
              color: '#1A1A1A',
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
  const T = useContext(ThemeContext)
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
      <div style={{ textAlign: 'center', padding: '32px 16px', color: T.faint }}>
        <div style={{ fontSize: '32px', marginBottom: '12px' }}>💬</div>
        <div style={{ fontSize: '14px', fontWeight: '500', color: T.muted }}>Sign in to send feedback</div>
        <div style={{ fontSize: '12px', marginTop: '4px' }}>
          Create an account to report bugs or request features.
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: T.muted, marginBottom: '8px' }}>
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
                backgroundColor: type === t.id ? '#0A84FF' : '#1A1A1A',
                border: '1px solid',
                borderColor: type === t.id ? '#0A84FF' : '#2C2C2C',
                borderRadius: '8px',
                color: type === t.id ? '#fff' : '#888888',
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
        <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: T.muted, marginBottom: '6px' }}>
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
            backgroundColor: T.card,
            border: `1px solid ${T.border}`,
            borderRadius: '8px',
            color: T.text,
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
          backgroundColor: 'rgba(48,209,88,0.1)',
          border: '1px solid #bbf7d0',
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '16px',
          color: '#30D158',
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
          backgroundColor: message.trim() && !sending ? '#0A84FF' : '#2C2C2C',
          border: 'none',
          borderRadius: '8px',
          color: message.trim() && !sending ? '#fff' : '#666666',
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

// Notification banner for resolved feedback
function NotificationBanner({ notification, onDismiss }) {
  const T = useContext(ThemeContext)
  const getNotificationContent = (notif) => {
    if (notif.type === 'feedback_resolved') {
      const typeLabel = notif.feedbackType === 'bug' ? 'bug report' :
                        notif.feedbackType === 'feature' ? 'feature request' : 'feedback'
      const truncatedMessage = notif.feedbackMessage.length > 60
        ? notif.feedbackMessage.substring(0, 60) + '...'
        : notif.feedbackMessage
      return {
        icon: 'check',
        label: 'Resolved',
        message: `Thank you for reporting the ${typeLabel} "${truncatedMessage}". The problem has been addressed.`,
        colors: {
          bg: 'rgba(48,209,88,0.1)',
          border: 'rgba(48,209,88,0.35)',
          icon: '#16a34a',
          label: '#16a34a',
          text: '#30D158'
        }
      }
    }

    if (notif.type === 'announcement') {
      return {
        icon: 'sparkle',
        label: notif.title || 'NEW FEATURE',
        message: notif.message,
        colors: {
          bg: 'rgba(10,132,255,0.08)',
          border: 'rgba(10,132,255,0.35)',
          icon: '#0A84FF',
          label: '#0A84FF',
          text: T.text
        }
      }
    }

    return {
      icon: 'info',
      label: 'Notification',
      message: 'You have a new notification.',
      colors: {
        bg: 'rgba(10,132,255,0.08)',
        border: 'rgba(10,132,255,0.25)',
        icon: '#0A84FF',
        label: '#0A84FF',
        text: T.muted
      }
    }
  }

  const content = getNotificationContent(notification)

  return (
    <div style={{
      backgroundColor: content.colors.bg,
      border: `1px solid ${content.colors.border}`,
      borderRadius: '8px',
      padding: '12px 16px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: '12px',
      marginBottom: '12px'
    }}>
      <div style={{ flex: 1 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '4px'
        }}>
          <span style={{ display: 'flex', color: content.colors.icon }}>
            {content.icon === 'check' && <CheckCircleIcon size={16} color={content.colors.icon} strokeWidth={2} />}
            {content.icon === 'sparkle' && <SparklesIcon size={16} color={content.colors.icon} strokeWidth={2} />}
            {content.icon === 'info' && <InfoIcon size={16} color={content.colors.icon} strokeWidth={2} />}
          </span>
          <span style={{
            fontSize: '12px',
            fontWeight: '600',
            color: content.colors.label,
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            {content.label}
          </span>
        </div>
        <div style={{
          margin: 0,
          fontSize: '14px',
          color: content.colors.text,
          lineHeight: '1.5'
        }}>
          {content.message.split('\n').map((line, i, arr) =>
            line.trim() === ''
              ? <br key={i}/>
              : <p key={i} style={{ margin: i < arr.length - 1 ? '0 0 6px 0' : 0 }}>{line}</p>
          )}
        </div>
      </div>
      <button
        onClick={onDismiss}
        style={{
          background: 'transparent',
          border: 'none',
          color: content.colors.label,
          cursor: 'pointer',
          padding: '0 2px',
          lineHeight: '1',
          flexShrink: 0,
          display: 'flex', alignItems: 'center'
        }}
        aria-label="Dismiss notification"
      >
        <CloseIcon size={16} color={content.colors.label} strokeWidth={2} />
      </button>
    </div>
  )
}

// Checklist Settings Component
function ChecklistSettings({ items, onAdd, onUpdate, onRemove, onMove }) {
  const T = useContext(ThemeContext)
  return (
    <div>
      <div style={{ fontSize: '13px', color: T.muted, marginBottom: '16px' }}>
        Add daily habits to track
      </div>

      {items.map((item, i) => (
        <div key={i} style={{ marginBottom: '10px' }}>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            {/* Up/down reorder buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <button
                onClick={() => onMove(i, -1)}
                disabled={i === 0}
                style={{
                  padding: '2px 8px',
                  backgroundColor: i === 0 ? '#222222' : '#1A1A1A',
                  border: `1px solid ${T.border}`,
                  borderRadius: '4px',
                  color: i === 0 ? '#ccc' : '#888888',
                  fontSize: '10px',
                  cursor: i === 0 ? 'default' : 'pointer',
                  lineHeight: '1'
                }}
              >▲</button>
              <button
                onClick={() => onMove(i, 1)}
                disabled={i === items.length - 1}
                style={{
                  padding: '2px 8px',
                  backgroundColor: i === items.length - 1 ? '#222222' : '#1A1A1A',
                  border: `1px solid ${T.border}`,
                  borderRadius: '4px',
                  color: i === items.length - 1 ? '#ccc' : '#888888',
                  fontSize: '10px',
                  cursor: i === items.length - 1 ? 'default' : 'pointer',
                  lineHeight: '1'
                }}
              >▼</button>
            </div>
            <input
              type="text"
              value={item.name}
              onChange={(e) => onUpdate(i, 'name', e.target.value)}
              placeholder="Habit name"
              style={{
                flex: 1,
                minWidth: 0,
                padding: '10px 12px',
                backgroundColor: T.card,
                border: `1px solid ${T.border}`,
                borderRadius: '8px',
                color: T.text,
                fontSize: '16px',
                fontWeight: '500',
                boxSizing: 'border-box'
              }}
            />
            <button
              onClick={() => onRemove(i)}
              style={{
                padding: '10px 12px',
                backgroundColor: T.card2,
                border: 'none',
                borderRadius: '8px',
                color: T.faint,
                fontSize: '13px',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              ✕
            </button>
          </div>
          {/* Frequency row */}
          <div style={{ display: 'flex', gap: '6px', marginTop: '6px', paddingLeft: '36px', alignItems: 'center' }}>
            {[
              { id: 'daily', label: 'Daily' },
              { id: 'multiple', label: 'Multiple/day' },
              { id: 'weekly', label: 'Weekly' }
            ].map(opt => (
              <button
                key={opt.id}
                type="button"
                onClick={() => onUpdate(i, 'frequency', opt.id)}
                style={{
                  padding: '4px 8px',
                  backgroundColor: (item.frequency || 'daily') === opt.id ? '#0A84FF' : '#222222',
                  border: 'none',
                  borderRadius: '6px',
                  color: (item.frequency || 'daily') === opt.id ? '#fff' : '#888888',
                  fontSize: '11px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                {opt.label}
              </button>
            ))}
            {(item.frequency || 'daily') === 'multiple' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '4px' }}>
                <span style={{ fontSize: '11px', color: T.faint }}>×</span>
                <input
                  type="number"
                  min="2"
                  max="20"
                  value={item.targetCount || 2}
                  onChange={(e) => onUpdate(i, 'targetCount', Math.max(2, parseInt(e.target.value) || 2))}
                  style={{
                    width: '44px',
                    padding: '4px 6px',
                    border: `1px solid ${T.border}`,
                    borderRadius: '6px',
                    fontSize: '12px',
                    textAlign: 'center'
                  }}
                />
                <span style={{ fontSize: '11px', color: T.faint }}>times</span>
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
          backgroundColor: T.card,
          border: '1px dashed #d0d0d0',
          borderRadius: '8px',
          color: T.muted,
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

// ── Micronutrient preset definitions ──────────────────────────────────────────
const MICRONUTRIENT_PRESETS = {
  vitamins: [
    { key: 'vitaminA',   name: 'Vitamin A',   unit: 'mcg', goal: 700,  goalType: 'min', goalMax: 0, color: '#BF5AF2', icon: '💊' },
    { key: 'vitaminC',   name: 'Vitamin C',   unit: 'mg',  goal: 90,   goalType: 'min', goalMax: 0, color: '#FF9F0A', icon: '💊' },
    { key: 'vitaminD',   name: 'Vitamin D',   unit: 'mcg', goal: 20,   goalType: 'min', goalMax: 0, color: '#FFD60A', icon: '💊' },
    { key: 'vitaminE',   name: 'Vitamin E',   unit: 'mg',  goal: 15,   goalType: 'min', goalMax: 0, color: '#30D158', icon: '💊' },
    { key: 'vitaminK',   name: 'Vitamin K',   unit: 'mcg', goal: 120,  goalType: 'min', goalMax: 0, color: '#32D74B', icon: '💊' },
    { key: 'vitaminB1',  name: 'Thiamine (B1)',  unit: 'mg',  goal: 1.2,  goalType: 'min', goalMax: 0, color: '#64D2FF', icon: '💊' },
    { key: 'vitaminB2',  name: 'Riboflavin (B2)', unit: 'mg', goal: 1.3, goalType: 'min', goalMax: 0, color: '#5E5CE6', icon: '💊' },
    { key: 'vitaminB3',  name: 'Niacin (B3)', unit: 'mg',  goal: 16,   goalType: 'min', goalMax: 0, color: '#FF6B6B', icon: '💊' },
    { key: 'vitaminB5',  name: 'Pantothenic Acid (B5)', unit: 'mg', goal: 5, goalType: 'min', goalMax: 0, color: '#0A84FF', icon: '💊' },
    { key: 'vitaminB6',  name: 'Vitamin B6',  unit: 'mg',  goal: 1.7,  goalType: 'min', goalMax: 0, color: '#30B0C7', icon: '💊' },
    { key: 'biotin',     name: 'Biotin (B7)', unit: 'mcg', goal: 30,   goalType: 'min', goalMax: 0, color: '#BF5AF2', icon: '💊' },
    { key: 'folate',     name: 'Folate (B9)', unit: 'mcg', goal: 400,  goalType: 'min', goalMax: 0, color: '#30D158', icon: '💊' },
    { key: 'vitaminB12', name: 'Vitamin B12', unit: 'mcg', goal: 2.4,  goalType: 'min', goalMax: 0, color: '#0A84FF', icon: '💊' },
  ],
  minerals: [
    { key: 'calcium',    name: 'Calcium',    unit: 'mg',  goal: 1000, goalType: 'min', goalMax: 0, color: '#FFD60A', icon: '⚗️' },
    { key: 'iron',       name: 'Iron',       unit: 'mg',  goal: 18,   goalType: 'min', goalMax: 0, color: '#FF453A', icon: '⚗️' },
    { key: 'magnesium',  name: 'Magnesium',  unit: 'mg',  goal: 420,  goalType: 'min', goalMax: 0, color: '#30D158', icon: '⚗️' },
    { key: 'phosphorus', name: 'Phosphorus', unit: 'mg',  goal: 700,  goalType: 'min', goalMax: 0, color: '#64D2FF', icon: '⚗️' },
    { key: 'potassium',  name: 'Potassium',  unit: 'mg',  goal: 3500, goalType: 'min', goalMax: 0, color: '#FF9F0A', icon: '⚗️' },
    { key: 'sodium',     name: 'Sodium',     unit: 'mg',  goal: 2300, goalType: 'max', goalMax: 0, color: '#FF453A', icon: '⚗️' },
    { key: 'zinc',       name: 'Zinc',       unit: 'mg',  goal: 11,   goalType: 'min', goalMax: 0, color: '#0A84FF', icon: '⚗️' },
    { key: 'copper',     name: 'Copper',     unit: 'mg',  goal: 0.9,  goalType: 'min', goalMax: 0, color: '#FF9F0A', icon: '⚗️' },
    { key: 'manganese',  name: 'Manganese',  unit: 'mg',  goal: 2.3,  goalType: 'min', goalMax: 0, color: '#64D2FF', icon: '⚗️' },
    { key: 'selenium',   name: 'Selenium',   unit: 'mcg', goal: 55,   goalType: 'min', goalMax: 0, color: '#BF5AF2', icon: '⚗️' },
    { key: 'iodine',     name: 'Iodine',     unit: 'mcg', goal: 150,  goalType: 'min', goalMax: 0, color: '#FFD60A', icon: '⚗️' },
    { key: 'chromium',   name: 'Chromium',   unit: 'mcg', goal: 35,   goalType: 'min', goalMax: 0, color: '#30D158', icon: '⚗️' },
  ],
  other: [
    { key: 'saturatedFat',  name: 'Saturated Fat', unit: 'g',  goal: 20,  goalType: 'max', goalMax: 0, color: '#FF453A', icon: '📊' },
    { key: 'transFat',      name: 'Trans Fat',     unit: 'g',  goal: 2,   goalType: 'max', goalMax: 0, color: '#FF453A', icon: '📊' },
    { key: 'cholesterol',   name: 'Cholesterol',   unit: 'mg', goal: 300, goalType: 'max', goalMax: 0, color: '#FF9F0A', icon: '📊' },
    { key: 'sugar',         name: 'Sugar',         unit: 'g',  goal: 50,  goalType: 'max', goalMax: 0, color: '#FFD60A', icon: '📊' },
    { key: 'omega3',        name: 'Omega-3',        unit: 'g',  goal: 1.6, goalType: 'min', goalMax: 0, color: '#0A84FF', icon: '📊' },
  ],
}

// Nutrition Settings Component
function NutritionSettings({ metrics, onAdd, onUpdate, onRemove }) {
  const T = useContext(ThemeContext)
  const [showMicroPicker, setShowMicroPicker] = useState(false)
  const [microTab, setMicroTab] = useState('vitamins')
  // Common food/nutrition emojis to choose from
  const iconOptions = ['📊', '🔥', '💪', '🥩', '🥚', '🥛', '🍗', '🥤', '🧈', '🥜', '🌾']

  const isAdded = (key) => metrics.some(m => m.key === key)
  const togglePreset = (preset) => {
    if (isAdded(preset.key)) {
      const idx = metrics.findIndex(m => m.key === preset.key)
      onRemove(idx)
    } else {
      onAdd(preset)
    }
  }

  return (
    <div>
      <div style={{ fontSize: '13px', color: T.muted, marginBottom: '16px' }}>
        Add nutrition metrics with optional goals
      </div>

      {metrics.map((metric, i) => (
        <div key={i} style={{
          paddingBottom: '12px',
          marginBottom: '12px',
          borderBottom: i < metrics.length - 1 ? '1px solid #f0f0f0' : 'none'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Icon + Name + Remove */}
            <div style={{ display: 'flex', gap: '6px' }}>
              <select
                value={metric.icon || '📊'}
                onChange={(e) => onUpdate(i, 'icon', e.target.value)}
                style={{
                  padding: '8px',
                  backgroundColor: T.bg,
                  border: `1px solid ${T.border}`,
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
                  backgroundColor: T.bg,
                  border: `1px solid ${T.border}`,
                  borderRadius: '8px',
                  color: T.text,
                  fontSize: '16px',
                  fontWeight: '500',
                  boxSizing: 'border-box'
                }}
              />
              <button
                onClick={() => onRemove(i)}
                style={{
                  padding: '10px 12px',
                  backgroundColor: T.card2,
                  border: 'none',
                  borderRadius: '8px',
                  color: T.faint,
                  fontSize: '13px',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                ✕
              </button>
            </div>
            {/* Unit */}
            <div>
              <label style={{ fontSize: '11px', color: T.faint, marginBottom: '4px', display: 'block' }}>
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
                  backgroundColor: T.bg,
                  border: `1px solid ${T.border}`,
                  borderRadius: '8px',
                  color: T.text,
                  fontSize: '16px',
                  boxSizing: 'border-box'
                }}
              />
            </div>
            {/* Goal Type */}
            <div>
              <label style={{ fontSize: '11px', color: T.faint, marginBottom: '4px', display: 'block' }}>
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
                      backgroundColor: (metric.goalType || 'min') === gt.id ? '#0A84FF' : '#1A1A1A',
                      border: '1px solid',
                      borderColor: (metric.goalType || 'min') === gt.id ? '#0A84FF' : '#2C2C2C',
                      borderRadius: '6px',
                      color: (metric.goalType || 'min') === gt.id ? '#fff' : '#888888',
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
            {/* Goal value(s) */}
            <div style={{ display: 'grid', gridTemplateColumns: (metric.goalType || 'min') === 'range' ? '1fr 1fr' : '1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '11px', color: T.faint, marginBottom: '4px', display: 'block' }}>
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
                    backgroundColor: T.bg,
                    border: `1px solid ${T.border}`,
                    borderRadius: '8px',
                    color: T.text,
                    fontSize: '16px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              {(metric.goalType || 'min') === 'range' && (
                <div>
                  <label style={{ fontSize: '11px', color: T.faint, marginBottom: '4px', display: 'block' }}>
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
                      backgroundColor: T.bg,
                      border: `1px solid ${T.border}`,
                      borderRadius: '8px',
                      color: T.text,
                      fontSize: '16px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      ))}

      {/* ── Micronutrient quick-add picker ── */}
      <div style={{
        marginTop: metrics.length > 0 ? '16px' : '0',
        border: `1px solid ${T.border}`,
        borderRadius: '12px',
        overflow: 'hidden',
      }}>
        <button
          onClick={() => setShowMicroPicker(v => !v)}
          style={{
            width: '100%', padding: '12px 14px',
            backgroundColor: T.card2,
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}
        >
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: '13px', fontWeight: '600', color: T.text }}>
              Quick Add Micronutrients
            </div>
            <div style={{ fontSize: '11px', color: T.muted, marginTop: '2px' }}>
              Vitamins, minerals & more — tap to toggle
            </div>
          </div>
          <span style={{ color: T.muted, fontSize: '18px', lineHeight: 1, transform: showMicroPicker ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
            ›
          </span>
        </button>

        {showMicroPicker && (
          <div style={{ padding: '12px 14px', backgroundColor: T.card }}>
            {/* Category tabs */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
              {[
                { id: 'vitamins', label: 'Vitamins' },
                { id: 'minerals', label: 'Minerals' },
                { id: 'other',    label: 'Other' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setMicroTab(tab.id)}
                  style={{
                    padding: '5px 12px', borderRadius: '20px', border: 'none',
                    fontSize: '12px', fontWeight: '500', cursor: 'pointer',
                    backgroundColor: microTab === tab.id ? '#0A84FF' : T.card2,
                    color: microTab === tab.id ? '#fff' : T.muted,
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Nutrient pill grid */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {MICRONUTRIENT_PRESETS[microTab].map(preset => {
                const active = isAdded(preset.key)
                return (
                  <button
                    key={preset.key}
                    onClick={() => togglePreset(preset)}
                    style={{
                      padding: '6px 10px', borderRadius: '20px', cursor: 'pointer',
                      fontSize: '12px', fontWeight: '500',
                      backgroundColor: active ? preset.color + '22' : T.card2,
                      border: `1px solid ${active ? preset.color : T.border}`,
                      color: active ? preset.color : T.muted,
                      transition: 'all 0.15s',
                    }}
                  >
                    {active ? '✓ ' : ''}{preset.name}
                    <span style={{ opacity: 0.6, marginLeft: 3 }}>·{preset.unit}</span>
                  </button>
                )
              })}
            </div>

            <div style={{ marginTop: '10px', fontSize: '11px', color: T.muted }}>
              Daily goals are pre-filled with standard RDA values — you can edit them above.
            </div>
          </div>
        )}
      </div>

      <button
        onClick={() => onAdd()}
        style={{
          width: '100%',
          padding: '10px',
          marginTop: '8px',
          backgroundColor: T.card,
          border: '1px dashed #d0d0d0',
          borderRadius: '8px',
          color: T.muted,
          fontSize: '13px',
          fontWeight: '500',
          cursor: 'pointer'
        }}
      >
        + Add Custom Metric
      </button>
    </div>
  )
}

// Water Settings Component
function WaterSettings({ buttons, goal, onGoalChange, onAdd, onUpdate, onRemove, onMove }) {
  const T = useContext(ThemeContext)
  return (
    <div>
      <div style={{ fontSize: '11px', color: T.muted, marginBottom: '6px', fontWeight: '500' }}>
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
          backgroundColor: T.card,
          border: `1px solid ${T.border}`,
          borderRadius: '8px',
          color: T.text,
          fontSize: '16px',
          marginBottom: '20px',
          boxSizing: 'border-box'
        }}
      />

      <div style={{ fontSize: '11px', color: T.muted, marginBottom: '12px', fontWeight: '500' }}>
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
                backgroundColor: i === 0 ? '#222222' : '#1A1A1A',
                border: `1px solid ${T.border}`,
                borderRadius: '4px',
                color: i === 0 ? '#ccc' : '#888888',
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
                backgroundColor: i === buttons.length - 1 ? '#222222' : '#1A1A1A',
                border: `1px solid ${T.border}`,
                borderRadius: '4px',
                color: i === buttons.length - 1 ? '#ccc' : '#888888',
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
              backgroundColor: T.card,
              border: `1px solid ${T.border}`,
              borderRadius: '8px',
              color: T.text,
              fontSize: '16px',
              boxSizing: 'border-box'
            }}
          />
          <button
            onClick={() => onRemove(i)}
            style={{
              padding: '10px 14px',
              backgroundColor: T.card,
              border: `1px solid ${T.border}`,
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
  const T = useContext(ThemeContext)
  const mealIcons = ['🍽️', '🍕', '🍔', '🥗', '🍜', '🍱', '🥪', '🌮', '🌯', '🥙', '🍳', '🥞', '🍞', '🥐', '🥓']

  return (
    <div>
      <div style={{ fontSize: '13px', color: T.muted, marginBottom: '16px' }}>
        Configure quick-add meal presets
      </div>

      {metrics.length === 0 && (
        <div style={{
          padding: '30px 16px',
          textAlign: 'center',
          color: T.faint,
          fontSize: '13px',
          backgroundColor: T.card,
          borderRadius: '10px',
          border: `1px solid ${T.border}`
        }}>
          Add nutrition metrics first
        </div>
      )}

      {metrics.length > 0 && meals.map((meal, i) => (
        <div key={i} style={{
          paddingBottom: '12px',
          marginBottom: '12px',
          borderBottom: i < meals.length - 1 ? '1px solid #f0f0f0' : 'none'
        }}>
          <div style={{ display: 'flex', gap: '6px', marginBottom: meal ? '12px' : '0' }}>
            {meal && (
              <select
                value={meal?.icon || '🍽️'}
                onChange={(e) => onUpdate(i, 'icon', e.target.value)}
                style={{
                  padding: '8px',
                  backgroundColor: T.bg,
                  border: `1px solid ${T.border}`,
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
                backgroundColor: T.bg,
                border: `1px solid ${T.border}`,
                borderRadius: '8px',
                color: T.text,
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
                  backgroundColor: T.card2,
                  border: 'none',
                  borderRadius: '8px',
                  color: T.faint,
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
                    color: T.faint,
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
                      backgroundColor: T.bg,
                      border: `1px solid ${T.border}`,
                      borderRadius: '8px',
                      color: T.text,
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
