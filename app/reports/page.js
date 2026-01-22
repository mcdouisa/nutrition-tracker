'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

export default function ReportsPage() {
  const [history, setHistory] = useState([])
  const [metrics, setMetrics] = useState([])
  const [viewMode, setViewMode] = useState('weekly') // weekly, monthly
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Load history from localStorage
    const storedHistory = localStorage.getItem('nutrition-history')
    if (storedHistory) {
      setHistory(JSON.parse(storedHistory))
    }

    // Load metrics configuration
    const storedMetrics = localStorage.getItem('nutrition-metrics')
    if (storedMetrics) {
      setMetrics(JSON.parse(storedMetrics))
    }

    setLoading(false)
  }, [])

  // Get date range based on view mode
  const getDateRange = () => {
    const start = new Date(selectedDate)
    const end = new Date(selectedDate)

    if (viewMode === 'weekly') {
      // Get start of week (Sunday)
      const day = start.getDay()
      start.setDate(start.getDate() - day)
      end.setDate(start.getDate() + 6)
    } else {
      // Get start and end of month
      start.setDate(1)
      end.setMonth(end.getMonth() + 1)
      end.setDate(0)
    }

    start.setHours(0, 0, 0, 0)
    end.setHours(23, 59, 59, 999)

    return { start, end }
  }

  // Filter history for selected range
  const getFilteredHistory = () => {
    const { start, end } = getDateRange()
    return history.filter(entry => {
      const entryDate = new Date(entry.date)
      return entryDate >= start && entryDate <= end
    }).sort((a, b) => new Date(a.date) - new Date(b.date))
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

    if (viewMode === 'weekly') {
      return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', options)}, ${end.getFullYear()}`
    } else {
      return start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
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
      padding: '40px 20px'
    }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{
          marginBottom: '32px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start'
        }}>
          <div>
            <h1 style={{
              margin: '0 0 8px 0',
              fontSize: '32px',
              fontWeight: '600',
              color: '#1a1a1a',
              letterSpacing: '-0.5px'
            }}>
              Reports
            </h1>
            <div style={{
              color: '#666',
              fontSize: '15px'
            }}>
              Track your nutrition progress over time
            </div>
          </div>
          <Link
            href="/"
            style={{
              padding: '10px 20px',
              backgroundColor: '#fff',
              border: '1px solid #e0e0e0',
              borderRadius: '8px',
              color: '#1a1a1a',
              fontSize: '14px',
              fontWeight: '500',
              textDecoration: 'none',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
            }}
          >
            ← Back to Tracker
          </Link>
        </div>

        {/* View Mode Toggle */}
        <div style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '24px'
        }}>
          <button
            onClick={() => setViewMode('weekly')}
            style={{
              padding: '10px 24px',
              backgroundColor: viewMode === 'weekly' ? '#1a1a1a' : '#fff',
              border: '1px solid',
              borderColor: viewMode === 'weekly' ? '#1a1a1a' : '#e0e0e0',
              borderRadius: '8px',
              color: viewMode === 'weekly' ? '#fff' : '#666',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            Weekly
          </button>
          <button
            onClick={() => setViewMode('monthly')}
            style={{
              padding: '10px 24px',
              backgroundColor: viewMode === 'monthly' ? '#1a1a1a' : '#fff',
              border: '1px solid',
              borderColor: viewMode === 'monthly' ? '#1a1a1a' : '#e0e0e0',
              borderRadius: '8px',
              color: viewMode === 'monthly' ? '#fff' : '#666',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            Monthly
          </button>
        </div>

        {/* Date Navigation */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '24px',
          marginBottom: '32px',
          padding: '20px',
          backgroundColor: '#fff',
          borderRadius: '12px',
          border: '1px solid #e0e0e0'
        }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              padding: '8px 16px',
              backgroundColor: '#f5f5f5',
              border: 'none',
              borderRadius: '6px',
              color: '#666',
              fontSize: '18px',
              cursor: 'pointer'
            }}
          >
            ←
          </button>
          <div style={{
            fontSize: '18px',
            fontWeight: '600',
            color: '#1a1a1a',
            minWidth: '200px',
            textAlign: 'center'
          }}>
            {formatDateRange()}
          </div>
          <button
            onClick={() => navigate(1)}
            style={{
              padding: '8px 16px',
              backgroundColor: '#f5f5f5',
              border: 'none',
              borderRadius: '6px',
              color: '#666',
              fontSize: '18px',
              cursor: 'pointer'
            }}
          >
            →
          </button>
        </div>

        {/* Summary Stats */}
        {metrics.length > 0 && (
          <div style={{ marginBottom: '32px' }}>
            <h2 style={{
              margin: '0 0 16px 0',
              fontSize: '13px',
              fontWeight: '600',
              color: '#999',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Summary ({stats.days} days tracked)
            </h2>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '12px'
            }}>
              {metrics.map(metric => (
                <div key={metric.key} style={{
                  padding: '24px',
                  backgroundColor: '#fff',
                  border: '1px solid #e0e0e0',
                  borderRadius: '12px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '12px'
                  }}>
                    {metric.icon && <span style={{ fontSize: '18px' }}>{metric.icon}</span>}
                    <span style={{ fontSize: '14px', color: '#666', fontWeight: '500' }}>
                      {metric.name}
                    </span>
                  </div>
                  <div style={{
                    fontSize: '32px',
                    fontWeight: '600',
                    color: '#1a1a1a',
                    marginBottom: '4px'
                  }}>
                    {stats.averages[metric.key] || 0}
                    <span style={{ fontSize: '16px', color: '#999', fontWeight: '500' }}> {metric.unit}/day</span>
                  </div>
                  <div style={{ fontSize: '13px', color: '#999' }}>
                    Total: {stats.totals[metric.key] || 0} {metric.unit}
                  </div>
                  {metric.goal > 0 && stats.days > 0 && (
                    <div style={{
                      marginTop: '12px',
                      padding: '8px 12px',
                      backgroundColor: '#f0fdf4',
                      borderRadius: '6px',
                      fontSize: '13px',
                      color: '#166534'
                    }}>
                      Goal met {stats.goalAchievement[metric.key] || 0}/{stats.days} days
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Daily Breakdown */}
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{
            margin: '0 0 16px 0',
            fontSize: '13px',
            fontWeight: '600',
            color: '#999',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            Daily Breakdown
          </h2>

          {filteredHistory.length === 0 ? (
            <div style={{
              padding: '60px 20px',
              backgroundColor: '#fff',
              borderRadius: '12px',
              border: '1px solid #e0e0e0',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.3 }}>📊</div>
              <div style={{ fontSize: '16px', fontWeight: '500', color: '#666', marginBottom: '8px' }}>
                No data for this period
              </div>
              <div style={{ fontSize: '14px', color: '#999' }}>
                Start tracking your nutrition to see reports here
              </div>
            </div>
          ) : (
            <div style={{
              backgroundColor: '#fff',
              borderRadius: '12px',
              border: '1px solid #e0e0e0',
              overflow: 'hidden'
            }}>
              {/* Chart visualization */}
              {metrics.length > 0 && (
                <div style={{ padding: '24px', borderBottom: '1px solid #e0e0e0' }}>
                  <div style={{ fontSize: '14px', fontWeight: '500', color: '#666', marginBottom: '16px' }}>
                    {metrics[0]?.name || 'Calories'} Trend
                  </div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'flex-end',
                    gap: '4px',
                    height: '120px'
                  }}>
                    {filteredHistory.map((day, i) => {
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
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <div
                            style={{
                              width: '100%',
                              maxWidth: '40px',
                              height: `${Math.max(height, 4)}%`,
                              backgroundColor: metGoal ? '#10b981' : '#60a5fa',
                              borderRadius: '4px 4px 0 0',
                              transition: 'height 0.3s ease',
                              minHeight: '4px'
                            }}
                            title={`${new Date(day.date).toLocaleDateString()}: ${value} ${metric?.unit || ''}`}
                          />
                          <div style={{
                            fontSize: '10px',
                            color: '#999',
                            transform: 'rotate(-45deg)',
                            whiteSpace: 'nowrap'
                          }}>
                            {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  {metrics[0]?.goal && (
                    <div style={{
                      marginTop: '8px',
                      fontSize: '12px',
                      color: '#999',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '16px'
                    }}>
                      <span><span style={{ display: 'inline-block', width: '12px', height: '12px', backgroundColor: '#10b981', borderRadius: '2px', marginRight: '4px' }}></span> Goal met</span>
                      <span><span style={{ display: 'inline-block', width: '12px', height: '12px', backgroundColor: '#60a5fa', borderRadius: '2px', marginRight: '4px' }}></span> Under goal</span>
                    </div>
                  )}
                </div>
              )}

              {/* Daily entries table */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#fafafa' }}>
                      <th style={{
                        padding: '12px 16px',
                        textAlign: 'left',
                        fontSize: '12px',
                        fontWeight: '600',
                        color: '#666',
                        borderBottom: '1px solid #e0e0e0'
                      }}>
                        Date
                      </th>
                      {metrics.map(metric => (
                        <th key={metric.key} style={{
                          padding: '12px 16px',
                          textAlign: 'right',
                          fontSize: '12px',
                          fontWeight: '600',
                          color: '#666',
                          borderBottom: '1px solid #e0e0e0'
                        }}>
                          {metric.name}
                        </th>
                      ))}
                      <th style={{
                        padding: '12px 16px',
                        textAlign: 'right',
                        fontSize: '12px',
                        fontWeight: '600',
                        color: '#666',
                        borderBottom: '1px solid #e0e0e0'
                      }}>
                        Water
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHistory.map((day, i) => (
                      <tr key={i} style={{
                        backgroundColor: i % 2 === 0 ? '#fff' : '#fafafa'
                      }}>
                        <td style={{
                          padding: '12px 16px',
                          fontSize: '14px',
                          color: '#1a1a1a',
                          borderBottom: '1px solid #f0f0f0'
                        }}>
                          {new Date(day.date).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </td>
                        {metrics.map(metric => {
                          const dayMetric = day.nutritionMetrics?.find(m => m.key === metric.key)
                          const value = dayMetric?.value || 0
                          const metGoal = metric.goal && value >= metric.goal
                          return (
                            <td key={metric.key} style={{
                              padding: '12px 16px',
                              textAlign: 'right',
                              fontSize: '14px',
                              color: metGoal ? '#10b981' : '#1a1a1a',
                              fontWeight: metGoal ? '600' : '400',
                              borderBottom: '1px solid #f0f0f0'
                            }}>
                              {value} {metric.unit}
                            </td>
                          )
                        })}
                        <td style={{
                          padding: '12px 16px',
                          textAlign: 'right',
                          fontSize: '14px',
                          color: '#1a1a1a',
                          borderBottom: '1px solid #f0f0f0'
                        }}>
                          {day.water || 0} oz
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Water Summary */}
        {filteredHistory.length > 0 && (
          <div style={{ marginBottom: '32px' }}>
            <h2 style={{
              margin: '0 0 16px 0',
              fontSize: '13px',
              fontWeight: '600',
              color: '#999',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Hydration Summary
            </h2>
            <div style={{
              padding: '24px',
              backgroundColor: '#fff',
              borderRadius: '12px',
              border: '1px solid #e0e0e0'
            }}>
              {(() => {
                const totalWater = filteredHistory.reduce((sum, day) => sum + (day.water || 0), 0)
                const avgWater = Math.round(totalWater / filteredHistory.length)
                const waterGoal = parseInt(localStorage.getItem('water-goal')) || 0
                const daysMetGoal = waterGoal > 0 ? filteredHistory.filter(d => (d.water || 0) >= waterGoal).length : 0

                return (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', textAlign: 'center' }}>
                    <div>
                      <div style={{ fontSize: '32px', fontWeight: '600', color: '#1a1a1a' }}>{totalWater}</div>
                      <div style={{ fontSize: '13px', color: '#999' }}>Total oz</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '32px', fontWeight: '600', color: '#1a1a1a' }}>{avgWater}</div>
                      <div style={{ fontSize: '13px', color: '#999' }}>Avg oz/day</div>
                    </div>
                    {waterGoal > 0 && (
                      <div>
                        <div style={{ fontSize: '32px', fontWeight: '600', color: '#10b981' }}>{daysMetGoal}/{stats.days}</div>
                        <div style={{ fontSize: '13px', color: '#999' }}>Days at goal</div>
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
