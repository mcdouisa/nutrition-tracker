// lib/deviceData.js — what Lytz keeps on this device, and wiping it on sign-out
// so the next person on a shared phone never sees (or inherits) someone else's data.

import { db } from './firebase'
import { terminate, clearIndexedDbPersistence, waitForPendingWrites } from 'firebase/firestore'

// Device preferences that aren't personal data
const KEEP = ['lytz-darkMode']

// Remove every Lytz key from localStorage and sessionStorage (except KEEP)
export function clearDeviceStorage() {
  try {
    Object.keys(localStorage).forEach(key => { if (!KEEP.includes(key)) localStorage.removeItem(key) })
  } catch {}
  try { sessionStorage.clear() } catch {}
}

// Wait for changes made offline to reach the server. false = still unsynced.
export async function syncedBeforeSignOut(timeoutMs = 6000) {
  if (!db) return true
  try {
    await Promise.race([
      waitForPendingWrites(db),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs))
    ])
    return true
  } catch {
    return false
  }
}

// Delete the on-device copy of the database. The page must reload afterwards.
export async function clearDeviceDatabase() {
  if (!db) return
  try {
    await terminate(db)
    await clearIndexedDbPersistence(db)
  } catch (e) {
    console.warn('Could not clear the on-device database copy:', e.message)
  }
}

// Full sign-out: make sure nothing is lost, sign out, then wipe this device.
// Returns false if the person chose to stay signed in.
export async function signOutAndClearDevice(signOut) {
  const synced = await syncedBeforeSignOut()
  if (!synced && !window.confirm("Some changes haven't reached the cloud yet (you may be offline). Sign out anyway? Those changes will be lost.")) {
    return false
  }
  await signOut()
  clearDeviceStorage()
  await clearDeviceDatabase()
  window.location.replace('/')
  return true
}
