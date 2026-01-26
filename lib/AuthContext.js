'use client'

import { createContext, useContext, useState, useEffect } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut
} from 'firebase/auth'
import { auth, initFirebase } from './firebase'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isConfigured, setIsConfigured] = useState(false)

  useEffect(() => {
    // Initialize Firebase on client side
    const configured = initFirebase()
    setIsConfigured(configured)

    if (!configured || !auth) {
      setLoading(false)
      return
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const signUp = async (email, password) => {
    if (!auth) throw new Error('Firebase not configured')
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

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      signUp,
      signIn,
      signOut,
      isConfigured
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
