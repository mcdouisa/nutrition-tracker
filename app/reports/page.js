'use client'

import { useState, useEffect, createContext, useContext } from 'react'
import Link from 'next/link'
import { useAuth } from '../../lib/AuthContext'
import { loadHistory, loadUserSettings, saveHistoryEntry, toLocalDateStr } from '../../lib/dataSync'

const DARK  = { bg: '#0D0D0D', card: '#1A1A1A', card2: '#242424', border: '#2C2C2C', text: '#FFFFFF', muted: '#888888' }
const LIGHT = { bg: '#F5F5F5', card: '#FFFFFF',  card2: '#EBEBEB', border: '#E0E0E0', text: '#1A1A1A', muted: '#666666' }
const ThemeContext = createContext(DARK)

// ── Time-of-day line chart ────────────────────────────────────────────────────
function TimeOfDayChart({ filteredHistory, metrics }) {
  const T = useContext(ThemeContext)
  const timeBlocks = [
    { label: '5-8am', start: 5, end: 8 },
    { label: '8-11am', start: 8, end: 11 },
    { label: '11am-2pm', start: 11, end: 14 },
    { label: '2-5pm', start: 14, end: 17 },
    { label: '5-8pm', start: 17, end: 20 },
    { label: '8-11pm', start: 20, end: 23 },
  ]

  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

  const blockData = {}
  let daysWithData = 0

  metrics.forEach(m => { blockData[m.key] = new Array(timeBlocks.length).fill(0) })

  filteredHistory.forEach(day => {
    if (!day.nutritionHistory || !Array.isArray(day.nutritionHistory)) return
    daysWithData++
    day.nutritionHistory.forEach(entry => {
      if (!entry.timestamp) return
      const hour = new Date(entry.timestamp).getHours()
      let blockIndex = timeBlocks.findIndex(b => hour >= b.start && hour < b.end)
      if (blockIndex === -1) blockIndex = hour < 5 ? 0 : 5

      if (entry.estimates) {
        metrics.forEach(m => {
          if (entry.estimates[m.key]) blockData[m.key][blockIndex] += entry.estimates[m.key]
        })
      } else if (entry.metricIndex !== undefined && entry.value !== undefined) {
        const metricDef = day.nutritionMetrics?.[entry.metricIndex]
        if (metricDef && blockData[metricDef.key] !== undefined) {
          blockData[metricDef.key][blockIndex] += entry.value
        }
      }
    })
  })

  if (daysWithData > 0) {
    metrics.forEach(m => {
      blockData[m.key] = blockData[m.key].map(v => Math.round(v / daysWithData))
    })
  }

  const hasData = Object.values(blockData).some(arr => arr.some(v => v > 0))

  if (!hasData) {
    return (
      <div style={{ padding: '32px 16px', textAlign: 'center', color: '#666666' }}>
        <div style={{ fontSize: '28px', marginBottom: '8px', opacity: 0.3 }}>📈</div>
        <div style={{ fontSize: '13px', color: T.muted }}>
          No meal timing data yet — log meals with the AI to see patterns
        </div>
      </div>
    )
  }

  const svgW = 320, svgH = 200
  const padL = 45, padR = 15, padT = 20, padB = 35
  const chartW = svgW - padL - padR
  const chartH = svgH - padT - padB

  const allValues = metrics.flatMap(m => blockData[m.key])
  const maxVal = Math.max(...allValues, 1)

  const getPoints = (metricKey) =>
    blockData[metricKey].map((val, i) => ({
      x: padL + (i / (timeBlocks.length - 1)) * chartW,
      y: padT + chartH - (val / maxVal) * chartH,
      val
    }))

  // Find peak block for insight
  const primaryKey = metrics[0]?.key
  const peakIdx = primaryKey
    ? blockData[primaryKey].indexOf(Math.max(...blockData[primaryKey]))
    : -1
  const peakLabel = peakIdx >= 0 ? timeBlocks[peakIdx]?.label : null

  return (
    <div>
      {peakLabel && (
        <div style={{
          fontSize: '12px', color: '#0A84FF', fontWeight: '600',
          marginBottom: '8px', textAlign: 'center'
        }}>
          Peak eating time: {peakLabel}
        </div>
      )}
      <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width: '100%', height: 'auto' }}>
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
        {metrics.map((metric, mi) => {
          const points = getPoints(metric.key)
          const color = metric.color || colors[mi % colors.length]
          if (points.every(p => p.val === 0)) return null
          return (
            <g key={metric.key}>
              <polyline
                points={points.map(p => `${p.x},${p.y}`).join(' ')}
                fill="none" stroke={color} strokeWidth="2.5"
                strokeLinecap="round" strokeLinejoin="round"
              />
              {points.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r="3.5" fill="#fff" stroke={color} strokeWidth="2" />
              ))}
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
        {timeBlocks.map((block, i) => {
          const x = padL + (i / (timeBlocks.length - 1)) * chartW
          return (
            <text key={i} x={x} y={svgH - 8} textAnchor="middle" fontSize="7" fill="#999">
              {block.label}
            </text>
          )
        })}
      </svg>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '8px', justifyContent: 'center' }}>
        {metrics.map((metric, mi) => {
          const hasValues = blockData[metric.key].some(v => v > 0)
          if (!hasValues) return null
          return (
            <div key={metric.key} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: T.muted }}>
              <span style={{
                width: '10px', height: '3px',
                backgroundColor: metric.color || colors[mi % colors.length],
                borderRadius: '2px', display: 'inline-block'
              }} />
              {metric.icon} {metric.name}
            </div>
          )
        })}
      </div>
      <div style={{ marginTop: '8px', fontSize: '10px', color: '#bbb', textAlign: 'center' }}>
        Averaged across {daysWithData} day{daysWithData !== 1 ? 's' : ''} with meal data
      </div>
    </div>
    </ThemeContext.Provider>
  )
}

// ── Bar chart ─────────────────────────────────────────────────────────────────
function BarChart({ bars, goal, scrollable = false }) {
  const T = useContext(ThemeContext)
  if (!bars || bars.length === 0) return null
  const maxVal = Math.max(...bars.map(b => b.value), goal || 1, 1)
  const barW = scrollable ? 18 : Math.max(12, Math.floor(260 / bars.length))
  const gap = scrollable ? 5 : 3
  const padL = 35, padB = 28, padT = 16, padR = 8
  const svgW = padL + bars.length * (barW + gap) + padR
  const svgH = 160
  const chartH = svgH - padT - padB
  const goalY = goal ? padT + chartH - (goal / maxVal) * chartH : null

  return (
    <div style={{ overflowX: scrollable ? 'auto' : 'visible', WebkitOverflowScrolling: 'touch' }}>
      <svg
        viewBox={`0 0 ${svgW} ${svgH}`}
        style={{ width: scrollable ? `${Math.max(svgW, 320)}px` : '100%', height: 'auto', display: 'block' }}
      >
        {/* Grid lines */}
        {[0, 0.5, 1].map((frac, i) => {
          const y = padT + chartH - frac * chartH
          return (
            <g key={i}>
              <line x1={padL} y1={y} x2={svgW - padR} y2={y} stroke="#f0f0f0" strokeWidth="0.5" />
              <text x={padL - 4} y={y + 3} textAnchor="end" fontSize="7" fill="#bbb">
                {Math.round(maxVal * frac) > 999
                  ? `${(Math.round(maxVal * frac) / 1000).toFixed(1)}k`
                  : Math.round(maxVal * frac)}
              </text>
            </g>
          )
        })}
        {/* Goal line */}
        {goalY !== null && (
          <line x1={padL} y1={goalY} x2={svgW - padR} y2={goalY}
            stroke="#ef4444" strokeWidth="1" strokeDasharray="3,2" />
        )}
        {/* Bars */}
        {bars.map((bar, i) => {
          const x = padL + i * (barW + gap)
          const barH = bar.value > 0 ? Math.max((bar.value / maxVal) * chartH, 2) : 0
          const y = padT + chartH - barH
          const metGoal = goal && bar.value > 0 ? bar.value >= goal : false
          const barColor = bar.value === 0 ? '#e5e7eb' : metGoal ? '#16a34a' : '#0A84FF'
          return (
            <g key={i}>
              <rect x={x} y={bar.value === 0 ? padT + chartH - 2 : y} width={barW} height={bar.value === 0 ? 2 : barH} fill={barColor} rx="2" />
              <text x={x + barW / 2} y={svgH - 6} textAnchor="middle" fontSize="7" fill="#999">{bar.label}</text>
            </g>
          )
        })}
      </svg>
      {/* Legend */}
      <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', fontSize: '10px', color: '#9ca3af', marginTop: '4px' }}>
        <span><span style={{ color: '#16a34a' }}>■</span> Met goal</span>
        <span><span style={{ color: '#0A84FF' }}>■</span> Logged</span>
        {goal && <span style={{ color: '#ef4444' }}>— Goal</span>}
      </div>
    </div>
  )
}

// ── Export view ───────────────────────────────────────────────────────────────
function ExportView({ todayEntry, metrics, waterGoal, onClose }) {
  const T = useContext(ThemeContext)
  const today = new Date()
  const dateLabel = today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const generatedAt = today.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, backgroundColor: T.card, overflowY: 'auto', padding: '32px 24px' }}>
      <style>{`@media print { .no-print { display: none !important; } body { background: white !important; } }`}</style>
      <div className="no-print" style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginBottom: '28px' }}>
        <button onClick={() => window.print()} style={{ padding: '10px 20px', backgroundColor: '#0A84FF', border: 'none', borderRadius: '8px', color: '#1A1A1A', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>
          Print / Save as PDF
        </button>
        <button onClick={onClose} style={{ padding: '10px 20px', backgroundColor: T.card, border: `1px solid ${T.border}`, borderRadius: '8px', color: T.muted, fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}>
          Close
        </button>
      </div>
      <div style={{ maxWidth: '680px', margin: '0 auto' }}>
        <div style={{ borderBottom: '2px solid #0A84FF', paddingBottom: '16px', marginBottom: '28px' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#0A84FF', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '6px' }}>
            Lytz · Daily Health Report
          </div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: T.text, letterSpacing: '-0.5px' }}>{dateLabel}</div>
        </div>
        {!todayEntry ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: '#666666', fontSize: '15px' }}>No data recorded for today yet.</div>
        ) : (
          <>
            {metrics.length > 0 && todayEntry.nutritionMetrics && (
              <div style={{ marginBottom: '28px' }}>
                <div style={{ fontSize: '12px', fontWeight: '700', color: '#666666', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '12px' }}>Nutrition</div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                      {['Metric', 'Value', 'Goal', 'Progress'].map(h => (
                        <th key={h} style={{ textAlign: h === 'Metric' ? 'left' : 'right', padding: '6px 8px', fontSize: '11px', fontWeight: '600', color: '#666666' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.map((metric) => {
                      const entry = todayEntry.nutritionMetrics?.find(m => m.key === metric.key) || {}
                      const val = entry.value || 0
                      const goal = metric.goal || 0
                      const goalType = metric.goalType || 'min'
                      let pct = null, goalDisplay = '—'
                      if (goal > 0) {
                        if (goalType === 'min') { pct = Math.min(Math.round((val / goal) * 100), 100); goalDisplay = `${goal}${metric.unit || ''}+` }
                        else if (goalType === 'max') { pct = val > goal ? 100 : Math.round((val / goal) * 100); goalDisplay = `<${goal}${metric.unit || ''}` }
                        else if (goalType === 'range' && metric.goalMax) {
                          pct = val >= goal && val <= metric.goalMax ? 100 : val < goal ? Math.round((val / goal) * 100) : Math.round((metric.goalMax / val) * 100)
                          goalDisplay = `${goal}-${metric.goalMax}${metric.unit || ''}`
                        }
                      }
                      return (
                        <tr key={metric.key} style={{ borderBottom: '1px solid #f5f5f5' }}>
                          <td style={{ padding: '8px', fontSize: '14px', color: T.text, fontWeight: '500' }}>{metric.name}</td>
                          <td style={{ padding: '8px', fontSize: '14px', color: T.text, textAlign: 'right', fontWeight: '600' }}>{val}{metric.unit || ''}</td>
                          <td style={{ padding: '8px', fontSize: '14px', color: '#666666', textAlign: 'right' }}>{goalDisplay}</td>
                          <td style={{ padding: '8px', textAlign: 'right' }}>
                            {pct !== null ? <span style={{ fontSize: '12px', fontWeight: '600', color: pct >= 100 ? '#16a34a' : pct >= 70 ? '#d97706' : '#dc2626' }}>{pct}%</span> : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div style={{ marginBottom: '28px' }}>
              <div style={{ fontSize: '12px', fontWeight: '700', color: '#666666', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '12px' }}>Hydration</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f5f5f5' }}>
                <span style={{ fontSize: '14px', fontWeight: '500', color: T.text }}>Water Intake</span>
                <span style={{ fontSize: '14px', fontWeight: '600', color: T.text }}>
                  {todayEntry.water || 0} oz
                  {waterGoal > 0 && <span style={{ fontWeight: '400', color: '#666666' }}> / {waterGoal} oz ({Math.min(Math.round(((todayEntry.water || 0) / waterGoal) * 100), 100)}%)</span>}
                </span>
              </div>
            </div>
            {todayEntry.checklistItems?.length > 0 && (
              <div style={{ marginBottom: '28px' }}>
                <div style={{ fontSize: '12px', fontWeight: '700', color: '#666666', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '12px' }}>Daily Habits</div>
                {todayEntry.checklistItems.map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: '1px solid #f5f5f5' }}>
                    <span style={{ fontSize: '16px', color: item.checked ? '#16a34a' : '#dc2626' }}>{item.checked ? '✓' : '✗'}</span>
                    <span style={{ fontSize: '14px', color: item.checked ? '#FFFFFF' : '#666666', fontWeight: '500', textDecoration: item.checked ? 'none' : 'line-through' }}>
                      {item.label || item.name || `Habit ${i + 1}`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        <div style={{ marginTop: '40px', paddingTop: '16px', borderTop: '1px solid #2C2C2C', fontSize: '11px', color: '#bbb', textAlign: 'center' }}>
          Generated {generatedAt} · Lytz Daily Nutrition Tracker
        </div>
      </div>
    </div>
  )
}

// ── Weekly strip (7-day color dots) ──────────────────────────────────────────
function WeeklyStrip({ history, metrics }) {
  const T = useContext(ThemeContext)
  const calMetric = metrics.find(m => m.key === 'calories') || metrics[0]
  if (!calMetric || !calMetric.goal) return null

  const days = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    d.setHours(0, 0, 0, 0)
    const dateStr = toLocalDateStr(d)

    const dayData = history.find(h => {
      if (!h.date) return false
      const hStr = /^\d{4}-\d{2}-\d{2}$/.test(h.date) ? h.date : toLocalDateStr(new Date(h.date))
      return hStr === dateStr
    })

    const metricEntry = dayData?.nutritionMetrics?.find(m => m.key === calMetric.key)
    const value = metricEntry?.value || 0
    const goal = calMetric.goal || 0
    const pct = goal > 0 ? value / goal : 0
    const hasData = value > 0

    let dotColor = '#e5e7eb'
    if (hasData) dotColor = pct >= 0.8 ? '#16a34a' : pct >= 0.5 ? '#d97706' : '#dc2626'

    days.push({ d, value, goal, dotColor, hasData, isToday: i === 0 })
  }

  return (
    <div style={{ backgroundColor: T.card, borderRadius: '12px', border: `1px solid ${T.border}`, padding: '16px', marginBottom: '16px' }}>
      <div style={{ fontSize: '11px', fontWeight: '600', color: '#666666', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '14px' }}>
        This Week — {calMetric.name}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        {days.map(({ d, value, goal, dotColor, hasData, isToday }) => (
          <div key={d.toISOString()} style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: '11px', color: isToday ? '#0A84FF' : '#666666', fontWeight: isToday ? '700' : '400', marginBottom: '6px' }}>
              {d.toLocaleDateString('en-US', { weekday: 'short' }).charAt(0)}
            </div>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: dotColor, margin: '0 auto 6px', border: isToday ? '2px solid #0A84FF' : '2px solid transparent', boxSizing: 'border-box' }} />
            <div style={{ fontSize: '10px', color: hasData ? '#FFFFFF' : '#d1d5db', fontWeight: '500', lineHeight: '1.3' }}>
              {hasData ? value.toLocaleString() : '—'}
            </div>
            {hasData && goal > 0 && <div style={{ fontSize: '9px', color: '#9ca3af' }}>/{goal.toLocaleString()}</div>}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', marginTop: '14px', fontSize: '11px', color: '#9ca3af' }}>
        <span><span style={{ color: '#16a34a' }}>●</span> On track</span>
        <span><span style={{ color: '#d97706' }}>●</span> Partial</span>
        <span><span style={{ color: '#dc2626' }}>●</span> Low</span>
      </div>
    </div>
  )
}

// ── Shared section header ─────────────────────────────────────────────────────
function SectionLabel({ children }) {
  const T = useContext(ThemeContext)
  return (
    <div style={{ fontSize: '11px', fontWeight: '600', color: '#666666', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>
      {children}
    </div>
  )
}

function Card({ children, style }) {
  const T = useContext(ThemeContext)
  return (
    <div style={{ backgroundColor: T.card, borderRadius: '12px', border: `1px solid ${T.border}`, padding: '16px', marginBottom: '16px', ...style }}>
      {children}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ReportsPage() {
  const { user, isConfigured } = useAuth()
  const [darkMode, setDarkMode] = useState(true)
  useEffect(() => {
    const saved = localStorage.getItem('lytz-darkMode')
    if (saved !== null) setDarkMode(saved === 'true')
  }, [])
  const T = darkMode ? DARK : LIGHT
  const [history, setHistory] = useState([])
  const [metrics, setMetrics] = useState([])
  const [viewMode, setViewMode] = useState('daily') // 'daily' | 'weekly' | 'monthly'
  const [monthlyGranularity, setMonthlyGranularity] = useState('daily') // 'daily' | 'weekly'
  const [chartMetricKey, setChartMetricKey] = useState(null) // which metric to show in bar charts
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [loading, setLoading] = useState(true)
  const [editingDay, setEditingDay] = useState(null)
  const [editValues, setEditValues] = useState({})
  const [waterGoal, setWaterGoal] = useState(0)
  const [showExport, setShowExport] = useState(false)

  useEffect(() => {
    const loadData = async () => {
      if (user && isConfigured) {
        const cloudHistory = await loadHistory(user.uid)
        if (cloudHistory?.length > 0) setHistory(cloudHistory)
        const cloudSettings = await loadUserSettings(user.uid)
        if (cloudSettings?.nutritionMetrics) {
          setMetrics(cloudSettings.nutritionMetrics)
          setChartMetricKey(cloudSettings.nutritionMetrics[0]?.key || null)
        }
        if (cloudSettings?.waterGoal) setWaterGoal(cloudSettings.waterGoal)
      } else {
        const storedHistory = localStorage.getItem('nutrition-history')
        if (storedHistory) setHistory(JSON.parse(storedHistory))
        const storedMetrics = localStorage.getItem('nutrition-metrics')
        if (storedMetrics) {
          const m = JSON.parse(storedMetrics)
          setMetrics(m)
          setChartMetricKey(m[0]?.key || null)
        }
      }
      setLoading(false)
    }
    loadData()
  }, [user, isConfigured])

  const parseLocalDate = (dateStr) => {
    if (!dateStr) return new Date(0)
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return new Date(dateStr + 'T00:00:00')
    return new Date(dateStr)
  }

  const normDate = (dateStr) => {
    if (!dateStr) return ''
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr
    return toLocalDateStr(new Date(dateStr))
  }

  const getDateRange = () => {
    const end = new Date()
    const start = new Date()
    if (viewMode === 'daily') {
      start.setDate(end.getDate() - 6)
    } else if (viewMode === 'weekly') {
      const day = selectedDate.getDay()
      start.setTime(selectedDate.getTime())
      start.setDate(start.getDate() - day)
      end.setTime(start.getTime())
      end.setDate(start.getDate() + 6)
    } else {
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

  const getFilteredHistory = () => {
    const { start, end } = getDateRange()
    return history.filter(entry => {
      const d = parseLocalDate(entry.date)
      return d >= start && d <= end
    }).sort((a, b) => parseLocalDate(b.date) - parseLocalDate(a.date))
  }

  const calculateStats = () => {
    const filtered = getFilteredHistory()
    if (filtered.length === 0 || metrics.length === 0) return { totals: {}, averages: {}, days: 0, goalAchievement: {} }
    const totals = {}, goalAchievement = {}
    metrics.forEach(m => { totals[m.key] = 0; goalAchievement[m.key] = 0 })
    filtered.forEach(day => {
      day.nutritionMetrics?.forEach(metric => {
        if (totals[metric.key] !== undefined) {
          totals[metric.key] += metric.value || 0
          const mc = metrics.find(m => m.key === metric.key)
          if (mc?.goal) {
            const gt = mc.goalType || 'min', v = metric.value || 0
            const met = gt === 'max' ? v <= mc.goal : gt === 'range' ? v >= mc.goal && v <= (mc.goalMax || mc.goal) : v >= mc.goal
            if (met) goalAchievement[metric.key]++
          }
        }
      })
    })
    const averages = {}
    metrics.forEach(m => { averages[m.key] = filtered.length > 0 ? Math.round(totals[m.key] / filtered.length) : 0 })
    return { totals, averages, days: filtered.length, goalAchievement }
  }

  const navigate = (dir) => {
    const d = new Date(selectedDate)
    if (viewMode === 'weekly') d.setDate(d.getDate() + dir * 7)
    else d.setMonth(d.getMonth() + dir)
    setSelectedDate(d)
  }

  const formatDateRange = () => {
    const { start, end } = getDateRange()
    const opts = { month: 'short', day: 'numeric' }
    if (viewMode === 'daily') return 'Last 7 Days'
    if (viewMode === 'weekly') return `${start.toLocaleDateString('en-US', opts)} – ${end.toLocaleDateString('en-US', opts)}`
    return start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }

  const startEditing = (day) => {
    const values = { water: day.water || 0 }
    metrics.forEach(m => {
      const dm = day.nutritionMetrics?.find(x => x.key === m.key)
      values[m.key] = dm?.value || 0
    })
    setEditValues(values)
    setEditingDay(day)
  }

  const saveEditedDay = async () => {
    if (!editingDay) return
    const updatedMetrics = metrics.map(m => ({ ...m, value: parseInt(editValues[m.key]) || 0 }))
    const updatedDay = { ...editingDay, water: parseInt(editValues.water) || 0, nutritionMetrics: updatedMetrics }
    const updatedHistory = history.map(d => d.date === editingDay.date ? updatedDay : d)
    if (!history.find(d => d.date === editingDay.date)) updatedHistory.push(updatedDay)
    setHistory(updatedHistory)
    if (user && isConfigured) await saveHistoryEntry(user.uid, editingDay.date, updatedDay)
    else localStorage.setItem('nutrition-history', JSON.stringify(updatedHistory))
    setEditingDay(null)
    setEditValues({})
  }

  const addToPreviousDay = (daysAgo) => {
    const targetDate = new Date()
    targetDate.setDate(targetDate.getDate() - daysAgo)
    const targetKey = toLocalDateStr(targetDate)
    const existingDay = history.find(d => normDate(d.date) === targetKey)
    if (existingDay) {
      startEditing(existingDay)
    } else {
      startEditing({ date: targetKey, water: 0, nutritionMetrics: metrics.map(m => ({ ...m, value: 0 })), checklistItems: [] })
    }
  }

  const calculateStreaks = () => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const dateMap = {}
    history.forEach(d => { dateMap[normDate(d.date)] = d })
    const countStreak = (checkFn) => {
      const todayKey = toLocalDateStr(today)
      const todayQualifies = dateMap[todayKey] && checkFn(dateMap[todayKey])
      let streak = 0
      for (let i = todayQualifies ? 0 : 1; i < 365; i++) {
        const d = new Date(today); d.setDate(today.getDate() - i)
        const key = toLocalDateStr(d)
        if (dateMap[key] && checkFn(dateMap[key])) streak++; else break
      }
      return streak
    }
    return { trackingStreak: countStreak(() => true) }
  }

  // ── Bar chart data builders ──────────────────────────────────────────────────
  const getWeeklyBars = () => {
    const { start } = getDateRange()
    const mKey = chartMetricKey
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start); d.setDate(d.getDate() + i)
      const dateStr = toLocalDateStr(d)
      const dayData = history.find(h => normDate(h.date) === dateStr)
      const entry = dayData?.nutritionMetrics?.find(m => m.key === mKey)
      return { label: d.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 2), value: entry?.value || 0 }
    })
  }

  const getMonthlyDailyBars = () => {
    const { start, end } = getDateRange()
    const mKey = chartMetricKey
    const bars = []
    const d = new Date(start)
    while (d <= end) {
      const dateStr = toLocalDateStr(d)
      const dayData = history.find(h => normDate(h.date) === dateStr)
      const entry = dayData?.nutritionMetrics?.find(m => m.key === mKey)
      bars.push({ label: d.getDate().toString(), value: entry?.value || 0 })
      d.setDate(d.getDate() + 1)
    }
    return bars
  }

  const getMonthlyWeeklyBars = () => {
    const { start, end } = getDateRange()
    const mKey = chartMetricKey
    const weeks = []
    const cursor = new Date(start)
    let weekNum = 1
    while (cursor <= end) {
      const wEnd = new Date(cursor); wEnd.setDate(wEnd.getDate() + 6)
      if (wEnd > end) wEnd.setTime(end.getTime())
      let total = 0, daysLogged = 0
      const wd = new Date(cursor)
      while (wd <= wEnd) {
        const dateStr = toLocalDateStr(wd)
        const dayData = history.find(h => normDate(h.date) === dateStr)
        const entry = dayData?.nutritionMetrics?.find(m => m.key === mKey)
        if (entry?.value) { total += entry.value; daysLogged++ }
        wd.setDate(wd.getDate() + 1)
      }
      weeks.push({ label: `Wk${weekNum}`, value: daysLogged > 0 ? Math.round(total / daysLogged) : 0 })
      weekNum++
      cursor.setDate(cursor.getDate() + 7)
    }
    return weeks
  }

  // ── Insights ──────────────────────────────────────────────────────────────────
  const getWeeklyInsight = () => {
    const bars = getWeeklyBars()
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const { start } = getDateRange()
    const withData = bars.map((b, i) => ({ ...b, fullDay: dayNames[(start.getDay() + i) % 7] })).filter(b => b.value > 0)
    if (withData.length === 0) return null
    const best = withData.reduce((a, b) => a.value >= b.value ? a : b)
    return `Your best day this week was ${best.fullDay} (${best.value.toLocaleString()})`
  }

  const getMonthlyInsight = () => {
    const filtered = getFilteredHistory()
    if (filtered.length === 0) return null
    const totalDays = (() => { const { start, end } = getDateRange(); return Math.round((end - start) / 86400000) + 1 })()
    const consistency = Math.round((filtered.length / totalDays) * 100)
    const calMetric = metrics.find(m => m.key === 'calories') || metrics[0]
    if (!calMetric) return `Logged ${filtered.length} of ${totalDays} days (${consistency}% consistency)`
    const daysHitGoal = calMetric.goal
      ? filtered.filter(d => {
          const e = d.nutritionMetrics?.find(m => m.key === calMetric.key)
          return e && e.value >= calMetric.goal
        }).length
      : 0
    const parts = [`${consistency}% consistency`]
    if (calMetric.goal) parts.push(`hit ${calMetric.name} goal ${daysHitGoal}/${filtered.length} days`)
    return parts.join(' · ')
  }

  // ────────────────────────────────────────────────────────────────────────────
  const stats = calculateStats()
  const filteredHistory = getFilteredHistory()
  const streaks = calculateStreaks()
  const activeMetric = metrics.find(m => m.key === chartMetricKey)

  if (loading) {
    return (
      <ThemeContext.Provider value={T}>
        <div style={{ minHeight: '100vh', backgroundColor: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ color: T.muted }}>Loading...</div>
        </div>
      </ThemeContext.Provider>
    )
  }

  return (
    <ThemeContext.Provider value={T}>
    <div style={{ minHeight: '100vh', backgroundColor: T.bg, padding: '16px 12px', paddingBottom: '40px' }}>
      {showExport && (
        <ExportView
          todayEntry={history.find(d => d.date === toLocalDateStr()) || null}
          metrics={metrics} waterGoal={waterGoal}
          onClose={() => setShowExport(false)}
        />
      )}

      {/* Edit Modal */}
      {editingDay && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ backgroundColor: T.card, borderRadius: '16px', padding: '24px', maxWidth: '400px', width: '100%', maxHeight: '80vh', overflow: 'auto' }}>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: '600', color: T.text }}>Edit Entry</h3>
            <div style={{ fontSize: '13px', color: T.muted, marginBottom: '20px' }}>
              {parseLocalDate(editingDay.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: T.muted, marginBottom: '6px' }}>💧 Water (oz)</label>
              <input type="number" value={editValues.water || ''} onChange={e => setEditValues({ ...editValues, water: e.target.value })}
                style={{ width: '100%', padding: '12px', backgroundColor: T.bg, border: `1px solid ${T.border}`, borderRadius: '8px', fontSize: '16px', boxSizing: 'border-box' }} />
            </div>
            {metrics.map(metric => (
              <div key={metric.key} style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: T.muted, marginBottom: '6px' }}>
                  {metric.icon} {metric.name} ({metric.unit})
                </label>
                <input type="number" value={editValues[metric.key] || ''} onChange={e => setEditValues({ ...editValues, [metric.key]: e.target.value })}
                  style={{ width: '100%', padding: '12px', backgroundColor: T.bg, border: `1px solid ${T.border}`, borderRadius: '8px', fontSize: '16px', boxSizing: 'border-box' }} />
              </div>
            ))}
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button onClick={() => { setEditingDay(null); setEditValues({}) }}
                style={{ flex: 1, padding: '12px', backgroundColor: T.card2, border: 'none', borderRadius: '8px', color: T.muted, fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={saveEditedDay}
                style={{ flex: 1, padding: '12px', backgroundColor: '#0A84FF', border: 'none', borderRadius: '8px', color: '#1A1A1A', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ maxWidth: '900px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ margin: '0 0 4px 0', fontSize: '22px', fontWeight: '600', color: T.text, letterSpacing: '-0.5px' }}>Reports</h1>
            <div style={{ color: T.muted, fontSize: '13px' }}>Track your progress</div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button onClick={() => setShowExport(true)}
              style={{ padding: '8px 14px', backgroundColor: '#f0f7f8', border: '1px solid #0A84FF', borderRadius: '8px', color: '#0A84FF', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
              Export Today
            </button>
            <Link href="/" style={{ padding: '8px 14px', backgroundColor: T.card, border: `1px solid ${T.border}`, borderRadius: '8px', color: T.text, fontSize: '13px', fontWeight: '500', textDecoration: 'none' }}>
              ← Back
            </Link>
          </div>
        </div>

        {/* Tab selector */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginBottom: '20px' }}>
          {[['daily', 'Daily'], ['weekly', 'Weekly'], ['monthly', 'Monthly']].map(([mode, label]) => (
            <button key={mode} onClick={() => setViewMode(mode)}
              style={{
                padding: '11px 12px', backgroundColor: viewMode === mode ? '#0A84FF' : '#1A1A1A',
                border: '1px solid', borderColor: viewMode === mode ? '#0A84FF' : '#2C2C2C',
                borderRadius: '8px', color: viewMode === mode ? '#fff' : '#888888',
                fontSize: '13px', fontWeight: viewMode === mode ? '600' : '500', cursor: 'pointer'
              }}>
              {label}
            </button>
          ))}
        </div>

        {/* ── DAILY TAB ─────────────────────────────────────────────────────── */}
        {viewMode === 'daily' && (
          <>
            {/* 7-day strip */}
            <WeeklyStrip history={history} metrics={metrics} />

            {/* Goal hit rate */}
            {metrics.some(m => m.goal) && stats.days > 0 && (
              <Card>
                <SectionLabel>Goal Achievement — Last 7 Days</SectionLabel>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {metrics.filter(m => m.goal).map(m => {
                    const hits = stats.goalAchievement[m.key] || 0
                    const pct = Math.round((hits / stats.days) * 100)
                    return (
                      <div key={m.key}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ fontSize: '13px', color: T.text }}>{m.icon} {m.name}</span>
                          <span style={{ fontSize: '13px', fontWeight: '600', color: pct >= 70 ? '#16a34a' : pct >= 40 ? '#d97706' : '#dc2626' }}>
                            {hits}/{stats.days} days
                          </span>
                        </div>
                        <div style={{ height: '6px', backgroundColor: T.card2, borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, backgroundColor: pct >= 70 ? '#16a34a' : pct >= 40 ? '#d97706' : '#dc2626', borderRadius: '3px', transition: 'width 0.3s' }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Card>
            )}

            {/* Avg stats */}
            {metrics.length > 0 && stats.days > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <SectionLabel>Daily Averages</SectionLabel>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                  {metrics.map(metric => (
                    <div key={metric.key} style={{ padding: '16px', backgroundColor: T.card, border: `1px solid ${T.border}`, borderRadius: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                        {metric.icon && <span style={{ fontSize: '14px' }}>{metric.icon}</span>}
                        <span style={{ fontSize: '12px', color: T.muted, fontWeight: '500' }}>{metric.name}</span>
                      </div>
                      <div style={{ fontSize: '24px', fontWeight: '600', color: T.text, marginBottom: '2px' }}>
                        {stats.averages[metric.key] || 0}
                        <span style={{ fontSize: '12px', color: '#666666', fontWeight: '500' }}> {metric.unit}/day</span>
                      </div>
                      {metric.goal && (
                        <div style={{ fontSize: '11px', color: '#666666' }}>
                          Goal: {metric.goal}{metric.unit}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Streak */}
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <SectionLabel>Tracking Streak</SectionLabel>
                  <div style={{ fontSize: '32px', fontWeight: '700', color: streaks.trackingStreak > 0 ? '#f59e0b' : '#ccc', lineHeight: '1' }}>
                    {streaks.trackingStreak > 0 && '🔥 '}{streaks.trackingStreak}
                  </div>
                  <div style={{ fontSize: '12px', color: T.muted, marginTop: '4px' }}>
                    day{streaks.trackingStreak !== 1 ? 's' : ''} in a row
                  </div>
                </div>
                <div style={{ fontSize: '48px', opacity: 0.1 }}>🔥</div>
              </div>
            </Card>

            {/* Time of day */}
            {metrics.length > 0 && (
              <Card>
                <SectionLabel>Eating Patterns — Last 7 Days</SectionLabel>
                <TimeOfDayChart filteredHistory={filteredHistory} metrics={metrics} />
              </Card>
            )}

            {/* Quick add */}
            <Card>
              <SectionLabel>Add to Previous Day</SectionLabel>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {['Yesterday', '2 days ago', '3 days ago'].map((label, i) => (
                  <button key={i} onClick={() => addToPreviousDay(i + 1)}
                    style={{ padding: '8px 14px', backgroundColor: T.card2, border: `1px solid ${T.border}`, borderRadius: '6px', color: T.text, fontSize: '12px', fontWeight: '500', cursor: 'pointer' }}>
                    {label}
                  </button>
                ))}
              </div>
            </Card>
          </>
        )}

        {/* ── WEEKLY TAB ────────────────────────────────────────────────────── */}
        {viewMode === 'weekly' && (
          <>
            {/* Date nav */}
            <Card style={{ padding: '12px 16px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <button onClick={() => navigate(-1)} style={{ padding: '8px 12px', backgroundColor: T.card2, border: 'none', borderRadius: '6px', color: T.muted, fontSize: '16px', cursor: 'pointer' }}>←</button>
                <div style={{ fontSize: '14px', fontWeight: '600', color: T.text }}>{formatDateRange()}</div>
                <button onClick={() => navigate(1)} style={{ padding: '8px 12px', backgroundColor: T.card2, border: 'none', borderRadius: '6px', color: T.muted, fontSize: '16px', cursor: 'pointer' }}>→</button>
              </div>
            </Card>

            {/* Summary row */}
            {stats.days > 0 && (
              <Card>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', textAlign: 'center' }}>
                  <div>
                    <div style={{ fontSize: '24px', fontWeight: '700', color: T.text }}>{stats.days}</div>
                    <div style={{ fontSize: '11px', color: '#666666' }}>Days logged</div>
                  </div>
                  {metrics.filter(m => m.goal).slice(0, 2).map(m => {
                    const hits = stats.goalAchievement[m.key] || 0
                    return (
                      <div key={m.key}>
                        <div style={{ fontSize: '24px', fontWeight: '700', color: hits >= 5 ? '#16a34a' : hits >= 3 ? '#d97706' : '#dc2626' }}>{hits}/7</div>
                        <div style={{ fontSize: '11px', color: '#666666' }}>{m.name} goal</div>
                      </div>
                    )
                  })}
                </div>
              </Card>
            )}

            {/* Day-by-day bar chart */}
            {metrics.length > 0 && (
              <Card>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <SectionLabel>Day by Day</SectionLabel>
                  {metrics.length > 1 && (
                    <select value={chartMetricKey || ''} onChange={e => setChartMetricKey(e.target.value)}
                      style={{ fontSize: '12px', padding: '4px 8px', border: `1px solid ${T.border}`, borderRadius: '6px', color: T.muted, backgroundColor: T.card }}>
                      {metrics.map(m => <option key={m.key} value={m.key}>{m.icon} {m.name}</option>)}
                    </select>
                  )}
                </div>
                <BarChart bars={getWeeklyBars()} goal={activeMetric?.goal} />
                {(() => {
                  const insight = getWeeklyInsight()
                  return insight ? (
                    <div style={{ marginTop: '12px', padding: '10px 12px', backgroundColor: '#f0f7f8', borderRadius: '8px', fontSize: '12px', color: '#0A84FF', fontWeight: '500' }}>
                      💡 {insight}
                    </div>
                  ) : null
                })()}
              </Card>
            )}

            {/* Time of day */}
            {metrics.length > 0 && (
              <Card>
                <SectionLabel>Meal Timing Patterns</SectionLabel>
                <TimeOfDayChart filteredHistory={filteredHistory} metrics={metrics} />
              </Card>
            )}

            {/* Water */}
            {filteredHistory.length > 0 && (
              <Card>
                <SectionLabel>Hydration</SectionLabel>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', textAlign: 'center' }}>
                  <div>
                    <div style={{ fontSize: '24px', fontWeight: '600', color: T.text }}>
                      {filteredHistory.reduce((s, d) => s + (d.water || 0), 0)}
                    </div>
                    <div style={{ fontSize: '11px', color: '#666666' }}>Total oz</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '24px', fontWeight: '600', color: T.text }}>
                      {filteredHistory.length > 0 ? Math.round(filteredHistory.reduce((s, d) => s + (d.water || 0), 0) / filteredHistory.length) : 0}
                    </div>
                    <div style={{ fontSize: '11px', color: '#666666' }}>Avg/day oz</div>
                  </div>
                </div>
              </Card>
            )}
          </>
        )}

        {/* ── MONTHLY TAB ───────────────────────────────────────────────────── */}
        {viewMode === 'monthly' && (
          <>
            {/* Date nav */}
            <Card style={{ padding: '12px 16px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <button onClick={() => navigate(-1)} style={{ padding: '8px 12px', backgroundColor: T.card2, border: 'none', borderRadius: '6px', color: T.muted, fontSize: '16px', cursor: 'pointer' }}>←</button>
                <div style={{ fontSize: '14px', fontWeight: '600', color: T.text }}>{formatDateRange()}</div>
                <button onClick={() => navigate(1)} style={{ padding: '8px 12px', backgroundColor: T.card2, border: 'none', borderRadius: '6px', color: T.muted, fontSize: '16px', cursor: 'pointer' }}>→</button>
              </div>
            </Card>

            {/* Insight banner */}
            {(() => {
              const insight = getMonthlyInsight()
              return insight ? (
                <div style={{ marginBottom: '16px', padding: '12px 16px', backgroundColor: '#f0f7f8', borderRadius: '10px', fontSize: '13px', color: '#0A84FF', fontWeight: '500' }}>
                  💡 {insight}
                </div>
              ) : null
            })()}

            {/* Avg stats */}
            {metrics.length > 0 && stats.days > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <SectionLabel>Monthly Averages</SectionLabel>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                  {metrics.map(metric => (
                    <div key={metric.key} style={{ padding: '16px', backgroundColor: T.card, border: `1px solid ${T.border}`, borderRadius: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                        {metric.icon && <span style={{ fontSize: '14px' }}>{metric.icon}</span>}
                        <span style={{ fontSize: '12px', color: T.muted, fontWeight: '500' }}>{metric.name}</span>
                      </div>
                      <div style={{ fontSize: '24px', fontWeight: '600', color: T.text, marginBottom: '2px' }}>
                        {stats.averages[metric.key] || 0}
                        <span style={{ fontSize: '12px', color: '#666666', fontWeight: '500' }}> {metric.unit}/day</span>
                      </div>
                      {metric.goal && (
                        <div style={{ fontSize: '11px', color: '#666666' }}>Goal: {metric.goal}{metric.unit}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bar chart with granularity toggle */}
            {metrics.length > 0 && (
              <Card>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <SectionLabel>{activeMetric?.icon} {activeMetric?.name || 'Metric'}</SectionLabel>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    {metrics.length > 1 && (
                      <select value={chartMetricKey || ''} onChange={e => setChartMetricKey(e.target.value)}
                        style={{ fontSize: '12px', padding: '4px 8px', border: `1px solid ${T.border}`, borderRadius: '6px', color: T.muted, backgroundColor: T.card }}>
                        {metrics.map(m => <option key={m.key} value={m.key}>{m.icon} {m.name}</option>)}
                      </select>
                    )}
                    {/* Granularity toggle */}
                    <div style={{ display: 'flex', backgroundColor: T.card2, borderRadius: '6px', padding: '2px' }}>
                      {[['daily', '30 Day'], ['weekly', '4 Week']].map(([g, label]) => (
                        <button key={g} onClick={() => setMonthlyGranularity(g)}
                          style={{
                            padding: '4px 10px', fontSize: '11px', fontWeight: monthlyGranularity === g ? '600' : '400',
                            backgroundColor: monthlyGranularity === g ? '#fff' : 'transparent',
                            border: 'none', borderRadius: '4px',
                            color: monthlyGranularity === g ? '#FFFFFF' : '#666666', cursor: 'pointer',
                            boxShadow: monthlyGranularity === g ? '0 1px 2px rgba(0,0,0,0.1)' : 'none'
                          }}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <BarChart
                  bars={monthlyGranularity === 'daily' ? getMonthlyDailyBars() : getMonthlyWeeklyBars()}
                  goal={activeMetric?.goal}
                  scrollable={monthlyGranularity === 'daily'}
                />
                {monthlyGranularity === 'weekly' && (
                  <div style={{ marginTop: '8px', fontSize: '11px', color: '#bbb', textAlign: 'center' }}>
                    Showing daily avg per week
                  </div>
                )}
              </Card>
            )}

            {/* Time of day for the month */}
            {metrics.length > 0 && filteredHistory.length > 0 && (
              <Card>
                <SectionLabel>Meal Timing Patterns</SectionLabel>
                <TimeOfDayChart filteredHistory={filteredHistory} metrics={metrics} />
              </Card>
            )}

            {/* Streak */}
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <SectionLabel>Current Tracking Streak</SectionLabel>
                  <div style={{ fontSize: '32px', fontWeight: '700', color: streaks.trackingStreak > 0 ? '#f59e0b' : '#ccc', lineHeight: '1' }}>
                    {streaks.trackingStreak > 0 && '🔥 '}{streaks.trackingStreak}
                  </div>
                  <div style={{ fontSize: '12px', color: T.muted, marginTop: '4px' }}>day{streaks.trackingStreak !== 1 ? 's' : ''} in a row</div>
                </div>
                <div style={{ fontSize: '48px', opacity: 0.1 }}>🔥</div>
              </div>
            </Card>

            {/* Water */}
            {filteredHistory.length > 0 && (
              <Card>
                <SectionLabel>Hydration</SectionLabel>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', textAlign: 'center' }}>
                  <div>
                    <div style={{ fontSize: '24px', fontWeight: '600', color: T.text }}>
                      {filteredHistory.reduce((s, d) => s + (d.water || 0), 0)}
                    </div>
                    <div style={{ fontSize: '11px', color: '#666666' }}>Total oz</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '24px', fontWeight: '600', color: T.text }}>
                      {filteredHistory.length > 0 ? Math.round(filteredHistory.reduce((s, d) => s + (d.water || 0), 0) / filteredHistory.length) : 0}
                    </div>
                    <div style={{ fontSize: '11px', color: '#666666' }}>Avg/day oz</div>
                  </div>
                </div>
              </Card>
            )}
          </>
        )}

      </div>
    </div>
  )
}
