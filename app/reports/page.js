'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '../../lib/AuthContext'
import { loadHistory, loadUserSettings, saveHistoryEntry, toLocalDateStr } from '../../lib/dataSync'

// Time-of-day line chart for weekly view
function TimeOfDayChart({ filteredHistory, metrics }) {
  const timeBlocks = [
    { label: '5-8am', start: 5, end: 8 },
    { label: '8-11am', start: 8, end: 11 },
    { label: '11am-2pm', start: 11, end: 14 },
    { label: '2-5pm', start: 14, end: 17 },
    { label: '5-8pm', start: 17, end: 20 },
    { label: '8-11pm', start: 20, end: 23 },
  ]

  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

  // Process data: group nutrition entries by time block
  const blockData = {} // { metricKey: [block0avg, block1avg, ...] }
  let daysWithData = 0

  metrics.forEach(m => {
    blockData[m.key] = new Array(timeBlocks.length).fill(0)
  })

  filteredHistory.forEach(day => {
    if (!day.nutritionHistory || !Array.isArray(day.nutritionHistory)) return
    daysWithData++

    day.nutritionHistory.forEach(entry => {
      if (!entry.timestamp) return
      const hour = new Date(entry.timestamp).getHours()
      let blockIndex = timeBlocks.findIndex(b => hour >= b.start && hour < b.end)
      if (blockIndex === -1) {
        blockIndex = hour < 5 ? 0 : 5 // Before 5am → first block, after 11pm → last block
      }

      if (entry.estimates) {
        // AI batch entry
        metrics.forEach(m => {
          if (entry.estimates[m.key]) {
            blockData[m.key][blockIndex] += entry.estimates[m.key]
          }
        })
      } else if (entry.metricIndex !== undefined && entry.value !== undefined) {
        // Single metric entry
        const metricDef = day.nutritionMetrics?.[entry.metricIndex]
        if (metricDef && blockData[metricDef.key] !== undefined) {
          blockData[metricDef.key][blockIndex] += entry.value
        }
      }
    })
  })

  // Average across days
  if (daysWithData > 0) {
    metrics.forEach(m => {
      blockData[m.key] = blockData[m.key].map(v => Math.round(v / daysWithData))
    })
  }

  // Check if there's any data
  const hasData = Object.values(blockData).some(arr => arr.some(v => v > 0))

  if (!hasData) {
    return (
      <div style={{
        padding: '16px',
        backgroundColor: '#fff',
        borderRadius: '10px',
        border: '1px solid #e0e0e0'
      }}>
        <div style={{ padding: '32px 16px', textAlign: 'center', color: '#999' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px', opacity: 0.3 }}>📈</div>
          <div style={{ fontSize: '13px', fontWeight: '500', color: '#666' }}>
            No meal timing data available
          </div>
          <div style={{ fontSize: '12px', marginTop: '4px' }}>
            Log meals with the AI assistant to see time-of-day patterns
          </div>
        </div>
      </div>
    )
  }

  // SVG dimensions
  const svgW = 320, svgH = 200
  const padL = 45, padR = 15, padT = 20, padB = 35
  const chartW = svgW - padL - padR
  const chartH = svgH - padT - padB

  // Find max value across all metrics for Y-axis scaling
  const allValues = metrics.flatMap(m => blockData[m.key])
  const maxVal = Math.max(...allValues, 1)

  // Generate points for each metric
  const getPoints = (metricKey) => {
    return blockData[metricKey].map((val, i) => {
      const x = padL + (i / (timeBlocks.length - 1)) * chartW
      const y = padT + chartH - (val / maxVal) * chartH
      return { x, y, val }
    })
  }

  return (
    <div style={{
      padding: '16px',
      backgroundColor: '#fff',
      borderRadius: '10px',
      border: '1px solid #e0e0e0'
    }}>
      <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width: '100%', height: 'auto' }}>
        {/* Horizontal grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((frac, i) => {
          const y = padT + chartH - frac * chartH
          return (
            <g key={i}>
              <line x1={padL} y1={y} x2={svgW - padR} y2={y} stroke="#f0f0f0" strokeWidth="0.5" />
              <text x={padL - 6} y={y + 3} textAnchor="end" fontSize="7" fill="#999">
                {Math.round(maxVal * frac)}
              </text>
            </g>
          )
        })}

        {/* Lines for each metric */}
        {metrics.map((metric, mi) => {
          const points = getPoints(metric.key)
          const color = metric.color || colors[mi % colors.length]
          // Skip metrics with no data
          if (points.every(p => p.val === 0)) return null
          return (
            <g key={metric.key}>
              <polyline
                points={points.map(p => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke={color}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Dots at data points */}
              {points.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r="3.5" fill="#fff" stroke={color} strokeWidth="2" />
              ))}
              {/* Values at data points */}
              {points.map((p, i) => (
                p.val > 0 ? (
                  <text key={`v${i}`} x={p.x} y={p.y - 8} textAnchor="middle" fontSize="6.5" fill={color} fontWeight="600">
                    {p.val}
                  </text>
                ) : null
              ))}
            </g>
          )
        })}

        {/* X-axis labels */}
        {timeBlocks.map((block, i) => {
          const x = padL + (i / (timeBlocks.length - 1)) * chartW
          return (
            <text key={i} x={x} y={svgH - 8} textAnchor="middle" fontSize="7" fill="#999">
              {block.label}
            </text>
          )
        })}
      </svg>

      {/* Legend */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '12px',
        marginTop: '10px',
        justifyContent: 'center'
      }}>
        {metrics.map((metric, mi) => {
          const hasValues = blockData[metric.key].some(v => v > 0)
          if (!hasValues) return null
          return (
            <div key={metric.key} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '11px',
              color: '#666'
            }}>
              <span style={{
                width: '10px',
                height: '3px',
                backgroundColor: metric.color || colors[mi % colors.length],
                borderRadius: '2px',
                display: 'inline-block'
              }} />
              {metric.icon} {metric.name}
            </div>
          )
        })}
      </div>

      {/* Context info */}
      <div style={{
        marginTop: '10px',
        fontSize: '10px',
        color: '#bbb',
        textAlign: 'center'
      }}>
        Averaged across {daysWithData} day{daysWithData !== 1 ? 's' : ''} with meal data
      </div>
    </div>
  )
}

function ExportView({ todayEntry, metrics, waterGoal, onClose }) {
  const today = new Date()
  const dateLabel = today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const generatedAt = today.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      backgroundColor: '#fff',
      overflowY: 'auto',
      padding: '32px 24px'
    }}>
      {/* Print CSS — hides controls and forces white background */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
        }
      `}</style>

      {/* Controls (hidden when printing) */}
      <div className="no-print" style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginBottom: '28px' }}>
        <button
          onClick={() => window.print()}
          style={{
            padding: '10px 20px', backgroundColor: '#5f8a8f', border: 'none',
            borderRadius: '8px', color: '#fff', fontSize: '14px', fontWeight: '600', cursor: 'pointer'
          }}
        >
          Print / Save as PDF
        </button>
        <button
          onClick={onClose}
          style={{
            padding: '10px 20px', backgroundColor: '#fff', border: '1px solid #e0e0e0',
            borderRadius: '8px', color: '#666', fontSize: '14px', fontWeight: '500', cursor: 'pointer'
          }}
        >
          Close
        </button>
      </div>

      {/* Report content */}
      <div style={{ maxWidth: '680px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ borderBottom: '2px solid #5f8a8f', paddingBottom: '16px', marginBottom: '28px' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#5f8a8f', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '6px' }}>
            Lytz · Daily Health Report
          </div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: '#1a1a1a', letterSpacing: '-0.5px' }}>
            {dateLabel}
          </div>
        </div>

        {!todayEntry ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: '#999', fontSize: '15px' }}>
            No data recorded for today yet.
          </div>
        ) : (
          <>
            {/* Nutrition */}
            {metrics.length > 0 && todayEntry.nutritionMetrics && (
              <div style={{ marginBottom: '28px' }}>
                <div style={{ fontSize: '12px', fontWeight: '700', color: '#999', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '12px' }}>
                  Nutrition
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #e0e0e0' }}>
                      {['Metric', 'Value', 'Goal', 'Progress'].map(h => (
                        <th key={h} style={{ textAlign: h === 'Value' || h === 'Goal' || h === 'Progress' ? 'right' : 'left', padding: '6px 8px', fontSize: '11px', fontWeight: '600', color: '#999' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.map((metric, i) => {
                      const entry = todayEntry.nutritionMetrics?.[i] || {}
                      const val = entry.value || 0
                      const goal = metric.goal || 0
                      const pct = goal > 0 ? Math.min(Math.round((val / goal) * 100), 100) : null
                      return (
                        <tr key={metric.key} style={{ borderBottom: '1px solid #f5f5f5' }}>
                          <td style={{ padding: '8px 8px', fontSize: '14px', color: '#1a1a1a', fontWeight: '500' }}>{metric.name}</td>
                          <td style={{ padding: '8px 8px', fontSize: '14px', color: '#1a1a1a', textAlign: 'right', fontWeight: '600' }}>{val}{metric.unit || ''}</td>
                          <td style={{ padding: '8px 8px', fontSize: '14px', color: '#999', textAlign: 'right' }}>{goal > 0 ? `${goal}${metric.unit || ''}` : '—'}</td>
                          <td style={{ padding: '8px 8px', textAlign: 'right' }}>
                            {pct !== null ? (
                              <span style={{ fontSize: '12px', fontWeight: '600', color: pct >= 100 ? '#16a34a' : pct >= 70 ? '#d97706' : '#dc2626' }}>
                                {pct}%
                              </span>
                            ) : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Water */}
            <div style={{ marginBottom: '28px' }}>
              <div style={{ fontSize: '12px', fontWeight: '700', color: '#999', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '12px' }}>
                Hydration
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f5f5f5' }}>
                <span style={{ fontSize: '14px', fontWeight: '500', color: '#1a1a1a' }}>Water Intake</span>
                <span style={{ fontSize: '14px', fontWeight: '600', color: '#1a1a1a' }}>
                  {todayEntry.water || 0} oz
                  {waterGoal > 0 && <span style={{ fontWeight: '400', color: '#999' }}> / {waterGoal} oz ({Math.min(Math.round(((todayEntry.water || 0) / waterGoal) * 100), 100)}%)</span>}
                </span>
              </div>
            </div>

            {/* Habits */}
            {todayEntry.checklistItems?.length > 0 && (
              <div style={{ marginBottom: '28px' }}>
                <div style={{ fontSize: '12px', fontWeight: '700', color: '#999', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '12px' }}>
                  Daily Habits
                </div>
                {todayEntry.checklistItems.map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: '1px solid #f5f5f5' }}>
                    <span style={{ fontSize: '16px', color: item.checked ? '#16a34a' : '#dc2626' }}>
                      {item.checked ? '✓' : '✗'}
                    </span>
                    <span style={{ fontSize: '14px', color: item.checked ? '#1a1a1a' : '#999', fontWeight: '500', textDecoration: item.checked ? 'none' : 'line-through' }}>
                      {item.label || item.name || `Habit ${i + 1}`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Footer */}
        <div style={{ marginTop: '40px', paddingTop: '16px', borderTop: '1px solid #e0e0e0', fontSize: '11px', color: '#bbb', textAlign: 'center' }}>
          Generated {generatedAt} · Lytz Daily Nutrition Tracker
        </div>
      </div>
    </div>
  )
}

export default function ReportsPage() {
  const { user, isConfigured } = useAuth()
  const [history, setHistory] = useState([])
  const [metrics, setMetrics] = useState([])
  const [viewMode, setViewMode] = useState('last7') // last7, weekly, monthly
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [loading, setLoading] = useState(true)
  const [editingDay, setEditingDay] = useState(null)
  const [editValues, setEditValues] = useState({})
  const [waterGoal, setWaterGoal] = useState(0)
  const [showExport, setShowExport] = useState(false)

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
        if (cloudSettings?.waterGoal) {
          setWaterGoal(cloudSettings.waterGoal)
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
            // Check if goal was met (goal-type aware)
            const metricConfig = metrics.find(m => m.key === metric.key)
            if (metricConfig?.goal) {
              const gt = metricConfig.goalType || 'min'
              const v = metric.value || 0
              const met = gt === 'max' ? v <= metricConfig.goal
                : gt === 'range' ? v >= metricConfig.goal && v <= (metricConfig.goalMax || metricConfig.goal)
                : v >= metricConfig.goal
              if (met) goalAchievement[metric.key]++
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
    const targetKey = toLocalDateStr(targetDate) // YYYY-MM-DD local time

    // Check if this day exists in history
    const existingDay = history.find(day => {
      const dayKey = toLocalDateStr(parseLocalDate(day.date))
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

  // Calculate streaks (consecutive days from today)
  const calculateStreaks = () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const getDateKey = (date) => {
      const d = new Date(date)
      d.setHours(0, 0, 0, 0)
      return toLocalDateStr(d)
    }

    // Build a map of date -> day data
    const dateMap = {}
    history.forEach(day => {
      const key = toLocalDateStr(parseLocalDate(day.date))
      dateMap[key] = day
    })

    // Count consecutive days. If today doesn't qualify, start from yesterday
    const countStreak = (checkFn) => {
      const todayKey = getDateKey(today)
      const todayQualifies = dateMap[todayKey] && checkFn(dateMap[todayKey])
      const startDay = todayQualifies ? 0 : 1
      let streak = 0

      for (let i = startDay; i < 365; i++) {
        const checkDate = new Date(today)
        checkDate.setDate(today.getDate() - i)
        const key = getDateKey(checkDate)
        const day = dateMap[key]
        if (day && checkFn(day)) streak++
        else break
      }
      return streak
    }

    // Tracking streak: any data logged
    const trackingStreak = countStreak(() => true)

    return { trackingStreak }
  }

  const streaks = calculateStreaks()

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
      {showExport && (
        <ExportView
          todayEntry={history.find(d => d.date === toLocalDateStr()) || null}
          metrics={metrics}
          waterGoal={waterGoal}
          onClose={() => setShowExport(false)}
        />
      )}
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
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={() => setShowExport(true)}
              style={{
                padding: '8px 14px',
                backgroundColor: '#f0f7f8',
                border: '1px solid #5f8a8f',
                borderRadius: '8px',
                color: '#5f8a8f',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
              }}
            >
              Export Today
            </button>
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
              backgroundColor: viewMode === 'last7' ? '#5f8a8f' : '#fff',
              border: '1px solid',
              borderColor: viewMode === 'last7' ? '#5f8a8f' : '#e0e0e0',
              borderRadius: '8px',
              color: viewMode === 'last7' ? '#fff' : '#666',
              fontSize: '12px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            Daily
          </button>
          <button
            onClick={() => setViewMode('weekly')}
            style={{
              padding: '10px 12px',
              backgroundColor: viewMode === 'weekly' ? '#5f8a8f' : '#fff',
              border: '1px solid',
              borderColor: viewMode === 'weekly' ? '#5f8a8f' : '#e0e0e0',
              borderRadius: '8px',
              color: viewMode === 'weekly' ? '#fff' : '#666',
              fontSize: '12px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            Time of Day
          </button>
          <button
            onClick={() => setViewMode('monthly')}
            style={{
              padding: '10px 12px',
              backgroundColor: viewMode === 'monthly' ? '#5f8a8f' : '#fff',
              border: '1px solid',
              borderColor: viewMode === 'monthly' ? '#5f8a8f' : '#e0e0e0',
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
                    fontSize: '16px',
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
                      fontSize: '16px',
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
                    backgroundColor: '#5f8a8f',
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
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Streaks */}
        <div style={{ marginBottom: '20px' }}>
          <h2 style={{
            margin: '0 0 12px 0',
            fontSize: '12px',
            fontWeight: '600',
            color: '#999',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            Streaks
          </h2>

          {/* Main tracking streak */}
          <div style={{
            padding: '20px 16px',
            backgroundColor: '#fff',
            borderRadius: '10px',
            border: '1px solid #e0e0e0',
            textAlign: 'center'
          }}>
            <div style={{
              fontSize: '36px',
              fontWeight: '700',
              color: streaks.trackingStreak > 0 ? '#f59e0b' : '#ccc',
              lineHeight: '1'
            }}>
              {streaks.trackingStreak > 0 && '🔥 '}{streaks.trackingStreak}
            </div>
            <div style={{ fontSize: '12px', color: '#666', marginTop: '6px' }}>
              day{streaks.trackingStreak !== 1 ? 's' : ''} tracking streak
            </div>
          </div>
        </div>

        {/* Time of Day chart - only for weekly view */}
        {viewMode === 'weekly' && metrics.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <h2 style={{
              margin: '0 0 12px 0',
              fontSize: '12px',
              fontWeight: '600',
              color: '#999',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Meal Timing Patterns
            </h2>
            <TimeOfDayChart filteredHistory={filteredHistory} metrics={metrics} />
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
                      const gt = metric.goalType || 'min'
                      const metGoal = metric.goal && (
                        gt === 'max' ? value <= metric.goal
                        : gt === 'range' ? value >= metric.goal && value <= (metric.goalMax || metric.goal)
                        : value >= metric.goal
                      )
                      const overLimit = metric.goal && gt === 'max' && value > metric.goal
                      return (
                        <div key={metric.key} style={{
                          padding: '4px 8px',
                          backgroundColor: overLimit ? '#fef2f2' : metGoal ? '#f0fdf4' : '#f5f5f5',
                          borderRadius: '4px',
                          fontSize: '12px',
                          color: overLimit ? '#991b1b' : metGoal ? '#166534' : '#666',
                          fontWeight: (metGoal || overLimit) ? '600' : '400'
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

                return (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
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
