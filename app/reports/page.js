'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '../../lib/AuthContext'
import { loadHistory, loadUserSettings, saveHistoryEntry } from '../../lib/dataSync'

export default function ReportsPage() {
  const { user, isConfigured } = useAuth()
  const [history, setHistory] = useState([])
  const [metrics, setMetrics] = useState([])
  const [viewMode, setViewMode] = useState('last7') // last7, weekly, monthly
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [loading, setLoading] = useState(true)
  const [editingDay, setEditingDay] = useState(null)
  const [editValues, setEditValues] = useState({})

  useEffect(() => {
    const loadData = async () => {
      // If user is logged in, load from cloud
      if (user && isConfigured) {
        const cloudHistory = await loadHistory(user.uid)
        if (cloudHistory && cloudHistory.length > 0) {
          setHistory(cloudHistory)
        }

        const cloudSettings = await loadUserSettings(user.uid)
        if (cloudSettings?.nutritionMetrics) {
          setMetrics(cloudSettings.nutritionMetrics)
        }
      } else {
        // Fallback to localStorage
        const storedHistory = localStorage.getItem('nutrition-history')
        if (storedHistory) {
          setHistory(JSON.parse(storedHistory))
        }

        const storedMetrics = localStorage.getItem('nutrition-metrics')
        if (storedMetrics) {
          setMetrics(JSON.parse(storedMetrics))
        }
      }

      setLoading(false)
    }

    loadData()
  }, [user, isConfigured])

  // Get date range based on view mode
  const getDateRange = () => {
    const end = new Date()
    const start = new Date()

    if (viewMode === 'last7') {
      // Last 7 days including today
      start.setDate(end.getDate() - 6)
    } else if (viewMode === 'weekly') {
      // Calendar week (Sunday to Saturday)
      const day = selectedDate.getDay()
      start.setTime(selectedDate.getTime())
      start.setDate(start.getDate() - day)
      end.setTime(start.getTime())
      end.setDate(start.getDate() + 6)
    } else {
      // Monthly
      start.setTime(selectedDate.getTime())
      start.setDate(1)
      end.setTime(selectedDate.getTime())
      end.setMonth(end.getMonth() + 1)
      end.setDate(0)
    }

    start.setHours(0, 0, 0, 0)
    end.setHours(23, 59, 59, 999)

    return { start, end }
  }

  // Parse date string safely in local time (YYYY-MM-DD as local, not UTC)
  const parseLocalDate = (dateStr) => {
    if (!dateStr) return new Date(0)
    // If YYYY-MM-DD format, append T00:00:00 to parse as local time
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return new Date(dateStr + 'T00:00:00')
    }
    return new Date(dateStr)
  }

  // Filter history for selected range
  const getFilteredHistory = () => {
    const { start, end } = getDateRange()
    return history.filter(entry => {
      const entryDate = parseLocalDate(entry.date)
      return entryDate >= start && entryDate <= end
    }).sort((a, b) => parseLocalDate(b.date) - parseLocalDate(a.date)) // Most recent first
  }

  // Calculate stats for the period
  const calculateStats = () => {
    const filtered = getFilteredHistory()
    if (filtered.length === 0 || metrics.length === 0) {
      return { totals: {}, averages: {}, days: 0, goalAchievement: {} }
    }

    const totals = {}
    const goalAchievement = {}

    metrics.forEach(metric => {
      totals[metric.key] = 0
      goalAchievement[metric.key] = 0
    })

    filtered.forEach(day => {
      if (day.nutritionMetrics) {
        day.nutritionMetrics.forEach(metric => {
          if (totals[metric.key] !== undefined) {
            totals[metric.key] += metric.value || 0
            // Check if goal was met
            const metricConfig = metrics.find(m => m.key === metric.key)
            if (metricConfig?.goal && metric.value >= metricConfig.goal) {
              goalAchievement[metric.key]++
            }
          }
        })
      }
    })

    const averages = {}
    metrics.forEach(metric => {
      averages[metric.key] = filtered.length > 0 ? Math.round(totals[metric.key] / filtered.length) : 0
    })

    return { totals, averages, days: filtered.length, goalAchievement }
  }

  // Navigate to previous/next period
  const navigate = (direction) => {
    const newDate = new Date(selectedDate)
    if (viewMode === 'weekly') {
      newDate.setDate(newDate.getDate() + (direction * 7))
    } else {
      newDate.setMonth(newDate.getMonth() + direction)
    }
    setSelectedDate(newDate)
  }

  // Format date range for display
  const formatDateRange = () => {
    const { start, end } = getDateRange()
    const options = { month: 'short', day: 'numeric' }

    if (viewMode === 'last7') {
      return `Last 7 Days`
    } else if (viewMode === 'weekly') {
      return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', options)}`
    } else {
      return start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    }
  }

  // Edit a past day
  const startEditing = (day) => {
    const values = { water: day.water || 0 }
    metrics.forEach(metric => {
      const dayMetric = day.nutritionMetrics?.find(m => m.key === metric.key)
      values[metric.key] = dayMetric?.value || 0
    })
    setEditValues(values)
    setEditingDay(day)
  }

  // Save edited day
  const saveEditedDay = async () => {
    if (!editingDay) return

    const updatedMetrics = metrics.map(metric => ({
      ...metric,
      value: parseInt(editValues[metric.key]) || 0
    }))

    const updatedDay = {
      ...editingDay,
      water: parseInt(editValues.water) || 0,
      nutritionMetrics: updatedMetrics
    }

    // Update in history
    const updatedHistory = history.map(day =>
      day.date === editingDay.date ? updatedDay : day
    )

    // Check if this day exists, if not add it
    if (!history.find(day => day.date === editingDay.date)) {
      updatedHistory.push(updatedDay)
    }

    setHistory(updatedHistory)

    // Save to cloud or localStorage
    if (user && isConfigured) {
      await saveHistoryEntry(user.uid, editingDay.date, updatedDay)
    } else {
      localStorage.setItem('nutrition-history', JSON.stringify(updatedHistory))
    }

    setEditingDay(null)
    setEditValues({})
  }

  // Add entry to a previous day (creates the day if it doesn't exist)
  const addToPreviousDay = (daysAgo) => {
    const targetDate = new Date()
    targetDate.setDate(targetDate.getDate() - daysAgo)
    const targetKey = targetDate.toISOString().split('T')[0] // YYYY-MM-DD

    // Check if this day exists in history
    const existingDay = history.find(day => {
      const dayKey = parseLocalDate(day.date).toISOString().split('T')[0]
      return dayKey === targetKey
    })

    if (existingDay) {
      startEditing(existingDay)
    } else {
      // Create a new day entry
      const newDay = {
        date: targetKey,
        water: 0,
        nutritionMetrics: metrics.map(m => ({ ...m, value: 0 })),
        checklistItems: []
      }
      startEditing(newDay)
    }
  }

  const stats = calculateStats()
  const filteredHistory = getFilteredHistory()

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#fafafa',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ color: '#666' }}>Loading...</div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#fafafa',
      padding: '16px 12px',
      paddingBottom: '32px'
    }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h1 style={{
              margin: '0 0 4px 0',
              fontSize: '22px',
              fontWeight: '600',
              color: '#1a1a1a',
              letterSpacing: '-0.5px'
            }}>
              Reports
            </h1>
            <div style={{
              color: '#666',
              fontSize: '13px'
            }}>
              Track your progress
            </div>
          </div>
          <Link
            href="/"
            style={{
              padding: '8px 14px',
              backgroundColor: '#fff',
              border: '1px solid #e0e0e0',
              borderRadius: '8px',
              color: '#1a1a1a',
              fontSize: '13px',
              fontWeight: '500',
              textDecoration: 'none',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
            }}
          >
            ← Back
          </Link>
        </div>

        {/* View Mode Toggle - 3 options */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '6px',
          marginBottom: '16px'
        }}>
          <button
            onClick={() => setViewMode('last7')}
            style={{
              padding: '10px 12px',
              backgroundColor: viewMode === 'last7' ? '#1a1a1a' : '#fff',
              border: '1px solid',
              borderColor: viewMode === 'last7' ? '#1a1a1a' : '#e0e0e0',
              borderRadius: '8px',
              color: viewMode === 'last7' ? '#fff' : '#666',
              fontSize: '12px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            Last 7 Days
          </button>
          <button
            onClick={() => setViewMode('weekly')}
            style={{
              padding: '10px 12px',
              backgroundColor: viewMode === 'weekly' ? '#1a1a1a' : '#fff',
              border: '1px solid',
              borderColor: viewMode === 'weekly' ? '#1a1a1a' : '#e0e0e0',
              borderRadius: '8px',
              color: viewMode === 'weekly' ? '#fff' : '#666',
              fontSize: '12px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            Weekly
          </button>
          <button
            onClick={() => setViewMode('monthly')}
            style={{
              padding: '10px 12px',
              backgroundColor: viewMode === 'monthly' ? '#1a1a1a' : '#fff',
              border: '1px solid',
              borderColor: viewMode === 'monthly' ? '#1a1a1a' : '#e0e0e0',
              borderRadius: '8px',
              color: viewMode === 'monthly' ? '#fff' : '#666',
              fontSize: '12px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            Monthly
          </button>
        </div>

        {/* Date Navigation - only show for weekly/monthly */}
        {viewMode !== 'last7' && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '20px',
            padding: '14px 16px',
            backgroundColor: '#fff',
            borderRadius: '10px',
            border: '1px solid #e0e0e0'
          }}>
            <button
              onClick={() => navigate(-1)}
              style={{
                padding: '8px 12px',
                backgroundColor: '#f5f5f5',
                border: 'none',
                borderRadius: '6px',
                color: '#666',
                fontSize: '16px',
                cursor: 'pointer'
              }}
            >
              ←
            </button>
            <div style={{
              fontSize: '14px',
              fontWeight: '600',
              color: '#1a1a1a',
              textAlign: 'center'
            }}>
              {formatDateRange()}
            </div>
            <button
              onClick={() => navigate(1)}
              style={{
                padding: '8px 12px',
                backgroundColor: '#f5f5f5',
                border: 'none',
                borderRadius: '6px',
                color: '#666',
                fontSize: '16px',
                cursor: 'pointer'
              }}
            >
              →
            </button>
          </div>
        )}

        {/* Quick Add to Previous Days */}
        <div style={{
          marginBottom: '20px',
          padding: '14px 16px',
          backgroundColor: '#fff',
          borderRadius: '10px',
          border: '1px solid #e0e0e0'
        }}>
          <div style={{
            fontSize: '12px',
            fontWeight: '600',
            color: '#999',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: '10px'
          }}>
            Add to Previous Day
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={() => addToPreviousDay(1)}
              style={{
                padding: '8px 14px',
                backgroundColor: '#f5f5f5',
                border: '1px solid #e0e0e0',
                borderRadius: '6px',
                color: '#1a1a1a',
                fontSize: '12px',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              Yesterday
            </button>
            <button
              onClick={() => addToPreviousDay(2)}
              style={{
                padding: '8px 14px',
                backgroundColor: '#f5f5f5',
                border: '1px solid #e0e0e0',
                borderRadius: '6px',
                color: '#1a1a1a',
                fontSize: '12px',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              2 days ago
            </button>
            <button
              onClick={() => addToPreviousDay(3)}
              style={{
                padding: '8px 14px',
                backgroundColor: '#f5f5f5',
                border: '1px solid #e0e0e0',
                borderRadius: '6px',
                color: '#1a1a1a',
                fontSize: '12px',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              3 days ago
            </button>
          </div>
        </div>

        {/* Edit Modal */}
        {editingDay && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}>
            <div style={{
              backgroundColor: '#fff',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '400px',
              width: '100%',
              maxHeight: '80vh',
              overflow: 'auto'
            }}>
              <h3 style={{
                margin: '0 0 4px 0',
                fontSize: '18px',
                fontWeight: '600',
                color: '#1a1a1a'
              }}>
                Edit Entry
              </h3>
              <div style={{
                fontSize: '13px',
                color: '#666',
                marginBottom: '20px'
              }}>
                {parseLocalDate(editingDay.date).toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric'
                })}
              </div>

              {/* Water */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: '500',
                  color: '#666',
                  marginBottom: '6px'
                }}>
                  💧 Water (oz)
                </label>
                <input
                  type="number"
                  value={editValues.water || ''}
                  onChange={(e) => setEditValues({ ...editValues, water: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '12px',
                    backgroundColor: '#fafafa',
                    border: '1px solid #e0e0e0',
                    borderRadius: '8px',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Nutrition Metrics */}
              {metrics.map(metric => (
                <div key={metric.key} style={{ marginBottom: '16px' }}>
                  <label style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: '500',
                    color: '#666',
                    marginBottom: '6px'
                  }}>
                    {metric.icon} {metric.name} ({metric.unit})
                  </label>
                  <input
                    type="number"
                    value={editValues[metric.key] || ''}
                    onChange={(e) => setEditValues({ ...editValues, [metric.key]: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '12px',
                      backgroundColor: '#fafafa',
                      border: '1px solid #e0e0e0',
                      borderRadius: '8px',
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              ))}

              {/* Buttons */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button
                  onClick={() => {
                    setEditingDay(null)
                    setEditValues({})
                  }}
                  style={{
                    flex: 1,
                    padding: '12px',
                    backgroundColor: '#f5f5f5',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#666',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={saveEditedDay}
                  style={{
                    flex: 1,
                    padding: '12px',
                    backgroundColor: '#1a1a1a',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Summary Stats */}
        {metrics.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <h2 style={{
              margin: '0 0 12px 0',
              fontSize: '12px',
              fontWeight: '600',
              color: '#999',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Summary ({stats.days} days)
            </h2>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '8px'
            }}>
              {metrics.map(metric => (
                <div key={metric.key} style={{
                  padding: '16px',
                  backgroundColor: '#fff',
                  border: '1px solid #e0e0e0',
                  borderRadius: '10px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    marginBottom: '8px'
                  }}>
                    {metric.icon && <span style={{ fontSize: '14px' }}>{metric.icon}</span>}
                    <span style={{ fontSize: '12px', color: '#666', fontWeight: '500' }}>
                      {metric.name}
                    </span>
                  </div>
                  <div style={{
                    fontSize: '24px',
                    fontWeight: '600',
                    color: '#1a1a1a',
                    marginBottom: '2px'
                  }}>
                    {stats.averages[metric.key] || 0}
                    <span style={{ fontSize: '12px', color: '#999', fontWeight: '500' }}> /day</span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#999' }}>
                    Total: {stats.totals[metric.key] || 0} {metric.unit}
                  </div>
                  {metric.goal > 0 && stats.days > 0 && (
                    <div style={{
                      marginTop: '8px',
                      padding: '6px 8px',
                      backgroundColor: '#f0fdf4',
                      borderRadius: '4px',
                      fontSize: '11px',
                      color: '#166534'
                    }}>
                      Goal: {stats.goalAchievement[metric.key] || 0}/{stats.days} days
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Chart visualization */}
        {filteredHistory.length > 0 && metrics.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <h2 style={{
              margin: '0 0 12px 0',
              fontSize: '12px',
              fontWeight: '600',
              color: '#999',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              {metrics[0]?.name || 'Calories'} Trend
            </h2>
            <div style={{
              padding: '16px',
              backgroundColor: '#fff',
              borderRadius: '10px',
              border: '1px solid #e0e0e0'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'flex-end',
                gap: '3px',
                height: '100px',
                marginBottom: '8px'
              }}>
                {[...filteredHistory].reverse().map((day, i) => {
                  const metric = metrics[0]
                  const dayMetric = day.nutritionMetrics?.find(m => m.key === metric?.key)
                  const value = dayMetric?.value || 0
                  const maxValue = Math.max(...filteredHistory.map(d => {
                    const m = d.nutritionMetrics?.find(m => m.key === metric?.key)
                    return m?.value || 0
                  }), metric?.goal || 1)
                  const height = maxValue > 0 ? (value / maxValue) * 100 : 0
                  const metGoal = metric?.goal && value >= metric.goal

                  return (
                    <div
                      key={i}
                      style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center'
                      }}
                    >
                      <div
                        style={{
                          width: '100%',
                          maxWidth: '30px',
                          height: `${Math.max(height, 4)}%`,
                          backgroundColor: metGoal ? '#10b981' : '#60a5fa',
                          borderRadius: '3px 3px 0 0',
                          transition: 'height 0.3s ease',
                          minHeight: '4px'
                        }}
                        title={`${value} ${metric?.unit || ''}`}
                      />
                    </div>
                  )
                })}
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '10px',
                color: '#999'
              }}>
                <span>{parseLocalDate(filteredHistory[filteredHistory.length - 1]?.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                <span>{parseLocalDate(filteredHistory[0]?.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
              </div>
              {metrics[0]?.goal && (
                <div style={{
                  marginTop: '10px',
                  fontSize: '11px',
                  color: '#999',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ width: '10px', height: '10px', backgroundColor: '#10b981', borderRadius: '2px' }}></span>
                    Goal met
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ width: '10px', height: '10px', backgroundColor: '#60a5fa', borderRadius: '2px' }}></span>
                    Under
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Daily Breakdown */}
        <div style={{ marginBottom: '20px' }}>
          <h2 style={{
            margin: '0 0 12px 0',
            fontSize: '12px',
            fontWeight: '600',
            color: '#999',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            Daily Breakdown (tap to edit)
          </h2>

          {filteredHistory.length === 0 ? (
            <div style={{
              padding: '48px 20px',
              backgroundColor: '#fff',
              borderRadius: '10px',
              border: '1px solid #e0e0e0',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '40px', marginBottom: '12px', opacity: 0.3 }}>📊</div>
              <div style={{ fontSize: '14px', fontWeight: '500', color: '#666', marginBottom: '4px' }}>
                No data for this period
              </div>
              <div style={{ fontSize: '12px', color: '#999' }}>
                Start tracking to see reports
              </div>
            </div>
          ) : (
            <div style={{
              backgroundColor: '#fff',
              borderRadius: '10px',
              border: '1px solid #e0e0e0',
              overflow: 'hidden'
            }}>
              {/* Mobile-friendly daily cards */}
              {filteredHistory.map((day, i) => (
                <div
                  key={i}
                  onClick={() => startEditing(day)}
                  style={{
                    padding: '14px 16px',
                    borderBottom: i < filteredHistory.length - 1 ? '1px solid #f0f0f0' : 'none',
                    backgroundColor: i % 2 === 0 ? '#fff' : '#fafafa',
                    cursor: 'pointer',
                    transition: 'background-color 0.15s'
                  }}
                >
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '8px'
                  }}>
                    <div style={{
                      fontSize: '13px',
                      fontWeight: '600',
                      color: '#1a1a1a'
                    }}>
                      {parseLocalDate(day.date).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </div>
                    <div style={{
                      fontSize: '11px',
                      color: '#999'
                    }}>
                      tap to edit ✏️
                    </div>
                  </div>
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '8px'
                  }}>
                    {metrics.map(metric => {
                      const dayMetric = day.nutritionMetrics?.find(m => m.key === metric.key)
                      const value = dayMetric?.value || 0
                      const metGoal = metric.goal && value >= metric.goal
                      return (
                        <div key={metric.key} style={{
                          padding: '4px 8px',
                          backgroundColor: metGoal ? '#f0fdf4' : '#f5f5f5',
                          borderRadius: '4px',
                          fontSize: '12px',
                          color: metGoal ? '#166534' : '#666',
                          fontWeight: metGoal ? '600' : '400'
                        }}>
                          {metric.icon && <span style={{ marginRight: '4px' }}>{metric.icon}</span>}
                          {value} {metric.unit}
                        </div>
                      )
                    })}
                    <div style={{
                      padding: '4px 8px',
                      backgroundColor: '#f5f5f5',
                      borderRadius: '4px',
                      fontSize: '12px',
                      color: '#666'
                    }}>
                      💧 {day.water || 0} oz
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Water Summary */}
        {filteredHistory.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <h2 style={{
              margin: '0 0 12px 0',
              fontSize: '12px',
              fontWeight: '600',
              color: '#999',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Hydration
            </h2>
            <div style={{
              padding: '16px',
              backgroundColor: '#fff',
              borderRadius: '10px',
              border: '1px solid #e0e0e0'
            }}>
              {(() => {
                const totalWater = filteredHistory.reduce((sum, day) => sum + (day.water || 0), 0)
                const avgWater = Math.round(totalWater / filteredHistory.length)
                const waterGoal = parseInt(localStorage.getItem('water-goal')) || 0
                const daysMetGoal = waterGoal > 0 ? filteredHistory.filter(d => (d.water || 0) >= waterGoal).length : 0

                return (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: waterGoal > 0 ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)',
                    gap: '16px',
                    textAlign: 'center'
                  }}>
                    <div>
                      <div style={{ fontSize: '24px', fontWeight: '600', color: '#1a1a1a' }}>{totalWater}</div>
                      <div style={{ fontSize: '11px', color: '#999' }}>Total oz</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '24px', fontWeight: '600', color: '#1a1a1a' }}>{avgWater}</div>
                      <div style={{ fontSize: '11px', color: '#999' }}>Avg/day</div>
                    </div>
                    {waterGoal > 0 && (
                      <div>
                        <div style={{ fontSize: '24px', fontWeight: '600', color: '#10b981' }}>{daysMetGoal}/{stats.days}</div>
                        <div style={{ fontSize: '11px', color: '#999' }}>At goal</div>
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
