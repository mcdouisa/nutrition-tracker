'use client'

// One-step food logging. Type one food or a whole meal, scan a barcode, or snap a photo;
// adjust servings and label values; every metric updates at once.

import { useEffect, useRef, useState } from 'react'
import { BarcodeScanner } from '../ai-chat-modal'
import { DONE, DONE_INK, FONT } from '../../lib/theme'
import { ChevronLeftIcon, CloseIcon, PlusIcon } from '../../lib/icons'

const fmt = (n) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 1 })
const round1 = (n) => Math.round(n * 10) / 10

export function SearchIcon({ size = 20 }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
    </svg>
  )
}

// Shrink a photo before upload; labels stay legible at ~1400px
export function compressPhoto(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = (e) => {
      const img = new Image()
      img.onerror = reject
      img.onload = () => {
        const MAX = 1400
        let w = img.width, h = img.height
        if (w > MAX || h > MAX) {
          if (w > h) { h = Math.round(h * MAX / w); w = MAX } else { w = Math.round(w * MAX / h); h = MAX }
        }
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        canvas.getContext('2d').drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', 0.85))
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })
}

// Where a food's numbers came from, shown wherever the numbers are
export const SOURCE_LABEL = {
  ai: 'AI estimate',
  photo: 'AI estimate from photo',
  barcode: 'From barcode',
  edited: 'Your numbers',
}

const toItem = (r, source = 'ai') => ({
  name: r.name, serving: r.serving, values: { ...r.values }, original: { ...r.values },
  qty: r.servings > 0 ? r.servings : 1, source: r.source || source
})

// Numbers the person changed are theirs, whatever the original source
const sourceOf = (it) => Object.keys(it.values).some(k => (it.values[k] || 0) !== (it.original[k] || 0)) ? 'edited' : it.source

// ── B: same search, same numbers ──
// Answers are remembered on the device for 30 days, keyed by the search and the tracked metrics
const CACHE_KEY = 'lytz-food-search-cache'
const CACHE_DAYS = 30
const CACHE_MAX = 150
const cacheKey = (q, metricsKey) => `${q.trim().toLowerCase().replace(/\s+/g, ' ')}|${metricsKey}`
function readCache(key) {
  try {
    const all = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}')
    const hit = all[key]
    if (hit && Date.now() - hit.at < CACHE_DAYS * 864e5) return hit.data
  } catch {}
  return null
}
function writeCache(key, data) {
  try {
    const all = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}')
    all[key] = { at: Date.now(), data }
    const keys = Object.keys(all)
    if (keys.length > CACHE_MAX) {
      keys.sort((a, b) => all[a].at - all[b].at).slice(0, keys.length - CACHE_MAX).forEach(k => delete all[k])
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(all))
  } catch {}
}

// metrics: today's metric list (with value)
// onLog({ name, estimates, foods }) — foods are the items with their per-serving values, for "Eaten before"
// startWith: 'search' | 'scan' | 'photo' (photo: the data URL to read)
export default function FoodLogSheet({ T, metrics, startWith = 'search', photo, onLog, onDescribe, onClose }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [mealMatch, setMealMatch] = useState(null) // whole-meal reading of what was typed
  const [status, setStatus] = useState('idle') // idle | loading | done | error
  const [errorMsg, setErrorMsg] = useState('')
  const [items, setItems] = useState([]) // the plate being logged
  const [view, setView] = useState(startWith === 'photo' ? 'photo' : 'search') // search | item | meal | photo
  const [editIndex, setEditIndex] = useState(0)
  const [scanning, setScanning] = useState(startWith === 'scan')
  const requestRef = useRef(0)
  const metricsRef = useRef(metrics)
  metricsRef.current = metrics
  const metricsKey = metrics.map(m => m.key).join(',')
  const metricDefs = () => metricsRef.current.map(({ key, name, unit }) => ({ key, name, unit }))

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Search as you type (debounced); only the latest request may land
  useEffect(() => {
    if (view !== 'search') return
    const q = query.trim()
    if (q.length < 2) { requestRef.current++; setResults([]); setMealMatch(null); setStatus('idle'); return }
    const id = ++requestRef.current
    const key = cacheKey(q, metricsKey)
    const cached = readCache(key)
    if (cached) {
      setResults(cached.results || [])
      setMealMatch(cached.meal || null)
      setStatus('done')
      return
    }
    setStatus('loading')
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/food-search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: q, metrics: metricDefs() })
        })
        const data = await res.json()
        if (id !== requestRef.current) return
        if (!res.ok) throw new Error(data.error || 'Search failed')
        writeCache(key, { results: data.results || [], meal: data.meal || null })
        setResults(data.results || [])
        setMealMatch(data.meal || null)
        setStatus('done')
      } catch (err) {
        if (id !== requestRef.current) return
        setErrorMsg(err.message || 'Could not search right now.')
        setStatus('error')
      }
    }, 550)
    return () => clearTimeout(timer)
  }, [query, metricsKey, view])

  // Read a photo once, straight into the plate
  useEffect(() => {
    if (startWith !== 'photo' || !photo) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/food-search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: photo, metrics: metricDefs() })
        })
        const data = await res.json()
        if (cancelled) return
        if (!res.ok) throw new Error(data.error || 'Could not read that photo')
        const found = data.meal?.items || data.results || []
        if (!found.length) throw new Error("Couldn't spot any food in that photo. Try again closer, or type what it is.")
        showPlate(found.map(r => toItem(r, 'photo')))
      } catch (err) {
        if (cancelled) return
        setErrorMsg(err.message || 'Could not read that photo')
        setStatus('error')
      }
    })()
    return () => { cancelled = true }
  }, [startWith, photo])

  const showPlate = (plate) => {
    setItems(plate)
    if (plate.length === 1) { setEditIndex(0); setView('item') } else setView('meal')
  }

  // Picking a match: first food opens it; with a plate started, it joins the meal
  const pick = (r, source = 'ai') => {
    const next = [...items, toItem(r, source)]
    setQuery('')
    if (next.length === 1) showPlate(next)
    else { setItems(next); setView('meal') }
  }

  const updateItem = (i, patch) => setItems(prev => prev.map((it, k) => k === i ? { ...it, ...patch } : it))
  const removeItem = (i) => {
    const next = items.filter((_, k) => k !== i)
    if (next.length === 0) { setItems([]); setView('search') }
    else if (next.length === 1) showPlate(next)
    else setItems(next)
  }

  const totals = (list) => Object.fromEntries(metrics.map(m => [m.key, round1(list.reduce((s, it) => s + (it.values[m.key] || 0) * it.qty, 0))]))

  const logPlate = () => {
    const sum = totals(items)
    const estimates = Object.fromEntries(Object.entries(sum).filter(([, v]) => v > 0))
    const names = items.map(it => it.name)
    const name = names.length <= 2 ? names.join(' + ') : `${names.slice(0, 2).join(', ')} + ${names.length - 2} more`
    onLog({
      name,
      estimates,
      foods: items.map(it => ({
        name: it.name,
        serving: it.serving,
        values: it.values,
        source: sourceOf(it),
        estimates: Object.fromEntries(metrics
          .map(m => [m.key, round1((it.values[m.key] || 0) * it.qty)])
          .filter(([, v]) => v > 0))
      }))
    })
  }

  const primary = metrics[0]
  const addLabel = (list) => primary ? ` · ${fmt(totals(list)[primary.key])}${primary.unit ? ` ${primary.unit}` : ''} ${primary.name.toLowerCase()}` : ''

  const btn = { border: 'none', cursor: 'pointer', fontFamily: FONT }
  const primaryBtn = { ...btn, height: 56, flexShrink: 0, borderRadius: 16, backgroundColor: DONE, color: DONE_INK, fontSize: 16, fontWeight: 600 }
  const ghostBtn = { ...btn, height: 48, flexShrink: 0, borderRadius: 14, background: 'none', border: `1px dashed ${T.border}`, color: T.soft, fontSize: 14 }

  const item = items[editIndex]

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1200, fontFamily: FONT, color: T.text }}>
      <button aria-label="Close" onClick={onClose} style={{ position: 'absolute', inset: 0, width: '100%', border: 'none', background: 'rgba(0,0,0,0.55)', cursor: 'default' }} />

      <div role="dialog" aria-modal="true" aria-label="Log food" style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, margin: '0 auto', maxWidth: '600px',
        height: 'min(88vh, 720px)', boxSizing: 'border-box',
        display: 'flex', flexDirection: 'column', gap: '14px',
        padding: '10px 16px calc(20px + env(safe-area-inset-bottom))',
        borderRadius: '24px 24px 0 0', backgroundColor: T.card
      }}>
        <div aria-hidden="true" style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: T.border, alignSelf: 'center', flexShrink: 0 }} />

        {/* ── Photo being read ─────────────────────────────────────────── */}
        {view === 'photo' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
            {photo && <img src={photo} alt="Your photo" style={{ width: 160, height: 160, objectFit: 'cover', borderRadius: 20 }} />}
            {status !== 'error' ? (
              <span role="status" style={{ fontSize: 16, color: T.soft }}>Reading your photo…</span>
            ) : (
              <>
                <span role="alert" style={{ fontSize: 15, color: T.soft, maxWidth: 300, lineHeight: 1.5 }}>{errorMsg}</span>
                <button onClick={() => { setStatus('idle'); setView('search') }} style={{ ...primaryBtn, height: 48, padding: '0 20px' }}>Type it instead</button>
              </>
            )}
          </div>
        )}

        {/* ── Search ──────────────────────────────────────────────────── */}
        {view === 'search' && (
          <>
            {items.length > 0 && (
              <button onClick={() => setView(items.length === 1 ? 'item' : 'meal')} style={{ ...btn, display: 'flex', alignItems: 'center', gap: 4, alignSelf: 'flex-start', background: 'none', color: T.soft, fontSize: 14, padding: '4px 0' }}>
                <ChevronLeftIcon size={18} strokeWidth={2} /> Back to your meal ({items.length})
              </button>
            )}
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 52, padding: '0 14px', marginRight: items.length ? 0 : 44, borderRadius: 16, backgroundColor: T.card2, color: T.muted }}>
              <SearchIcon size={18} />
              <input
                autoFocus={startWith === 'search'}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={items.length ? 'Add another food' : 'What did you eat?'}
                aria-label="What did you eat?"
                enterKeyHint="search"
                style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'none', color: T.text, fontSize: 17, fontFamily: FONT }}
              />
            </label>

            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {status === 'idle' && (
                <span style={{ fontSize: 14, color: T.muted, lineHeight: 1.5 }}>
                  Type one food, like "greek yogurt", or your whole meal, like "2 eggs, toast with butter and a coffee". You can change amounts before adding.
                </span>
              )}
              {status === 'loading' && [0, 1, 2].map(i => (
                <div key={i} aria-hidden="true" style={{ height: 70, flexShrink: 0, borderRadius: 16, backgroundColor: T.card2, opacity: 0.6 - i * 0.15 }} />
              ))}
              {status === 'loading' && <span role="status" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden' }}>Searching</span>}
              {status === 'error' && <span role="alert" style={{ fontSize: 14, color: T.muted }}>{errorMsg}</span>}
              {status === 'done' && !mealMatch && results.length === 0 && (
                <span style={{ fontSize: 14, color: T.muted }}>No matches. Try different words.</span>
              )}

              {status === 'done' && mealMatch && (
                <button onClick={() => showPlate([...items, ...mealMatch.items.map(r => toItem(r, 'ai'))])} style={{ ...btn, display: 'flex', flexDirection: 'column', gap: 8, padding: '16px', borderRadius: 16, backgroundColor: T.card2, color: T.text, textAlign: 'left', flexShrink: 0 }}>
                  <span style={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: 8 }}>
                    <span style={{ fontSize: 15, fontWeight: 600 }}>Your meal · {mealMatch.items.length} {mealMatch.items.length === 1 ? 'food' : 'foods'}</span>
                    {primary && <span style={{ fontSize: 14, color: T.soft, whiteSpace: 'nowrap' }}>{fmt(totals(mealMatch.items.map(r => toItem(r, 'ai')))[primary.key])} {primary.name.toLowerCase()}</span>}
                  </span>
                  {mealMatch.items.map((it, i) => (
                    <span key={i} style={{ fontSize: 14, color: T.soft }}>
                      {it.servings !== 1 ? `${fmt(it.servings)} × ` : ''}{it.name} <span style={{ color: T.muted }}>· {it.serving}</span>
                    </span>
                  ))}
                  <span style={{ fontSize: 13, color: T.muted }}>AI estimates · you can change any number</span>
                  <span style={{ fontSize: 13, color: DONE, marginTop: 2 }}>Review and add all</span>
                </button>
              )}

              {status === 'done' && results.map((r, i) => (
                <button key={i} onClick={() => pick(r)} style={{ ...btn, display: 'flex', flexDirection: 'column', gap: 6, padding: '14px 16px', borderRadius: 16, backgroundColor: T.card2, color: T.text, textAlign: 'left', flexShrink: 0 }}>
                  <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, width: '100%' }}>
                    <span style={{ fontSize: 15, fontWeight: 500 }}>{r.name}</span>
                    <span style={{ fontSize: 13, color: T.muted, whiteSpace: 'nowrap' }}>{r.serving}</span>
                  </span>
                  <span style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', fontSize: 13, color: T.soft }}>
                    {metrics.slice(0, 4).map(m => (
                      <span key={m.key}>{fmt(r.values[m.key])}{m.unit ? ` ${m.unit}` : ''} {m.name.toLowerCase()}</span>
                    ))}
                  </span>
                  <span style={{ fontSize: 12, color: T.muted }}>{SOURCE_LABEL.ai}</span>
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button onClick={() => setScanning(true)} style={{ ...ghostBtn, flex: 1 }}>Scan barcode</button>
              <button onClick={() => onDescribe(query)} style={{ ...ghostBtn, flex: 1 }}>Ask AI</button>
            </div>
          </>
        )}

        {/* ── One food: servings + label values ───────────────────────── */}
        {view === 'item' && item && (
          <>
            <Header T={T} title={item.name} subtitle={`${item.serving} per serving · ${SOURCE_LABEL[sourceOf(item)]}`} onBack={() => {
              if (items.length > 1) setView('meal')
              else { setItems([]); setView('search') }
            }} />

            <Stepper T={T} value={item.qty} onChange={(qty) => updateItem(editIndex, { qty })} />

            <ValueList T={T} metrics={metrics} item={item}
              onChange={(values) => updateItem(editIndex, { values })}
              onReset={() => updateItem(editIndex, { values: { ...item.original } })} />

            {items.length > 1 ? (
              <button onClick={() => setView('meal')} style={primaryBtn}>Done</button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
                <button onClick={() => setView('search')} style={ghostBtn}>+ Add another food to this meal</button>
                <button onClick={logPlate} style={primaryBtn}>Add{addLabel(items)}</button>
              </div>
            )}
          </>
        )}

        {/* ── Whole meal: every food, adjustable, added together ──────── */}
        {view === 'meal' && (
          <>
            <Header T={T} title="Your meal" subtitle="Tap a food to change its numbers" />

            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {items.map((it, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 8px 8px 14px', borderRadius: 16, backgroundColor: T.card2, flexShrink: 0 }}>
                  <button onClick={() => { setEditIndex(i); setView('item') }} style={{ ...btn, flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2, background: 'none', color: T.text, textAlign: 'left', padding: '6px 0' }}>
                    <span style={{ fontSize: 15, fontWeight: 500 }}>{it.name}</span>
                    <span style={{ fontSize: 13, color: T.muted }}>
                      {it.serving}{primary ? ` · ${fmt((it.values[primary.key] || 0) * it.qty)} ${primary.name.toLowerCase()}` : ''} · {SOURCE_LABEL[sourceOf(it)]}
                    </span>
                  </button>
                  <Stepper T={T} compact value={it.qty} onChange={(qty) => updateItem(i, { qty })} />
                  <button onClick={() => removeItem(i)} aria-label={`Remove ${it.name}`} style={{ ...btn, width: 36, height: 44, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', color: T.muted }}>
                    <CloseIcon size={16} strokeWidth={2} />
                  </button>
                </div>
              ))}
              <button onClick={() => setView('search')} style={{ ...ghostBtn, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <PlusIcon size={16} strokeWidth={2} /> Add another food
              </button>

              <div style={{ marginTop: 6, borderRadius: 18, backgroundColor: T.card2, overflow: 'hidden', flexShrink: 0 }}>
                {metrics.map((m, i) => {
                  const add = totals(items)[m.key]
                  const unit = m.unit ? ` ${m.unit}` : ''
                  return (
                    <div key={m.key} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 48, padding: '0 16px', borderTop: i ? `1px solid ${T.border}` : 'none' }}>
                      <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, backgroundColor: T.hues[i % T.hues.length] }} />
                      <span style={{ fontSize: 15, flex: 1 }}>{m.name}</span>
                      <span style={{ fontSize: 15, fontWeight: 500 }}>+{fmt(add)}{unit}</span>
                      <span style={{ fontSize: 13, color: T.muted, minWidth: 74, textAlign: 'right' }}>→ {fmt((m.value || 0) + add)}{unit}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            <button onClick={logPlate} style={primaryBtn}>Add all{addLabel(items)}</button>
          </>
        )}

        <button onClick={onClose} aria-label="Close" style={{ ...btn, position: 'absolute', top: 8, right: 8, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', color: T.muted }}>
          <CloseIcon size={18} strokeWidth={2} />
        </button>
      </div>

      {scanning && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1300 }}>
          <BarcodeScanner
            metrics={metrics}
            onClose={() => { setScanning(false); if (startWith === 'scan' && items.length === 0) onClose() }}
            onResult={({ name, brand, servingSize, estimates }) => {
              setScanning(false)
              pick({ name: brand ? `${brand} ${name}` : name, serving: servingSize || '1 serving', values: estimates, servings: 1 }, 'barcode')
            }}
          />
        </div>
      )}
    </div>
  )
}

function Header({ T, title, subtitle, onBack }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingRight: 40 }}>
      {onBack && (
        <button onClick={onBack} aria-label="Back" style={{ width: 36, height: 44, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'none', color: T.muted, cursor: 'pointer' }}>
          <ChevronLeftIcon size={20} strokeWidth={2} />
        </button>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, paddingLeft: onBack ? 0 : 4 }}>
        <span style={{ fontSize: 18, fontWeight: 500 }}>{title}</span>
        {subtitle && <span style={{ fontSize: 13, color: T.muted }}>{subtitle}</span>}
      </div>
    </div>
  )
}

// − [servings] +, half steps, no upper limit; the number is typeable too
function Stepper({ T, value, onChange, compact }) {
  const [draft, setDraft] = useState(null)
  const set = (n) => onChange(Math.max(0.25, Math.round(n * 4) / 4))
  const size = compact ? 40 : 52
  const stepBtn = {
    width: size, height: size, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
    border: 'none', borderRadius: compact ? 12 : 16, backgroundColor: compact ? T.card : T.card2, color: T.text,
    fontSize: compact ? 20 : 24, cursor: 'pointer', fontFamily: FONT
  }
  const control = (
    <div role="group" aria-label="Servings" style={{ display: 'flex', alignItems: 'center', gap: compact ? 4 : 8 }}>
      <button onClick={() => set(value - 0.5)} disabled={value <= 0.5} aria-label="Fewer servings" style={{ ...stepBtn, opacity: value <= 0.5 ? 0.35 : 1 }}>−</button>
      <input
        value={draft ?? fmt(value)}
        onFocus={(e) => { setDraft(fmt(value)); e.target.select() }}
        onChange={(e) => {
          const v = e.target.value.replace(/[^0-9.]/g, '')
          setDraft(v)
          const n = parseFloat(v)
          if (Number.isFinite(n) && n > 0) onChange(n)
        }}
        onBlur={() => setDraft(null)}
        inputMode="decimal"
        aria-label="Number of servings"
        style={{
          width: compact ? 44 : 88, height: size, boxSizing: 'border-box', textAlign: 'center', border: 'none', borderRadius: compact ? 12 : 16,
          backgroundColor: compact ? 'transparent' : T.card2, color: T.text, fontSize: compact ? 16 : 24, fontWeight: 500, fontFamily: FONT
        }}
      />
      <button onClick={() => set(value + (value < 1 ? 0.5 : 1))} aria-label="More servings" style={stepBtn}>+</button>
    </div>
  )
  if (compact) return control
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexShrink: 0 }}>
      <span style={{ fontSize: 15, color: T.soft }}>Servings</span>
      {control}
    </div>
  )
}

// Per-serving numbers, each a tappable field so it can match the package label
function ValueList({ T, metrics, item, onChange, onReset }) {
  const [drafts, setDrafts] = useState({})
  const edited = metrics.some(m => (item.values[m.key] || 0) !== (item.original[m.key] || 0))
  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 13, color: T.muted }}>Per serving · tap a number to match your label</span>
        {edited && (
          <button onClick={() => { setDrafts({}); onReset() }} style={{ border: 'none', background: 'none', padding: '6px 0', color: T.soft, fontSize: 13, cursor: 'pointer', fontFamily: FONT, textDecoration: 'underline' }}>
            Reset
          </button>
        )}
      </div>
      <div style={{ borderRadius: 18, backgroundColor: T.card2, overflow: 'hidden', flexShrink: 0 }}>
        {metrics.map((m, i) => {
          const per = item.values[m.key] || 0
          const add = per * item.qty
          const unit = m.unit ? ` ${m.unit}` : ''
          const changed = per !== (item.original[m.key] || 0)
          return (
            <div key={m.key} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 56, padding: '0 8px 0 16px', borderTop: i ? `1px solid ${T.border}` : 'none' }}>
              <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, backgroundColor: T.hues[i % T.hues.length] }} />
              <label htmlFor={`food-${m.key}`} style={{ fontSize: 15, flex: 1, minWidth: 0 }}>{m.name}</label>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <input
                  id={`food-${m.key}`}
                  value={drafts[m.key] ?? String(round1(per))}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^0-9.]/g, '')
                    setDrafts({ ...drafts, [m.key]: v })
                    const n = parseFloat(v)
                    onChange({ ...item.values, [m.key]: Number.isFinite(n) && n > 0 ? n : 0 })
                  }}
                  onBlur={() => setDrafts(({ [m.key]: _, ...rest }) => rest)}
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
  )
}
