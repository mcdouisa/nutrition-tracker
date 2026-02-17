'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../lib/AuthContext'
import { loadUserProfile, loadAllFeedback, loadAllUsers, updateFeedbackItem } from '../../lib/dataSync'

const PRIORITY_CONFIG = {
  none:     { label: 'No Priority', color: '#999',    bg: '#f5f5f5' },
  low:      { label: 'Low',         color: '#2563eb', bg: '#eff6ff' },
  medium:   { label: 'Medium',      color: '#d97706', bg: '#fffbeb' },
  high:     { label: 'High',        color: '#ea580c', bg: '#fff7ed' },
  critical: { label: 'Critical',    color: '#dc2626', bg: '#fef2f2' },
}

const STATUS_CONFIG = {
  new:         { label: 'Open',        color: '#2563eb', bg: '#eff6ff' },
  'in-progress': { label: 'In Progress', color: '#d97706', bg: '#fffbeb' },
  resolved:    { label: 'Resolved',    color: '#16a34a', bg: '#f0fdf4' },
}

const TYPE_CONFIG = {
  bug:     { label: 'Bug',     color: '#dc2626', bg: '#fef2f2' },
  feature: { label: 'Feature', color: '#7c3aed', bg: '#f5f3ff' },
  other:   { label: 'Other',   color: '#666',    bg: '#f5f5f5' },
}

export default function AdminPage() {
  const { user, loading: authLoading, isConfigured } = useAuth()
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(false)
  const [checking, setChecking] = useState(true)
  const [feedback, setFeedback] = useState([])
  const [users, setUsers] = useState([])
  const [tab, setTab] = useState('analytics')
  const [filterType, setFilterType] = useState('all')
  const [filterStatus, setFilterStatus] = useState('open')
  const [sortBy, setSortBy] = useState('date')
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    if (authLoading) return
    // Redirect anonymous users and unauthenticated users to login
    if (!user || user.isAnonymous || !isConfigured) { router.push('/login'); return }

    const checkAdmin = async () => {
      const profile = await loadUserProfile(user.uid)
      if (profile?.isAdmin) {
        setIsAdmin(true)
        const [fb, u] = await Promise.all([loadAllFeedback(), loadAllUsers()])
        setFeedback(fb)
        setUsers(u)
      }
      setChecking(false)
    }
    checkAdmin()
  }, [user, authLoading, isConfigured, router])

  // Optimistically update a feedback item in local state + Firestore
  const handleFeedbackUpdate = async (id, updates) => {
    // Snapshot previous state so we can revert if the Firestore write fails
    const previous = feedback.find(f => f.id === id)
    setFeedback(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f))
    setSaveError('')

    const ok = await updateFeedbackItem(id, updates)
    if (!ok) {
      // Revert optimistic update
      if (previous) {
        setFeedback(prev => prev.map(f => f.id === id ? previous : f))
      }
      setSaveError('Save failed — check your connection or Firestore permissions.')
      setTimeout(() => setSaveError(''), 5000)
    }
  }

  // ── Derived analytics ──────────────────────────────────────────────────────
  const now = new Date()
  const msDay = 24 * 60 * 60 * 1000

  const analytics = useMemo(() => {
    const ago = (days) => new Date(now.getTime() - days * msDay).toISOString()
    const active7d  = users.filter(u => u.lastActive >= ago(7)).length
    const active30d = users.filter(u => u.lastActive >= ago(30)).length
    const newMonth  = users.filter(u => u.createdAt  >= ago(30)).length

    const openBugs     = feedback.filter(f => f.type === 'bug'     && f.status !== 'resolved').length
    const openFeatures = feedback.filter(f => f.type === 'feature' && f.status !== 'resolved').length

    // User registrations — last 8 weeks
    const weekBuckets = Array.from({ length: 8 }, (_, i) => {
      const weekStart = new Date(now.getTime() - (7 - i) * 7 * msDay)
      const weekEnd   = new Date(now.getTime() - (6 - i) * 7 * msDay)
      const count = users.filter(u => {
        if (!u.createdAt) return false
        const d = new Date(u.createdAt)
        return d >= weekStart && d < weekEnd
      }).length
      const label = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      return { label, count }
    })

    // Feedback submissions — last 8 weeks
    const feedbackWeeks = Array.from({ length: 8 }, (_, i) => {
      const weekStart = new Date(now.getTime() - (7 - i) * 7 * msDay)
      const weekEnd   = new Date(now.getTime() - (6 - i) * 7 * msDay)
      const count = feedback.filter(f => {
        if (!f.createdAt) return false
        const d = new Date(f.createdAt)
        return d >= weekStart && d < weekEnd
      }).length
      const label = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      return { label, count }
    })

    const byType = {
      bug:     feedback.filter(f => f.type === 'bug').length,
      feature: feedback.filter(f => f.type === 'feature').length,
      other:   feedback.filter(f => f.type === 'other').length,
    }
    const byStatus = {
      new:          feedback.filter(f => f.status === 'new' || !f.status).length,
      'in-progress': feedback.filter(f => f.status === 'in-progress').length,
      resolved:     feedback.filter(f => f.status === 'resolved').length,
    }
    const byPriority = {
      critical: feedback.filter(f => f.priority === 'critical').length,
      high:     feedback.filter(f => f.priority === 'high').length,
      medium:   feedback.filter(f => f.priority === 'medium').length,
      low:      feedback.filter(f => f.priority === 'low').length,
    }

    return { active7d, active30d, newMonth, openBugs, openFeatures, weekBuckets, feedbackWeeks, byType, byStatus, byPriority }
  }, [users, feedback])

  // ── Filtered + sorted feedback ─────────────────────────────────────────────
  const filteredFeedback = useMemo(() => {
    let list = [...feedback]
    if (filterType !== 'all') list = list.filter(f => f.type === filterType)
    if (filterStatus === 'open') list = list.filter(f => f.status !== 'resolved')
    else if (filterStatus !== 'all') list = list.filter(f => f.status === filterStatus)

    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3, none: 4, undefined: 4 }
    if (sortBy === 'priority') {
      list.sort((a, b) => (priorityOrder[a.priority ?? 'none'] - priorityOrder[b.priority ?? 'none']))
    } else {
      list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    }
    return list
  }, [feedback, filterType, filterStatus, sortBy])

  // ── Helpers ────────────────────────────────────────────────────────────────
  const formatDate = (iso) => {
    if (!iso) return 'N/A'
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }
  const formatDateTime = (iso) => {
    if (!iso) return 'N/A'
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' +
      d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }

  const Badge = ({ config, value }) => {
    const c = config[value] || config.other || config.none || Object.values(config)[0]
    return (
      <span style={{
        display: 'inline-block', padding: '2px 8px',
        backgroundColor: c.bg, color: c.color,
        borderRadius: '4px', fontSize: '11px', fontWeight: '600'
      }}>{c.label}</span>
    )
  }

  const MiniBar = ({ data, color = '#5f8a8f' }) => {
    const max = Math.max(...data.map(d => d.count), 1)
    return (
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '72px' }}>
        {data.map((d, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
            <div style={{ fontSize: '9px', color: '#999', height: '12px' }}>{d.count > 0 ? d.count : ''}</div>
            <div style={{
              width: '100%',
              height: `${Math.max((d.count / max) * 48, d.count > 0 ? 4 : 1)}px`,
              backgroundColor: d.count > 0 ? color : '#f0f0f0',
              borderRadius: '2px 2px 0 0',
              transition: 'height 0.3s'
            }} />
            <div style={{ fontSize: '9px', color: '#bbb', whiteSpace: 'nowrap' }}>{d.label}</div>
          </div>
        ))}
      </div>
    )
  }

  // ── Loading / access denied ────────────────────────────────────────────────
  if (authLoading || checking) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: '14px', color: '#666' }}>Loading...</div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={{ backgroundColor: '#fff', borderRadius: '16px', padding: '32px 24px', maxWidth: '400px', width: '100%', textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
          <h1 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: '600', color: '#1a1a1a' }}>Access Denied</h1>
          <p style={{ margin: '0 0 20px 0', fontSize: '14px', color: '#666' }}>You don't have admin permissions.</p>
          <button onClick={() => router.push('/')} style={{ padding: '12px 24px', backgroundColor: '#5f8a8f', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}>
            Back to App
          </button>
        </div>
      </div>
    )
  }

  const openCount = feedback.filter(f => f.status !== 'resolved').length

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#fafafa' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '24px 20px' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h1 style={{ margin: '0 0 2px 0', fontSize: '20px', fontWeight: '700', color: '#1a1a1a', letterSpacing: '-0.3px' }}>
              Admin Dashboard
            </h1>
            <div style={{ fontSize: '12px', color: '#999' }}>Lytz Administration</div>
          </div>
          <button
            onClick={() => router.push('/')}
            style={{ padding: '8px 16px', backgroundColor: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', color: '#666', fontSize: '13px', fontWeight: '500', cursor: 'pointer' }}
          >
            Back to App
          </button>
        </div>

        {/* Stats strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '24px' }}>
          {[
            { label: 'Total Users',    value: users.length,          color: '#5f8a8f' },
            { label: 'Active (7d)',    value: analytics.active7d,    color: '#10b981' },
            { label: 'Active (30d)',   value: analytics.active30d,   color: '#10b981' },
            { label: 'New This Month', value: analytics.newMonth,    color: '#7c3aed' },
            { label: 'Open Bugs',      value: analytics.openBugs,    color: '#dc2626' },
            { label: 'Open Features',  value: analytics.openFeatures, color: '#2563eb' },
          ].map(s => (
            <div key={s.label} style={{ backgroundColor: '#fff', borderRadius: '10px', padding: '14px 16px', border: '1px solid #e8e8e8', textAlign: 'center' }}>
              <div style={{ fontSize: '22px', fontWeight: '700', color: s.color }}>{s.value}</div>
              <div style={{ fontSize: '11px', color: '#999', marginTop: '2px' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Save error banner */}
        {saveError && (
          <div style={{
            backgroundColor: '#fef2f2', border: '1px solid #fecaca',
            borderRadius: '8px', padding: '10px 14px', marginBottom: '16px',
            color: '#dc2626', fontSize: '13px', fontWeight: '500'
          }}>
            {saveError}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '2px', marginBottom: '20px', borderBottom: '1px solid #e0e0e0' }}>
          {[
            { id: 'analytics', label: 'Analytics' },
            { id: 'feedback',  label: `Feedback (${openCount} open)` },
            { id: 'users',     label: `Users (${users.length})` },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: '10px 20px', backgroundColor: 'transparent', border: 'none',
                borderBottom: tab === t.id ? '2px solid #5f8a8f' : '2px solid transparent',
                color: tab === t.id ? '#5f8a8f' : '#999',
                fontSize: '14px', fontWeight: '500', cursor: 'pointer', marginBottom: '-1px'
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── ANALYTICS TAB ── */}
        {tab === 'analytics' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* User activity breakdown */}
            <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '20px', border: '1px solid #e8e8e8' }}>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#1a1a1a', marginBottom: '14px' }}>User Activity</div>
              {[
                { label: 'Active last 7 days',  value: analytics.active7d,  total: users.length, color: '#10b981' },
                { label: 'Active last 30 days', value: analytics.active30d, total: users.length, color: '#5f8a8f' },
                { label: 'New this month',       value: analytics.newMonth,  total: users.length, color: '#7c3aed' },
              ].map(row => (
                <div key={row.label} style={{ marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '12px', color: '#555' }}>{row.label}</span>
                    <span style={{ fontSize: '12px', fontWeight: '600', color: '#1a1a1a' }}>
                      {row.value} <span style={{ color: '#999', fontWeight: '400' }}>/ {row.total}</span>
                    </span>
                  </div>
                  <div style={{ height: '6px', backgroundColor: '#f0f0f0', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: row.total > 0 ? `${(row.value / row.total) * 100}%` : '0%',
                      backgroundColor: row.color,
                      borderRadius: '3px',
                      transition: 'width 0.4s'
                    }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Charts row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '20px', border: '1px solid #e8e8e8' }}>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#1a1a1a', marginBottom: '14px' }}>New Users — Last 8 Weeks</div>
                <MiniBar data={analytics.weekBuckets} color="#5f8a8f" />
              </div>
              <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '20px', border: '1px solid #e8e8e8' }}>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#1a1a1a', marginBottom: '14px' }}>Feedback — Last 8 Weeks</div>
                <MiniBar data={analytics.feedbackWeeks} color="#7c3aed" />
              </div>
            </div>

            {/* Feedback breakdown */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
              {/* By type */}
              <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '20px', border: '1px solid #e8e8e8' }}>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#1a1a1a', marginBottom: '14px' }}>By Type</div>
                {Object.entries(analytics.byType).map(([type, count]) => (
                  <div key={type} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <Badge config={TYPE_CONFIG} value={type} />
                    <span style={{ fontSize: '14px', fontWeight: '600', color: '#1a1a1a' }}>{count}</span>
                  </div>
                ))}
              </div>

              {/* By status */}
              <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '20px', border: '1px solid #e8e8e8' }}>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#1a1a1a', marginBottom: '14px' }}>By Status</div>
                {Object.entries(analytics.byStatus).map(([status, count]) => (
                  <div key={status} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <Badge config={STATUS_CONFIG} value={status} />
                    <span style={{ fontSize: '14px', fontWeight: '600', color: '#1a1a1a' }}>{count}</span>
                  </div>
                ))}
              </div>

              {/* By priority */}
              <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '20px', border: '1px solid #e8e8e8' }}>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#1a1a1a', marginBottom: '14px' }}>By Priority</div>
                {Object.entries(analytics.byPriority).map(([pri, count]) => (
                  <div key={pri} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <Badge config={PRIORITY_CONFIG} value={pri} />
                    <span style={{ fontSize: '14px', fontWeight: '600', color: '#1a1a1a' }}>{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── FEEDBACK TAB ── */}
        {tab === 'feedback' && (
          <div>
            {/* Controls */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px', alignItems: 'center' }}>
              {/* Type filter */}
              <div style={{ display: 'flex', gap: '4px' }}>
                {[
                  { id: 'all', label: 'All' },
                  { id: 'bug', label: 'Bugs' },
                  { id: 'feature', label: 'Features' },
                  { id: 'other', label: 'Other' },
                ].map(f => (
                  <button
                    key={f.id}
                    onClick={() => setFilterType(f.id)}
                    style={{
                      padding: '5px 12px',
                      backgroundColor: filterType === f.id ? '#5f8a8f' : '#fff',
                      border: '1px solid', borderColor: filterType === f.id ? '#5f8a8f' : '#e0e0e0',
                      borderRadius: '6px',
                      color: filterType === f.id ? '#fff' : '#666',
                      fontSize: '12px', fontWeight: '500', cursor: 'pointer'
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div style={{ width: '1px', height: '20px', backgroundColor: '#e0e0e0' }} />

              {/* Status filter */}
              <div style={{ display: 'flex', gap: '4px' }}>
                {[
                  { id: 'open', label: 'Open' },
                  { id: 'in-progress', label: 'In Progress' },
                  { id: 'resolved', label: 'Resolved' },
                  { id: 'all', label: 'All' },
                ].map(s => (
                  <button
                    key={s.id}
                    onClick={() => setFilterStatus(s.id)}
                    style={{
                      padding: '5px 12px',
                      backgroundColor: filterStatus === s.id ? '#1a1a1a' : '#fff',
                      border: '1px solid', borderColor: filterStatus === s.id ? '#1a1a1a' : '#e0e0e0',
                      borderRadius: '6px',
                      color: filterStatus === s.id ? '#fff' : '#666',
                      fontSize: '12px', fontWeight: '500', cursor: 'pointer'
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '12px', color: '#999' }}>Sort:</span>
                {[
                  { id: 'date', label: 'Newest' },
                  { id: 'priority', label: 'Priority' },
                ].map(s => (
                  <button
                    key={s.id}
                    onClick={() => setSortBy(s.id)}
                    style={{
                      padding: '5px 12px',
                      backgroundColor: sortBy === s.id ? '#f0f7f8' : '#fff',
                      border: '1px solid', borderColor: sortBy === s.id ? '#5f8a8f' : '#e0e0e0',
                      borderRadius: '6px',
                      color: sortBy === s.id ? '#5f8a8f' : '#666',
                      fontSize: '12px', fontWeight: '500', cursor: 'pointer'
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Feedback count */}
            <div style={{ fontSize: '12px', color: '#999', marginBottom: '12px' }}>
              {filteredFeedback.length} item{filteredFeedback.length !== 1 ? 's' : ''}
            </div>

            {/* Feedback list */}
            {filteredFeedback.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#999', backgroundColor: '#fff', borderRadius: '10px', border: '1px solid #e0e0e0' }}>
                No feedback matches these filters.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {filteredFeedback.map(item => {
                  const isResolved = item.status === 'resolved'
                  return (
                    <div
                      key={item.id}
                      style={{
                        backgroundColor: '#fff',
                        borderRadius: '10px',
                        padding: '14px 16px',
                        border: '1px solid',
                        borderColor: isResolved ? '#e8f5e9' : '#e0e0e0',
                        opacity: isResolved ? 0.7 : 1,
                        transition: 'opacity 0.2s'
                      }}
                    >
                      {/* Top row */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
                        {/* Resolve checkbox */}
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', flexShrink: 0 }}>
                          <input
                            type="checkbox"
                            checked={isResolved}
                            onChange={e => handleFeedbackUpdate(item.id, { status: e.target.checked ? 'resolved' : 'new' })}
                            style={{ width: '15px', height: '15px', cursor: 'pointer', accentColor: '#16a34a' }}
                          />
                          <span style={{ fontSize: '11px', color: '#999', userSelect: 'none' }}>
                            {isResolved ? 'Resolved' : 'Resolve'}
                          </span>
                        </label>

                        <div style={{ width: '1px', height: '14px', backgroundColor: '#e0e0e0', flexShrink: 0 }} />

                        {/* Type badge */}
                        <Badge config={TYPE_CONFIG} value={item.type || 'other'} />

                        {/* Status badge (if not new/resolved) */}
                        {item.status === 'in-progress' && (
                          <Badge config={STATUS_CONFIG} value="in-progress" />
                        )}

                        {/* Priority selector */}
                        <select
                          value={item.priority || 'none'}
                          onChange={e => handleFeedbackUpdate(item.id, { priority: e.target.value })}
                          style={{
                            padding: '2px 6px',
                            backgroundColor: PRIORITY_CONFIG[item.priority || 'none'].bg,
                            color: PRIORITY_CONFIG[item.priority || 'none'].color,
                            border: `1px solid ${PRIORITY_CONFIG[item.priority || 'none'].color}40`,
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            outline: 'none'
                          }}
                        >
                          {Object.entries(PRIORITY_CONFIG).map(([val, cfg]) => (
                            <option key={val} value={val}>{cfg.label}</option>
                          ))}
                        </select>

                        {/* Status → In Progress button */}
                        {!isResolved && item.status !== 'in-progress' && (
                          <button
                            onClick={() => handleFeedbackUpdate(item.id, { status: 'in-progress' })}
                            style={{
                              padding: '2px 8px', backgroundColor: '#fffbeb',
                              border: '1px solid #d97706', borderRadius: '4px',
                              color: '#d97706', fontSize: '11px', fontWeight: '600',
                              cursor: 'pointer'
                            }}
                          >
                            Mark In Progress
                          </button>
                        )}
                        {item.status === 'in-progress' && !isResolved && (
                          <button
                            onClick={() => handleFeedbackUpdate(item.id, { status: 'new' })}
                            style={{
                              padding: '2px 8px', backgroundColor: '#f5f5f5',
                              border: '1px solid #ccc', borderRadius: '4px',
                              color: '#666', fontSize: '11px', fontWeight: '500',
                              cursor: 'pointer'
                            }}
                          >
                            Reopen
                          </button>
                        )}

                        {/* Date + user — pushed right */}
                        <div style={{ marginLeft: 'auto', textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: '11px', color: '#bbb' }}>{formatDateTime(item.createdAt)}</div>
                          <div style={{ fontSize: '11px', color: '#999', marginTop: '1px' }}>{item.userEmail || 'Anonymous'}</div>
                        </div>
                      </div>

                      {/* Message */}
                      <div style={{
                        fontSize: '13px', color: isResolved ? '#999' : '#1a1a1a',
                        lineHeight: '1.6', whiteSpace: 'pre-wrap',
                        textDecoration: isResolved ? 'line-through' : 'none'
                      }}>
                        {item.message}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── USERS TAB ── */}
        {tab === 'users' && (
          <div>
            {users.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#999', backgroundColor: '#fff', borderRadius: '10px', border: '1px solid #e0e0e0' }}>
                No users yet.
              </div>
            ) : (
              <div style={{ backgroundColor: '#fff', borderRadius: '10px', border: '1px solid #e0e0e0', overflow: 'hidden' }}>
                {/* Header */}
                <div style={{
                  display: 'grid', gridTemplateColumns: '2fr 1fr 1fr',
                  padding: '10px 16px', backgroundColor: '#fafafa',
                  borderBottom: '1px solid #e0e0e0',
                  fontSize: '11px', fontWeight: '600', color: '#999',
                  textTransform: 'uppercase', letterSpacing: '0.5px'
                }}>
                  <div>Email</div><div>Joined</div><div>Last Active</div>
                </div>
                {users
                  .sort((a, b) => (b.lastActive || '').localeCompare(a.lastActive || ''))
                  .map(u => (
                    <div key={u.id} style={{
                      display: 'grid', gridTemplateColumns: '2fr 1fr 1fr',
                      padding: '11px 16px', borderBottom: '1px solid #f0f0f0', fontSize: '13px'
                    }}>
                      <div style={{ color: '#1a1a1a', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {u.email}
                        {u.isAdmin && (
                          <span style={{ marginLeft: '6px', padding: '1px 6px', backgroundColor: '#5f8a8f', color: '#fff', borderRadius: '3px', fontSize: '9px', fontWeight: '600' }}>
                            ADMIN
                          </span>
                        )}
                      </div>
                      <div style={{ color: '#999' }}>{formatDate(u.createdAt)}</div>
                      <div style={{ color: '#999' }}>{formatDate(u.lastActive)}</div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
