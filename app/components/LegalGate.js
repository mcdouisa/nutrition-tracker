'use client'

// Everyone who uses Lytz, including people already signed in, must accept the
// current Terms, Privacy Policy and Health Data Notice (and confirm their age)
// before using the app. Bumping LEGAL.version asks everyone again.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { useAuth } from '../../lib/AuthContext'
import { db, isConfigured } from '../../lib/firebase'
import { LEGAL } from '../../lib/legal'
import { DARK, DONE, DONE_INK, FONT } from '../../lib/theme'
import { signOutAndClearDevice, clearDeviceStorage } from '../../lib/deviceData'

const OPEN_PATHS = ['/privacy', '/terms', '/health-data', '/login']
const LOCAL_KEY = 'lytz-legal-accepted' // device record for people without an account

export default function LegalGate({ children }) {
  const { user, loading, signOut } = useAuth()
  const pathname = usePathname()
  const [needsConsent, setNeedsConsent] = useState(false)

  const realAccount = user && !user.isAnonymous
  const usingWithoutAccount = typeof window !== 'undefined' &&
    (localStorage.getItem('skip-auth') === 'true' || !isConfigured)

  useEffect(() => {
    if (loading || OPEN_PATHS.includes(pathname)) { setNeedsConsent(false); return }
    let cancelled = false
    const check = async () => {
      if (realAccount && db) {
        // Fast path: this device already saw this account accept this version
        if (localStorage.getItem(`${LOCAL_KEY}-${user.uid}`) === LEGAL.version) return setNeedsConsent(false)
        try {
          const snap = await getDoc(doc(db, 'userProfiles', user.uid))
          const accepted = snap.exists() && snap.data().legalAcceptedVersion === LEGAL.version
          if (!cancelled) setNeedsConsent(!accepted)
          if (accepted) localStorage.setItem(`${LOCAL_KEY}-${user.uid}`, LEGAL.version)
        } catch {
          if (!cancelled) setNeedsConsent(true)
        }
      } else if (usingWithoutAccount) {
        setNeedsConsent(localStorage.getItem(LOCAL_KEY) !== LEGAL.version)
      } else {
        setNeedsConsent(false) // not using the app yet (sign-in screen)
      }
    }
    check()
    return () => { cancelled = true }
  }, [loading, pathname, user?.uid, realAccount, usingWithoutAccount])

  const accept = async (record) => {
    if (realAccount && db) {
      await setDoc(doc(db, 'userProfiles', user.uid), record, { merge: true })
      localStorage.setItem(`${LOCAL_KEY}-${user.uid}`, LEGAL.version)
    } else {
      localStorage.setItem(LOCAL_KEY, LEGAL.version)
    }
    setNeedsConsent(false)
  }

  const decline = async () => {
    if (realAccount) {
      await signOutAndClearDevice(signOut)
    } else {
      clearDeviceStorage()
      window.location.replace('/')
    }
  }

  return (
    <>
      {children}
      {needsConsent && <ConsentScreen onAccept={accept} onDecline={decline} signedIn={!!realAccount} />}
    </>
  )
}

function ConsentScreen({ onAccept, onDecline, signedIn }) {
  const T = DARK
  const [age, setAge] = useState(false)
  const [terms, setTerms] = useState(false)
  const [health, setHealth] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const ready = age && terms && health && !busy

  const submit = async () => {
    setBusy(true)
    setError('')
    try {
      await onAccept({
        legalAcceptedVersion: LEGAL.version,
        legalAcceptedAt: new Date().toISOString(),
        ageConfirmed: `${LEGAL.minimumAge}+`,
        healthDataConsent: true,
      })
    } catch {
      setError("Couldn't save your answer. Check your connection and try again.")
      setBusy(false)
    }
  }

  const link = { color: T.text, textDecoration: 'underline' }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="consent-title" style={{
      position: 'fixed', inset: 0, zIndex: 3000, overflowY: 'auto', backgroundColor: T.bg, color: T.text, fontFamily: FONT
    }}>
      <div style={{ maxWidth: '520px', margin: '0 auto', padding: '48px 16px calc(32px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h1 id="consent-title" style={{ margin: 0, fontSize: '26px', fontWeight: 500 }}>Before you continue</h1>
        <p style={{ margin: 0, fontSize: '15px', lineHeight: 1.5, color: T.soft }}>
          {signedIn ? "We've updated how Lytz handles your information. " : ''}
          Lytz stores what you log (food, water, habits, weight and workouts) to run the app. Food text, photos and voice notes you choose to send are processed by our AI provider to estimate nutrition. We don't sell your data or show ads.
        </p>

        <Check checked={age} onChange={setAge}>
          I'm at least {LEGAL.minimumAge} years old. If I'm under 18, a parent or guardian has agreed to these terms for me.
        </Check>
        <Check checked={terms} onChange={setTerms}>
          I agree to the <Link href="/terms" target="_blank" style={link}>Terms of Service</Link> and the <Link href="/privacy" target="_blank" style={link}>Privacy Policy</Link>.
        </Check>
        <Check checked={health} onChange={setHealth}>
          I consent to Lytz collecting and using my health-related information (like food, weight and body details) to provide the app, as described in the <Link href="/health-data" target="_blank" style={link}>Consumer Health Data Notice</Link>. I can withdraw by deleting my data at any time.
        </Check>

        <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.5, color: T.muted }}>
          Lytz gives estimates for awareness. It isn't medical advice and doesn't replace a doctor or dietitian.
        </p>

        {error && <div role="alert" style={{ fontSize: '14px', color: '#FF6B3D' }}>{error}</div>}

        <button onClick={submit} disabled={!ready} style={{
          height: '56px', border: 'none', borderRadius: '16px', backgroundColor: DONE, color: DONE_INK,
          fontSize: '16px', fontWeight: 600, fontFamily: FONT, cursor: ready ? 'pointer' : 'default', opacity: ready ? 1 : 0.4
        }}>
          {busy ? 'Saving…' : 'Agree and continue'}
        </button>
        <button onClick={onDecline} disabled={busy} style={{
          height: '48px', border: 'none', borderRadius: '14px', backgroundColor: T.card, color: T.soft,
          fontSize: '15px', fontFamily: FONT, cursor: 'pointer'
        }}>
          {signedIn ? "Don't agree and sign out" : "Don't agree"}
        </button>
      </div>
    </div>
  )
}

function Check({ checked, onChange, children }) {
  const T = DARK
  return (
    <label style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '14px 16px', borderRadius: '16px', backgroundColor: T.card, cursor: 'pointer' }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)}
        style={{ width: '22px', height: '22px', marginTop: '1px', flexShrink: 0, accentColor: DONE }} />
      <span style={{ fontSize: '15px', lineHeight: 1.45, color: T.soft }}>{children}</span>
    </label>
  )
}
