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
  loadUserProfile,
  saveBodyWeight,
  loadBodyWeightHistory,
} from '../lib/dataSync'
import { syncWeightToGroups } from '../lib/groupSync'
import {
  BarChartIcon, DumbbellIcon, TargetIcon, InboxIcon, CalendarIcon,
  SparklesIcon, InfoIcon, CheckCircleIcon, CloseIcon, PersonIcon, PlusIcon,
  FlameIcon, UtensilsIcon, ChevronDownIcon, ChevronRightIcon, ChevronLeftIcon,
  BarcodeIcon, CameraIcon
} from '../lib/icons'
import { DARK, LIGHT, DONE, OVER, FONT } from '../lib/theme'
import { AppTabBar, TAB_BAR_SPACE } from './components/AppChrome'
import FoodLogSheet, { SearchIcon, compressPhoto, SOURCE_LABEL } from './components/FoodLogSheet'

// ─── THEME TOKENS (shared across screens) ─────────────────────────────────────

// Typed amounts keep one decimal (12.5 g stays 12.5)
const parseAmount = (v) => Math.round((parseFloat(String(v ?? '').replace(',', '.')) || 0) * 10) / 10

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
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('goals') === '1') {
      setSettingsTab('home')
      setShowSettings(true)
      window.history.replaceState(null, '', '/')
    }
  }, [])
  const isRemoteUpdate = useRef(false) // Track if update came from real-time listener
  const cloudLoadSucceeded = useRef(false) // Track if cloud data was loaded successfully
  const isNavigatingDay = useRef(false) // Reentrancy lock for navigateDay — closes the gap before loadingPastDay(true) takes effect
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
  const [showCustomEntry, setShowCustomEntry] = useState(false)

  // One-step food logging
  const [foodSheet, setFoodSheet] = useState(null) // null | 'search' | 'scan' | 'photo'
  const [foodPhoto, setFoodPhoto] = useState(null) // compressed data URL for the photo flow
  const foodPhotoInput = useRef(null)
  const [loggedToast, setLoggedToast] = useState(null) // { name, logId? } of what was just logged
  const [recentFoods, setRecentFoods] = useState([]) // [{ name, serving, values }] newest first, this device only
  useEffect(() => {
    try { setRecentFoods(JSON.parse(localStorage.getItem('lytz-recent-foods') || '[]')) } catch {}
  }, [])
  useEffect(() => {
    if (!loggedToast) return
    const t = setTimeout(() => setLoggedToast(null), 5000)
    return () => clearTimeout(t)
  }, [loggedToast])

  // History for undo
  const [nutritionHistory, setNutritionHistory] = useState([])
  const [waterHistory, setWaterHistory] = useState([])

  // Settings modal
  const [showSettings, setShowSettings] = useState(false)
  const [settingsTab, setSettingsTab] = useState('home') // home, checklist, nutrition, water, meals, feedback, appSettings
  const [showNutritionLog, setShowNutritionLog] = useState(false)
  const [editingMetric, setEditingMetric] = useState(null) // index of metric being edited
  const [editMetricValue, setEditMetricValue] = useState('')
  const [addingMetric, setAddingMetric] = useState(null) // index of metric whose "+" amount field is open
  const [addMetricValue, setAddMetricValue] = useState('')

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

  // Admin flag — used to gate in-progress features
  const [isAdmin, setIsAdmin] = useState(false)

  // Body weight tracking
  const [bodyWeight, setBodyWeight] = useState('')        // today's logged weight
  const [bodyWeightUnit, setBodyWeightUnit] = useState('lbs')
  const [bodyWeightInput, setBodyWeightInput] = useState('')
  const [showWeightInput, setShowWeightInput] = useState(false)

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
    const attempt = async () => {
      await saveTodayData(user.uid, data)
      await saveHistoryEntry(user.uid, data.date, data)
      if (settings) await saveUserSettings(user.uid, settings)
    }

    try {
      await attempt()
      setSyncStatus('synced')
      setTimeout(() => setSyncStatus(''), 2000)
    } catch (error) {
      console.error('Sync error, retrying in 4s:', error)
      // Retry once after 4 seconds before giving up
      setTimeout(async () => {
        try {
          await attempt()
          setSyncStatus('synced')
          setTimeout(() => setSyncStatus(''), 2000)
        } catch (retryError) {
          console.error('Sync retry failed:', retryError)
          setSyncStatus('error')
          setTimeout(() => setSyncStatus(''), 3000)
        }
      }, 4000)
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

        // Load today's body weight
        loadBodyWeightHistory(user.uid, 1).then(entries => {
          if (cancelled || entries.length === 0) return
          const today = toLocalDateStr()
          const todayEntry = entries.find(e => e.date === today)
          if (todayEntry) {
            setBodyWeight(String(todayEntry.weight))
            setBodyWeightUnit(todayEntry.unit || 'lbs')
          }
        })

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
          // Unblock saves after 8s — a transient network error on load shouldn't
          // silently block every save for the entire session
          setTimeout(() => { if (!cancelled) cloudLoadSucceeded.current = true }, 8000)
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
              // Reset flag after state updates — 1s gives React time to flush
              // the remote update before we start treating changes as local again
              setTimeout(() => { isRemoteUpdate.current = false }, 1000)
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
        if (profile?.isAdmin) setIsAdmin(true)

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
          color: '#B8F06A'
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
          color: 'rgba(184,240,106,0.25)'
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
    // Reentrancy lock: a fast double-tap can fire a second call before
    // setLoadingPastDay(true) below has disabled the buttons (it doesn't fire
    // until after the awaited saves), and before this call's own setViewDate
    // has committed. Two overlapping calls each read stale viewDate/pastDayData
    // closures, which can land an edit on the wrong day or clobber a fresher
    // load with a stale one. This check-and-set is synchronous, so it closes
    // the gap completely — a second tap while one call is in flight is a no-op.
    if (isNavigatingDay.current) return
    isNavigatingDay.current = true
    try {
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
    } finally {
      isNavigatingDay.current = false
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
  // Setting a total is logged as an adjustment (the difference), so the log,
  // Undo and the total always agree, and decimals are kept
  const saveMetricEdit = async (metricIndex) => {
    const metrics = viewDate !== null && pastDayData ? pastDayData.nutritionMetrics : nutritionMetrics
    const current = metrics[metricIndex]?.value || 0
    const newValue = Math.max(0, parseAmount(editMetricValue))
    const delta = Math.round((newValue - current) * 10) / 10

    setEditingMetric(null)
    setEditMetricValue('')
    if (delta !== 0) await addToMetric(metricIndex, delta)
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
        const value = parseAmount(customValues[metric.key])
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
        const value = parseAmount(customValues[metric.key])
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
    if (!confirm("Clear today's food, water and habit checks? Your goals stay.")) return false

    const resetChecklist = checklistItems.map(item => ({ ...item, checked: false }))
    const resetMetrics = nutritionMetrics.map(metric => ({ ...metric, value: 0 }))

    setChecklistItems(resetChecklist)
    setNutritionMetrics(resetMetrics)
    setWater(0)
    setWaterHistory([])
    setNutritionHistory([])
    return true
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

  const logBodyWeight = async () => {
    const val = parseFloat(bodyWeightInput)
    if (isNaN(val) || val <= 0) return
    setBodyWeight(String(val))
    setBodyWeightInput('')
    setShowWeightInput(false)
    if (user) {
      const dateStr = toLocalDateStr()
      await saveBodyWeight(user.uid, dateStr, val, bodyWeightUnit)
      // Load full history and push to any groups where weight sharing is enabled
      loadBodyWeightHistory(user.uid, 90).then(history => {
        if (history.length > 0) syncWeightToGroups(user.uid, history)
      })
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

  const addEstimatedNutrition = async (estimates, messageIndex, name) => {
    const timestamp = Date.now()
    const msgScore = messageIndex !== undefined ? chatMessages[messageIndex]?.score : null
    const newEntry = { estimates, score: msgScore || undefined, timestamp, ...(name ? { name } : {}) }

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

  // Log a whole food in one step: every metric updates together, and it joins "Eaten before"
  // Food-sheet logs: one entry per food, so a meal stays itemized and each food
  // can be removed on its own. All entries land in one update (no lost adds).
  const sumEstimates = (entries, key) => entries.reduce((sum, e) => sum + (e.estimates?.[key] || 0), 0)
  const round1 = (n) => Math.round(n * 10) / 10

  const addFoodEntries = async (foods) => {
    const timestamp = Date.now()
    const logId = `log-${timestamp}`
    const newEntries = foods.map(f => ({
      estimates: f.estimates,
      name: f.name,
      timestamp,
      logId,
      ...(f.source ? { source: f.source } : {}),
      ...(foods.length > 1 ? { mealId: logId } : {})
    }))
    const addAll = (metrics) => metrics.map(metric => ({
      ...metric,
      value: round1((metric.value || 0) + sumEstimates(newEntries, metric.key))
    }))

    if (viewDate !== null && pastDayData) {
      const updated = addAll(pastDayData.nutritionMetrics)
      setPastDayData({ ...pastDayData, nutritionMetrics: updated, nutritionHistory: [...(pastDayData.nutritionHistory || []), ...newEntries] })
      if (user && isConfigured) {
        const dayData = await loadDayData(user.uid, viewDate)
        await saveHistoryEntry(user.uid, viewDate, {
          ...(dayData || {}),
          nutritionMetrics: updated,
          nutritionHistory: [...(dayData?.nutritionHistory || []), ...newEntries],
          date: viewDate
        })
      }
    } else {
      setNutritionMetrics(prev => addAll(prev))
      setNutritionHistory(prev => [...prev, ...newEntries])
    }
    return logId
  }

  // Undo for a food-sheet log: removes every food that was added together
  const removeFoodLog = async (logId) => {
    const subtract = (metrics, removed) => metrics.map(metric => ({
      ...metric,
      value: Math.max(0, round1((metric.value || 0) - sumEstimates(removed, metric.key)))
    }))

    if (viewDate !== null && pastDayData) {
      const removed = (pastDayData.nutritionHistory || []).filter(e => e.logId === logId)
      if (!removed.length) return
      const updated = subtract(pastDayData.nutritionMetrics, removed)
      setPastDayData({ ...pastDayData, nutritionMetrics: updated, nutritionHistory: pastDayData.nutritionHistory.filter(e => e.logId !== logId) })
      if (user && isConfigured) {
        const dayData = await loadDayData(user.uid, viewDate)
        await saveHistoryEntry(user.uid, viewDate, {
          ...(dayData || {}),
          nutritionMetrics: updated,
          nutritionHistory: (dayData?.nutritionHistory || []).filter(e => e.logId !== logId),
          date: viewDate
        })
      }
    } else {
      const removed = nutritionHistory.filter(e => e.logId === logId)
      if (!removed.length) return
      setNutritionMetrics(prev => subtract(prev, removed))
      setNutritionHistory(prev => prev.filter(e => e.logId !== logId))
    }
  }

  // Log from the food sheet or an "Eaten before" chip; logged foods join "Eaten before"
  const logFood = async ({ name, foods = [] }) => {
    if (!foods.length) return
    setFoodSheet(null)
    setFoodPhoto(null)
    const names = new Set(foods.map(f => f.name))
    const next = [
      ...foods.map(({ name, serving, values, source }) => ({ name, serving, values, ...(source ? { source } : {}) })),
      ...recentFoods.filter(f => !names.has(f.name))
    ].slice(0, 10)
    setRecentFoods(next)
    try { localStorage.setItem('lytz-recent-foods', JSON.stringify(next)) } catch {}
    const logId = await addFoodEntries(foods)
    setLoggedToast({ name, logId })
  }

  // Camera button: take or pick a photo, then read it straight into the food sheet
  const onFoodPhotoChosen = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      setFoodPhoto(await compressPhoto(file))
      setFoodSheet('photo')
    } catch {
      setLoggedToast(null)
      alert("Couldn't open that photo. Try another one.")
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
              backgroundColor: '#B8F06A',
              border: 'none',
              borderRadius: '8px',
              color: '#15171A',
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


  // ── Today screen: date labels for the header ─────────────────────────────────
  const shownDate = (() => {
    if (viewDate === null) return new Date()
    const [y, m, d] = viewDate.split('-').map(Number)
    return new Date(y, m - 1, d)
  })()
  const isYesterdayShown = (() => {
    if (viewDate === null) return false
    const y = new Date()
    y.setHours(0, 0, 0, 0)
    y.setDate(y.getDate() - 1)
    return shownDate.toDateString() === y.toDateString()
  })()
  const dayTitle = loadingPastDay ? 'Loading…'
    : viewDate === null ? 'Today'
    : isYesterdayShown ? 'Yesterday'
    : shownDate.toLocaleDateString('en-US', { weekday: 'long' })
  const daySubtitle = viewDate === null || isYesterdayShown
    ? shownDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    : shownDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const syncLabel = syncStatus === 'syncing' ? 'Syncing' : syncStatus === 'synced' ? 'Synced' : syncStatus === 'error' ? 'Sync error' : ''

  return (
    <ThemeContext.Provider value={T}>
    <div style={{
      minHeight: '100vh',
      backgroundColor: T.bg,
      padding: `0 0 calc(${TAB_BAR_SPACE} + ${nutritionMetrics.length > 0 ? 72 : 0}px) 0`,
      fontFamily: "'Geist', -apple-system, BlinkMacSystemFont, sans-serif",
      fontVariantNumeric: 'tabular-nums',
      WebkitFontSmoothing: 'antialiased',
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
                background: '#B8F06A',
                color: '#0B0C0E',
                border: 'none',
                borderRadius: '12px',
                fontSize: '15px',
                fontWeight: '700',
                cursor: 'pointer',
                marginBottom: '10px',
                boxShadow: 'none'
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

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '0 16px' }}>
        {/* Header */}
        <div style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          backgroundColor: T.bg + 'ee',
          margin: '0 -16px 12px',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
            <button
              onClick={() => navigateDay('back')}
              disabled={loadingPastDay}
              aria-label="Previous day"
              style={{ ...iconButton, width: '36px', color: T.muted, opacity: loadingPastDay ? 0.4 : 1 }}
            >
              <ChevronLeftIcon size={20} strokeWidth={2} />
            </button>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', minWidth: 0 }}>
              <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 500, letterSpacing: '-0.01em', color: T.text, whiteSpace: 'nowrap' }}>
                {dayTitle}
              </h1>
              <span style={{ fontSize: '15px', color: T.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {daySubtitle}
              </span>
            </div>
            {viewDate !== null && (
              <button
                onClick={() => navigateDay('forward')}
                disabled={loadingPastDay}
                aria-label="Next day"
                style={{ ...iconButton, width: '36px', color: T.muted, opacity: loadingPastDay ? 0.4 : 1 }}
              >
                <ChevronRightIcon size={20} strokeWidth={2} />
              </button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            {/* Return to Today — only shown when viewing a past day */}
            {viewDate !== null && (
              <button
                onClick={() => { setViewDate(null); setPastDayData(null) }}
                style={{ height: '36px', padding: '0 14px', borderRadius: '999px', border: 'none', backgroundColor: T.text, color: T.bg, fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Today
              </button>
            )}
            <button
              onClick={() => setShowChat(true)}
              aria-label="Ask Lytz AI"
              style={{ ...iconButton, borderRadius: '50%', backgroundColor: T.card, color: T.text }}
            >
              <SparklesIcon size={18} strokeWidth={1.75} />
            </button>

            {/* User Account Button — the dot shows sync status */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => user ? setShowUserMenu(!showUserMenu) : router.push('/login')}
                aria-label={user ? `Account menu${syncLabel ? `, ${syncLabel}` : ''}` : 'Sign in'}
                title={syncLabel || undefined}
                style={{ ...iconButton, position: 'relative', borderRadius: '50%', backgroundColor: T.card, color: T.text, fontSize: '15px', fontWeight: 600 }}
              >
                {user?.email ? user.email[0].toUpperCase() : <PersonIcon size={18} strokeWidth={1.75} />}
                {syncStatus && (
                  <span aria-hidden="true" style={{
                    position: 'absolute', right: '2px', bottom: '2px',
                    width: '10px', height: '10px', borderRadius: '50%',
                    border: `2px solid ${T.bg}`,
                    backgroundColor: syncStatus === 'synced' ? DONE : syncStatus === 'error' ? OVER : T.muted
                  }} />
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
                      color: '#B8F06A',
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
                      color: '#B8F06A',
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
                      color: signingOut ? '#666666' : '#FF6B3D',
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
                backgroundColor: showCatchUp ? 'rgba(184,240,106,0.1)' : T.card,
                border: `1px solid ${showCatchUp ? 'rgba(184,240,106,0.35)' : T.border}`,
                borderRadius: '12px',
                color: showCatchUp ? '#B8F06A' : T.muted,
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
                          <SparklesIcon size={14} color="#B8F06A" strokeWidth={2} />
                          <span style={{
                            fontSize: '12px', fontWeight: '700', color: '#B8F06A', letterSpacing: '0.5px',
                            fontFamily: 'inherit'
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

        {/* Daily Habits */}
        {checklistItems.length > 0 && (
          <div style={{ marginBottom: '16px' }}>
            {loadingPastDay ? (
              <div style={{ textAlign: 'center', padding: '14px', color: T.muted, fontSize: '13px' }}>
                Loading...
              </div>
            ) : (() => {
              const displayItems = viewDate !== null && pastDayData?.checklistItems ? pastDayData.checklistItems : checklistItems
              return (
                <div role="group" aria-label="Habits" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {displayItems.map((item, i) => {
                    const freq = item.frequency || 'daily'
                    const isMultiple = freq === 'multiple'
                    const count = item.count || 0
                    const target = item.targetCount || 1
                    const isDone = isMultiple ? count >= target : !!item.checked
                    return (
                      <button
                        key={i}
                        onClick={() => viewDate !== null ? togglePastChecklistItem(i) : toggleChecklistItem(i)}
                        aria-pressed={isDone}
                        style={{
                          flex: '1 1 auto',
                          minHeight: '48px',
                          maxWidth: '100%',
                          padding: '0 14px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          border: 'none',
                          borderRadius: '14px',
                          backgroundColor: isDone ? DONE : T.card,
                          color: isDone ? '#0B0C0E' : T.soft,
                          fontSize: '14px',
                          fontWeight: 500,
                          fontFamily: 'inherit',
                          cursor: 'pointer',
                          transition: 'background-color 0.2s, color 0.2s'
                        }}
                      >
                        {isMultiple ? (
                          <span style={{ fontSize: '12px', fontWeight: 600, opacity: 0.75, flexShrink: 0 }}>{count}/{target}</span>
                        ) : isDone && (
                          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                            <path d="M5 12.5l4.5 4.5L19 7.5" />
                          </svg>
                        )}
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                        {freq === 'weekly' && (
                          <span title="Weekly" style={{ fontSize: '10px', fontWeight: 600, opacity: 0.6, flexShrink: 0 }}>W</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )
            })()}
          </div>
        )}

        {/* Water */}
        {waterButtons.length > 0 && (() => {
          const displayWater = viewDate !== null && pastDayData ? pastDayData.water : water
          const displayWaterHistory = (viewDate !== null && pastDayData ? pastDayData.waterHistory : waterHistory) || []
          return (
            <WaterCard
              water={displayWater || 0}
              goal={waterGoal}
              buttons={waterButtons}
              canUndo={displayWaterHistory.length > 0}
              onAdd={addWater}
              onUndo={undoWater}
            />
          )
        })()}

        {/* Nutrition */}
        {nutritionMetrics.length > 0 && (() => {
          // Determine which data to display (past day or today)
          const displayNutritionMetrics = viewDate !== null && pastDayData
            ? pastDayData.nutritionMetrics
            : nutritionMetrics
          const displayNutritionHistory = viewDate !== null && pastDayData
            ? pastDayData.nutritionHistory
            : nutritionHistory

          return (
          <div style={{ marginBottom: '8px' }}>
            {displayNutritionHistory.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', color: T.muted }}>Nutrition</span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={undoNutrition} style={pillButton(T)}>Undo</button>
                  <button
                    onClick={() => setShowNutritionLog(!showNutritionLog)}
                    aria-expanded={showNutritionLog}
                    style={{ ...pillButton(T), ...(showNutritionLog ? { backgroundColor: T.card2, color: T.text } : {}) }}
                  >
                    {showNutritionLog ? 'Hide entries' : `Entries (${displayNutritionHistory.length})`}
                  </button>
                </div>
              </div>
            )}

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
                            color: entry.type === 'manual_named' ? '#8B9098' : '#FFFFFF',
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
                            backgroundColor: 'rgba(255,107,61,0.1)',
                            border: '1px solid #fecaca',
                            borderRadius: '6px',
                            color: '#FF6B3D',
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
                    // Food search / AI batch entry
                    entryType = entry.name || 'AI Estimate'
                    const parts = displayNutritionMetrics
                      .filter(m => entry.estimates[m.key])
                      .map(m => `${m.name}: ${entry.estimates[m.key]}${m.unit ? ` ${m.unit}` : ''}`)
                    const origin = [entry.mealId ? 'Part of a meal' : null, SOURCE_LABEL[entry.source]].filter(Boolean).join(' · ')
                    description = [origin, parts.join(', ')].filter(Boolean).join(' — ')
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
                            const c = g === 'A' ? '#B8F06A' : g === 'B' ? '#B8F06A' : g === 'C' ? '#F2C94C' : '#FF6B3D'
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
                          backgroundColor: 'rgba(255,107,61,0.1)',
                          border: '1px solid #fecaca',
                          borderRadius: '6px',
                          color: '#FF6B3D',
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {displayNutritionMetrics.map((metric, i) => {
                const goalType = metric.goalType || 'min'
                const value = metric.value || 0
                const goal = metric.goal || 0
                const goalMax = metric.goalMax || 0
                const unit = metric.unit ? ` ${metric.unit}` : ''

                // Progress, state and the short status line, by goal type
                let pct = 0
                let state = 'progress' // 'progress' | 'done' | 'over'
                let sub = ''
                if (goal > 0) {
                  if (goalType === 'max') {
                    pct = Math.min(value / goal * 100, 100)
                    if (value > goal) { state = 'over'; sub = `${fmtNum(value - goal)}${unit} over` }
                    else sub = `${fmtNum(goal - value)}${unit} left`
                  } else if (goalType === 'range' && goalMax > 0) {
                    pct = Math.min(value / goalMax * 100, 100)
                    if (value < goal) sub = `${fmtNum(goal - value)}${unit} to go`
                    else if (value > goalMax) { state = 'over'; sub = `${fmtNum(value - goalMax)}${unit} over` }
                    else { state = 'done'; sub = 'In range' }
                  } else {
                    pct = Math.min(value / goal * 100, 100)
                    if (value >= goal) { state = 'done'; sub = 'Done' }
                    else sub = `of ${fmtNum(goal)}${unit}`
                  }
                }
                const color = state === 'done' ? DONE : state === 'over' ? OVER : T.hues[i % T.hues.length]

                // "−" undoes this metric's most recent single add (the "+" button's entries)
                let lastAddIndex = -1
                for (let h = displayNutritionHistory.length - 1; h >= 0; h--) {
                  if (displayNutritionHistory[h].metricIndex === i) { lastAddIndex = h; break }
                }

                return (
                  <TrackerRow
                    key={i}
                    color={color}
                    pct={pct}
                    label={metric.name}
                    value={fmtNum(value)}
                    unit={metric.unit}
                    sub={sub}
                    onValueClick={() => { setAddingMetric(null); setEditingMetric(i); setEditMetricValue(String(value)) }}
                    valueAria={`Set ${metric.name} total, currently ${fmtNum(value)}${unit}`}
                    editor={editingMetric === i ? (
                      <ValueEditor
                        label={`${metric.name} total`}
                        placeholder={`Total ${metric.name.toLowerCase()}`}
                        value={editMetricValue}
                        onChange={setEditMetricValue}
                        onSave={() => saveMetricEdit(i)}
                        onCancel={() => { setEditingMetric(null); setEditMetricValue('') }}
                      />
                    ) : addingMetric === i ? (
                      <ValueEditor
                        label={`Amount of ${metric.name} to add`}
                        placeholder={`Add ${metric.name.toLowerCase()}${metric.unit ? ` (${metric.unit})` : ''}`}
                        inputMode="decimal"
                        saveLabel="Add"
                        value={addMetricValue}
                        onChange={setAddMetricValue}
                        onSave={() => {
                          const amount = parseFloat(addMetricValue)
                          if (amount > 0) addToMetric(i, amount)
                          setAddingMetric(null); setAddMetricValue('')
                        }}
                        onCancel={() => { setAddingMetric(null); setAddMetricValue('') }}
                      />
                    ) : null}
                    actions={<>
                      <button
                        onClick={() => removeNutritionEntry(lastAddIndex)}
                        disabled={lastAddIndex < 0}
                        aria-label={`Undo last ${metric.name} add`}
                        style={{ ...iconButton, borderRadius: '12px', color: T.soft, opacity: lastAddIndex < 0 ? 0.3 : 1, cursor: lastAddIndex < 0 ? 'default' : 'pointer' }}
                      >
                        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 12h12" /></svg>
                      </button>
                      <button
                        onClick={() => { setEditingMetric(null); setAddingMetric(i); setAddMetricValue('') }}
                        aria-label={`Add ${metric.name}`}
                        style={stepButton(T)}
                      >
                        <PlusIcon size={18} strokeWidth={2} />
                      </button>
                    </>}
                  />
                )
              })}
            </div>
          </div>
          )
        })()}

        {/* Body Weight */}
        <div style={{ marginBottom: '16px' }}>
          <TrackerRow
            color={bodyWeight ? '#B9A3FF' : null}
            pct={0}
            label="Weight"
            value={bodyWeight || '—'}
            unit={bodyWeight ? bodyWeightUnit : ''}
            sub={bodyWeight ? '' : 'Not logged today'}
            onValueClick={() => { setBodyWeightInput(bodyWeight); setShowWeightInput(true) }}
            valueAria={bodyWeight ? `Edit weight, ${bodyWeight} ${bodyWeightUnit}` : "Log today's weight"}
            editor={showWeightInput ? (
              <ValueEditor
                label={`Weight in ${bodyWeightUnit}`}
                placeholder={`Weight in ${bodyWeightUnit}`}
                type="text"
                inputMode="decimal"
                value={bodyWeightInput}
                onChange={setBodyWeightInput}
                onSave={logBodyWeight}
                onCancel={() => setShowWeightInput(false)}
              />
            ) : null}
            actions={<>
              <button
                onClick={() => setBodyWeightUnit(u => u === 'lbs' ? 'kg' : 'lbs')}
                aria-label={`Switch to ${bodyWeightUnit === 'lbs' ? 'kg' : 'lbs'}`}
                style={{ ...iconButton, width: 'auto', padding: '0 10px', borderRadius: '12px', color: T.muted, fontSize: '13px' }}
              >
                {bodyWeightUnit}
              </button>
              <button
                onClick={() => { setBodyWeightInput(bodyWeight); setShowWeightInput(true) }}
                style={stepButton(T)}
              >
                {bodyWeight ? 'Edit' : 'Log'}
              </button>
            </>}
          />
        </div>

        {/* Eaten before — saved meals and recent foods, one tap each; custom entry behind its own chip */}
        {(meals.some(m => m) || nutritionMetrics.length > 0) && (
          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '13px', color: T.muted, marginBottom: '10px' }}>Eaten before</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {meals.map((meal, i) => meal ? (
                <button
                  key={`meal-${i}`}
                  onClick={() => { addMeal(meal); setLoggedToast({ name: meal.name }) }}
                  title={nutritionMetrics.map(metric =>
                    meal[metric.key] ? `${meal[metric.key]}${metric.unit || ''} ${metric.name}` : ''
                  ).filter(Boolean).join(' · ')}
                  style={chipButton(T)}
                >
                  <PlusIcon size={14} color={T.muted} strokeWidth={2} />
                  {meal.name}
                </button>
              ) : null)}
              {recentFoods
                .filter(f => !meals.some(m => m && m.name.toLowerCase() === f.name.toLowerCase()))
                .slice(0, 6)
                .map(food => (
                  <button
                    key={`recent-${food.name}`}
                    onClick={() => logFood({ name: food.name, foods: [{ ...food, estimates: food.values }] })}
                    title={`${food.serving} · ` + nutritionMetrics.map(metric =>
                      food.values[metric.key] ? `${food.values[metric.key]}${metric.unit || ''} ${metric.name}` : ''
                    ).filter(Boolean).join(' · ')}
                    style={chipButton(T)}
                  >
                    <PlusIcon size={14} color={T.muted} strokeWidth={2} />
                    {food.name}
                  </button>
                ))}
              {nutritionMetrics.length > 0 && (
                <button
                  onClick={() => setShowCustomEntry(v => !v)}
                  aria-expanded={showCustomEntry}
                  style={{ ...chipButton(T), borderStyle: 'dashed', color: T.muted }}
                >
                  {showCustomEntry ? 'Close manual entry' : 'Enter numbers…'}
                </button>
              )}
            </div>

            {/* Custom Entry */}
            {showCustomEntry && nutritionMetrics.length > 0 && (
              <div style={{ marginTop: '10px', padding: '14px', backgroundColor: T.card, borderRadius: '18px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="Name (optional, e.g. Chicken breast)"
                  aria-label="Entry name"
                  value={customEntryName}
                  onChange={(e) => setCustomEntryName(e.target.value)}
                  maxLength={50}
                  style={fieldStyle(T)}
                />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' }}>
                  {nutritionMetrics.map((metric, i) => (
                    <input
                      key={i}
                      type="number"
                      inputMode="decimal"
                      placeholder={metric.unit ? `${metric.name} (${metric.unit})` : metric.name}
                      aria-label={metric.name}
                      value={customValues[metric.key] || ''}
                      onChange={(e) => setCustomValues({ ...customValues, [metric.key]: e.target.value })}
                      style={fieldStyle(T)}
                    />
                  ))}
                </div>
                <button onClick={addCustomEntry} style={{ ...primaryButton, width: '100%' }}>
                  Add entry
                </button>
              </div>
            )}
          </div>
        )}

        {/* Empty State Message */}
        {checklistItems.length === 0 && nutritionMetrics.length === 0 && waterButtons.length === 0 && (
          <div style={{ padding: '40px 24px', backgroundColor: T.card, borderRadius: '24px', textAlign: 'center', marginBottom: '24px' }}>
            <div style={{ fontSize: '20px', fontWeight: 500, marginBottom: '6px' }}>Nothing to track yet</div>
            <div style={{ fontSize: '15px', color: T.muted, marginBottom: '20px', lineHeight: 1.5 }}>
              Pick the habits, water and nutrition goals you want on this screen.
            </div>
            <button onClick={() => { setSettingsTab('home'); setShowSettings(true) }} style={primaryButton}>
              Set up goals
            </button>
          </div>
        )}
      </div>

      {/* "What did you eat?" bar — one step to log a whole food */}
      {nutritionMetrics.length > 0 && !foodSheet && (
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: `calc(76px + env(safe-area-inset-bottom))`, zIndex: 55, pointerEvents: 'none' }}>
          <div style={{ maxWidth: '600px', margin: '0 auto', padding: '0 16px', display: 'flex', flexDirection: 'column', gap: '8px', pointerEvents: 'auto' }}>
            {loggedToast && (
              <div role="status" style={{ height: '52px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '0 6px 0 16px', borderRadius: '14px', backgroundColor: T.text, color: T.bg }}>
                <span style={{ fontSize: '14px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Added {loggedToast.name}</span>
                <button onClick={() => { if (loggedToast.logId) removeFoodLog(loggedToast.logId); else undoNutrition(); setLoggedToast(null) }} style={{ height: '40px', padding: '0 12px', border: 'none', borderRadius: '10px', background: 'none', color: T.bg, fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Undo
                </button>
              </div>
            )}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setFoodSheet('search')} style={{ flex: 1, height: '56px', display: 'flex', alignItems: 'center', gap: '10px', padding: '0 16px', border: 'none', borderRadius: '18px', backgroundColor: DONE, color: '#0B0C0E', fontSize: '16px', fontWeight: 500, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 8px 24px rgba(0,0,0,0.45)' }}>
                <SearchIcon size={20} />
                What did you eat?
              </button>
              <button onClick={() => setFoodSheet('scan')} aria-label="Scan a barcode" style={{ ...iconButton, width: '56px', height: '56px', borderRadius: '18px', backgroundColor: T.card, color: T.text, boxShadow: '0 8px 24px rgba(0,0,0,0.45)' }}>
                <BarcodeIcon size={20} strokeWidth={1.8} />
              </button>
              <button onClick={() => foodPhotoInput.current?.click()} aria-label="Take a photo of your food or its label" style={{ ...iconButton, width: '56px', height: '56px', borderRadius: '18px', backgroundColor: T.card, color: T.text, boxShadow: '0 8px 24px rgba(0,0,0,0.45)' }}>
                <CameraIcon size={20} strokeWidth={1.8} />
              </button>
              <input ref={foodPhotoInput} type="file" accept="image/*" capture="environment" onChange={onFoodPhotoChosen} style={{ display: 'none' }} />
            </div>
          </div>
        </div>
      )}

      {foodSheet && (
        <FoodLogSheet
          T={T}
          metrics={viewDate !== null && pastDayData ? pastDayData.nutritionMetrics : nutritionMetrics}
          startWith={foodSheet}
          photo={foodPhoto}
          onLog={logFood}
          onDescribe={(text) => { setFoodSheet(null); setChatInput(text); setShowChat(true) }}
          onClose={() => { setFoodSheet(null); setFoodPhoto(null) }}
        />
      )}

      {/* Bottom tab bar */}
      <AppTabBar
        current="today"
        T={T}
        onToday={() => {
          if (viewDate !== null) { setViewDate(null); setPastDayData(null) }
          else window.scrollTo({ top: 0, behavior: 'smooth' })
        }}
        onGoals={() => { setSettingsTab('home'); setShowSettings(true) }}
      />

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
          onRedoSetup={() => { setShowSettings(false); setShowOnboarding(true) }}
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

// ─── Today screen building blocks ─────────────────────────────────────────────

const fmtNum = (n) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 1 })

const iconButton = {
  width: '44px',
  height: '44px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: 'none',
  background: 'none',
  padding: 0,
  cursor: 'pointer',
  flexShrink: 0,
  fontFamily: 'inherit'
}

const primaryButton = {
  height: '44px',
  padding: '0 20px',
  borderRadius: '12px',
  border: 'none',
  backgroundColor: DONE,
  color: '#0B0C0E',
  fontSize: '15px',
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit'
}

const stepButton = (T) => ({
  height: '44px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: '56px',
  padding: '0 12px',
  flexShrink: 0,
  border: 'none',
  borderRadius: '12px',
  backgroundColor: T.card2,
  color: T.text,
  fontSize: '14px',
  fontWeight: 500,
  cursor: 'pointer',
  fontFamily: 'inherit'
})

const pillButton = (T) => ({
  height: '32px',
  padding: '0 12px',
  borderRadius: '999px',
  border: `1px solid ${T.border}`,
  backgroundColor: 'transparent',
  color: T.muted,
  fontSize: '13px',
  fontWeight: 500,
  cursor: 'pointer',
  fontFamily: 'inherit'
})

const chipButton = (T) => ({
  height: '40px',
  padding: '0 14px',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  borderRadius: '999px',
  border: `1px solid ${T.border}`,
  backgroundColor: 'transparent',
  color: T.soft,
  fontSize: '14px',
  cursor: 'pointer',
  fontFamily: 'inherit'
})

const fieldStyle = (T) => ({
  width: '100%',
  height: '44px',
  padding: '0 12px',
  borderRadius: '12px',
  border: `1px solid ${T.border}`,
  backgroundColor: T.bg,
  color: T.text,
  fontSize: '16px',
  fontFamily: 'inherit',
  boxSizing: 'border-box'
})

// One tracker row: the row itself fills like a progress bar; tap the number to type a value
function TrackerRow({ color, pct, label, value, unit, sub, onValueClick, valueAria, editor, actions }) {
  const T = useContext(ThemeContext)
  return (
    <div style={{ position: 'relative', minHeight: '68px', borderRadius: '18px', backgroundColor: T.card, overflow: 'hidden' }}>
      {pct > 0 && (
        <div aria-hidden="true" style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: `${pct}%`,
          backgroundColor: color + '24',
          boxShadow: `inset -2px 0 0 ${color}`,
          transition: 'width 0.5s cubic-bezier(.2,.8,.2,1), background-color 0.3s'
        }} />
      )}
      <div style={{ position: 'relative', minHeight: '68px', display: 'flex', alignItems: 'center', gap: '8px', padding: '0 8px 0 18px' }}>
        <span aria-hidden="true" style={{
          width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0, boxSizing: 'border-box',
          ...(color ? { backgroundColor: color } : { border: `1.5px solid ${T.faint}` })
        }} />
        {editor || (
          <button
            onClick={onValueClick}
            aria-label={valueAria}
            style={{ flex: 1, minWidth: 0, padding: '10px 0', display: 'flex', flexDirection: 'column', gap: '1px', textAlign: 'left', border: 'none', background: 'none', color: 'inherit', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            <span style={{ fontSize: '13px', color: T.soft }}>{label}</span>
            <span style={{ display: 'flex', alignItems: 'baseline', gap: '6px', minWidth: 0, maxWidth: '100%' }}>
              <span style={{ fontSize: '24px', fontWeight: 500, letterSpacing: '-0.02em', color: T.text, whiteSpace: 'nowrap' }}>
                {value}
                {unit && <span style={{ fontSize: '13px', fontWeight: 400, color: T.muted, marginLeft: '3px' }}>{unit}</span>}
              </span>
              {sub && (
                <span style={{ fontSize: '13px', color: T.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</span>
              )}
            </span>
          </button>
        )}
        {!editor && actions}
      </div>
    </div>
  )
}

// Inline number entry used inside a TrackerRow
function ValueEditor({ label, value, onChange, onSave, onCancel, type = 'number', inputMode, placeholder, saveLabel = 'Save' }) {
  const T = useContext(ThemeContext)
  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 0' }}>
      <input
        autoFocus
        type={type}
        inputMode={inputMode}
        value={value}
        placeholder={placeholder}
        aria-label={label}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') onCancel() }}
        style={{ ...fieldStyle(T), flex: 1, minWidth: 0, width: 'auto', backgroundColor: T.card2, fontSize: '18px' }}
      />
      <button onClick={onSave} style={{ ...primaryButton, padding: '0 14px', fontSize: '14px' }}>{saveLabel}</button>
      <button onClick={onCancel} aria-label="Cancel" style={{ ...iconButton, borderRadius: '12px', color: T.muted }}>
        <CloseIcon size={18} strokeWidth={2} />
      </button>
    </div>
  )
}

// Water card — the liquid rises with progress and two wave layers drift across the top
const WATER = { bg: '#0F1A26', front: '#2E7BD6B3', back: '#2E7BD666' }
const WAVE_BACK = 'M0 12 C 100 2, 100 2, 200 12 S 300 22, 400 12 S 500 2, 600 12 S 700 22, 800 12 V 24 H 0 Z'
const WAVE_FRONT = 'M0 12 C 100 4, 100 4, 200 12 S 300 20, 400 12 S 500 4, 600 12 S 700 20, 800 12 V 24 H 0 Z'

function WaterCard({ water, goal, buttons, canUndo, onAdd, onUndo }) {
  const met = goal > 0 && water >= goal
  // Cap the fill below the top edge so the waves always stay visible
  const level = water > 0 ? Math.min(88, Math.max(8, (goal > 0 ? water / goal : 0) * 88)) : 0
  return (
    <section aria-label="Water" style={{ position: 'relative', marginBottom: '16px', borderRadius: '24px', backgroundColor: WATER.bg, overflow: 'hidden', color: '#F2F3F5' }}>
      <style>{`
        @keyframes lytzWave { from { transform: translateX(0) } to { transform: translateX(-50%) } }
        .lytz-wave { animation: lytzWave 6s linear infinite }
        .lytz-wave-slow { animation: lytzWave 10s linear infinite }
        @media (prefers-reduced-motion: reduce) { .lytz-wave, .lytz-wave-slow { animation: none } }
      `}</style>

      <div aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: `${level}%`, transition: 'height 0.6s cubic-bezier(.2,.8,.2,1)' }}>
        {level > 0 && (
          <>
            <svg className="lytz-wave-slow" viewBox="0 0 800 24" preserveAspectRatio="none" style={{ position: 'absolute', left: 0, top: '-18px', width: '200%', height: '24px', display: 'block' }}>
              <path d={WAVE_BACK} fill={WATER.back} />
            </svg>
            <svg className="lytz-wave" viewBox="0 0 800 24" preserveAspectRatio="none" style={{ position: 'absolute', left: 0, top: '-12px', width: '200%', height: '14px', display: 'block' }}>
              <path d={WAVE_FRONT} fill={WATER.front} />
            </svg>
          </>
        )}
        <div style={{ position: 'absolute', inset: 0, backgroundColor: WATER.front }} />
      </div>

      <div style={{ position: 'relative', minHeight: '196px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '16px', padding: '18px 16px 14px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
          <div>
            <div style={{ fontSize: '14px', color: '#C9DDF0' }}>Water</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
              <span style={{ fontSize: '52px', fontWeight: 500, letterSpacing: '-0.03em', lineHeight: 1.05 }}>{fmtNum(water)}</span>
              <span style={{ fontSize: '15px', color: '#C9DDF0' }}>{goal > 0 ? `/ ${fmtNum(goal)} oz` : 'oz'}</span>
            </div>
          </div>
          {goal > 0 && (
            <span style={{
              height: '28px', display: 'flex', alignItems: 'center', padding: '0 10px',
              borderRadius: '999px', fontSize: '13px', fontWeight: 500, whiteSpace: 'nowrap',
              backgroundColor: met ? DONE : 'rgba(255,255,255,0.12)',
              color: met ? '#0B0C0E' : '#E6F1FB'
            }}>
              {met ? 'Goal hit' : `${fmtNum(goal - water)} oz to go`}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          <button
            onClick={onUndo}
            disabled={!canUndo}
            aria-label="Undo last water"
            style={{ ...iconButton, borderRadius: '12px', backgroundColor: 'rgba(255,255,255,0.10)', color: '#E6F1FB', opacity: canUndo ? 1 : 0.4, cursor: canUndo ? 'pointer' : 'default' }}
          >
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 14L4 9l5-5" /><path d="M4 9h10a6 6 0 0 1 0 12h-3" />
            </svg>
          </button>
          {buttons.map((amount, i) => (
            <button
              key={i}
              onClick={() => onAdd(amount)}
              aria-label={`Add ${amount} ounces of water`}
              style={{ flex: '1 0 52px', height: '44px', border: 'none', borderRadius: '12px', backgroundColor: 'rgba(255,255,255,0.14)', color: '#F2F3F5', fontSize: '15px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              +{amount}
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}

const SETTINGS_TITLES = {
  home: 'Goals',
  checklist: 'Habits',
  nutrition: 'Nutrients',
  water: 'Water',
  meals: 'Saved meals',
  feedback: 'Send feedback',
  appSettings: 'App settings'
}

const GOAL_TYPES = [
  { id: 'min', label: 'At least' },
  { id: 'max', label: 'At most' },
  { id: 'range', label: 'Between' }
]

// ── Goal guardrails ─────────────────────────────────────────────────────────
// 'block' stops Save (unsafe or impossible); 'warn' is shown but allowed.
const isCalorieMetric = (m) => m.key === 'calories' || /calor/i.test(m.name || '')
const isProteinMetric = (m) => m.key === 'protein' || /protein/i.test(m.name || '')

function checkMetricGoal(m) {
  const type = m.goalType || 'min'
  const goal = Number(m.goal) || 0
  const max = Number(m.goalMax) || 0
  if (type === 'range' && goal > 0 && max > 0 && max < goal) {
    return { level: 'block', text: 'The top of the range is below the bottom.' }
  }
  if (isCalorieMetric(m) && goal > 0) {
    const top = type === 'range' ? Math.max(goal, max) : goal
    if (goal < 500) return { level: 'block', text: 'Under 500 calories a day is too low to be safe. Use 500 or more.' }
    if (goal < 1200) return { level: 'warn', text: 'Under 1,200 calories is very low for most adults. Check with a doctor before eating this little.' }
    if (top > 5000) return { level: 'warn', text: 'Over 5,000 calories is unusually high. Double-check the number.' }
  }
  if (isProteinMetric(m) && goal > 400) {
    return { level: 'warn', text: 'Over 400 g of protein a day is unusually high. Double-check the number.' }
  }
  return null
}

function checkWaterGoal(oz) {
  const v = Number(oz) || 0
  if (v > 0 && v < 16) return { level: 'warn', text: 'Under 16 oz of water is very low. Most adults need 64 oz or more.' }
  if (v > 300) return { level: 'warn', text: 'Over 300 oz of water a day is unusually high. Double-check the number.' }
  return null
}

function GoalNote({ check }) {
  const T = useContext(ThemeContext)
  if (!check) return null
  return (
    <div role={check.level === 'block' ? 'alert' : 'status'} style={{ fontSize: '13px', lineHeight: 1.4, color: check.level === 'block' ? OVER : T.soft, display: 'flex', gap: '6px' }}>
      <span aria-hidden="true" style={{ flexShrink: 0 }}>{check.level === 'block' ? '!' : '·'}</span>
      <span>{check.text}</span>
    </div>
  )
}

// Goals overview: every daily target editable in place, then sections, then clear ways to start fresh
function GoalsOverview({ metrics, onUpdateMetric, waterGoal, onWaterGoal, counts, onOpen, onClearToday, onRedoSetup }) {
  const T = useContext(ThemeContext)
  const label = sectionLabel(T)
  const card = groupCard(T)
  const numberInput = (value, onChange, aria) => (
    <input
      value={value || ''}
      onChange={(e) => onChange(parseFloat(e.target.value.replace(/[^0-9.]/g, '')) || 0)}
      onFocus={(e) => e.target.select()}
      inputMode="decimal"
      aria-label={aria}
      placeholder="0"
      style={{ width: '76px', height: '40px', boxSizing: 'border-box', padding: '0 10px', borderRadius: '10px', textAlign: 'right', fontSize: '16px', fontWeight: 500, fontFamily: 'inherit', color: T.text, backgroundColor: T.card2, border: `1px solid ${T.border}` }}
    />
  )
  const rowButton = (id, title, detail) => (
    <button key={id} onClick={() => onOpen(id)} style={{ width: '100%', minHeight: '56px', display: 'flex', alignItems: 'center', gap: '8px', padding: '0 12px 0 16px', border: 'none', borderTop: `1px solid ${T.border}`, background: 'none', color: T.text, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}>
      <span style={{ flex: 1, fontSize: '15px' }}>{title}</span>
      {detail && <span style={{ fontSize: '14px', color: T.muted }}>{detail}</span>}
      <ChevronRightIcon size={18} color={T.muted} strokeWidth={2} />
    </button>
  )
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <section>
        <h3 style={label}>Daily targets</h3>
        <div style={card}>
          {metrics.length === 0 && (
            <div style={{ padding: '16px', fontSize: '14px', color: T.muted }}>No nutrition targets yet. Add some under Nutrients below.</div>
          )}
          {metrics.map((m, i) => {
            const type = m.goalType || 'min'
            return (
              <div key={i} style={{ padding: '12px 12px 12px 16px', borderTop: i ? `1px solid ${T.border}` : 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span aria-hidden="true" style={{ width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0, backgroundColor: T.hues[i % T.hues.length] }} />
                  <span style={{ flex: 1, fontSize: '15px', color: T.text }}>{m.name || 'Untitled'}</span>
                  {numberInput(m.goal, (v) => onUpdateMetric(i, 'goal', v), `${m.name} ${type === 'range' ? 'minimum' : 'target'}`)}
                  {type === 'range' && <span style={{ color: T.muted }}>–</span>}
                  {type === 'range' && numberInput(m.goalMax, (v) => onUpdateMetric(i, 'goalMax', v), `${m.name} maximum`)}
                  <span style={{ width: '28px', fontSize: '13px', color: T.muted }}>{m.unit}</span>
                </div>
                <div style={{ paddingLeft: '18px' }}><GoalNote check={checkMetricGoal(m)} /></div>
                <div role="group" aria-label={`${m.name} goal type`} style={{ display: 'flex', gap: '4px', paddingLeft: '18px' }}>
                  {GOAL_TYPES.map(g => (
                    <button key={g.id} onClick={() => onUpdateMetric(i, 'goalType', g.id)} aria-pressed={type === g.id} style={{
                      height: '32px', padding: '0 12px', border: 'none', borderRadius: '999px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                      backgroundColor: type === g.id ? T.text : T.card2, color: type === g.id ? T.bg : T.soft
                    }}>
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
          <div style={{ minHeight: '56px', padding: '0 12px 0 16px', borderTop: metrics.length ? `1px solid ${T.border}` : 'none', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span aria-hidden="true" style={{ width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0, backgroundColor: '#2E7BD6' }} />
            <span style={{ flex: 1, fontSize: '15px', color: T.text }}>Water</span>
            {numberInput(waterGoal, onWaterGoal, 'Daily water goal in ounces')}
            <span style={{ width: '28px', fontSize: '13px', color: T.muted }}>oz</span>
          </div>
          {checkWaterGoal(waterGoal) && (
            <div style={{ padding: '0 16px 12px 34px' }}><GoalNote check={checkWaterGoal(waterGoal)} /></div>
          )}
        </div>
      </section>

      <section>
        <h3 style={label}>What you track</h3>
        <div style={{ ...card, marginTop: 0 }}>
          <div style={{ marginTop: '-1px' }}>
            {rowButton('checklist', 'Habits', plural(counts.checklist, 'habit'))}
            {rowButton('nutrition', 'Nutrients', plural(counts.nutrition, 'nutrient'))}
            {rowButton('water', 'Water buttons & reminder', plural(counts.water, 'button'))}
            {rowButton('meals', 'Saved meals', plural(counts.meals, 'meal'))}
          </div>
        </div>
      </section>

      <section>
        <h3 style={label}>Start fresh</h3>
        <div style={card}>
          <button onClick={onClearToday} style={{ width: '100%', padding: '14px 16px', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '15px', color: OVER }}>Clear today</span>
            <span style={{ fontSize: '13px', color: T.muted }}>Removes today's food, water and habit checks. Your goals stay.</span>
          </button>
          <button onClick={onRedoSetup} style={{ width: '100%', padding: '14px 16px', border: 'none', borderTop: `1px solid ${T.border}`, background: 'none', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '15px', color: T.text }}>Redo setup</span>
            <span style={{ fontSize: '13px', color: T.muted }}>Answer a few questions and get new recommended goals.</span>
          </button>
        </div>
      </section>

      <section>
        <div style={card}>
          <div style={{ marginTop: '-1px' }}>
            {rowButton('appSettings', 'App settings')}
            {rowButton('feedback', 'Send feedback')}
          </div>
        </div>
      </section>
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
  onRedoSetup,
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

  const blockingGoal = tempMetrics.find(m => m.name?.trim() && checkMetricGoal(m)?.level === 'block')

  const handleSave = () => {
    if (blockingGoal) { setSettingsTab('home'); return }
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
      backgroundColor: 'rgba(0, 0, 0, 0.55)',
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div role="dialog" aria-modal="true" aria-label={SETTINGS_TITLES[settingsTab] || 'Goals'} style={{
        backgroundColor: T.bg,
        borderRadius: '24px 24px 0 0',
        width: '100%',
        maxWidth: '600px',
        height: 'min(92vh, 860px)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: FONT
      }}>
        {/* Header — overview, or a section with a way back */}
        <div style={{ padding: '12px 12px 8px 16px', display: 'flex', alignItems: 'center', gap: '4px' }}>
          {settingsTab !== 'home' && (
            <button onClick={() => setSettingsTab('home')} aria-label="Back to goals" style={{ ...iconButton, width: '36px', color: T.muted }}>
              <ChevronLeftIcon size={20} strokeWidth={2} />
            </button>
          )}
          <h2 style={{ margin: 0, flex: 1, fontSize: '20px', fontWeight: 500, color: T.text }}>
            {SETTINGS_TITLES[settingsTab] || 'Goals'}
          </h2>
          <button onClick={onClose} aria-label="Close" style={{ ...iconButton, color: T.muted }}>
            <CloseIcon size={18} strokeWidth={2} />
          </button>
        </div>

        {/* Content */}
        <div ref={contentRef} style={{
          flex: 1,
          overflow: 'auto',
          padding: '8px 16px 24px',
          backgroundColor: T.bg
        }}>
          <div>
          {settingsTab === 'home' && (
            <GoalsOverview
              metrics={tempMetrics}
              onUpdateMetric={updateNutritionMetric}
              waterGoal={tempWaterGoal}
              onWaterGoal={setTempWaterGoal}
              counts={{
                checklist: tempChecklist.filter(i => i.name?.trim()).length,
                nutrition: tempMetrics.length,
                water: tempWater.filter(a => a > 0).length,
                meals: tempMeals.filter(Boolean).length
              }}
              onOpen={setSettingsTab}
              onClearToday={() => { if (onResetDay()) onClose() }}
              onRedoSetup={onRedoSetup}
            />
          )}

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
              <section style={{ marginTop: '24px' }}>
                <h3 style={sectionLabel(T)}>Missed-day reminder</h3>
                <label style={{ ...groupCard(T), minHeight: '56px', padding: '8px 12px 8px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '15px', color: T.text }}>Remind me if nothing's logged after</span>
                    <span style={{ fontSize: '13px', color: T.muted }}>You'll get a nudge the next morning</span>
                  </span>
                  <select
                    value={eveningCutoff}
                    onChange={e => onSaveEveningCutoff(e.target.value)}
                    style={{ height: '40px', padding: '0 10px', borderRadius: '10px', border: `1px solid ${T.border}`, backgroundColor: T.card2, color: T.text, fontSize: '15px', fontFamily: 'inherit', cursor: 'pointer' }}
                  >
                    <option value="18:00">6:00 PM</option>
                    <option value="18:30">6:30 PM</option>
                    <option value="19:00">7:00 PM</option>
                    <option value="19:30">7:30 PM</option>
                    <option value="20:00">8:00 PM</option>
                    <option value="20:30">8:30 PM</option>
                    <option value="21:00">9:00 PM</option>
                  </select>
                </label>
              </section>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <section>
                <h3 style={sectionLabel(T)}>Appearance</h3>
                <div style={{ ...groupCard(T), minHeight: '56px', padding: '0 12px 0 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ flex: 1, fontSize: '15px', color: T.text }}>Dark mode</span>
                  <button
                    onClick={onToggleTheme}
                    role="switch"
                    aria-checked={darkMode}
                    aria-label="Dark mode"
                    style={{ width: '52px', height: '32px', borderRadius: '16px', border: 'none', cursor: 'pointer', position: 'relative', backgroundColor: darkMode ? DONE : T.card2, transition: 'background-color 0.2s' }}
                  >
                    <span aria-hidden="true" style={{ position: 'absolute', top: '3px', left: darkMode ? '23px' : '3px', width: '26px', height: '26px', borderRadius: '50%', backgroundColor: darkMode ? '#0B0C0E' : T.text, transition: 'left 0.2s' }} />
                  </button>
                </div>
              </section>

              {user && (
                <section>
                  <h3 style={sectionLabel(T)}>Account</h3>
                  <div style={groupCard(T)}>
                    <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontSize: '13px', color: T.muted }}>Signed in as</span>
                      <span style={{ fontSize: '15px', color: T.text, overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.email}</span>
                    </div>
                    <button onClick={onSignOut} style={{ width: '100%', minHeight: '52px', padding: '0 16px', border: 'none', borderTop: `1px solid ${T.border}`, background: 'none', color: OVER, fontSize: '15px', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}>
                      Sign out
                    </button>
                  </div>
                </section>
              )}
            </div>
          )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 16px calc(16px + env(safe-area-inset-bottom))', borderTop: `1px solid ${T.border}`, backgroundColor: T.bg, display: 'flex', gap: '8px' }}>
          <button onClick={onClose} style={{ flex: 1, height: '52px', border: 'none', borderRadius: '14px', backgroundColor: T.card, color: T.soft, fontSize: '15px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
            Cancel
          </button>
          <button onClick={handleSave} aria-disabled={!!blockingGoal} style={{ ...primaryButton, flex: 2, height: '52px', borderRadius: '14px', opacity: blockingGoal ? 0.45 : 1 }}>
            {blockingGoal ? `Fix ${blockingGoal.name} goal to save` : 'Save'}
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
      <div style={{ ...groupCard(T), padding: '20px 16px' }}>
        <div style={{ fontSize: '15px', color: T.text, marginBottom: '4px' }}>Sign in to send feedback</div>
        <div style={{ fontSize: '13px', color: T.muted }}>Create an account to report bugs or request features.</div>
      </div>
    )
  }

  const ready = message.trim() && !sending
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <section>
        <h3 style={sectionLabel(T)}>What kind?</h3>
        <Pills T={T} label="Feedback type" value={type} onChange={setType} options={[
          { id: 'bug', label: 'Something broke' },
          { id: 'feature', label: 'Idea' },
          { id: 'other', label: 'Other' }
        ]} />
      </section>
      <label>
        <span style={{ ...sectionLabel(T), display: 'block' }}>Message</span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={type === 'bug' ? 'What happened, and what did you expect?' : type === 'feature' ? 'What would make Lytz better?' : "What's on your mind?"}
          style={{ width: '100%', minHeight: '140px', padding: '14px 16px', boxSizing: 'border-box', borderRadius: '18px', border: 'none', backgroundColor: T.card, color: T.text, fontSize: '16px', fontFamily: 'inherit', resize: 'vertical' }}
        />
      </label>
      {sent && <div role="status" style={{ fontSize: '14px', color: DONE }}>Thanks! We'll take a look.</div>}
      <button onClick={handleSubmit} disabled={!ready} style={{ ...primaryButton, width: '100%', height: '52px', opacity: ready ? 1 : 0.4, cursor: ready ? 'pointer' : 'default' }}>
        {sending ? 'Sending…' : 'Send feedback'}
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
          bg: 'rgba(184,240,106,0.1)',
          border: 'rgba(184,240,106,0.35)',
          icon: '#16a34a',
          label: '#16a34a',
          text: '#B8F06A'
        }
      }
    }

    if (notif.type === 'announcement') {
      return {
        icon: 'sparkle',
        label: notif.title || 'NEW FEATURE',
        message: notif.message,
        colors: {
          bg: 'rgba(184,240,106,0.08)',
          border: 'rgba(184,240,106,0.35)',
          icon: '#B8F06A',
          label: '#B8F06A',
          text: T.text
        }
      }
    }

    return {
      icon: 'info',
      label: 'Notification',
      message: 'You have a new notification.',
      colors: {
        bg: 'rgba(184,240,106,0.08)',
        border: 'rgba(184,240,106,0.25)',
        icon: '#B8F06A',
        label: '#B8F06A',
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
// ─── Goals section editors (shared look) ──────────────────────────────────────

const sectionLabel = (T) => ({ fontSize: '13px', color: T.muted, margin: '0 0 8px 4px', fontWeight: 400 })
const groupCard = (T) => ({ backgroundColor: T.card, borderRadius: '18px', overflow: 'hidden' })
const plainInput = (T) => ({
  flex: 1, minWidth: 0, height: '44px', padding: '0 4px', border: 'none', outline: 'none',
  background: 'none', color: T.text, fontSize: '16px', fontFamily: 'inherit'
})
const smallField = (T, width = '76px') => ({
  width, height: '40px', boxSizing: 'border-box', padding: '0 10px', borderRadius: '10px', textAlign: 'right',
  fontSize: '16px', fontWeight: 500, fontFamily: 'inherit', color: T.text, backgroundColor: T.card2, border: `1px solid ${T.border}`
})
const addRowButton = (T) => ({
  width: '100%', height: '48px', marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
  border: `1px dashed ${T.border}`, borderRadius: '14px', background: 'none', color: T.soft, fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit'
})
const numberValue = (v) => parseFloat(String(v).replace(/[^0-9.]/g, '')) || 0

function Pills({ T, options, value, onChange, label }) {
  return (
    <div role="group" aria-label={label} style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
      {options.map(o => (
        <button key={o.id} type="button" onClick={() => onChange(o.id)} aria-pressed={value === o.id} style={{
          height: '32px', padding: '0 12px', border: 'none', borderRadius: '999px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
          backgroundColor: value === o.id ? T.text : T.card2, color: value === o.id ? T.bg : T.soft
        }}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

// Small up / down / remove controls at the end of a list row
function RowControls({ T, name, index, count, onMove, onRemove }) {
  const small = { ...iconButton, width: '32px', color: T.muted }
  return (
    <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
      {onMove && (
        <>
          <button onClick={() => onMove(index, -1)} disabled={index === 0} aria-label={`Move ${name} up`} style={{ ...small, opacity: index === 0 ? 0.3 : 1 }}>
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 15l6-6 6 6" /></svg>
          </button>
          <button onClick={() => onMove(index, 1)} disabled={index === count - 1} aria-label={`Move ${name} down`} style={{ ...small, opacity: index === count - 1 ? 0.3 : 1 }}>
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
          </button>
        </>
      )}
      <button onClick={() => onRemove(index)} aria-label={`Remove ${name}`} style={{ ...iconButton, width: '40px', color: T.muted }}>
        <CloseIcon size={16} strokeWidth={2} />
      </button>
    </div>
  )
}

const FREQUENCIES = [
  { id: 'daily', label: 'Daily' },
  { id: 'multiple', label: 'Several a day' },
  { id: 'weekly', label: 'Weekly' }
]

function ChecklistSettings({ items, onAdd, onUpdate, onRemove, onMove }) {
  const T = useContext(ThemeContext)
  return (
    <div>
      <h3 style={sectionLabel(T)}>Habits you check off</h3>
      <div style={groupCard(T)}>
        {items.length === 0 && (
          <div style={{ padding: '16px', fontSize: '14px', color: T.muted }}>No habits yet. Add one below.</div>
        )}
        {items.map((item, i) => {
          const freq = item.frequency || 'daily'
          return (
            <div key={i} style={{ padding: '6px 4px 12px 16px', borderTop: i ? `1px solid ${T.border}` : 'none', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input
                  type="text"
                  value={item.name}
                  onChange={(e) => onUpdate(i, 'name', e.target.value)}
                  placeholder="Habit name, e.g. Take vitamins"
                  aria-label={`Habit ${i + 1} name`}
                  style={plainInput(T)}
                />
                <RowControls T={T} name={item.name || 'habit'} index={i} count={items.length} onMove={onMove} onRemove={onRemove} />
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
                <Pills T={T} label={`How often for ${item.name || 'this habit'}`} options={FREQUENCIES} value={freq} onChange={(v) => onUpdate(i, 'frequency', v)} />
                {freq === 'multiple' && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: T.muted }}>
                    <input
                      value={item.targetCount || 2}
                      onChange={(e) => onUpdate(i, 'targetCount', Math.max(2, Math.min(20, parseInt(e.target.value) || 2)))}
                      onFocus={(e) => e.target.select()}
                      inputMode="numeric"
                      aria-label="Times per day"
                      style={{ ...smallField(T, '52px'), height: '32px', textAlign: 'center' }}
                    />
                    times a day
                  </label>
                )}
              </div>
            </div>
          )
        })}
      </div>
      <button onClick={onAdd} style={addRowButton(T)}>
        <PlusIcon size={16} strokeWidth={2} /> Add a habit
      </button>
    </div>
  )
}

// ── Micronutrient preset definitions ──────────────────────────────────────────
const MICRONUTRIENT_PRESETS = {
  vitamins: [
    { key: 'vitaminA',   name: 'Vitamin A',   unit: 'mcg', goal: 700,  goalType: 'min', goalMax: 0 },
    { key: 'vitaminC',   name: 'Vitamin C',   unit: 'mg',  goal: 90,   goalType: 'min', goalMax: 0 },
    { key: 'vitaminD',   name: 'Vitamin D',   unit: 'mcg', goal: 20,   goalType: 'min', goalMax: 0 },
    { key: 'vitaminE',   name: 'Vitamin E',   unit: 'mg',  goal: 15,   goalType: 'min', goalMax: 0 },
    { key: 'vitaminK',   name: 'Vitamin K',   unit: 'mcg', goal: 120,  goalType: 'min', goalMax: 0 },
    { key: 'vitaminB1',  name: 'Thiamine (B1)',  unit: 'mg',  goal: 1.2,  goalType: 'min', goalMax: 0 },
    { key: 'vitaminB2',  name: 'Riboflavin (B2)', unit: 'mg', goal: 1.3, goalType: 'min', goalMax: 0 },
    { key: 'vitaminB3',  name: 'Niacin (B3)', unit: 'mg',  goal: 16,   goalType: 'min', goalMax: 0 },
    { key: 'vitaminB5',  name: 'Pantothenic Acid (B5)', unit: 'mg', goal: 5, goalType: 'min', goalMax: 0 },
    { key: 'vitaminB6',  name: 'Vitamin B6',  unit: 'mg',  goal: 1.7,  goalType: 'min', goalMax: 0 },
    { key: 'biotin',     name: 'Biotin (B7)', unit: 'mcg', goal: 30,   goalType: 'min', goalMax: 0 },
    { key: 'folate',     name: 'Folate (B9)', unit: 'mcg', goal: 400,  goalType: 'min', goalMax: 0 },
    { key: 'vitaminB12', name: 'Vitamin B12', unit: 'mcg', goal: 2.4,  goalType: 'min', goalMax: 0 },
  ],
  minerals: [
    { key: 'calcium',    name: 'Calcium',    unit: 'mg',  goal: 1000, goalType: 'min', goalMax: 0 },
    { key: 'iron',       name: 'Iron',       unit: 'mg',  goal: 18,   goalType: 'min', goalMax: 0 },
    { key: 'magnesium',  name: 'Magnesium',  unit: 'mg',  goal: 420,  goalType: 'min', goalMax: 0 },
    { key: 'phosphorus', name: 'Phosphorus', unit: 'mg',  goal: 700,  goalType: 'min', goalMax: 0 },
    { key: 'potassium',  name: 'Potassium',  unit: 'mg',  goal: 3500, goalType: 'min', goalMax: 0 },
    { key: 'sodium',     name: 'Sodium',     unit: 'mg',  goal: 2300, goalType: 'max', goalMax: 0 },
    { key: 'zinc',       name: 'Zinc',       unit: 'mg',  goal: 11,   goalType: 'min', goalMax: 0 },
    { key: 'copper',     name: 'Copper',     unit: 'mg',  goal: 0.9,  goalType: 'min', goalMax: 0 },
    { key: 'manganese',  name: 'Manganese',  unit: 'mg',  goal: 2.3,  goalType: 'min', goalMax: 0 },
    { key: 'selenium',   name: 'Selenium',   unit: 'mcg', goal: 55,   goalType: 'min', goalMax: 0 },
    { key: 'iodine',     name: 'Iodine',     unit: 'mcg', goal: 150,  goalType: 'min', goalMax: 0 },
    { key: 'chromium',   name: 'Chromium',   unit: 'mcg', goal: 35,   goalType: 'min', goalMax: 0 },
  ],
  other: [
    { key: 'saturatedFat',  name: 'Saturated Fat', unit: 'g',  goal: 20,  goalType: 'max', goalMax: 0 },
    { key: 'transFat',      name: 'Trans Fat',     unit: 'g',  goal: 2,   goalType: 'max', goalMax: 0 },
    { key: 'cholesterol',   name: 'Cholesterol',   unit: 'mg', goal: 300, goalType: 'max', goalMax: 0 },
    { key: 'sugar',         name: 'Sugar',         unit: 'g',  goal: 50,  goalType: 'max', goalMax: 0 },
    { key: 'omega3',        name: 'Omega-3',       unit: 'g',  goal: 1.6, goalType: 'min', goalMax: 0 },
  ],
}

function NutritionSettings({ metrics, onAdd, onUpdate, onRemove }) {
  const T = useContext(ThemeContext)
  const [showMicroPicker, setShowMicroPicker] = useState(false)
  const [microTab, setMicroTab] = useState('vitamins')

  const isAdded = (key) => metrics.some(m => m.key === key)
  const togglePreset = (preset) => {
    if (isAdded(preset.key)) onRemove(metrics.findIndex(m => m.key === preset.key))
    else onAdd(preset)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <section>
        <h3 style={sectionLabel(T)}>Nutrients on your Today screen</h3>
        <div style={groupCard(T)}>
          {metrics.length === 0 && (
            <div style={{ padding: '16px', fontSize: '14px', color: T.muted }}>Nothing tracked yet. Add calories, protein or anything else below.</div>
          )}
          {metrics.map((metric, i) => {
            const type = metric.goalType || 'min'
            return (
              <div key={i} style={{ padding: '6px 4px 14px 16px', borderTop: i ? `1px solid ${T.border}` : 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span aria-hidden="true" style={{ width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0, backgroundColor: T.hues[i % T.hues.length] }} />
                  <input
                    type="text"
                    value={metric.name}
                    onChange={(e) => onUpdate(i, 'name', e.target.value)}
                    placeholder="Name, e.g. Fiber"
                    aria-label={`Nutrient ${i + 1} name`}
                    style={plainInput(T)}
                  />
                  <RowControls T={T} name={metric.name || 'nutrient'} index={i} count={metrics.length} onRemove={onRemove} />
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', paddingLeft: '16px', paddingRight: '12px' }}>
                  <Pills T={T} label={`${metric.name || 'Nutrient'} goal type`} options={GOAL_TYPES} value={type} onChange={(v) => onUpdate(i, 'goalType', v)} />
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', paddingLeft: '16px', paddingRight: '12px' }}>
                  <input value={metric.goal || ''} onChange={(e) => onUpdate(i, 'goal', numberValue(e.target.value))} onFocus={(e) => e.target.select()}
                    inputMode="decimal" placeholder="Goal" aria-label={`${metric.name} ${type === 'range' ? 'minimum' : 'goal'}`} style={smallField(T)} />
                  {type === 'range' && <span style={{ color: T.muted }}>–</span>}
                  {type === 'range' && (
                    <input value={metric.goalMax || ''} onChange={(e) => onUpdate(i, 'goalMax', numberValue(e.target.value))} onFocus={(e) => e.target.select()}
                      inputMode="decimal" placeholder="Max" aria-label={`${metric.name} maximum`} style={smallField(T)} />
                  )}
                  <input value={metric.unit} onChange={(e) => onUpdate(i, 'unit', e.target.value)}
                    placeholder="unit" aria-label={`${metric.name} unit`} style={{ ...smallField(T, '64px'), textAlign: 'left' }} />
                  <span style={{ fontSize: '13px', color: T.muted }}>per day</span>
                </div>
                <div style={{ paddingLeft: '16px', paddingRight: '12px' }}><GoalNote check={checkMetricGoal(metric)} /></div>
              </div>
            )
          })}
        </div>
        <button onClick={() => onAdd()} style={addRowButton(T)}>
          <PlusIcon size={16} strokeWidth={2} /> Add a nutrient
        </button>
      </section>

      <section>
        <div style={groupCard(T)}>
          <button
            onClick={() => setShowMicroPicker(v => !v)}
            aria-expanded={showMicroPicker}
            style={{ width: '100%', minHeight: '60px', padding: '10px 12px 10px 16px', border: 'none', background: 'none', color: T.text, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '15px' }}>Add vitamins & minerals</span>
              <span style={{ fontSize: '13px', color: T.muted }}>Goals start at standard daily values</span>
            </span>
            <ChevronDownIcon size={18} color={T.muted} strokeWidth={2} />
          </button>
          {showMicroPicker && (
            <div style={{ padding: '4px 16px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <Pills T={T} label="Category" value={microTab} onChange={setMicroTab} options={[
                { id: 'vitamins', label: 'Vitamins' },
                { id: 'minerals', label: 'Minerals' },
                { id: 'other', label: 'Other' }
              ]} />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {MICRONUTRIENT_PRESETS[microTab].map(preset => {
                  const active = isAdded(preset.key)
                  return (
                    <button key={preset.key} onClick={() => togglePreset(preset)} aria-pressed={active} style={{
                      height: '36px', padding: '0 12px', display: 'flex', alignItems: 'center', gap: '4px', borderRadius: '999px', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit',
                      border: `1px solid ${active ? DONE : T.border}`, backgroundColor: active ? 'rgba(184,240,106,0.12)' : 'transparent', color: active ? T.text : T.soft
                    }}>
                      {active && <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={DONE} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>}
                      {preset.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function WaterSettings({ buttons, goal, onGoalChange, onAdd, onUpdate, onRemove, onMove }) {
  const T = useContext(ThemeContext)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <section>
        <h3 style={sectionLabel(T)}>Daily goal</h3>
        <div style={{ ...groupCard(T), minHeight: '56px', padding: '0 12px 0 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span aria-hidden="true" style={{ width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0, backgroundColor: '#2E7BD6' }} />
          <span style={{ flex: 1, fontSize: '15px', color: T.text }}>Water</span>
          <input value={goal || ''} onChange={(e) => onGoalChange(numberValue(e.target.value))} onFocus={(e) => e.target.select()}
            inputMode="decimal" placeholder="0" aria-label="Daily water goal in ounces" style={smallField(T)} />
          <span style={{ width: '24px', fontSize: '13px', color: T.muted }}>oz</span>
        </div>
        {checkWaterGoal(goal) && <div style={{ padding: '8px 4px 0' }}><GoalNote check={checkWaterGoal(goal)} /></div>}
      </section>

      <section>
        <h3 style={sectionLabel(T)}>Quick-add buttons on the water card</h3>
        <div style={groupCard(T)}>
          {buttons.length === 0 && (
            <div style={{ padding: '16px', fontSize: '14px', color: T.muted }}>No buttons yet. Add the bottle or glass sizes you use.</div>
          )}
          {buttons.map((amount, i) => (
            <div key={i} style={{ minHeight: '56px', padding: '0 4px 0 16px', borderTop: i ? `1px solid ${T.border}` : 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '15px', color: T.soft }}>+</span>
              <input value={amount === 0 ? '' : amount} onChange={(e) => onUpdate(i, e.target.value.replace(/[^0-9]/g, ''))} onFocus={(e) => e.target.select()}
                inputMode="numeric" placeholder="0" aria-label={`Button ${i + 1} ounces`} style={{ ...smallField(T, '72px'), textAlign: 'left' }} />
              <span style={{ flex: 1, fontSize: '13px', color: T.muted }}>oz</span>
              <RowControls T={T} name={`${amount || ''} oz button`} index={i} count={buttons.length} onMove={onMove} onRemove={onRemove} />
            </div>
          ))}
        </div>
        <button onClick={onAdd} style={addRowButton(T)}>
          <PlusIcon size={16} strokeWidth={2} /> Add a button
        </button>
      </section>
    </div>
  )
}

function MealSettings({ meals, metrics, onUpdate, onRemove }) {
  const T = useContext(ThemeContext)
  const saved = meals.map((meal, i) => ({ meal, i })).filter(({ meal }) => meal)
  const nextFree = meals.findIndex(m => !m)

  if (metrics.length === 0) {
    return (
      <div style={{ ...groupCard(T), padding: '16px', fontSize: '14px', color: T.muted }}>
        Add a nutrient first, then you can save meals with their numbers.
      </div>
    )
  }

  return (
    <div>
      <h3 style={sectionLabel(T)}>One tap logs a saved meal from "Eaten before"</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {saved.length === 0 && (
          <div style={{ ...groupCard(T), padding: '16px', fontSize: '14px', color: T.muted }}>No saved meals yet.</div>
        )}
        {saved.map(({ meal, i }) => (
          <div key={i} style={{ ...groupCard(T), padding: '6px 4px 14px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <input type="text" value={meal.name || ''} onChange={(e) => onUpdate(i, 'name', e.target.value)}
                placeholder="Meal name, e.g. Protein shake" aria-label="Meal name" style={{ ...plainInput(T), fontWeight: 500 }} />
              <RowControls T={T} name={meal.name || 'meal'} index={i} count={meals.length} onRemove={onRemove} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px 12px', paddingRight: '12px' }}>
              {metrics.map((metric, k) => (
                <label key={metric.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: T.soft, minWidth: 0 }}>
                  <span aria-hidden="true" style={{ width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0, backgroundColor: T.hues[k % T.hues.length] }} />
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{metric.name}</span>
                  <input value={meal[metric.key] || ''} onChange={(e) => onUpdate(i, metric.key, numberValue(e.target.value))} onFocus={(e) => e.target.select()}
                    inputMode="decimal" placeholder="0" aria-label={`${meal.name || 'Meal'} ${metric.name}`} style={smallField(T, '64px')} />
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
      {nextFree >= 0 && (
        <button onClick={() => onUpdate(nextFree, 'name', '')} style={addRowButton(T)}>
          <PlusIcon size={16} strokeWidth={2} /> Save a meal
        </button>
      )}
    </div>
  )
}
