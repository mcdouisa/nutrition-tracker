// lib/firebase.js - Firebase configuration for Nutrition Tracker
import { initializeApp, getApps } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'

// Firebase configuration - add your config values to .env.local
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
}

let app = null
let db = null
let auth = null
let isConfigured = false

// Initialize Firebase
function initFirebase() {
  if (typeof window === 'undefined') return false

  // Check if API key exists and is valid
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
  if (!apiKey || apiKey === 'undefined' || apiKey === '') {
    return false
  }

  if (app) return true // Already initialized

  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]
    db = getFirestore(app)
    auth = getAuth(app)
    isConfigured = true
    return true
  } catch (error) {
    console.warn('Firebase initialization failed:', error.message)
    return false
  }
}

// Try to initialize on load
if (typeof window !== 'undefined') {
  initFirebase()
}

export { db, auth, isConfigured, initFirebase }
export default app
