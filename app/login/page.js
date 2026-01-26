'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../lib/AuthContext'

export default function LoginPage() {
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn, signUp, isConfigured } = useAuth()
  const router = useRouter()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!email || !password) {
      setError('Please fill in all fields')
      return
    }

    if (isSignUp && password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)

    try {
      if (isSignUp) {
        await signUp(email, password)
      } else {
        await signIn(email, password)
      }
      router.push('/')
    } catch (err) {
      console.error('Auth error:', err)
      if (err.code === 'auth/email-already-in-use') {
        setError('Email already in use')
      } else if (err.code === 'auth/invalid-email') {
        setError('Invalid email address')
      } else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Invalid email or password')
      } else {
        setError(err.message || 'Something went wrong')
      }
    } finally {
      setLoading(false)
    }
  }

  if (!isConfigured) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#fafafa',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}>
        <div style={{
          backgroundColor: '#fff',
          borderRadius: '16px',
          padding: '32px 24px',
          maxWidth: '400px',
          width: '100%',
          textAlign: 'center',
          boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>
            Setup Required
          </div>
          <h2 style={{
            margin: '0 0 12px 0',
            fontSize: '20px',
            fontWeight: '600',
            color: '#1a1a1a'
          }}>
            Firebase Not Configured
          </h2>
          <p style={{
            margin: '0 0 20px 0',
            fontSize: '14px',
            color: '#666',
            lineHeight: '1.6'
          }}>
            To enable cloud sync and accounts, please set up Firebase:
          </p>
          <div style={{
            textAlign: 'left',
            backgroundColor: '#f5f5f5',
            borderRadius: '8px',
            padding: '16px',
            fontSize: '13px',
            color: '#333',
            lineHeight: '1.8'
          }}>
            <strong>1.</strong> Go to console.firebase.google.com<br />
            <strong>2.</strong> Create a new project<br />
            <strong>3.</strong> Enable Authentication (Email/Password)<br />
            <strong>4.</strong> Enable Firestore Database<br />
            <strong>5.</strong> Copy your config to .env.local
          </div>
          <button
            onClick={() => router.push('/')}
            style={{
              marginTop: '20px',
              padding: '12px 24px',
              backgroundColor: '#1a1a1a',
              border: 'none',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            Continue Without Account
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#fafafa',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: '#fff',
        borderRadius: '16px',
        padding: '32px 24px',
        maxWidth: '400px',
        width: '100%',
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '40px', marginBottom: '8px' }}>
            {isSignUp ? '🍎' : '👋'}
          </div>
          <h1 style={{
            margin: '0 0 4px 0',
            fontSize: '24px',
            fontWeight: '600',
            color: '#1a1a1a',
            letterSpacing: '-0.5px'
          }}>
            {isSignUp ? 'Create Account' : 'Welcome Back'}
          </h1>
          <p style={{
            margin: 0,
            fontSize: '14px',
            color: '#666'
          }}>
            {isSignUp ? 'Start tracking your nutrition' : 'Sign in to sync your data'}
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            padding: '12px 16px',
            marginBottom: '20px',
            color: '#dc2626',
            fontSize: '13px',
            fontWeight: '500'
          }}>
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: '500',
              color: '#666',
              marginBottom: '6px'
            }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={{
                width: '100%',
                padding: '12px 14px',
                backgroundColor: '#fafafa',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                color: '#1a1a1a',
                fontSize: '14px',
                boxSizing: 'border-box',
                outline: 'none'
              }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: '500',
              color: '#666',
              marginBottom: '6px'
            }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              style={{
                width: '100%',
                padding: '12px 14px',
                backgroundColor: '#fafafa',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                color: '#1a1a1a',
                fontSize: '14px',
                boxSizing: 'border-box',
                outline: 'none'
              }}
            />
          </div>

          {isSignUp && (
            <div style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: '500',
                color: '#666',
                marginBottom: '6px'
              }}>
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  backgroundColor: '#fafafa',
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px',
                  color: '#1a1a1a',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                  outline: 'none'
                }}
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px',
              backgroundColor: loading ? '#999' : '#1a1a1a',
              border: 'none',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '14px',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              marginTop: '8px'
            }}
          >
            {loading ? 'Please wait...' : (isSignUp ? 'Create Account' : 'Sign In')}
          </button>
        </form>

        {/* Toggle sign up/sign in */}
        <div style={{
          textAlign: 'center',
          marginTop: '24px',
          paddingTop: '24px',
          borderTop: '1px solid #e0e0e0'
        }}>
          <span style={{ fontSize: '13px', color: '#666' }}>
            {isSignUp ? 'Already have an account?' : "Don't have an account?"}
          </span>
          <button
            onClick={() => {
              setIsSignUp(!isSignUp)
              setError('')
            }}
            style={{
              marginLeft: '6px',
              backgroundColor: 'transparent',
              border: 'none',
              color: '#1a1a1a',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              textDecoration: 'underline'
            }}
          >
            {isSignUp ? 'Sign In' : 'Sign Up'}
          </button>
        </div>

        {/* Skip button */}
        <button
          onClick={() => router.push('/')}
          style={{
            width: '100%',
            marginTop: '16px',
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
      </div>
    </div>
  )
}
