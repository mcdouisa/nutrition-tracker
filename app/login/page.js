'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../lib/AuthContext'

const DARK  = { bg: '#0D0D0D', card: '#1A1A1A', card2: '#242424', border: '#2C2C2C', text: '#FFFFFF', muted: '#888888' }
const LIGHT = { bg: '#F5F5F5', card: '#FFFFFF',  card2: '#EBEBEB', border: '#E0E0E0', text: '#1A1A1A', muted: '#666666' }

export default function LoginPage() {
  const [isSignUp, setIsSignUp] = useState(false)
  const [isResetPassword, setIsResetPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn, signUp, resetPassword, isConfigured } = useAuth()
  const [darkMode, setDarkMode] = useState(true)
  useEffect(() => {
    const saved = localStorage.getItem('lytz-darkMode')
    if (saved !== null) setDarkMode(saved === 'true')
  }, [])
  const T = darkMode ? DARK : LIGHT
  const router = useRouter()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

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
      // Handle specific Firebase auth errors with clear messages
      switch (err.code) {
        case 'auth/email-already-in-use':
          setError('This email is already registered. Try signing in instead.')
          break
        case 'auth/invalid-email':
          setError('Please enter a valid email address.')
          break
        case 'auth/user-not-found':
          setError('No account found with this email. Please sign up first.')
          break
        case 'auth/wrong-password':
          setError('Incorrect password. Please try again or reset your password.')
          break
        case 'auth/invalid-credential':
          setError('Incorrect email or password. Please check your credentials and try again.')
          break
        case 'auth/too-many-requests':
          setError('Too many failed attempts. Please wait a few minutes and try again.')
          break
        case 'auth/user-disabled':
          setError('This account has been disabled. Please contact support.')
          break
        case 'auth/weak-password':
          setError('Password is too weak. Please use at least 6 characters.')
          break
        case 'auth/network-request-failed':
          setError('Network error. Please check your internet connection.')
          break
        default:
          setError(err.message || 'Something went wrong. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!email) {
      setError('Please enter your email address')
      return
    }

    setLoading(true)

    try {
      await resetPassword(email)
      setSuccess('Password reset email sent! Check your inbox.')
    } catch (err) {
      console.error('Reset password error:', err)
      switch (err.code) {
        case 'auth/user-not-found':
          setError('No account found with this email. Please check the email or sign up.')
          break
        case 'auth/invalid-email':
          setError('Please enter a valid email address.')
          break
        case 'auth/too-many-requests':
          setError('Too many requests. Please wait a few minutes and try again.')
          break
        case 'auth/network-request-failed':
          setError('Network error. Please check your internet connection.')
          break
        default:
          setError(err.message || 'Failed to send reset email. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  if (!isConfigured) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: T.card,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}>
        <div style={{
          backgroundColor: T.card,
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
            color: '#0A84FF'
          }}>
            Firebase Not Configured
          </h2>
          <p style={{
            margin: '0 0 20px 0',
            fontSize: '14px',
            color: T.muted,
            lineHeight: '1.6'
          }}>
            To enable cloud sync and accounts, please set up Firebase:
          </p>
          <div style={{
            textAlign: 'left',
            backgroundColor: T.card2,
            borderRadius: '8px',
            padding: '16px',
            fontSize: '13px',
            color: T.text,
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
              backgroundColor: '#0A84FF',
              border: 'none',
              borderRadius: '8px',
              color: '#1A1A1A',
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

  // Password Reset View
  if (isResetPassword) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: T.card,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}>
        <div style={{
          backgroundColor: T.card,
          borderRadius: '16px',
          padding: '32px 24px',
          maxWidth: '400px',
          width: '100%',
          boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
        }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={{ fontSize: '40px', marginBottom: '8px' }}>🔑</div>
            <h1 style={{
              margin: '0 0 4px 0',
              fontSize: '24px',
              fontWeight: '600',
              color: '#0A84FF',
              letterSpacing: '-0.5px'
            }}>
              Reset Password
            </h1>
            <p style={{
              margin: 0,
              fontSize: '14px',
              color: T.muted
            }}>
              Enter your email to receive a reset link
            </p>
          </div>

          {/* Error message */}
          {error && (
            <div style={{
              backgroundColor: 'rgba(255,69,58,0.1)',
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

          {/* Success message */}
          {success && (
            <div style={{
              backgroundColor: 'rgba(48,209,88,0.1)',
              border: '1px solid #bbf7d0',
              borderRadius: '8px',
              padding: '12px 16px',
              marginBottom: '20px',
              color: '#30D158',
              fontSize: '13px',
              fontWeight: '500'
            }}>
              {success}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleResetPassword}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: '500',
                color: T.muted,
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
                  backgroundColor: T.bg,
                  border: `1px solid ${T.border}`,
                  borderRadius: '8px',
                  color: T.text,
                  fontSize: '16px',
                  boxSizing: 'border-box',
                  outline: 'none'
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '14px',
                backgroundColor: loading ? '#a0b8bb' : '#0A84FF',
                border: 'none',
                borderRadius: '8px',
                color: '#1A1A1A',
                fontSize: '14px',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                marginTop: '8px'
              }}
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>

          {/* Back to sign in */}
          <div style={{
            textAlign: 'center',
            marginTop: '24px',
            paddingTop: '24px',
            borderTop: '1px solid #2C2C2C'
          }}>
            <button
              onClick={() => {
                setIsResetPassword(false)
                setError('')
                setSuccess('')
              }}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                color: '#0A84FF',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
            >
              Back to Sign In
            </button>
          </div>
        </div>
      </div>
    )
  }

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
        width: '100%'
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <img
            src="/logo.png"
            alt="Lytz"
            style={{ width: '100%', maxWidth: '420px', height: 'auto', display: 'block', margin: '0 auto 4px', mixBlendMode: 'screen' }}
          />
          <p style={{
            margin: 0,
            fontSize: '14px',
            color: '#888'
          }}>
            {isSignUp ? 'Your existing data will be preserved' : 'Sign in to sync your data'}
          </p>
        </div>

        {/* Form area with padding */}
        <div style={{ padding: '0 24px 32px' }}>

        {/* Error message */}
        {error && (
          <div style={{
            backgroundColor: 'rgba(255,69,58,0.1)',
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
              color: T.muted,
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
                backgroundColor: T.bg,
                border: `1px solid ${T.border}`,
                borderRadius: '8px',
                color: T.text,
                fontSize: '16px',
                boxSizing: 'border-box',
                outline: 'none'
              }}
            />
          </div>

          <div style={{ marginBottom: isSignUp ? '16px' : '8px' }}>
            <label style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: '500',
              color: T.muted,
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
                backgroundColor: T.bg,
                border: `1px solid ${T.border}`,
                borderRadius: '8px',
                color: T.text,
                fontSize: '16px',
                boxSizing: 'border-box',
                outline: 'none'
              }}
            />
          </div>

          {/* Forgot Password Link */}
          {!isSignUp && (
            <div style={{ textAlign: 'right', marginBottom: '16px' }}>
              <button
                type="button"
                onClick={() => {
                  setIsResetPassword(true)
                  setError('')
                }}
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: T.muted,
                  fontSize: '12px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  textDecoration: 'underline'
                }}
              >
                Forgot password?
              </button>
            </div>
          )}

          {isSignUp && (
            <div style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: '500',
                color: T.muted,
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
                  backgroundColor: T.bg,
                  border: `1px solid ${T.border}`,
                  borderRadius: '8px',
                  color: T.text,
                  fontSize: '16px',
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
              backgroundColor: loading ? '#a0b8bb' : '#0A84FF',
              border: 'none',
              borderRadius: '8px',
              color: '#1A1A1A',
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
          borderTop: '1px solid #2C2C2C'
        }}>
          <span style={{ fontSize: '13px', color: T.muted }}>
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
              color: '#0A84FF',
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
        </div>{/* end form area */}
      </div>
    </div>
  )
}
