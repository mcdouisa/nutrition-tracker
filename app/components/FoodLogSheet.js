'use client'

// One-step food logging: search (or scan) a food, pick how much, and every metric updates at once.

import { useEffect, useRef, useState } from 'react'
import { BarcodeScanner } from '../ai-chat-modal'
import { DONE, DONE_INK, FONT } from '../../lib/theme'
import { ChevronLeftIcon, CloseIcon } from '../../lib/icons'

const fmt = (n) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 1 })
const PORTIONS = [0.5, 1, 1.5, 2]
const portionLabel = (q) => q === 0.5 ? '½' : q === 1.5 ? '1½' : String(q)

export function SearchIcon({ size = 20 }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
    </svg>
  )
}

// metrics: today's metric list (with value); onLog({ name, serving, estimates })
// startWith: 'search' | 'scan' — which step opens first
export default function FoodLogSheet({ T, metrics, startWith = 'search', onLog, onDescribe, onClose }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [status, setStatus] = useState('idle') // idle | loading | done | error
  const [errorMsg, setErrorMsg] = useState('')
  const [food, setFood] = useState(null) // { name, serving, values }
  const [qty, setQty] = useState(1)
  const [customQty, setCustomQty] = useState('') // typed servings, e.g. "3" or "0.75"
  const [edits, setEdits] = useState({}) // per-serving values the user typed in, by metric key
  const [scanning, setScanning] = useState(startWith === 'scan')
  const inputRef = useRef(null)
  const requestRef = useRef(0)
  // The search only needs metric definitions; keep a stable key so parent re-renders don't re-search
  const metricsRef = useRef(metrics)
  metricsRef.current = metrics
  const metricsKey = metrics.map(m => m.key).join(',')

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Search as you type (debounced); only the latest request is allowed to land
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) { requestRef.current++; setResults([]); setStatus('idle'); return }
    const id = ++requestRef.current
    setStatus('loading')
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/food-search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: q, metrics: metricsRef.current.map(({ key, name, unit }) => ({ key, name, unit })) })
        })
        const data = await res.json()
        if (id !== requestRef.current) return
        if (!res.ok) throw new Error(data.error || 'Search failed')
        setResults(data.results || [])
        setStatus('done')
      } catch (err) {
        if (id !== requestRef.current) return
        setErrorMsg(err.message || 'Could not search right now.')
        setStatus('error')
      }
    }, 450)
    return () => clearTimeout(timer)
  }, [query, metricsKey])

  const pick = (f) => { setFood(f); setQty(1); setCustomQty(''); setEdits({}) }

  // Per-serving value: what the user typed, else the suggestion
  const perServing = (key) => {
    if (edits[key] !== undefined) {
      const n = parseFloat(edits[key])
      return Number.isFinite(n) && n > 0 ? n : 0
    }
    return food?.values[key] || 0
  }
  const edited = Object.keys(edits).length > 0

  const confirm = () => {
    const estimates = {}
    const values = {}
    metrics.forEach(m => {
      values[m.key] = perServing(m.key)
      const v = values[m.key] * qty
      if (v) estimates[m.key] = Math.round(v * 10) / 10
    })
    // Remember the corrected values, so "Eaten before" logs the label's numbers next time
    onLog({ name: food.name, serving: qty === 1 ? food.serving : `${fmt(qty)} × ${food.serving}`, estimates, base: { ...food, values } })
  }

  const primary = metrics[0]
  const sheetText = { fontFamily: FONT, color: T.text }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1200, ...sheetText }}>
      <button aria-label="Close" onClick={onClose} style={{ position: 'absolute', inset: 0, width: '100%', border: 'none', background: 'rgba(0,0,0,0.55)', cursor: 'default' }} />

      <div role="dialog" aria-modal="true" aria-label="Log food" style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, margin: '0 auto', maxWidth: '600px',
        height: 'min(86vh, 680px)', boxSizing: 'border-box',
        display: 'flex', flexDirection: 'column', gap: '14px',
        padding: '10px 16px calc(20px + env(safe-area-inset-bottom))',
        borderRadius: '24px 24px 0 0', backgroundColor: T.card
      }}>
        <div aria-hidden="true" style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: T.border, alignSelf: 'center', flexShrink: 0 }} />

        {!food ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, height: 52, padding: '0 14px', borderRadius: 16, backgroundColor: T.card2, color: T.muted }}>
                <SearchIcon size={18} />
                <input
                  ref={inputRef}
                  autoFocus={startWith !== 'scan'}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="What did you eat?"
                  aria-label="What did you eat?"
                  enterKeyHint="search"
                  style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'none', color: T.text, fontSize: 17, fontFamily: FONT }}
                />
              </label>
              <button onClick={() => setScanning(true)} aria-label="Scan a barcode" style={{ width: 52, height: 52, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', borderRadius: 16, backgroundColor: T.card2, color: T.text, cursor: 'pointer' }}>
                <BarcodeGlyph />
              </button>
            </div>

            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {status === 'idle' && (
                <span style={{ fontSize: 14, color: T.muted, lineHeight: 1.5 }}>
                  Type a food, like "greek yogurt" or "chipotle burrito bowl". Pick the closest match and all your totals update at once.
                </span>
              )}
              {status === 'loading' && [0, 1, 2].map(i => (
                <div key={i} aria-hidden="true" style={{ height: 70, borderRadius: 16, backgroundColor: T.card2, opacity: 0.6 - i * 0.15 }} />
              ))}
              {status === 'loading' && <span role="status" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden' }}>Searching</span>}
              {status === 'error' && <span role="alert" style={{ fontSize: 14, color: T.muted }}>{errorMsg}</span>}
              {status === 'done' && results.length === 0 && (
                <span style={{ fontSize: 14, color: T.muted }}>No matches. Try different words, or describe it below.</span>
              )}
              {status === 'done' && results.map((r, i) => (
                <button key={i} onClick={() => pick(r)} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '14px 16px', border: 'none', borderRadius: 16, backgroundColor: T.card2, color: T.text, textAlign: 'left', cursor: 'pointer', fontFamily: FONT }}>
                  <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, width: '100%' }}>
                    <span style={{ fontSize: 15, fontWeight: 500 }}>{r.name}</span>
                    <span style={{ fontSize: 13, color: T.muted, whiteSpace: 'nowrap' }}>{r.serving}</span>
                  </span>
                  <span style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', fontSize: 13, color: T.soft }}>
                    {metrics.slice(0, 4).map(m => (
                      <span key={m.key}>{fmt(r.values[m.key])}{m.unit ? ` ${m.unit}` : ''} {m.name.toLowerCase()}</span>
                    ))}
                  </span>
                </button>
              ))}
            </div>

            <button onClick={() => onDescribe(query)} style={{ height: 48, flexShrink: 0, border: `1px dashed ${T.border}`, borderRadius: 14, background: 'none', color: T.muted, fontSize: 14, cursor: 'pointer', fontFamily: FONT }}>
              Not listed? Describe it or snap a photo
            </button>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button onClick={() => setFood(null)} aria-label="Back to results" style={{ width: 36, height: 44, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'none', color: T.muted, cursor: 'pointer' }}>
                <ChevronLeftIcon size={20} strokeWidth={2} />
              </button>
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span style={{ fontSize: 18, fontWeight: 500 }}>{food.name}</span>
                <span style={{ fontSize: 13, color: T.muted }}>{food.serving} per serving</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 13, color: T.muted }}>How much?</span>
              <div role="group" aria-label="Servings" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 6 }}>
                {PORTIONS.map(q => {
                  const on = q === qty && customQty === ''
                  return (
                    <button key={q} onClick={() => { setQty(q); setCustomQty('') }} aria-pressed={on} style={{
                      height: 44, border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 500, cursor: 'pointer', fontFamily: FONT,
                      backgroundColor: on ? T.text : T.card2, color: on ? T.bg : T.soft
                    }}>
                      {portionLabel(q)}
                    </button>
                  )
                })}
                <input
                  value={customQty}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^0-9.]/g, '')
                    setCustomQty(v)
                    const n = parseFloat(v)
                    if (Number.isFinite(n) && n > 0) setQty(n)
                    else if (v === '') setQty(1)
                  }}
                  inputMode="decimal"
                  placeholder="Other"
                  aria-label="Number of servings"
                  style={{
                    height: 44, minWidth: 0, width: '100%', boxSizing: 'border-box', borderRadius: 12, textAlign: 'center',
                    fontSize: 15, fontWeight: 500, fontFamily: FONT,
                    border: customQty !== '' ? `2px solid ${T.text}` : 'none',
                    backgroundColor: T.card2, color: T.text
                  }}
                />
              </div>
            </div>

            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 13, color: T.muted }}>Per serving · tap a number to match your label</span>
                {edited && (
                  <button onClick={() => setEdits({})} style={{ border: 'none', background: 'none', padding: '6px 0', color: T.soft, fontSize: 13, cursor: 'pointer', fontFamily: FONT, textDecoration: 'underline' }}>
                    Reset
                  </button>
                )}
              </div>
              <div style={{ borderRadius: 18, backgroundColor: T.card2, overflow: 'hidden', flexShrink: 0 }}>
                {metrics.map((m, i) => {
                  const per = perServing(m.key)
                  const add = per * qty
                  const unit = m.unit ? ` ${m.unit}` : ''
                  const changed = edits[m.key] !== undefined
                  return (
                    <div key={m.key} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 56, padding: '0 8px 0 16px', borderTop: i ? `1px solid ${T.border}` : 'none' }}>
                      <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, backgroundColor: T.hues[i % T.hues.length] }} />
                      <label htmlFor={`food-${m.key}`} style={{ fontSize: 15, flex: 1, minWidth: 0 }}>{m.name}</label>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <input
                          id={`food-${m.key}`}
                          value={changed ? edits[m.key] : fmt(per).replace(/,/g, '')}
                          onChange={(e) => setEdits({ ...edits, [m.key]: e.target.value.replace(/[^0-9.]/g, '') })}
                          onFocus={(e) => e.target.select()}
                          inputMode="decimal"
                          style={{
                            width: 76, height: 40, boxSizing: 'border-box', padding: '0 10px', borderRadius: 10, textAlign: 'right',
                            fontSize: 16, fontWeight: 500, fontFamily: FONT, color: T.text,
                            backgroundColor: T.card, border: `1px solid ${changed ? T.text : T.border}`
                          }}
                        />
                        <span style={{ width: 22, fontSize: 13, color: T.muted }}>{m.unit}</span>
                      </span>
                      <span style={{ fontSize: 13, color: T.muted, minWidth: 74, textAlign: 'right' }}>→ {fmt((m.value || 0) + add)}{unit}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            <button onClick={confirm} style={{ height: 56, flexShrink: 0, border: 'none', borderRadius: 16, backgroundColor: DONE, color: DONE_INK, fontSize: 16, fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>
              Add{primary ? ` · ${fmt(perServing(primary.key) * qty)}${primary.unit ? ` ${primary.unit}` : ''} ${primary.name.toLowerCase()}` : ''}
            </button>
          </>
        )}

        <button onClick={onClose} aria-label="Close" style={{ position: 'absolute', top: 8, right: 8, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'none', color: T.muted, cursor: 'pointer' }}>
          <CloseIcon size={18} strokeWidth={2} />
        </button>
      </div>

      {scanning && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1300 }}>
          <BarcodeScanner
            metrics={metrics}
            onClose={() => { setScanning(false); if (startWith === 'scan' && !food) onClose() }}
            onResult={({ name, brand, servingSize, estimates }) => {
              setScanning(false)
              pick({ name: brand ? `${brand} ${name}` : name, serving: servingSize || '1 serving', values: estimates })
            }}
          />
        </div>
      )}
    </div>
  )
}

function BarcodeGlyph() {
  return (
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M4 7V5h3M17 5h3v2M20 17v2h-3M7 19H4v-2M8 9v6M11 9v6M14 9v6M17 9v6" />
    </svg>
  )
}
