// lib/dataSync.js - Sync nutrition data with Firestore
import { doc, getDoc, setDoc, collection, getDocs, writeBatch, onSnapshot } from 'firebase/firestore'
import { db, isConfigured } from './firebase'

// Real-time listener for today's data
export function subscribeTodayData(userId, callback) {
  if (!isConfigured || !db || !userId) return () => {}

  const today = new Date().toISOString().split('T')[0]
  const docRef = doc(db, 'users', userId, 'dailyData', today)

  return onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      callback(docSnap.data())
    } else {
      callback(null)
    }
  }, (error) => {
    console.error('Error in today data listener:', error)
  })
}

// Real-time listener for user settings
export function subscribeUserSettings(userId, callback) {
  if (!isConfigured || !db || !userId) return () => {}

  const docRef = doc(db, 'users', userId, 'settings', 'config')

  return onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      callback(docSnap.data())
    } else {
      callback(null)
    }
  }, (error) => {
    console.error('Error in settings listener:', error)
  })
}

// Save today's data to Firestore
export async function saveTodayData(userId, data) {
  if (!isConfigured || !db || !userId) return false

  try {
    const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD format
    const docRef = doc(db, 'users', userId, 'dailyData', today)
    await setDoc(docRef, {
      ...data,
      updatedAt: new Date().toISOString()
    }, { merge: true })
    return true
  } catch (error) {
    console.error('Error saving data:', error)
    return false
  }
}

// Load today's data from Firestore
export async function loadTodayData(userId) {
  if (!isConfigured || !db || !userId) return null

  try {
    const today = new Date().toISOString().split('T')[0]
    const docRef = doc(db, 'users', userId, 'dailyData', today)
    const docSnap = await getDoc(docRef)

    if (docSnap.exists()) {
      return docSnap.data()
    }
    return null
  } catch (error) {
    console.error('Error loading data:', error)
    return null
  }
}

// Save user settings (metrics, checklist items, water settings, meals)
export async function saveUserSettings(userId, settings) {
  if (!isConfigured || !db || !userId) return false

  try {
    const docRef = doc(db, 'users', userId, 'settings', 'config')
    await setDoc(docRef, {
      ...settings,
      updatedAt: new Date().toISOString()
    }, { merge: true })
    return true
  } catch (error) {
    console.error('Error saving settings:', error)
    return false
  }
}

// Load user settings
export async function loadUserSettings(userId) {
  if (!isConfigured || !db || !userId) return null

  try {
    const docRef = doc(db, 'users', userId, 'settings', 'config')
    const docSnap = await getDoc(docRef)

    if (docSnap.exists()) {
      return docSnap.data()
    }
    return null
  } catch (error) {
    console.error('Error loading settings:', error)
    return null
  }
}

// Save historical data (for reports)
export async function saveHistoryEntry(userId, date, data) {
  if (!isConfigured || !db || !userId) return false

  try {
    // Always normalize to YYYY-MM-DD format
    const dateStr = new Date(date).toISOString().split('T')[0]
    const docRef = doc(db, 'users', userId, 'history', dateStr)
    await setDoc(docRef, {
      ...data,
      date: dateStr,
      updatedAt: new Date().toISOString()
    }, { merge: true })
    return true
  } catch (error) {
    console.error('Error saving history:', error)
    return false
  }
}

// Load all history (for reports) - checks both history and dailyData collections
export async function loadHistory(userId, limitDays = 365) {
  if (!isConfigured || !db || !userId) return []

  try {
    const entriesByDate = {}

    // Load from history collection
    const historyRef = collection(db, 'users', userId, 'history')
    const historySnapshot = await getDocs(historyRef)
    historySnapshot.forEach((doc) => {
      const data = doc.data()
      const dateKey = new Date(data.date).toISOString().split('T')[0]
      entriesByDate[dateKey] = { id: doc.id, ...data, date: dateKey }
    })

    // Also load from dailyData collection (may have entries not yet in history)
    const dailyRef = collection(db, 'users', userId, 'dailyData')
    const dailySnapshot = await getDocs(dailyRef)
    dailySnapshot.forEach((doc) => {
      const data = doc.data()
      const dateKey = doc.id // dailyData uses YYYY-MM-DD as doc ID
      // Only add if not already in history, or if dailyData is newer
      if (!entriesByDate[dateKey] ||
          (data.updatedAt && (!entriesByDate[dateKey].updatedAt || data.updatedAt > entriesByDate[dateKey].updatedAt))) {
        entriesByDate[dateKey] = { id: doc.id, ...data, date: dateKey }
      }
    })

    // Convert to array, sort, and limit
    return Object.values(entriesByDate)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, limitDays)
  } catch (error) {
    console.error('Error loading history:', error)
    return []
  }
}

// Migrate localStorage data to Firestore (one-time migration)
export async function migrateLocalStorageToFirestore(userId) {
  if (!isConfigured || !db || !userId) return false

  try {
    const batch = writeBatch(db)

    // Migrate settings
    const settings = {}
    const checklistItems = localStorage.getItem('checklist-items')
    const nutritionMetrics = localStorage.getItem('nutrition-metrics')
    const waterButtons = localStorage.getItem('water-buttons')
    const waterGoal = localStorage.getItem('water-goal')
    const customMeals = localStorage.getItem('custom-meals')

    if (checklistItems) settings.checklistItems = JSON.parse(checklistItems)
    if (nutritionMetrics) settings.nutritionMetrics = JSON.parse(nutritionMetrics)
    if (waterButtons) settings.waterButtons = JSON.parse(waterButtons)
    if (waterGoal) settings.waterGoal = Number(waterGoal)
    if (customMeals) settings.meals = JSON.parse(customMeals)

    if (Object.keys(settings).length > 0) {
      const settingsRef = doc(db, 'users', userId, 'settings', 'config')
      batch.set(settingsRef, { ...settings, migratedAt: new Date().toISOString() }, { merge: true })
    }

    // Migrate today's data
    const todayData = localStorage.getItem('nutrition-data')
    if (todayData) {
      const data = JSON.parse(todayData)
      const today = new Date().toISOString().split('T')[0]
      const todayRef = doc(db, 'users', userId, 'dailyData', today)
      batch.set(todayRef, { ...data, migratedAt: new Date().toISOString() }, { merge: true })
    }

    // Migrate history
    const history = localStorage.getItem('nutrition-history')
    if (history) {
      const historyData = JSON.parse(history)
      for (const entry of historyData) {
        if (entry.date) {
          // Convert date string to YYYY-MM-DD format
          const dateObj = new Date(entry.date)
          const dateStr = dateObj.toISOString().split('T')[0]
          const historyRef = doc(db, 'users', userId, 'history', dateStr)
          batch.set(historyRef, { ...entry, date: dateStr, migratedAt: new Date().toISOString() }, { merge: true })
        }
      }
    }

    await batch.commit()

    // Mark migration as complete in localStorage
    localStorage.setItem('firebase-migrated', 'true')

    return true
  } catch (error) {
    console.error('Migration error:', error)
    return false
  }
}

// Check if migration is needed
export function needsMigration() {
  return localStorage.getItem('firebase-migrated') !== 'true' &&
    (localStorage.getItem('nutrition-data') || localStorage.getItem('checklist-items'))
}
