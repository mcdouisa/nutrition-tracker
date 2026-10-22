'use client'

// Shared app chrome: the bottom tab bar and the page header used on every screen.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../lib/AuthContext'
import { loadUserProfile } from '../../lib/dataSync'
import { DARK, FONT } from '../../lib/theme'
import { CalendarIcon, BarChartIcon, DumbbellIcon, TargetIcon, ChevronLeftIcon } from '../../lib/icons'

// Groups is admin-only for now; remember the answer for the session so tabs don't flicker
function useIsAdmin() {
  const { user } = useAuth()
  const [isAdmin, setIsAdmin] = useState(false)
  useEffect(() => {
    try { if (sessionStorage.getItem('lytz-isAdmin') === 'true') setIsAdmin(true) } catch {}
    if (!user || user.isAnonymous) return
    let cancelled = false
    loadUserProfile(user.uid)
      .then(profile => {
        if (cancelled) return
        const admin = !!profile?.isAdmin
        setIsAdmin(admin)
        try { sessionStorage.setItem('lytz-isAdmin', String(admin)) } catch {}
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [user])
  return isAdmin
}

function GroupsIcon({ size = 22, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3" />
      <path d="M3 19c0-3 3-5 6-5s6 2 6 5" />
      <path d="M16 5.5a3 3 0 0 1 0 5.5" />
      <path d="M21 19c0-2.3-1.5-4-4-4.7" />
    </svg>
  )
}

function TabItem({ T, label, icon, href, onClick, current }) {
  const style = {
    flex: 1,
    minHeight: '52px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    border: 'none',
    background: 'none',
    padding: 0,
    cursor: 'pointer',
    textDecoration: 'none',
    fontFamily: FONT,
    fontSize: '11px',
    color: current ? T.text : T.muted
  }
  const content = <>{icon}<span>{label}</span></>
  if (onClick) return <button onClick={onClick} aria-current={current ? 'page' : undefined} style={style}>{content}</button>
  return <Link href={href} aria-current={current ? 'page' : undefined} style={style}>{content}</Link>
}

// current: 'today' | 'reports' | 'train' | 'groups'
// onToday / onGoals let the home screen handle those tabs in place
export function AppTabBar({ current, T = DARK, onToday, onGoals }) {
  const isAdmin = useIsAdmin()
  return (
    <nav aria-label="Primary" style={{
      position: 'fixed',
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 60,
      backgroundColor: T.bg + 'f2',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      borderTop: `1px solid ${T.border}`,
      paddingBottom: 'env(safe-area-inset-bottom)'
    }}>
      <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', padding: '6px 8px' }}>
        <TabItem T={T} label="Today" href="/" onClick={onToday} current={current === 'today'} icon={<CalendarIcon size={22} strokeWidth={1.75} />} />
        <TabItem T={T} label="Reports" href="/reports" current={current === 'reports'} icon={<BarChartIcon size={22} strokeWidth={1.75} />} />
        <TabItem T={T} label="Train" href="/workout" current={current === 'train'} icon={<DumbbellIcon size={22} strokeWidth={1.75} />} />
        {(isAdmin || current === 'groups') && (
          <TabItem T={T} label="Groups" href="/groups" current={current === 'groups'} icon={<GroupsIcon />} />
        )}
        <TabItem T={T} label="Goals" href="/?goals=1" onClick={onGoals} icon={<TargetIcon size={22} strokeWidth={1.75} />} />
      </div>
    </nav>
  )
}

// Space to leave at the bottom of a page so content clears the tab bar
export const TAB_BAR_SPACE = 'calc(96px + env(safe-area-inset-bottom))'

// Sticky page header: optional back button, title, optional subtitle, right-side actions
export function PageHeader({ title, subtitle, back, onBack, right, T = DARK }) {
  const router = useRouter()
  const goBack = onBack || (back ? () => router.push(back) : null)
  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 50,
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      backgroundColor: T.bg + 'ee',
      padding: '12px 16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '8px',
      fontFamily: FONT
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0 }}>
        {goBack && (
          <button
            onClick={goBack}
            aria-label="Back"
            style={{ width: '36px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: T.muted, flexShrink: 0 }}
          >
            <ChevronLeftIcon size={20} strokeWidth={2} />
          </button>
        )}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 500, letterSpacing: '-0.01em', color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {title}
          </h1>
          {subtitle && (
            <span style={{ fontSize: '15px', color: T.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{subtitle}</span>
          )}
        </div>
      </div>
      {right && <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>{right}</div>}
    </header>
  )
}
