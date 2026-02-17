'use client'

import { createContext, useContext, useState, useEffect } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  signInAnonymously,
  linkWithCredential,
  EmailAuthProvider
} from 'firebase/auth'
import { auth, initFirebase } from './firebase'
import { updateUserProfile } from './dataSync'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isConfigured, setIsConfigured] = useState(false)

  useEffect(() => {
    const configured = initFirebase()
    setIsConfigured(configured)

    if (!configured || !auth) {
      setLoading(false)
      return
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        // No session — sign in anonymously so guest data goes to Firestore, not localStorage.
        // This protects data from iOS wiping PWA storage.
        try {
          await signInAnonymously(auth)
        } catch (err) {
          console.error('Anonymous sign-in failed:', err)
          setLoading(false)
        }
        return // onAuthStateChanged fires again with the anonymous user
      }

      setUser(firebaseUser)
      setLoading(false)

      // Only track real (non-anonymous) users in the admin dashboard.
      // Pass metadata.creationTime so the profile gets the real account creation date.
      if (!firebaseUser.isAnonymous) {
        updateUserProfile(firebaseUser.uid, firebaseUser.email, firebaseUser.metadata?.creationTime)
      }
    })

    return () => unsubscribe()
  }, [])

  const signUp = async (email, password) => {
    if (!auth) throw new Error('Firebase not configured')
    const currentUser = auth.currentUser
    if (currentUser?.isAnonymous) {
      // Convert the anonymous account to a permanent one — same UID means all
      // Firestore data (dailyData, settings, history) is automatically preserved.
      const credential = EmailAuthProvider.credential(email, password)
      return linkWithCredential(currentUser, credential)
    }
    return createUserWithEmailAndPassword(auth, email, password)
  }

  const signIn = async (email, password) => {
    if (!auth) throw new Error('Firebase not configured')
    return signInWithEmailAndPassword(auth, email, password)
  }

  const signOut = async () => {
    if (!auth) return
    return firebaseSignOut(auth)
  }

  const resetPassword = async (email) => {
    if (!auth) throw new Error('Firebase not configured')
    return sendPasswordResetEmail(auth, email)
  }

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      signUp,
      signIn,
      signOut,
      resetPassword,
      isConfigured
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
