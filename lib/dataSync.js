// lib/dataSync.js - Sync nutrition data with Firestore
import { doc, getDoc, setDoc, collection, getDocs, writeBatch, onSnapshot, addDoc, updateDoc, query, orderBy, collectionGroup, where } from 'firebase/firestore'
import { db, isConfigured } from './firebase'

// Format a date as YYYY-MM-DD in local time (not UTC)
export function toLocalDateStr(d) {
  if (!d) {
    const date = new Date()
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  }
  // If already YYYY-MM-DD, return as-is to avoid UTC parsing shifting the date back a day
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
    return d
  }
  const date = new Date(d)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

// Real-time listener for today's data
export function subscribeTodayData(userId, callback) {
  if (!isConfigured || !db || !userId) return () => {}

  const today = toLocalDateStr()
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
    const today = toLocalDateStr() // YYYY-MM-DD format in local time
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
// Checks both dailyData and history collections (mirrors loadHistory behavior)
// Returns data if exists, null if no data for today, throws on error
export async function loadTodayData(userId) {
  if (!isConfigured || !db || !userId) return null

  const today = toLocalDateStr()

  // Fetch from both collections in parallel
  const [dailySnap, historySnap] = await Promise.all([
    getDoc(doc(db, 'users', userId, 'dailyData', today)),
    getDoc(doc(db, 'users', userId, 'history', today))
  ])

  const dailyData = dailySnap.exists() ? dailySnap.data() : null
  const historyData = historySnap.exists() ? historySnap.data() : null

  if (!dailyData && !historyData) return null
  if (!dailyData) return historyData
  if (!historyData) return dailyData

  // Both exist - prefer whichever has more recent updatedAt
  if (historyData.updatedAt && (!dailyData.updatedAt || historyData.updatedAt > dailyData.updatedAt)) {
    return historyData
  }
  return dailyData
}

// Load any day's data from Firestore (for viewing past days)
export async function loadDayData(userId, dateStr) {
  if (!isConfigured || !db || !userId) return null

  const normalizedDate = toLocalDateStr(dateStr)

  const [dailySnap, historySnap] = await Promise.all([
    getDoc(doc(db, 'users', userId, 'dailyData', normalizedDate)),
    getDoc(doc(db, 'users', userId, 'history', normalizedDate))
  ])

  const dailyData = dailySnap.exists() ? dailySnap.data() : null
  const historyData = historySnap.exists() ? historySnap.data() : null

  if (!dailyData && !historyData) return null
  if (!dailyData) return historyData
  if (!historyData) return dailyData

  if (historyData.updatedAt && (!dailyData.updatedAt || historyData.updatedAt > dailyData.updatedAt)) {
    return historyData
  }
  return dailyData
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
    const dateStr = toLocalDateStr(date)
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
      const dateKey = toLocalDateStr(data.date)
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
      const today = toLocalDateStr()
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
          const dateStr = toLocalDateStr(dateObj)
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

// Update user profile (for admin user list tracking)
// creationTime: Firebase Auth user.metadata.creationTime — used to backfill the real sign-up date
export async function updateUserProfile(userId, email, creationTime = null) {
  if (!isConfigured || !db || !userId) return false

  try {
    const docRef = doc(db, 'userProfiles', userId)
    const docSnap = await getDoc(docRef)
    const now = new Date().toISOString()
    const authCreatedAt = creationTime ? new Date(creationTime).toISOString() : null

    if (docSnap.exists()) {
      const updates = { email, lastActive: now }
      // Correct createdAt if our stored value is later than the real auth creation date
      // (happens when profile was first created after account already existed)
      if (authCreatedAt && docSnap.data().createdAt > authCreatedAt) {
        updates.createdAt = authCreatedAt
      }
      await setDoc(docRef, updates, { merge: true })
    } else {
      await setDoc(docRef, {
        email,
        createdAt: authCreatedAt || now,
        lastActive: now
      })
    }
    return true
  } catch (error) {
    console.error('Error updating user profile:', error)
    return false
  }
}

// Load user profile (check admin flag)
export async function loadUserProfile(userId) {
  if (!isConfigured || !db || !userId) return null

  try {
    const docRef = doc(db, 'userProfiles', userId)
    const docSnap = await getDoc(docRef)
    if (docSnap.exists()) {
      return docSnap.data()
    }
    return null
  } catch (error) {
    console.error('Error loading user profile:', error)
    return null
  }
}

// Save feedback to top-level collection
export async function saveFeedback(userId, userEmail, feedbackData) {
  if (!isConfigured || !db || !userId) return false

  try {
    await addDoc(collection(db, 'feedback'), {
      userId,
      userEmail,
      type: feedbackData.type,
      message: feedbackData.message,
      status: 'new',
      createdAt: new Date().toISOString()
    })
    return true
  } catch (error) {
    console.error('Error saving feedback:', error)
    return false
  }
}

// Load all feedback (admin only)
export async function loadAllFeedback() {
  if (!isConfigured || !db) return []

  try {
    const q = query(collection(db, 'feedback'), orderBy('createdAt', 'desc'))
    const snapshot = await getDocs(q)
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
  } catch (error) {
    console.error('Error loading feedback:', error)
    return []
  }
}

// Create notification when feedback is resolved
async function createFeedbackResolvedNotification(userId, feedbackId, feedbackType, feedbackMessage, resolvedAt) {
  if (!isConfigured || !db) return

  try {
    await addDoc(collection(db, 'users', userId, 'notifications'), {
      type: 'feedback_resolved',
      feedbackId,
      feedbackType,
      feedbackMessage,
      read: false,
      dismissed: false,
      createdAt: resolvedAt,
      metadata: {
        resolvedAt
      }
    })
  } catch (error) {
    console.error('Error creating notification:', error)
    // Don't throw - notification failure shouldn't break feedback update
  }
}

// Update a feedback item (admin only — set priority, status, etc.)
// Automatically sets startedAt when status → 'in-progress' and resolvedAt when status → 'resolved'.
export async function updateFeedbackItem(feedbackId, updates) {
  if (!isConfigured || !db) return false

  try {
    const now = new Date().toISOString()
    const enriched = { ...updates, updatedAt: now }

    // Check if status is changing to 'resolved'
    const isBeingResolved = updates.status === 'resolved' && !enriched.resolvedAt
    if (updates.status === 'in-progress' && !enriched.startedAt) enriched.startedAt = now
    if (isBeingResolved) enriched.resolvedAt = now

    const docRef = doc(db, 'feedback', feedbackId)

    // If being resolved, fetch feedback data to create notification
    let feedbackData = null
    if (isBeingResolved) {
      const feedbackSnap = await getDoc(docRef)
      if (feedbackSnap.exists()) {
        feedbackData = feedbackSnap.data()
      }
    }

    await updateDoc(docRef, enriched)

    // Create notification after successful feedback update
    if (isBeingResolved && feedbackData?.userId) {
      await createFeedbackResolvedNotification(
        feedbackData.userId,
        feedbackId,
        feedbackData.type,
        feedbackData.message,
        now
      )
    }

    return true
  } catch (error) {
    console.error('Error updating feedback:', error)
    return false
  }
}

// Subscribe to user's unread notifications (real-time)
export function subscribeNotifications(userId, callback) {
  if (!isConfigured || !db || !userId) return () => {}

  const notificationsRef = collection(db, 'users', userId, 'notifications')
  const q = query(
    notificationsRef,
    where('dismissed', '==', false),
    orderBy('createdAt', 'desc')
  )

  return onSnapshot(q, (snapshot) => {
    const notifications = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))
    callback(notifications)
  }, (error) => {
    console.error('Error in notifications listener:', error)
    callback([])
  })
}

// Dismiss a notification
export async function dismissNotification(userId, notificationId) {
  if (!isConfigured || !db) return false

  try {
    const docRef = doc(db, 'users', userId, 'notifications', notificationId)
    await updateDoc(docRef, { dismissed: true })
    return true
  } catch (error) {
    console.error('Error dismissing notification:', error)
    return false
  }
}

// Create announcement notification for all users (admin only)
export async function createAnnouncementForAllUsers(title, message, usersList) {
  if (!isConfigured || !db) return { success: false, error: 'Firebase not configured' }
  if (!usersList || usersList.length === 0) return { success: false, error: 'No users to notify' }

  try {
    const now = new Date().toISOString()
    const batch = writeBatch(db)
    let count = 0

    // Create notification for each user
    for (const user of usersList) {
      const notificationRef = doc(collection(db, 'users', user.id, 'notifications'))
      batch.set(notificationRef, {
        type: 'announcement',
        title,
        message,
        read: false,
        dismissed: false,
        createdAt: now,
        metadata: {
          announcedAt: now
        }
      })
      count++

      // Firestore batch limit is 500, commit and create new batch if needed
      if (count % 500 === 0) {
        await batch.commit()
      }
    }

    // Commit remaining writes
    if (count % 500 !== 0) {
      await batch.commit()
    }

    return { success: true, count }
  } catch (error) {
    console.error('Error creating announcement:', error)
    return { success: false, error: error.message }
  }
}

// Load all users' daily activity for last N days (admin analytics)
// Uses a collection-group query across all users' dailyData subcollections.
// Requires the matching Firestore rule: match /{path=**}/dailyData/{docId} { allow read: if isAdmin }
// Returns array of { userId, date } — one entry per day a user logged data.
export async function loadAllActivityData(limitDays = 30) {
  if (!isConfigured || !db) return []

  try {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - limitDays)
    const cutoffISO = cutoff.toISOString()
    const q = query(
      collectionGroup(db, 'dailyData'),
      where('updatedAt', '>=', cutoffISO)
    )
    const snap = await getDocs(q)
    return snap.docs.map(d => ({
      userId: d.ref.parent.parent.id,
      date: d.id  // document ID is YYYY-MM-DD
    }))
  } catch (error) {
    console.error('Error loading activity data:', error)
    return []
  }
}

// Load all user profiles (admin only)
export async function loadAllUsers() {
  if (!isConfigured || !db) return []

  try {
    const snapshot = await getDocs(collection(db, 'userProfiles'))
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
  } catch (error) {
    console.error('Error loading users:', error)
    return []
  }
}
