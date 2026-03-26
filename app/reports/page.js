'use client'

import { useState, useEffect, createContext, useContext } from 'react'
import Link from 'next/link'
import { useAuth } from '../../lib/AuthContext'
import { loadHistory, loadUserSettings, saveHistoryEntry, toLocalDateStr } from '../../lib/dataSync'

const DARK = { bg: '#0D0D0D', card: '#1A1A1A', card2: '#222222', border: '#2C2C2C', text: '#FFFFFF', muted: '#888888', faint: '#3A3A3A' }
const ThemeContext = createContext(DARK)
const T_ACCENT = '#0A84FF'
const T_SUCCESS = '#30D158'
const T_WARNING = '#FF9F0A'
const T_DANGER = '#FF453A'
const T_PURPLE = '#BF5AF2'
const FALLBACK_COLORS = ['#0A84FF', '#FF9F0A', '#30D158', '#BF5AF2', '#FF453A']

// ── SectionHeader ─────────────────────────────────────────────────────────────
function SectionHeader({ icon, title }) {
  const T = useContext(ThemeContext)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
      {icon && (
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: 'rgba(10,132,255,0.12)', border: '1px solid rgba(10,132,255,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17
        }}>
          {icon}
        </div>
      )}
      <h2 style={{
        margin: 0, fontSize: 13, fontWeight: 700, color: T.muted,
        textTransform: 'uppercase', letterSpacing: '2px',
        fontFamily: "'Barlow Condensed', sans-serif"
      }}>
        {title}
      </h2>
    </div>
  )
}

// ── Card ──────────────────────────────────────────────────────────────────────
function Card({ children, style }) {
  const T = useContext(ThemeContext)
  return (
    <div style={{
      backgroundColor: T.card, borderRadius: 16, border: `1px solid ${T.border}`,
      padding: '18px', marginBottom: 16, ...style
    }}>
      {children}
    </div>
  )
}

// ── MacroRing ─────────────────────────────────────────────────────────────────
function MacroRing({ metrics, values }) {
  const T = useContext(ThemeContext)
  const size = 120
  const ringWidth = 14
  const r = (size / 2) - ringWidth / 2
  const circ = 2 * Math.PI * r

  const activeMetrics = metrics.filter(m => (values[m.key] || 0) > 0)
  if (activeMetrics.length === 0) return null

  const total = activeMetrics.reduce((s, m) => s + (values[m.key] || 0), 0)
  if (total === 0) return null

  let offset = 0
  const arcs = activeMetrics.map((m, i) => {
    const val = values[m.key] || 0
    const pct = val / total
    const arcLen = pct * circ
    const arc = { metric: m, val, pct, arcLen, offset, color: m.color || FALLBACK_COLORS[i % FALLBACK_COLORS.length] }
    offset += arcLen
    return arc
  })

  const calMetric = metrics.find(m => m.key === 'calories')
  const centerVal = calMetric && values['calories'] ? values['calories'].toLocaleString() : total.toLocaleString()
  const centerLabel = calMetric && values['calories'] ? 'kcal' : 'total'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={T.faint} strokeWidth={ringWidth} />
          {arcs.map((arc, i) => (
            <circle
              key={arc.metric.key}
              cx={size / 2} cy={size / 2} r={r}
              fill="none"
              stroke={arc.color}
              strokeWidth={ringWidth}
              strokeDasharray={`${arc.arcLen} ${circ - arc.arcLen}`}
              strokeDashoffset={-arc.offset}
              strokeLinecap="round"
            />
          ))}
        </svg>
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center'
        }}>
          <span style={{ fontSize: 20, fontWeight: 900, color: T.text, fontFamily: "'Barlow Condensed', sans-serif", lineHeight: 1 }}>
            {centerVal}
          </span>
          <span style={{ fontSize: 10, color: T.muted, textTransform: 'uppercase', letterSpacing: '1px' }}>{centerLabel}</span>
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
        {arcs.map(arc => (
          <div key={arc.metric.key} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px',
            backgroundColor: `${arc.color}18`, border: `1px solid ${arc.color}40`,
            borderRadius: 20, fontSize: 11
          }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: arc.color, flexShrink: 0 }} />
            <span style={{ color: T.muted, fontWeight: 500 }}>{arc.metric.name}</span>
            <span style={{ color: T.text, fontWeight: 700 }}>{arc.val}{arc.metric.unit || ''}</span>
            <span style={{ color: T.muted }}>({Math.round(arc.pct * 100)}%)</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── DayGoalGrid ───────────────────────────────────────────────────────────────
function DayGoalGrid({ history, metrics, dateRange }) {
  const T = useContext(ThemeContext)
  const metricsWithGoal = metrics.filter(m => m.goal)
  if (metricsWithGoal.length === 0) return null

  const days = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(dateRange)
    d.setDate(d.getDate() + i)
    days.push(d)
  }

  const dayLetters = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
  const startDow = dateRange.getDay()
  const reorderedLetters = Array.from({ length: 7 }, (_, i) => {
    const dow = (startDow + i) % 7
    return ['S', 'M', 'T', 'W', 'T', 'F', 'S'][dow]
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Header row */}
      <div style={{ display: 'grid', gridTemplateColumns: '120px repeat(7, 1fr)', gap: 4, alignItems: 'center' }}>
        <div />
        {reorderedLetters.map((letter, i) => (
          <div key={i} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: T.muted,
            fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '1px' }}>
            {letter}
          </div>
        ))}
      </div>
      {metricsWithGoal.map(metric => (
        <div key={metric.key} style={{ display: 'grid', gridTemplateColumns: '120px repeat(7, 1fr)', gap: 4, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8, flexShrink: 0,
              background: 'rgba(10,132,255,0.1)', border: '1px solid rgba(10,132,255,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13
            }}>
              {metric.icon || '📊'}
            </div>
            <span style={{ fontSize: 11, color: T.muted, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {metric.name}
            </span>
          </div>
          {days.map((d, i) => {
            const dateStr = toLocalDateStr(d)
            const dayData = history.find(h => {
              if (!h.date) return false
              const hStr = /^\d{4}-\d{2}-\d{2}$/.test(h.date) ? h.date : toLocalDateStr(new Date(h.date))
              return hStr === dateStr
            })
            const entry = dayData?.nutritionMetrics?.find(m => m.key === metric.key)
            const val = entry?.value || 0
            const hasData = val > 0
            const gt = metric.goalType || 'min'
            let metGoal = false
            if (hasData && metric.goal) {
              if (gt === 'max') metGoal = val <= metric.goal
              else if (gt === 'range') metGoal = val >= metric.goal && val <= (metric.goalMax || metric.goal)
              else metGoal = val >= metric.goal
            }
            let dotColor = T.faint
            if (hasData) dotColor = metGoal ? T_SUCCESS : T_DANGER
            return (
              <div key={i} style={{ display: 'flex', justifyContent: 'center' }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%',
                  backgroundColor: dotColor,
                  opacity: hasData ? 1 : 0.4,
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }} />
              </div>
            )
          })}
        </div>
      ))}
      <div style={{ display: 'flex', gap: 14, fontSize: 10, color: T.muted, marginTop: 4 }}>
        <span><span style={{ color: T_SUCCESS }}>●</span> Goal hit</span>
        <span><span style={{ color: T_DANGER }}>●</span> Missed</span>
        <span><span style={{ color: T.faint }}>●</span> No data</span>
      </div>
    </div>
  )
}

// ── BestWorstWeeks ────────────────────────────────────────────────────────────
function BestWorstWeeks({ history, metrics, monthStart, monthEnd }) {
  const T = useContext(ThemeContext)
  const primaryMetric = metrics.find(m => m.key === 'calories') || metrics[0]
  if (!primaryMetric) return null

  const weeks = []
  const cursor = new Date(monthStart)
  let weekNum = 1
  while (cursor <= monthEnd) {
    const wStart = new Date(cursor)
    const wEnd = new Date(cursor)
    wEnd.setDate(wEnd.getDate() + 6)
    if (wEnd > monthEnd) wEnd.setTime(monthEnd.getTime())
    let total = 0, daysLogged = 0
    const wd = new Date(wStart)
    while (wd <= wEnd) {
      const dateStr = toLocalDateStr(wd)
      const dayData = history.find(h => {
        if (!h.date) return false
        const hStr = /^\d{4}-\d{2}-\d{2}$/.test(h.date) ? h.date : toLocalDateStr(new Date(h.date))
        return hStr === dateStr
      })
      const entry = dayData?.nutritionMetrics?.find(m => m.key === primaryMetric.key)
      if (entry?.value) { total += entry.value; daysLogged++ }
      wd.setDate(wd.getDate() + 1)
    }
    const avg = daysLogged > 0 ? Math.round(total / daysLogged) : 0
    const opts = { month: 'short', day: 'numeric' }
    weeks.push({
      label: `Wk ${weekNum}`,
      range: `${wStart.toLocaleDateString('en-US', opts)}–${wEnd.toLocaleDateString('en-US', opts)}`,
      avg, daysLogged, weekNum
    })
    weekNum++
    cursor.setDate(cursor.getDate() + 7)
  }

  if (weeks.length === 0) return null

  const weeksWithData = weeks.filter(w => w.daysLogged > 0)
  const bestAvg = weeksWithData.length > 0 ? Math.max(...weeksWithData.map(w => w.avg)) : -1
  const worstAvg = weeksWithData.length > 0 ? Math.min(...weeksWithData.map(w => w.avg)) : -1

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
      {weeks.map(week => {
        const isBest = week.daysLogged > 0 && week.avg === bestAvg && weeksWithData.length > 1
        const isWorst = week.daysLogged > 0 && week.avg === worstAvg && weeksWithData.length > 1
        const goal = primaryMetric.goal
        const pct = goal && week.avg > 0 ? Math.min(Math.round((week.avg / goal) * 100), 100) : null
        return (
          <div key={week.weekNum} style={{
            padding: '14px', borderRadius: 12,
            backgroundColor: isBest ? 'rgba(48,209,88,0.08)' : isWorst ? 'rgba(255,69,58,0.08)' : T.card2,
            border: `1px solid ${isBest ? 'rgba(48,209,88,0.35)' : isWorst ? 'rgba(255,69,58,0.35)' : T.border}`
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.text, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '1px' }}>
                  {week.label}
                </div>
                <div style={{ fontSize: 10, color: T.muted, marginTop: 2 }}>{week.range}</div>
              </div>
              {isBest && <span style={{ fontSize: 10, fontWeight: 700, color: T_SUCCESS, backgroundColor: 'rgba(48,209,88,0.15)', padding: '2px 7px', borderRadius: 20 }}>BEST</span>}
              {isWorst && <span style={{ fontSize: 10, fontWeight: 700, color: T_DANGER, backgroundColor: 'rgba(255,69,58,0.15)', padding: '2px 7px', borderRadius: 20 }}>WORST</span>}
            </div>
            {week.daysLogged > 0 ? (
              <>
                <div style={{ fontSize: 22, fontWeight: 900, color: isBest ? T_SUCCESS : isWorst ? T_DANGER : T.text, fontFamily: "'Barlow Condensed', sans-serif", lineHeight: 1 }}>
                  {week.avg.toLocaleString()}
                  <span style={{ fontSize: 11, fontWeight: 400, color: T.muted, marginLeft: 4 }}>{primaryMetric.unit}/day avg</span>
                </div>
                <div style={{ fontSize: 10, color: T.muted, marginTop: 4 }}>{week.daysLogged} day{week.daysLogged !== 1 ? 's' : ''} logged{pct !== null ? ` · ${pct}% of goal` : ''}</div>
              </>
            ) : (
              <div style={{ fontSize: 13, color: T.muted, fontStyle: 'italic' }}>No data</div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── TimeOfDayChart ────────────────────────────────────────────────────────────
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

  const colors = [T_ACCENT, '#10b981', T_WARNING, T_DANGER, T_PURPLE, '#ec4899']
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
      <div style={{ padding: '32px 16px', textAlign: 'center' }}>
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

  const primaryKey = metrics[0]?.key
  const peakIdx = primaryKey ? blockData[primaryKey].indexOf(Math.max(...blockData[primaryKey])) : -1
  const peakLabel = peakIdx >= 0 ? timeBlocks[peakIdx]?.label : null

  return (
    <div>
      {peakLabel && (
        <div style={{ fontSize: '12px', color: T_ACCENT, fontWeight: '600', marginBottom: '8px', textAlign: 'center' }}>
          Peak eating time: {peakLabel}
        </div>
      )}
      <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width: '100%', height: 'auto' }}>
        {[0, 0.25, 0.5, 0.75, 1].map((frac, i) => {
          const y = padT + chartH - frac * chartH
          return (
            <g key={i}>
              <line x1={padL} y1={y} x2={svgW - padR} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
              <text x={padL - 6} y={y + 3} textAnchor="end" fontSize="7" fill="#888888">
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
                <circle key={i} cx={p.x} cy={p.y} r="3.5" fill="#1A1A1A" stroke={color} strokeWidth="2" />
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
            <text key={i} x={x} y={svgH - 8} textAnchor="middle" fontSize="7" fill="#888888">
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
      <div style={{ marginTop: '8px', fontSize: '10px', color: T.muted, textAlign: 'center' }}>
        Averaged across {daysWithData} day{daysWithData !== 1 ? 's' : ''} with meal data
      </div>
    </div>
  )
}

// ── BarChart ──────────────────────────────────────────────────────────────────
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
        {[0, 0.5, 1].map((frac, i) => {
          const y = padT + chartH - frac * chartH
          return (
            <g key={i}>
              <line x1={padL} y1={y} x2={svgW - padR} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
              <text x={padL - 4} y={y + 3} textAnchor="end" fontSize="7" fill="#888888">
                {Math.round(maxVal * frac) > 999
                  ? `${(Math.round(maxVal * frac) / 1000).toFixed(1)}k`
                  : Math.round(maxVal * frac)}
              </text>
            </g>
          )
        })}
        {goalY !== null && (
          <line x1={padL} y1={goalY} x2={svgW - padR} y2={goalY}
            stroke={T_DANGER} strokeWidth="1" strokeDasharray="3,2" />
        )}
        {bars.map((bar, i) => {
          const x = padL + i * (barW + gap)
          const barH = bar.value > 0 ? Math.max((bar.value / maxVal) * chartH, 2) : 0
          const y = padT + chartH - barH
          const metGoal = goal && bar.value > 0 ? bar.value >= goal : false
          const barColor = bar.value === 0 ? '#3A3A3A' : metGoal ? T_SUCCESS : T_ACCENT
          return (
            <g key={i}>
              <rect x={x} y={bar.value === 0 ? padT + chartH - 2 : y} width={barW} height={bar.value === 0 ? 2 : barH} fill={barColor} rx="2" />
              <text x={x + barW / 2} y={svgH - 6} textAnchor="middle" fontSize="7" fill="#888888">{bar.label}</text>
            </g>
          )
        })}
      </svg>
      <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', fontSize: '10px', color: T.muted, marginTop: '4px' }}>
        <span><span style={{ color: T_SUCCESS }}>■</span> Met goal</span>
        <span><span style={{ color: T_ACCENT }}>■</span> Logged</span>
        {goal && <span style={{ color: T_DANGER }}>— Goal</span>}
      </div>
    </div>
  )
}

// ── ExportView ────────────────────────────────────────────────────────────────
function ExportView({ todayEntry, metrics, waterGoal, onClose }) {
  const T = useContext(ThemeContext)
  const today = new Date()
  const dateLabel = today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const generatedAt = today.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, backgroundColor: T.bg, overflowY: 'auto', padding: '32px 24px' }}>
      <style>{`@media print { .no-print { display: none !important; } body { background: #0D0D0D !important; } }`}</style>
      <div className="no-print" style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginBottom: '28px' }}>
        <button onClick={() => window.print()} style={{
          padding: '10px 20px', background: 'linear-gradient(90deg, #0A84FF, #5856D6)',
          border: 'none', borderRadius: '10px', color: '#fff', fontSize: '14px', fontWeight: '600',
          cursor: 'pointer', boxShadow: '0 2px 12px rgba(10,132,255,0.35)'
        }}>
          Print / Save as PDF
        </button>
        <button onClick={onClose} style={{
          padding: '10px 20px', backgroundColor: T.card, border: `1px solid ${T.border}`,
          borderRadius: '10px', color: T.muted, fontSize: '14px', fontWeight: '500', cursor: 'pointer'
        }}>
          Close
        </button>
      </div>
      <div style={{ maxWidth: '680px', margin: '0 auto' }}>
        <div style={{ borderBottom: `2px solid ${T_ACCENT}`, paddingBottom: '16px', marginBottom: '28px' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: T_ACCENT, letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '6px', fontFamily: "'Barlow Condensed', sans-serif" }}>
            Lytz · Daily Health Report
          </div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: T.text, letterSpacing: '-0.5px', fontFamily: "'Barlow Condensed', sans-serif" }}>{dateLabel}</div>
        </div>
        {!todayEntry ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: T.muted, fontSize: '15px' }}>No data recorded for today yet.</div>
        ) : (
          <>
            {metrics.length > 0 && todayEntry.nutritionMetrics && (
              <div style={{ marginBottom: '28px' }}>
                <div style={{ fontSize: '11px', fontWeight: '700', color: T.muted, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px', fontFamily: "'Barlow Condensed', sans-serif" }}>Nutrition</div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                      {['Metric', 'Value', 'Goal', 'Progress'].map(h => (
                        <th key={h} style={{ textAlign: h === 'Metric' ? 'left' : 'right', padding: '6px 8px', fontSize: '11px', fontWeight: '600', color: T.muted }}>{h}</th>
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
                        <tr key={metric.key} style={{ borderBottom: `1px solid ${T.faint}` }}>
                          <td style={{ padding: '8px', fontSize: '14px', color: T.text, fontWeight: '500' }}>{metric.name}</td>
                          <td style={{ padding: '8px', fontSize: '14px', color: T.text, textAlign: 'right', fontWeight: '600' }}>{val}{metric.unit || ''}</td>
                          <td style={{ padding: '8px', fontSize: '14px', color: T.muted, textAlign: 'right' }}>{goalDisplay}</td>
                          <td style={{ padding: '8px', textAlign: 'right' }}>
                            {pct !== null ? <span style={{ fontSize: '12px', fontWeight: '600', color: pct >= 100 ? T_SUCCESS : pct >= 70 ? T_WARNING : T_DANGER }}>{pct}%</span> : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div style={{ marginBottom: '28px' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: T.muted, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px', fontFamily: "'Barlow Condensed', sans-serif" }}>Hydration</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: `1px solid ${T.faint}` }}>
                <span style={{ fontSize: '14px', fontWeight: '500', color: T.text }}>Water Intake</span>
                <span style={{ fontSize: '14px', fontWeight: '600', color: T.text }}>
                  {todayEntry.water || 0} oz
                  {waterGoal > 0 && <span style={{ fontWeight: '400', color: T.muted }}> / {waterGoal} oz ({Math.min(Math.round(((todayEntry.water || 0) / waterGoal) * 100), 100)}%)</span>}
                </span>
              </div>
            </div>
            {todayEntry.checklistItems?.length > 0 && (
              <div style={{ marginBottom: '28px' }}>
                <div style={{ fontSize: '11px', fontWeight: '700', color: T.muted, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px', fontFamily: "'Barlow Condensed', sans-serif" }}>Daily Habits</div>
                {todayEntry.checklistItems.map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: `1px solid ${T.faint}` }}>
                    <span style={{ fontSize: '16px', color: item.checked ? T_SUCCESS : T_DANGER }}>{item.checked ? '✓' : '✗'}</span>
                    <span style={{ fontSize: '14px', color: item.checked ? T.text : T.muted, fontWeight: '500', textDecoration: item.checked ? 'none' : 'line-through' }}>
                      {item.label || item.name || `Habit ${i + 1}`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        <div style={{ marginTop: '40px', paddingTop: '16px', borderTop: `1px solid ${T.border}`, fontSize: '11px', color: T.muted, textAlign: 'center' }}>
          Generated {generatedAt} · Lytz Daily Nutrition Tracker
        </div>
      </div>
    </div>
  )
}

// ── WeeklyStrip ───────────────────────────────────────────────────────────────
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
    let dotColor = T.faint
    if (hasData) dotColor = pct >= 0.8 ? T_SUCCESS : pct >= 0.5 ? T_WARNING : T_DANGER
    days.push({ d, value, goal, dotColor, hasData, isToday: i === 0 })
  }

  return (
    <Card>
      <SectionHeader icon="📅" title={`This Week — ${calMetric.name}`} />
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4 }}>
        {days.map(({ d, value, goal, dotColor, hasData, isToday }) => (
          <div key={d.toISOString()} style={{ textAlign: 'center', flex: 1 }}>
            <div style={{
              fontSize: '10px', color: isToday ? T_ACCENT : T.muted,
              fontWeight: isToday ? '700' : '500', marginBottom: '8px',
              fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '1px'
            }}>
              {d.toLocaleDateString('en-US', { weekday: 'short' }).charAt(0)}
            </div>
            <div style={{
              width: '36px', height: '36px', borderRadius: '50%', backgroundColor: dotColor,
              margin: '0 auto 8px',
              border: isToday ? `2px solid ${T_ACCENT}` : '2px solid transparent',
              boxSizing: 'border-box', boxShadow: isToday ? `0 0 8px rgba(10,132,255,0.4)` : 'none'
            }} />
            <div style={{ fontSize: '10px', color: hasData ? T.text : T.muted, fontWeight: '600', lineHeight: '1.3' }}>
              {hasData ? value.toLocaleString() : '—'}
            </div>
            {hasData && goal > 0 && <div style={{ fontSize: '9px', color: T.muted }}>/{goal.toLocaleString()}</div>}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', marginTop: '14px', fontSize: '10px', color: T.muted }}>
        <span><span style={{ color: T_SUCCESS }}>●</span> On track</span>
        <span><span style={{ color: T_WARNING }}>●</span> Partial</span>
        <span><span style={{ color: T_DANGER }}>●</span> Low</span>
      </div>
    </Card>
  )
}

// ── DateNavCard ───────────────────────────────────────────────────────────────
function DateNavCard({ label, onPrev, onNext }) {
  const T = useContext(ThemeContext)
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: T.card, borderRadius: 16, border: `1px solid rgba(10,132,255,0.25)`,
      padding: '12px 16px', marginBottom: 16
    }}>
      <button onClick={onPrev} style={{
        width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(10,132,255,0.1)',
        border: '1px solid rgba(10,132,255,0.25)', color: T_ACCENT, fontSize: '16px',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '600'
      }}>←</button>
      <div style={{
        fontSize: '15px', fontWeight: '700', color: T.text,
        fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '1px'
      }}>{label}</div>
      <button onClick={onNext} style={{
        width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(10,132,255,0.1)',
        border: '1px solid rgba(10,132,255,0.25)', color: T_ACCENT, fontSize: '16px',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '600'
      }}>→</button>
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
  const T = DARK
  const [history, setHistory] = useState([])
  const [metrics, setMetrics] = useState([])
  const [viewMode, setViewMode] = useState('daily')
  const [monthlyGranularity, setMonthlyGranularity] = useState('daily')
  const [chartMetricKey, setChartMetricKey] = useState(null)
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

  const stats = calculateStats()
  const filteredHistory = getFilteredHistory()
  const streaks = calculateStreaks()
  const activeMetric = metrics.find(m => m.key === chartMetricKey)

  // Greeting
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'GOOD MORNING' : hour < 17 ? 'GOOD AFTERNOON' : 'GOOD EVENING'

  // Today's data
  const todayKey = toLocalDateStr(new Date())
  const todayEntry = history.find(d => normDate(d.date) === todayKey)

  // Primary metric for today hero
  const primaryMetric = metrics.find(m => m.key === 'calories') || metrics[0]
  const todayPrimaryEntry = todayEntry?.nutritionMetrics?.find(m => m.key === primaryMetric?.key)
  const todayPrimaryVal = todayPrimaryEntry?.value || 0
  const todayPrimaryGoal = primaryMetric?.goal || 0
  const todayPrimaryPct = todayPrimaryGoal > 0 ? todayPrimaryVal / todayPrimaryGoal : 0

  // Today macro values (for MacroRing)
  const todayMacroValues = {}
  if (todayEntry?.nutritionMetrics) {
    todayEntry.nutritionMetrics.forEach(m => { todayMacroValues[m.key] = m.value || 0 })
  }

  // Today habits
  const totalHabits = todayEntry?.checklistItems?.length || 0
  const checkedHabits = todayEntry?.checklistItems?.filter(h => h.checked)?.length || 0
  const habitPct = totalHabits > 0 ? Math.round((checkedHabits / totalHabits) * 100) : null

  // Today water
  const todayWater = todayEntry?.water || 0

  // Meal timing windows for today
  const mealWindows = [
    { label: 'Morning', start: 5, end: 11 },
    { label: 'Afternoon', start: 11, end: 17 },
    { label: 'Evening', start: 17, end: 21 },
    { label: 'Late', start: 21, end: 29 },
  ]
  const todayWindowsLogged = mealWindows.map(w => {
    if (!todayEntry?.nutritionHistory) return false
    return todayEntry.nutritionHistory.some(entry => {
      if (!entry.timestamp) return false
      const h = new Date(entry.timestamp).getHours()
      const adjustedH = h < 5 ? h + 24 : h
      return adjustedH >= w.start && adjustedH < w.end
    })
  })

  // Weekly summary for weekly tab
  const { start: weekStart } = getDateRange()

  // Monthly date range
  const { start: monthStart, end: monthEnd } = getDateRange()

  if (loading) {
    return (
      <ThemeContext.Provider value={T}>
        <div style={{ minHeight: '100vh', backgroundColor: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.3 }}>📊</div>
            <div style={{ color: T.muted, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '2px', textTransform: 'uppercase', fontSize: 13 }}>Loading reports...</div>
          </div>
        </div>
      </ThemeContext.Provider>
    )
  }

  return (
    <ThemeContext.Provider value={T}>
      <div style={{ minHeight: '100vh', backgroundColor: T.bg, padding: '0 0 80px 0' }}>

        {showExport && (
          <ExportView
            todayEntry={history.find(d => normDate(d.date) === toLocalDateStr(new Date())) || null}
            metrics={metrics} waterGoal={waterGoal}
            onClose={() => setShowExport(false)}
          />
        )}

        {/* Edit Modal */}
        {editingDay && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
            <div style={{ backgroundColor: T.card, borderRadius: '20px', padding: '8px 24px 24px', maxWidth: '400px', width: '100%', maxHeight: '85vh', overflow: 'auto' }}>
              {/* Drag handle */}
              <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 16px' }}>
                <div style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: T.faint }} />
              </div>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '20px', fontWeight: '900', color: T.text, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '1px' }}>Edit Entry</h3>
              <div style={{ fontSize: '13px', color: T.muted, marginBottom: '20px' }}>
                {parseLocalDate(editingDay.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: T.muted, marginBottom: '6px', letterSpacing: '1.5px', textTransform: 'uppercase', fontFamily: "'Barlow Condensed', sans-serif" }}>💧 Water (oz)</label>
                <input type="number" value={editValues.water || ''} onChange={e => setEditValues({ ...editValues, water: e.target.value })}
                  style={{ width: '100%', padding: '12px 14px', backgroundColor: T.bg, border: `1px solid ${T.border}`, borderRadius: '10px', fontSize: '16px', color: T.text, boxSizing: 'border-box', outline: 'none' }} />
              </div>
              {metrics.map(metric => (
                <div key={metric.key} style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: T.muted, marginBottom: '6px', letterSpacing: '1.5px', textTransform: 'uppercase', fontFamily: "'Barlow Condensed', sans-serif" }}>
                    {metric.icon} {metric.name} ({metric.unit})
                  </label>
                  <input type="number" value={editValues[metric.key] || ''} onChange={e => setEditValues({ ...editValues, [metric.key]: e.target.value })}
                    style={{ width: '100%', padding: '12px 14px', backgroundColor: T.bg, border: `1px solid ${T.border}`, borderRadius: '10px', fontSize: '16px', color: T.text, boxSizing: 'border-box', outline: 'none' }} />
                </div>
              ))}
              <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
                <button onClick={() => { setEditingDay(null); setEditValues({}) }}
                  style={{ flex: 1, padding: '13px', backgroundColor: T.card2, border: `1px solid ${T.border}`, borderRadius: '12px', color: T.muted, fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button onClick={saveEditedDay}
                  style={{ flex: 1, padding: '13px', background: 'linear-gradient(90deg, #0A84FF, #5856D6)', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '14px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 2px 12px rgba(10,132,255,0.35)' }}>
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Sticky Header */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 100,
          backdropFilter: 'blur(16px)', backgroundColor: '#0D0D0Dee',
          borderBottom: `1px solid ${T.border}`,
          marginLeft: 0, marginRight: 0,
          padding: '12px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: T.muted, letterSpacing: '2.5px', textTransform: 'uppercase', fontFamily: "'Barlow Condensed', sans-serif", marginBottom: 2 }}>
              {greeting}
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: T.text, letterSpacing: '4px', textTransform: 'uppercase', fontFamily: "'Barlow Condensed', sans-serif", lineHeight: 1 }}>
              REPORTS
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={() => setShowExport(true)} style={{
              padding: '7px 12px', backgroundColor: 'transparent',
              border: `1px solid ${T.border}`, borderRadius: '10px',
              color: T.muted, fontSize: '12px', fontWeight: '600', cursor: 'pointer',
              fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.5px'
            }}>
              Export Today
            </button>
            <Link href="/" style={{
              width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: T.card, border: `1px solid ${T.border}`, color: T.text,
              fontSize: '16px', textDecoration: 'none', fontWeight: '600'
            }}>
              ←
            </Link>
          </div>
        </div>

        {/* Content */}
        <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 16px' }}>

          {/* Tab selector */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginTop: 20, marginBottom: 20 }}>
            {[
              { mode: 'daily', label: 'Daily', activeBg: 'rgba(10,132,255,0.12)', activeBorder: 'rgba(10,132,255,0.3)', activeColor: T_ACCENT },
              { mode: 'weekly', label: 'Weekly', activeBg: 'rgba(191,90,242,0.12)', activeBorder: 'rgba(191,90,242,0.3)', activeColor: T_PURPLE },
              { mode: 'monthly', label: 'Monthly', activeBg: 'rgba(255,159,10,0.12)', activeBorder: 'rgba(255,159,10,0.3)', activeColor: T_WARNING },
            ].map(({ mode, label, activeBg, activeBorder, activeColor }) => (
              <button key={mode} onClick={() => setViewMode(mode)}
                style={{
                  padding: '11px 12px',
                  backgroundColor: viewMode === mode ? activeBg : T.card,
                  border: `1px solid ${viewMode === mode ? activeBorder : T.border}`,
                  borderRadius: '12px',
                  color: viewMode === mode ? activeColor : T.muted,
                  fontSize: '13px', fontWeight: '700', cursor: 'pointer',
                  fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '1px',
                  textTransform: 'uppercase', transition: 'all 0.15s'
                }}>
                {label}
              </button>
            ))}
          </div>

          {/* ── DAILY TAB ───────────────────────────────────────────────────── */}
          {viewMode === 'daily' && (
            <>
              {/* Today Hero Card */}
              {todayEntry && primaryMetric && (
                <div style={{
                  background: 'linear-gradient(145deg, #0a0f1e, #111827, #0d0d0d)',
                  borderRadius: 20, border: `1px solid rgba(10,132,255,0.2)`,
                  padding: '24px 20px', marginBottom: 16, position: 'relative', overflow: 'hidden'
                }}>
                  {/* Glow orb */}
                  <div style={{
                    position: 'absolute', top: -40, right: -40,
                    width: 160, height: 160, borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(10,132,255,0.18) 0%, transparent 70%)',
                    pointerEvents: 'none'
                  }} />
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, position: 'relative' }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, letterSpacing: '2px', textTransform: 'uppercase', fontFamily: "'Barlow Condensed', sans-serif", marginBottom: 4 }}>
                        Today · {primaryMetric.name}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                        <span style={{ fontSize: 48, fontWeight: 900, color: T.text, fontFamily: "'Barlow Condensed', sans-serif", lineHeight: 1 }}>
                          {todayPrimaryVal.toLocaleString()}
                        </span>
                        {todayPrimaryGoal > 0 && (
                          <span style={{ fontSize: 16, color: T.muted, fontWeight: 500 }}>
                            / {todayPrimaryGoal.toLocaleString()} {primaryMetric.unit}
                          </span>
                        )}
                      </div>
                      {todayPrimaryGoal > 0 && (
                        <div style={{ marginTop: 10, height: 5, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden', width: 200 }}>
                          <div style={{ height: '100%', width: `${Math.min(todayPrimaryPct * 100, 100)}%`, borderRadius: 3, backgroundColor: todayPrimaryPct >= 0.8 ? T_SUCCESS : todayPrimaryPct >= 0.5 ? T_WARNING : T_ACCENT, transition: 'width 0.4s' }} />
                        </div>
                      )}
                    </div>
                    {/* Status badge */}
                    <div style={{
                      padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                      letterSpacing: '1.5px', textTransform: 'uppercase',
                      fontFamily: "'Barlow Condensed', sans-serif",
                      backgroundColor: todayPrimaryPct >= 0.8 ? 'rgba(48,209,88,0.15)' : todayPrimaryPct >= 0.5 ? 'rgba(255,159,10,0.15)' : 'rgba(255,255,255,0.05)',
                      color: todayPrimaryPct >= 0.8 ? T_SUCCESS : todayPrimaryPct >= 0.5 ? T_WARNING : T.muted,
                      border: `1px solid ${todayPrimaryPct >= 0.8 ? 'rgba(48,209,88,0.3)' : todayPrimaryPct >= 0.5 ? 'rgba(255,159,10,0.3)' : T.border}`
                    }}>
                      {todayPrimaryPct >= 0.8 ? 'ON TRACK' : todayPrimaryPct >= 0.5 ? 'IN PROGRESS' : 'START LOGGING'}
                    </div>
                  </div>
                  {/* Secondary stats row */}
                  <div style={{ display: 'flex', gap: 12, position: 'relative' }}>
                    <div style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '10px 12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ fontSize: 10, color: T.muted, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', fontFamily: "'Barlow Condensed', sans-serif", marginBottom: 4 }}>💧 Water</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: T_ACCENT, fontFamily: "'Barlow Condensed', sans-serif" }}>
                        {todayWater} <span style={{ fontSize: 11, fontWeight: 500, color: T.muted }}>oz{waterGoal > 0 ? ` / ${waterGoal}` : ''}</span>
                      </div>
                    </div>
                    {habitPct !== null && (
                      <div style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '10px 12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ fontSize: 10, color: T.muted, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', fontFamily: "'Barlow Condensed', sans-serif", marginBottom: 4 }}>✅ Habits</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: habitPct >= 80 ? T_SUCCESS : habitPct >= 50 ? T_WARNING : T.muted, fontFamily: "'Barlow Condensed', sans-serif" }}>
                          {habitPct}% <span style={{ fontSize: 11, fontWeight: 500, color: T.muted }}>{checkedHabits}/{totalHabits}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Macro Breakdown */}
              {todayEntry && metrics.length >= 2 && Object.values(todayMacroValues).some(v => v > 0) && (
                <Card>
                  <SectionHeader icon="🥗" title="Macro Breakdown" />
                  <MacroRing metrics={metrics} values={todayMacroValues} />
                </Card>
              )}

              {/* Meal Timing Today */}
              {todayEntry && (
                <Card>
                  <SectionHeader icon="🕐" title="Meal Windows Today" />
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                    {mealWindows.map((w, i) => (
                      <div key={w.label} style={{ flex: 1, textAlign: 'center' }}>
                        <div style={{
                          height: 40, borderRadius: 10, marginBottom: 8,
                          backgroundColor: todayWindowsLogged[i] ? 'rgba(48,209,88,0.2)' : 'rgba(255,255,255,0.04)',
                          border: `1px solid ${todayWindowsLogged[i] ? 'rgba(48,209,88,0.4)' : T.border}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: todayWindowsLogged[i] ? 18 : 14
                        }}>
                          {todayWindowsLogged[i] ? '🍽️' : '·'}
                        </div>
                        <div style={{ fontSize: 10, color: todayWindowsLogged[i] ? T_SUCCESS : T.muted, fontWeight: 600, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.5px' }}>
                          {w.label}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* 7-day goal strip */}
              <WeeklyStrip history={history} metrics={metrics} />

              {/* Goal Achievement */}
              {metrics.some(m => m.goal) && stats.days > 0 && (
                <Card>
                  <SectionHeader icon="🎯" title="Goal Achievement — Last 7 Days" />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {metrics.filter(m => m.goal).map(m => {
                      const hits = stats.goalAchievement[m.key] || 0
                      const pct = Math.round((hits / stats.days) * 100)
                      return (
                        <div key={m.key}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                            <span style={{ fontSize: '13px', color: T.text, fontWeight: 500 }}>{m.icon} {m.name}</span>
                            <span style={{ fontSize: '13px', fontWeight: '700', color: pct >= 70 ? T_SUCCESS : pct >= 40 ? T_WARNING : T_DANGER }}>
                              {hits}/{stats.days} days
                            </span>
                          </div>
                          <div style={{ height: '6px', backgroundColor: T.faint, borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, backgroundColor: pct >= 70 ? T_SUCCESS : pct >= 40 ? T_WARNING : T_DANGER, borderRadius: '3px', transition: 'width 0.3s' }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </Card>
              )}

              {/* Avg stats */}
              {metrics.length > 0 && stats.days > 0 && (
                <Card>
                  <SectionHeader icon="📊" title="Daily Averages" />
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                    {metrics.map((metric, i) => (
                      <div key={metric.key} style={{
                        padding: '14px', backgroundColor: T.card2, border: `1px solid ${T.border}`,
                        borderRadius: '12px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                            backgroundColor: `${metric.color || FALLBACK_COLORS[i % FALLBACK_COLORS.length]}20`,
                            border: `1px solid ${metric.color || FALLBACK_COLORS[i % FALLBACK_COLORS.length]}40`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14
                          }}>
                            {metric.icon || '📊'}
                          </div>
                          <span style={{ fontSize: '12px', color: T.muted, fontWeight: '600', letterSpacing: '0.5px' }}>{metric.name}</span>
                        </div>
                        <div style={{ fontSize: '26px', fontWeight: '900', color: T.text, lineHeight: 1, fontFamily: "'Barlow Condensed', sans-serif" }}>
                          {(stats.averages[metric.key] || 0).toLocaleString()}
                          <span style={{ fontSize: '12px', color: T.muted, fontWeight: '500', marginLeft: 4 }}>{metric.unit}/day</span>
                        </div>
                        {metric.goal && (
                          <div style={{ fontSize: '11px', color: T.muted, marginTop: 4 }}>
                            Goal: {metric.goal.toLocaleString()}{metric.unit}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Tracking Streak */}
              <div style={{
                background: 'linear-gradient(135deg, #28180a, #3a2810)',
                border: '1px solid rgba(255,159,10,0.3)',
                borderRadius: 16, padding: '18px', marginBottom: 16
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,159,10,0.7)', letterSpacing: '2px', textTransform: 'uppercase', fontFamily: "'Barlow Condensed', sans-serif", marginBottom: 6 }}>
                      Tracking Streak
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      <span style={{ fontSize: 48, fontWeight: 900, color: streaks.trackingStreak > 0 ? T_WARNING : T.muted, fontFamily: "'Barlow Condensed', sans-serif", lineHeight: 1 }}>
                        {streaks.trackingStreak > 0 ? '🔥' : ''} {streaks.trackingStreak}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,159,10,0.6)', letterSpacing: '2px', textTransform: 'uppercase', fontFamily: "'Barlow Condensed', sans-serif", marginTop: 4 }}>
                      DAY STREAK
                    </div>
                  </div>
                  <div style={{ fontSize: 56, opacity: 0.12 }}>🔥</div>
                </div>
              </div>

              {/* Eating Patterns */}
              {metrics.length > 0 && (
                <Card>
                  <SectionHeader icon="📈" title="Eating Patterns — Last 7 Days" />
                  <TimeOfDayChart filteredHistory={filteredHistory} metrics={metrics} />
                </Card>
              )}

              {/* Add to Previous Day */}
              <Card>
                <SectionHeader icon="✏️" title="Add to Previous Day" />
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {['Yesterday', '2 days ago', '3 days ago'].map((label, i) => (
                    <button key={i} onClick={() => addToPreviousDay(i + 1)}
                      style={{
                        padding: '8px 16px', backgroundColor: 'transparent',
                        border: `1px solid ${T.border}`, borderRadius: '20px',
                        color: T.text, fontSize: '13px', fontWeight: '600', cursor: 'pointer',
                        fontFamily: "'DM Sans', sans-serif"
                      }}>
                      {label}
                    </button>
                  ))}
                </div>
              </Card>
            </>
          )}

          {/* ── WEEKLY TAB ─────────────────────────────────────────────────── */}
          {viewMode === 'weekly' && (
            <>
              <DateNavCard label={formatDateRange()} onPrev={() => navigate(-1)} onNext={() => navigate(1)} />

              {/* Summary Hero */}
              {stats.days > 0 && (
                <div style={{
                  background: 'linear-gradient(145deg, #0a0f1e, #111827, #0d0d0d)',
                  borderRadius: 20, border: '1px solid rgba(191,90,242,0.2)',
                  padding: '20px', marginBottom: 16, position: 'relative', overflow: 'hidden'
                }}>
                  <div style={{
                    position: 'absolute', top: -30, right: -30, width: 130, height: 130, borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(191,90,242,0.15) 0%, transparent 70%)',
                    pointerEvents: 'none'
                  }} />
                  <div style={{ fontSize: 11, fontWeight: 700, color: T_PURPLE, letterSpacing: '2px', textTransform: 'uppercase', fontFamily: "'Barlow Condensed', sans-serif", marginBottom: 14, opacity: 0.8 }}>
                    Week Summary
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, textAlign: 'center' }}>
                    <div>
                      <div style={{ fontSize: 36, fontWeight: 900, color: T.text, fontFamily: "'Barlow Condensed', sans-serif", lineHeight: 1 }}>{stats.days}</div>
                      <div style={{ fontSize: 10, color: T.muted, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', marginTop: 4, fontFamily: "'Barlow Condensed', sans-serif" }}>Days Logged</div>
                      <div style={{ fontSize: 10, color: T.muted, marginTop: 2 }}>of 7</div>
                    </div>
                    {metrics.filter(m => m.goal).slice(0, 1).map(m => {
                      const hits = stats.goalAchievement[m.key] || 0
                      return (
                        <div key={m.key}>
                          <div style={{ fontSize: 36, fontWeight: 900, color: hits >= 5 ? T_SUCCESS : hits >= 3 ? T_WARNING : T_DANGER, fontFamily: "'Barlow Condensed', sans-serif", lineHeight: 1 }}>{hits}/7</div>
                          <div style={{ fontSize: 10, color: T.muted, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', marginTop: 4, fontFamily: "'Barlow Condensed', sans-serif" }}>Goal Days</div>
                          <div style={{ fontSize: 10, color: T.muted, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
                        </div>
                      )
                    })}
                    {activeMetric && (
                      <div>
                        <div style={{ fontSize: 36, fontWeight: 900, color: T_PURPLE, fontFamily: "'Barlow Condensed', sans-serif", lineHeight: 1 }}>
                          {(stats.averages[activeMetric.key] || 0).toLocaleString()}
                        </div>
                        <div style={{ fontSize: 10, color: T.muted, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', marginTop: 4, fontFamily: "'Barlow Condensed', sans-serif" }}>Daily Avg</div>
                        <div style={{ fontSize: 10, color: T.muted, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeMetric.unit}/day</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Day Goal Grid */}
              {metrics.some(m => m.goal) && (
                <Card>
                  <SectionHeader icon="🗓️" title="Day-by-Day Goal Tracker" />
                  <DayGoalGrid history={history} metrics={metrics} dateRange={weekStart} />
                </Card>
              )}

              {/* Water week bars */}
              {filteredHistory.length > 0 && (
                <Card>
                  <SectionHeader icon="💧" title="Hydration This Week" />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {Array.from({ length: 7 }, (_, i) => {
                      const d = new Date(weekStart); d.setDate(d.getDate() + i)
                      const dateStr = toLocalDateStr(d)
                      const dayData = history.find(h => normDate(h.date) === dateStr)
                      const oz = dayData?.water || 0
                      const pct = waterGoal > 0 ? Math.min(oz / waterGoal, 1) : oz > 0 ? Math.min(oz / 64, 1) : 0
                      const isToday = dateStr === toLocalDateStr(new Date())
                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 28, fontSize: 10, color: isToday ? T_ACCENT : T.muted, fontWeight: isToday ? 700 : 500, fontFamily: "'Barlow Condensed', sans-serif", flexShrink: 0, textAlign: 'right' }}>
                            {d.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 2)}
                          </div>
                          <div style={{ flex: 1, height: 8, backgroundColor: T.faint, borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct * 100}%`, borderRadius: 4, backgroundColor: pct >= 1 ? T_SUCCESS : T_ACCENT, transition: 'width 0.3s' }} />
                          </div>
                          <div style={{ width: 42, fontSize: 11, color: oz > 0 ? T.text : T.muted, fontWeight: 600, textAlign: 'right', flexShrink: 0 }}>
                            {oz > 0 ? `${oz} oz` : '—'}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, textAlign: 'center', marginTop: 14, paddingTop: 14, borderTop: `1px solid ${T.border}` }}>
                    <div>
                      <div style={{ fontSize: '22px', fontWeight: '700', color: T.text, fontFamily: "'Barlow Condensed', sans-serif" }}>
                        {filteredHistory.reduce((s, d) => s + (d.water || 0), 0)}
                      </div>
                      <div style={{ fontSize: '11px', color: T.muted, marginTop: 2 }}>Total oz</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '22px', fontWeight: '700', color: T.text, fontFamily: "'Barlow Condensed', sans-serif" }}>
                        {filteredHistory.length > 0 ? Math.round(filteredHistory.reduce((s, d) => s + (d.water || 0), 0) / filteredHistory.length) : 0}
                      </div>
                      <div style={{ fontSize: '11px', color: T.muted, marginTop: 2 }}>Avg/day oz</div>
                    </div>
                  </div>
                </Card>
              )}

              {/* Bar chart */}
              {metrics.length > 0 && (
                <Card>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <SectionHeader icon="📊" title="Day by Day" />
                    {metrics.length > 1 && (
                      <select value={chartMetricKey || ''} onChange={e => setChartMetricKey(e.target.value)}
                        style={{ fontSize: '12px', padding: '6px 10px', border: `1px solid ${T.border}`, borderRadius: '8px', color: T.muted, backgroundColor: T.card2, outline: 'none' }}>
                        {metrics.map(m => <option key={m.key} value={m.key}>{m.icon} {m.name}</option>)}
                      </select>
                    )}
                  </div>
                  <BarChart bars={getWeeklyBars()} goal={activeMetric?.goal} />
                  {(() => {
                    const insight = getWeeklyInsight()
                    return insight ? (
                      <div style={{ marginTop: '12px', padding: '10px 14px', backgroundColor: 'rgba(10,132,255,0.1)', border: '1px solid rgba(10,132,255,0.25)', borderRadius: '10px', fontSize: '12px', color: T_ACCENT, fontWeight: '500' }}>
                        💡 {insight}
                      </div>
                    ) : null
                  })()}
                </Card>
              )}

              {/* Meal Timing */}
              {metrics.length > 0 && (
                <Card>
                  <SectionHeader icon="🍽️" title="Meal Timing Patterns" />
                  <TimeOfDayChart filteredHistory={filteredHistory} metrics={metrics} />
                </Card>
              )}
            </>
          )}

          {/* ── MONTHLY TAB ─────────────────────────────────────────────────── */}
          {viewMode === 'monthly' && (
            <>
              <DateNavCard label={formatDateRange()} onPrev={() => navigate(-1)} onNext={() => navigate(1)} />

              {/* Consistency Hero */}
              {(() => {
                const totalDays = Math.round((monthEnd - monthStart) / 86400000) + 1
                const consistency = totalDays > 0 ? Math.round((filteredHistory.length / totalDays) * 100) : 0
                return (
                  <div style={{
                    background: 'linear-gradient(145deg, #0f1a0a, #162010, #0d0d0d)',
                    borderRadius: 20, border: '1px solid rgba(48,209,88,0.2)',
                    padding: '24px 20px', marginBottom: 16, position: 'relative', overflow: 'hidden'
                  }}>
                    <div style={{
                      position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: '50%',
                      background: 'radial-gradient(circle, rgba(48,209,88,0.15) 0%, transparent 70%)',
                      pointerEvents: 'none'
                    }} />
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(48,209,88,0.7)', letterSpacing: '2px', textTransform: 'uppercase', fontFamily: "'Barlow Condensed', sans-serif", marginBottom: 6 }}>
                      Consistency
                    </div>
                    <div style={{ fontSize: 56, fontWeight: 900, color: consistency >= 80 ? T_SUCCESS : consistency >= 50 ? T_WARNING : T_DANGER, fontFamily: "'Barlow Condensed', sans-serif", lineHeight: 1, marginBottom: 6 }}>
                      {consistency}%
                    </div>
                    <div style={{ fontSize: 13, color: T.muted }}>
                      {filteredHistory.length} of {totalDays} days logged
                    </div>
                    {(() => {
                      const insight = getMonthlyInsight()
                      return insight ? (
                        <div style={{ marginTop: 14, padding: '10px 14px', backgroundColor: 'rgba(10,132,255,0.1)', border: '1px solid rgba(10,132,255,0.25)', borderRadius: '10px', fontSize: '12px', color: T_ACCENT, fontWeight: '500' }}>
                          💡 {insight}
                        </div>
                      ) : null
                    })()}
                  </div>
                )
              })()}

              {/* Best vs Worst Weeks */}
              {filteredHistory.length > 0 && metrics.length > 0 && (
                <Card>
                  <SectionHeader icon="🏆" title="Best vs Worst Weeks" />
                  <BestWorstWeeks history={history} metrics={metrics} monthStart={monthStart} monthEnd={monthEnd} />
                </Card>
              )}

              {/* Monthly averages grid */}
              {metrics.length > 0 && stats.days > 0 && (
                <Card>
                  <SectionHeader icon="📊" title="Monthly Averages" />
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                    {metrics.map((metric, i) => (
                      <div key={metric.key} style={{
                        padding: '14px', backgroundColor: T.card2, border: `1px solid ${T.border}`,
                        borderRadius: '12px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                            backgroundColor: `${metric.color || FALLBACK_COLORS[i % FALLBACK_COLORS.length]}20`,
                            border: `1px solid ${metric.color || FALLBACK_COLORS[i % FALLBACK_COLORS.length]}40`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14
                          }}>
                            {metric.icon || '📊'}
                          </div>
                          <span style={{ fontSize: '12px', color: T.muted, fontWeight: '600', letterSpacing: '0.5px' }}>{metric.name}</span>
                        </div>
                        <div style={{ fontSize: '26px', fontWeight: '900', color: T.text, lineHeight: 1, fontFamily: "'Barlow Condensed', sans-serif" }}>
                          {(stats.averages[metric.key] || 0).toLocaleString()}
                          <span style={{ fontSize: '12px', color: T.muted, fontWeight: '500', marginLeft: 4 }}>{metric.unit}/day</span>
                        </div>
                        {metric.goal && (
                          <div style={{ fontSize: '11px', color: T.muted, marginTop: 4 }}>
                            Goal: {metric.goal.toLocaleString()}{metric.unit}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Bar chart with granularity toggle */}
              {metrics.length > 0 && (
                <Card>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                    <SectionHeader icon={activeMetric?.icon || '📊'} title={activeMetric?.name || 'Metric'} />
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      {metrics.length > 1 && (
                        <select value={chartMetricKey || ''} onChange={e => setChartMetricKey(e.target.value)}
                          style={{ fontSize: '12px', padding: '6px 10px', border: `1px solid ${T.border}`, borderRadius: '8px', color: T.muted, backgroundColor: T.card2, outline: 'none' }}>
                          {metrics.map(m => <option key={m.key} value={m.key}>{m.icon} {m.name}</option>)}
                        </select>
                      )}
                      <div style={{ display: 'flex', backgroundColor: T.card2, borderRadius: '8px', padding: '2px', border: `1px solid ${T.border}` }}>
                        {[['daily', '30 Day'], ['weekly', '4 Week']].map(([g, label]) => (
                          <button key={g} onClick={() => setMonthlyGranularity(g)}
                            style={{
                              padding: '5px 10px', fontSize: '11px', fontWeight: monthlyGranularity === g ? '700' : '400',
                              backgroundColor: monthlyGranularity === g ? T_ACCENT : 'transparent',
                              border: 'none', borderRadius: '6px',
                              color: monthlyGranularity === g ? '#fff' : T.muted, cursor: 'pointer',
                              fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.5px'
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
                    <div style={{ marginTop: '8px', fontSize: '11px', color: T.muted, textAlign: 'center' }}>
                      Showing daily avg per week
                    </div>
                  )}
                </Card>
              )}

              {/* Meal Timing for the month */}
              {metrics.length > 0 && filteredHistory.length > 0 && (
                <Card>
                  <SectionHeader icon="🍽️" title="Meal Timing Patterns" />
                  <TimeOfDayChart filteredHistory={filteredHistory} metrics={metrics} />
                </Card>
              )}

              {/* Long-term streak */}
              <div style={{
                background: 'linear-gradient(135deg, #28180a, #3a2810)',
                border: '1px solid rgba(255,159,10,0.3)',
                borderRadius: 16, padding: '18px', marginBottom: 16
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,159,10,0.7)', letterSpacing: '2px', textTransform: 'uppercase', fontFamily: "'Barlow Condensed', sans-serif", marginBottom: 6 }}>
                      Current Tracking Streak
                    </div>
                    <div style={{ fontSize: 48, fontWeight: 900, color: streaks.trackingStreak > 0 ? T_WARNING : T.muted, fontFamily: "'Barlow Condensed', sans-serif", lineHeight: 1 }}>
                      {streaks.trackingStreak > 0 ? '🔥' : ''} {streaks.trackingStreak}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,159,10,0.6)', letterSpacing: '2px', textTransform: 'uppercase', fontFamily: "'Barlow Condensed', sans-serif", marginTop: 4 }}>
                      DAY STREAK
                    </div>
                  </div>
                  <div style={{ fontSize: 56, opacity: 0.12 }}>🔥</div>
                </div>
              </div>
            </>
          )}

        </div>
      </div>
    </ThemeContext.Provider>
  )
}
