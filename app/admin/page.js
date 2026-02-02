'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../lib/AuthContext'
import { loadUserProfile, loadAllFeedback, loadAllUsers } from '../../lib/dataSync'

export default function AdminPage() {
  const { user, loading: authLoading, isConfigured } = useAuth()
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(false)
  const [checking, setChecking] = useState(true)
  const [feedback, setFeedback] = useState([])
  const [users, setUsers] = useState([])
  const [tab, setTab] = useState('feedback')
  const [filterType, setFilterType] = useState('all')

  useEffect(() => {
    if (authLoading) return

    if (!user || !isConfigured) {
      router.push('/login')
      return
    }

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

  if (authLoading || checking) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#fafafa',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ fontSize: '14px', color: '#666' }}>Loading...</div>
      </div>
    )
  }

  if (!isAdmin) {
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
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
          <h1 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: '600', color: '#1a1a1a' }}>
            Access Denied
          </h1>
          <p style={{ margin: '0 0 20px 0', fontSize: '14px', color: '#666' }}>
            You don't have admin permissions.
          </p>
          <button
            onClick={() => router.push('/')}
            style={{
              padding: '12px 24px',
              backgroundColor: '#5f8a8f',
              border: 'none',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            Back to App
          </button>
        </div>
      </div>
    )
  }

  // Stats
  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const activeUsers = users.filter(u => u.lastActive && u.lastActive >= sevenDaysAgo).length
  const bugCount = feedback.filter(f => f.type === 'bug').length
  const featureCount = feedback.filter(f => f.type === 'feature').length

  const filteredFeedback = filterType === 'all'
    ? feedback
    : feedback.filter(f => f.type === filterType)

  const formatDate = (iso) => {
    if (!iso) return 'N/A'
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const formatDateTime = (iso) => {
    if (!iso) return 'N/A'
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' +
      d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }

  const typeBadge = (type) => {
    const colors = {
      bug: { bg: '#fef2f2', color: '#dc2626', label: 'Bug' },
      feature: { bg: '#eff6ff', color: '#2563eb', label: 'Feature' },
      other: { bg: '#f5f5f5', color: '#666', label: 'Other' }
    }
    const c = colors[type] || colors.other
    return (
      <span style={{
        display: 'inline-block',
        padding: '2px 8px',
        backgroundColor: c.bg,
        color: c.color,
        borderRadius: '4px',
        fontSize: '11px',
        fontWeight: '600'
      }}>
        {c.label}
      </span>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#fafafa',
      padding: '20px',
      maxWidth: '800px',
      margin: '0 auto'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px'
      }}>
        <div>
          <h1 style={{ margin: '0 0 4px 0', fontSize: '20px', fontWeight: '600', color: '#1a1a1a', letterSpacing: '-0.3px' }}>
            Admin Dashboard
          </h1>
          <div style={{ fontSize: '12px', color: '#999' }}>Lytz Administration</div>
        </div>
        <button
          onClick={() => router.push('/')}
          style={{
            padding: '8px 16px',
            backgroundColor: '#fff',
            border: '1px solid #e0e0e0',
            borderRadius: '8px',
            color: '#666',
            fontSize: '13px',
            fontWeight: '500',
            cursor: 'pointer'
          }}
        >
          Back to App
        </button>
      </div>

      {/* Stats Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '12px',
        marginBottom: '24px'
      }}>
        {[
          { label: 'Total Users', value: users.length, color: '#5f8a8f' },
          { label: 'Active (7d)', value: activeUsers, color: '#10b981' },
          { label: 'Bug Reports', value: bugCount, color: '#dc2626' },
          { label: 'Feature Requests', value: featureCount, color: '#2563eb' }
        ].map(stat => (
          <div key={stat.label} style={{
            backgroundColor: '#fff',
            borderRadius: '10px',
            padding: '16px',
            border: '1px solid #e0e0e0',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '24px', fontWeight: '600', color: stat.color }}>
              {stat.value}
            </div>
            <div style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: '2px',
        marginBottom: '16px',
        borderBottom: '1px solid #e0e0e0'
      }}>
        {[
          { id: 'feedback', label: 'Feedback' },
          { id: 'users', label: 'Users' }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '10px 20px',
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: tab === t.id ? '2px solid #5f8a8f' : '2px solid transparent',
              color: tab === t.id ? '#5f8a8f' : '#999',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              marginBottom: '-1px'
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Feedback Tab */}
      {tab === 'feedback' && (
        <div>
          {/* Filter */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            {[
              { id: 'all', label: 'All' },
              { id: 'bug', label: 'Bugs' },
              { id: 'feature', label: 'Features' },
              { id: 'other', label: 'Other' }
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setFilterType(f.id)}
                style={{
                  padding: '6px 14px',
                  backgroundColor: filterType === f.id ? '#5f8a8f' : '#fff',
                  border: '1px solid',
                  borderColor: filterType === f.id ? '#5f8a8f' : '#e0e0e0',
                  borderRadius: '6px',
                  color: filterType === f.id ? '#fff' : '#666',
                  fontSize: '12px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {filteredFeedback.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '32px',
              color: '#999',
              backgroundColor: '#fff',
              borderRadius: '10px',
              border: '1px solid #e0e0e0'
            }}>
              No feedback yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filteredFeedback.map(item => (
                <div key={item.id} style={{
                  backgroundColor: '#fff',
                  borderRadius: '10px',
                  padding: '16px',
                  border: '1px solid #e0e0e0'
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '8px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {typeBadge(item.type)}
                      <span style={{ fontSize: '12px', color: '#999' }}>
                        {item.userEmail}
                      </span>
                    </div>
                    <span style={{ fontSize: '11px', color: '#bbb' }}>
                      {formatDateTime(item.createdAt)}
                    </span>
                  </div>
                  <div style={{
                    fontSize: '13px',
                    color: '#1a1a1a',
                    lineHeight: '1.5',
                    whiteSpace: 'pre-wrap'
                  }}>
                    {item.message}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Users Tab */}
      {tab === 'users' && (
        <div>
          {users.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '32px',
              color: '#999',
              backgroundColor: '#fff',
              borderRadius: '10px',
              border: '1px solid #e0e0e0'
            }}>
              No users yet.
            </div>
          ) : (
            <div style={{
              backgroundColor: '#fff',
              borderRadius: '10px',
              border: '1px solid #e0e0e0',
              overflow: 'hidden'
            }}>
              {/* Table header */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr 1fr',
                padding: '12px 16px',
                backgroundColor: '#fafafa',
                borderBottom: '1px solid #e0e0e0',
                fontSize: '11px',
                fontWeight: '600',
                color: '#999',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                <div>Email</div>
                <div>Joined</div>
                <div>Last Active</div>
              </div>
              {/* User rows */}
              {users
                .sort((a, b) => (b.lastActive || '').localeCompare(a.lastActive || ''))
                .map(u => (
                <div key={u.id} style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 1fr',
                  padding: '12px 16px',
                  borderBottom: '1px solid #f0f0f0',
                  fontSize: '13px'
                }}>
                  <div style={{
                    color: '#1a1a1a',
                    fontWeight: '500',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {u.email}
                    {u.isAdmin && (
                      <span style={{
                        marginLeft: '6px',
                        padding: '1px 6px',
                        backgroundColor: '#5f8a8f',
                        color: '#fff',
                        borderRadius: '3px',
                        fontSize: '9px',
                        fontWeight: '600'
                      }}>
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
  )
}
