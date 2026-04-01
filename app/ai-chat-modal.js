// AI Chat Modal Component (mobile optimized)
import { useRef, useState, useEffect } from 'react'
import { CameraIcon, BarcodeIcon, MicIcon } from '../lib/icons'

// ── Barcode lookup via Open Food Facts (free, no API key) ────────────────────
async function lookupBarcode(barcode, metrics) {
  const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`)
  const data = await res.json()
  if (data.status === 0 || !data.product) return null

  const p = data.product
  const n = p.nutriments || {}

  // Prefer per-serving values, fall back to per-100g
  const get = (key) => {
    const s = n[`${key}_serving`]
    if (s != null && !isNaN(s)) return s
    const h = n[`${key}_100g`]
    if (h != null && !isNaN(h)) return h
    return n[key] ?? null
  }

  // Map common metric keys to Open Food Facts nutriment keys
  const keyMap = {
    // Macros
    calories:       () => n['energy-kcal_serving'] ?? n['energy-kcal_100g'] ?? n['energy-kcal'],
    protein:        () => get('proteins'),
    carbs:          () => get('carbohydrates'),
    fat:            () => get('fat'),
    fiber:          () => get('fiber'),
    sugar:          () => get('sugars'),
    sugars:         () => get('sugars'),
    // Other fats
    saturatedfat:   () => get('saturated-fat'),
    saturated_fat:  () => get('saturated-fat'),
    saturatedFat:   () => get('saturated-fat'),
    transfat:       () => get('trans-fat'),
    trans_fat:      () => get('trans-fat'),
    transFat:       () => get('trans-fat'),
    cholesterol:    () => get('cholesterol'),
    omega3:         () => get('omega-3-fat'),
    'omega-3':      () => get('omega-3-fat'),
    // Minerals (OFF stores in g, convert to mg where needed)
    sodium:         () => { const v = get('sodium');     return v != null ? Math.round(v * 1000) : null },
    calcium:        () => { const v = get('calcium');    return v != null ? Math.round(v * 1000) : null },
    iron:           () => { const v = get('iron');       return v != null ? Math.round(v * 1000) : null },
    magnesium:      () => { const v = get('magnesium');  return v != null ? Math.round(v * 1000) : null },
    phosphorus:     () => { const v = get('phosphorus'); return v != null ? Math.round(v * 1000) : null },
    potassium:      () => { const v = get('potassium');  return v != null ? Math.round(v * 1000) : null },
    zinc:           () => { const v = get('zinc');       return v != null ? Math.round(v * 1000) : null },
    copper:         () => get('copper'),
    manganese:      () => get('manganese'),
    selenium:       () => { const v = get('selenium');   return v != null ? Math.round(v * 1000000) : null }, // g → mcg
    iodine:         () => { const v = get('iodine');     return v != null ? Math.round(v * 1000000) : null },
    chromium:       () => { const v = get('chromium');   return v != null ? Math.round(v * 1000000) : null },
    // Vitamins (OFF stores in g, convert to mcg/mg as appropriate)
    vitaminA:       () => { const v = get('vitamin-a');  return v != null ? Math.round(v * 1000000) : null }, // g → mcg
    vitaminC:       () => { const v = get('vitamin-c');  return v != null ? Math.round(v * 1000) : null },    // g → mg
    vitaminD:       () => { const v = get('vitamin-d');  return v != null ? Math.round(v * 1000000) : null },
    vitaminE:       () => { const v = get('vitamin-e');  return v != null ? Math.round(v * 1000) : null },
    vitaminK:       () => { const v = get('vitamin-k');  return v != null ? Math.round(v * 1000000) : null },
    vitaminB1:      () => { const v = get('vitamin-b1') ?? get('thiamine'); return v != null ? Math.round(v * 1000) : null },
    vitaminB2:      () => { const v = get('vitamin-b2') ?? get('riboflavin'); return v != null ? Math.round(v * 1000) : null },
    vitaminB3:      () => { const v = get('vitamin-b3') ?? get('niacin'); return v != null ? Math.round(v * 1000) : null },
    vitaminB5:      () => { const v = get('vitamin-b5') ?? get('pantothenic-acid'); return v != null ? Math.round(v * 1000) : null },
    vitaminB6:      () => { const v = get('vitamin-b6'); return v != null ? Math.round(v * 1000) : null },
    biotin:         () => { const v = get('biotin') ?? get('vitamin-b7'); return v != null ? Math.round(v * 1000000) : null },
    folate:         () => { const v = get('folates') ?? get('folic-acid') ?? get('vitamin-b9'); return v != null ? Math.round(v * 1000000) : null },
    vitaminB12:     () => { const v = get('vitamin-b12'); return v != null ? Math.round(v * 1000000) : null },
  }

  const estimates = {}
  ;(metrics || []).forEach(m => {
    const getter = keyMap[m.key.toLowerCase().replace(/[_-]/g, '')]
               || keyMap[m.key.toLowerCase()]
    if (getter) {
      const val = getter()
      if (val != null && !isNaN(val)) estimates[m.key] = Math.round(val)
    }
  })

  return {
    name: p.product_name || p.abbreviated_product_name || 'Unknown Product',
    brand: p.brands ? p.brands.split(',')[0].trim() : null,
    servingSize: p.serving_size || null,
    estimates,
  }
}

// ── Live barcode scanner overlay ─────────────────────────────────────────────
function BarcodeScanner({ metrics, onResult, onClose }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const rafRef = useRef(null)
  const detectorRef = useRef(null)
  const photoInputRef = useRef(null)
  const [status, setStatus] = useState('starting') // starting | scanning | found | error | unsupported | notfound | reading-photo | photo-error
  const [errorMsg, setErrorMsg] = useState('')
  const [manualCode, setManualCode] = useState('')
  const [submittingManual, setSubmittingManual] = useState(false)
  const [showManualInput, setShowManualInput] = useState(false)

  const stopCamera = () => {
    cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
  }

  const handleBarcode = async (code) => {
    setStatus('found')
    stopCamera()
    try {
      const result = await lookupBarcode(code, metrics)
      if (!result || Object.keys(result.estimates).length === 0) {
        setStatus('notfound')
        setErrorMsg(`Barcode ${code} not found in our database.`)
      } else {
        onResult(result)
      }
    } catch {
      setStatus('error')
      setErrorMsg('Network error looking up product. Please try again.')
    }
  }

  const handleManualSubmit = async (e) => {
    e.preventDefault()
    if (!manualCode.trim()) return
    setSubmittingManual(true)
    await handleBarcode(manualCode.trim())
    setSubmittingManual(false)
  }

  const readBarcodeFromPhoto = async (dataUrl) => {
    setStatus('reading-photo')
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: 'You are a barcode reader. When shown an image, find the barcode and return ONLY its numeric digits — nothing else. No spaces, no explanation. If no barcode is visible, return NONE.',
            },
            {
              role: 'user',
              content: [
                { type: 'text', text: 'Read the barcode number from this image. Return ONLY the digits.' },
                { type: 'image_url', image_url: { url: dataUrl } },
              ],
            },
          ],
        }),
      })
      const data = await response.json()
      const raw = (data.content || '').trim()
      const digits = raw.replace(/\D/g, '')
      if (!digits || raw === 'NONE' || digits.length < 6) {
        setStatus('photo-error')
        setErrorMsg("Couldn't read a barcode from that photo. Try again or enter the number manually.")
        return
      }
      await handleBarcode(digits)
    } catch {
      setStatus('photo-error')
      setErrorMsg('Network error. Please try again.')
    }
  }

  const handlePhotoChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    e.target.value = ''
    const dataUrl = await compressImage(file)
    readBarcodeFromPhoto(dataUrl)
  }

  useEffect(() => {
    if (!('BarcodeDetector' in window)) {
      setStatus('unsupported')
      return
    }

    detectorRef.current = new window.BarcodeDetector({
      formats: ['upc_a', 'upc_e', 'ean_8', 'ean_13', 'code_128', 'code_39'],
    })

    navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
    })
    .then(stream => {
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
        setStatus('scanning')
      }
    })
    .catch(() => {
      setStatus('error')
      setErrorMsg('Camera access denied. Please allow camera access and try again.')
    })

    return stopCamera
  }, [])

  useEffect(() => {
    if (status !== 'scanning') return
    let active = true

    const scan = async () => {
      if (!active) return
      const vid = videoRef.current
      if (!vid || vid.readyState < 2) {
        rafRef.current = requestAnimationFrame(scan)
        return
      }
      try {
        const codes = await detectorRef.current.detect(vid)
        if (codes.length > 0) {
          handleBarcode(codes[0].rawValue)
        } else if (active) {
          rafRef.current = requestAnimationFrame(scan)
        }
      } catch {
        if (active) rafRef.current = requestAnimationFrame(scan)
      }
    }

    rafRef.current = requestAnimationFrame(scan)
    return () => { active = false; cancelAnimationFrame(rafRef.current) }
  }, [status]) // eslint-disable-line react-hooks/exhaustive-deps

  const isPhotoMode = status === 'unsupported' || status === 'notfound' || status === 'photo-error'

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: '#000', zIndex: 10, display: 'flex',
      flexDirection: 'column', borderRadius: '16px 16px 0 0', overflow: 'hidden',
    }}>
      <style>{`
        @keyframes scanPulse {
          0%, 100% { opacity: 0.9; top: 22%; }
          50% { opacity: 0.6; top: 72%; }
        }
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes recPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.75); }
        }
        @keyframes recRing {
          0% { box-shadow: 0 0 0 0 rgba(255,69,58,0.5); }
          70% { box-shadow: 0 0 0 8px rgba(255,69,58,0); }
          100% { box-shadow: 0 0 0 0 rgba(255,69,58,0); }
        }
      `}</style>

      {/* Camera feed */}
      {(status === 'scanning' || status === 'starting') && (
        <video
          ref={videoRef}
          playsInline
          muted
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
      )}

      {/* Dark vignette overlay */}
      {status === 'scanning' && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse 60% 45% at 50% 45%, transparent 0%, rgba(0,0,0,0.65) 100%)',
        }} />
      )}

      {/* Scan frame */}
      {status === 'scanning' && (
        <div style={{
          position: 'absolute', top: '20%', left: '10%', right: '10%', height: '55%',
          border: '2px solid rgba(10,132,255,0.85)', borderRadius: 12,
          boxShadow: '0 0 0 9999px rgba(0,0,0,0.35)',
        }}>
          {/* Corner accents */}
          {[
            { top: -2, left: -2, borderTop: '3px solid #0A84FF', borderLeft: '3px solid #0A84FF' },
            { top: -2, right: -2, borderTop: '3px solid #0A84FF', borderRight: '3px solid #0A84FF' },
            { bottom: -2, left: -2, borderBottom: '3px solid #0A84FF', borderLeft: '3px solid #0A84FF' },
            { bottom: -2, right: -2, borderBottom: '3px solid #0A84FF', borderRight: '3px solid #0A84FF' },
          ].map((s, i) => (
            <div key={i} style={{ position: 'absolute', width: 20, height: 20, borderRadius: 3, ...s }} />
          ))}
          {/* Scan line */}
          <div style={{
            position: 'absolute', left: 4, right: 4, height: 2,
            background: 'linear-gradient(90deg, transparent, #0A84FF, transparent)',
            boxShadow: '0 0 8px #0A84FF',
            animation: 'scanPulse 2s ease-in-out infinite',
          }} />
        </div>
      )}

      {/* Hidden photo input for AI barcode reading */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handlePhotoChange}
        style={{ display: 'none' }}
      />

      {/* Status / message area */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: '20px 24px 32px',
        background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 100%)',
        animation: 'fadeIn 0.3s ease',
      }}>
        {status === 'starting' && (
          <p style={{ color: '#888', textAlign: 'center', fontSize: 14, margin: 0 }}>Starting camera...</p>
        )}

        {status === 'scanning' && (
          <p style={{ color: '#fff', textAlign: 'center', fontSize: 14, margin: 0, fontWeight: 500 }}>
            Point at a product barcode
          </p>
        )}

        {(status === 'found' || status === 'reading-photo') && (
          <p style={{ color: '#30D158', textAlign: 'center', fontSize: 14, margin: 0, fontWeight: 600 }}>
            {status === 'reading-photo' ? 'Reading barcode from photo...' : 'Barcode detected — looking up product...'}
          </p>
        )}

        {status === 'error' && (
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: '#FF453A', fontSize: 13, marginBottom: 12 }}>{errorMsg}</p>
            <button onClick={() => setStatus('scanning')} style={{
              padding: '9px 20px', backgroundColor: '#0A84FF', border: 'none',
              borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>Try Again</button>
          </div>
        )}

        {isPhotoMode && (
          <div style={{ animation: 'fadeIn 0.25s ease' }}>
            {/* Error/context message */}
            {(status === 'photo-error' || status === 'notfound') && (
              <p style={{ color: '#FF453A', fontSize: 12, textAlign: 'center', marginBottom: 12 }}>{errorMsg}</p>
            )}
            {status === 'unsupported' && (
              <p style={{ color: '#888', fontSize: 12, textAlign: 'center', marginBottom: 12 }}>
                Live scanning isn't supported on this browser — snap a photo instead.
              </p>
            )}

            {/* Primary: take photo of barcode */}
            <button
              onClick={() => photoInputRef.current?.click()}
              style={{
                width: '100%', padding: '13px', marginBottom: 10,
                backgroundColor: '#0A84FF', border: 'none',
                borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 600,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              <CameraIcon size={18} color="#fff" strokeWidth={2} />
              Take Photo of Barcode
            </button>

            {/* Secondary: manual entry toggle */}
            {!showManualInput ? (
              <button
                onClick={() => setShowManualInput(true)}
                style={{
                  width: '100%', padding: '9px', backgroundColor: 'transparent',
                  border: '1px solid #333', borderRadius: 8,
                  color: '#666', fontSize: 12, cursor: 'pointer',
                }}
              >
                Enter number manually
              </button>
            ) : (
              <form onSubmit={handleManualSubmit} style={{ display: 'flex', gap: 8 }}>
                <input
                  value={manualCode}
                  onChange={e => setManualCode(e.target.value)}
                  placeholder="e.g. 012345678905"
                  inputMode="numeric"
                  autoFocus
                  style={{
                    flex: 1, padding: '10px 12px', backgroundColor: '#1A1A1A',
                    border: '1px solid #2C2C2C', borderRadius: 8, color: '#fff', fontSize: 15,
                  }}
                />
                <button type="submit" disabled={submittingManual || !manualCode.trim()} style={{
                  padding: '10px 16px', backgroundColor: '#0A84FF', border: 'none',
                  borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600,
                  cursor: submittingManual ? 'not-allowed' : 'pointer',
                  opacity: submittingManual ? 0.6 : 1,
                }}>
                  {submittingManual ? '...' : 'Look Up'}
                </button>
              </form>
            )}
          </div>
        )}
      </div>

      {/* Close button */}
      <button
        onClick={() => { stopCamera(); onClose() }}
        style={{
          position: 'absolute', top: 14, right: 16,
          padding: '6px 14px', backgroundColor: 'rgba(0,0,0,0.55)',
          border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8,
          color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer',
        }}
      >
        Cancel
      </button>
    </div>
  )
}

// Compress image before sending to API
// Higher resolution + quality needed for nutrition label text to remain legible
function compressImage(file) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const MAX = 1400
        let w = img.width, h = img.height
        if (w > MAX || h > MAX) {
          if (w > h) { h = Math.round(h * MAX / w); w = MAX }
          else { w = Math.round(w * MAX / h); h = MAX }
        }
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        canvas.getContext('2d').drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', 0.92))
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })
}

export function AIChatModal({ messages, input, pendingImage, isThinking, metrics, viewDate, onInputChange, onImageSelect, onImageClear, onSend, onAddEstimates, onBarcodeResult, onClose }) {
  const fileInputRef = useRef(null)
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false)

  // Voice recording
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const recordingTimerRef = useRef(null)
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [voiceError, setVoiceError] = useState('')

  const formatRecordingTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  const transcribeAudio = async (blob, mimeType) => {
    setIsTranscribing(true)
    setVoiceError('')
    try {
      const ext = mimeType.includes('mp4') || mimeType.includes('m4a') ? 'm4a'
               : mimeType.includes('ogg') ? 'ogg'
               : 'webm'
      const formData = new FormData()
      formData.append('audio', blob, `recording.${ext}`)
      const res = await fetch('/api/transcribe', { method: 'POST', body: formData })
      const data = await res.json()
      if (data.text) {
        onInputChange(data.text)
      } else {
        setVoiceError(data.error || 'Could not transcribe audio. Please try again.')
      }
    } catch {
      setVoiceError('Network error. Please try again.')
    } finally {
      setIsTranscribing(false)
    }
  }

  const startRecording = async () => {
    setVoiceError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus'
                     : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm'
                     : 'audio/mp4'
      const recorder = new MediaRecorder(stream, { mimeType })
      audioChunksRef.current = []
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType })
        transcribeAudio(blob, recorder.mimeType)
      }
      recorder.start()
      mediaRecorderRef.current = recorder
      setIsRecording(true)
      setRecordingSeconds(0)
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds(s => {
          if (s >= 59) { stopRecording(); return 0 }
          return s + 1
        })
      }, 1000)
    } catch {
      setVoiceError('Microphone access denied. Please allow microphone access and try again.')
    }
  }

  const stopRecording = () => {
    clearInterval(recordingTimerRef.current)
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop())
    }
    setIsRecording(false)
    setRecordingSeconds(0)
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (input.trim() || pendingImage) onSend()
    }
  }

  const handleFileChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    const compressed = await compressImage(file)
    onImageSelect(compressed)
    e.target.value = '' // allow re-selecting same file
  }

  // Generate button text based on viewing date
  const getAddButtonText = () => {
    if (viewDate === null) {
      return '✓ Add to Today'
    }

    // Parse viewDate (YYYY-MM-DD format)
    const parts = viewDate.split('-')
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (d.toDateString() === yesterday.toDateString()) {
      return '✓ Add to Yesterday'
    }

    // Format as "Add to Dec 15"
    return `✓ Add to ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.4)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: '#1A1A1A',
        borderRadius: '16px 16px 0 0',
        width: '100%',
        maxWidth: '600px',
        height: '85vh',
        maxHeight: '600px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 -4px 30px rgba(0,0,0,0.2)',
        position: 'relative',
      }}>
        <style>{`
          @keyframes recPulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.4; transform: scale(0.75); }
          }
          @keyframes recRing {
            0% { box-shadow: 0 0 0 0 rgba(255,69,58,0.5); }
            70% { box-shadow: 0 0 0 8px rgba(255,69,58,0); }
            100% { box-shadow: 0 0 0 0 rgba(255,69,58,0); }
          }
        `}</style>

        {/* Barcode scanner overlay */}
        {showBarcodeScanner && (
          <BarcodeScanner
            metrics={metrics}
            onResult={(result) => {
              setShowBarcodeScanner(false)
              onBarcodeResult && onBarcodeResult(result)
            }}
            onClose={() => setShowBarcodeScanner(false)}
          />
        )}

        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #2C2C2C',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#0D0D0D'
        }}>
          <div>
            <h2 style={{
              margin: 0,
              fontSize: '16px',
              fontWeight: '600',
              color: '#FFFFFF',
              letterSpacing: '-0.3px'
            }}>
              AI Assistant
            </h2>
            <div style={{
              fontSize: '12px',
              color: viewDate !== null ? '#d97706' : '#666666',
              marginTop: '2px'
            }}>
              {viewDate !== null
                ? `Adding to ${(() => {
                    const parts = viewDate.split('-')
                    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
                    const yesterday = new Date()
                    yesterday.setDate(yesterday.getDate() - 1)
                    yesterday.setHours(0, 0, 0, 0)
                    return d.toDateString() === yesterday.toDateString()
                      ? 'Yesterday'
                      : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                  })()}`
                : 'Describe your meal or snap a photo'
              }
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '6px 14px',
              backgroundColor: '#1A1A1A',
              border: '1px solid #2C2C2C',
              borderRadius: '6px',
              color: '#888888',
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            Close
          </button>
        </div>

        {/* Messages */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '16px',
          backgroundColor: '#0D0D0D'
        }}>
          {messages.length === 0 && (
            <div style={{
              textAlign: 'center',
              padding: '32px 16px',
              color: '#666666'
            }}>
              <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'center' }}>
                <CameraIcon size={40} color="rgba(10,132,255,0.5)" strokeWidth={1.25} />
              </div>
              <div style={{ fontSize: '14px', marginBottom: '6px', fontWeight: '500', color: '#888888' }}>
                Ask me about your meals!
              </div>
              <div style={{ fontSize: '12px', lineHeight: '1.8' }}>
                Type a description:<br />
                "Chicken breast with rice"<br />
                <br />
                Or tap the camera to:<br />
                • Take a photo of your food<br />
                • Snap a nutrition label
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} style={{
              marginBottom: '12px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start'
            }}>
              <div style={{
                maxWidth: '85%',
                padding: '10px 14px',
                backgroundColor: msg.role === 'user' ? '#0A84FF' : '#1A1A1A',
                color: msg.role === 'user' ? '#fff' : '#FFFFFF',
                borderRadius: '12px',
                fontSize: '13px',
                lineHeight: '1.5',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                whiteSpace: 'pre-wrap'
              }}>
                {/* Show image thumbnail if the user message had a photo */}
                {msg.image && (
                  <img
                    src={msg.image}
                    alt="Food photo"
                    style={{
                      display: 'block',
                      maxWidth: '100%',
                      borderRadius: '8px',
                      marginBottom: msg.content && msg.content !== 'Analyze this food photo' ? '8px' : '0'
                    }}
                  />
                )}
                {/* Only show text if it's not the auto-generated fallback placeholder */}
                {msg.content && msg.content !== 'Analyze this food photo' && msg.content}
              </div>

              {msg.estimates && (
                <div style={{
                  marginTop: '6px',
                  backgroundColor: msg.added ? '#222222' : 'rgba(48,209,88,0.1)',
                  border: msg.added ? '1px solid #d1d5db' : '1px solid #bbf7d0',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  maxWidth: '85%'
                }}>
                  <div style={{
                    fontSize: '11px',
                    fontWeight: '600',
                    color: msg.added ? '#6b7280' : '#30D158',
                    marginBottom: '6px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    {msg.added ? 'Added:' : 'Will add:'}
                  </div>
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '4px 10px',
                    marginBottom: '8px'
                  }}>
                    {(metrics || []).map(m => {
                      const val = msg.estimates[m.key]
                      if (!val) return null
                      return (
                        <div key={m.key} style={{
                          fontSize: '12px',
                          color: msg.added ? '#6b7280' : '#FFFFFF',
                          fontWeight: '500'
                        }}>
                          <span style={{ color: msg.added ? '#9ca3af' : (m.color || '#888888') }}>{m.name}:</span>{' '}
                          {val}{m.unit ? ` ${m.unit}` : ''}
                        </div>
                      )
                    })}
                  </div>
                  <button
                    onClick={() => onAddEstimates(msg.estimates, i)}
                    disabled={msg.added}
                    style={{
                      width: '100%',
                      padding: '8px 14px',
                      backgroundColor: msg.added ? '#e5e7eb' : '#10b981',
                      border: 'none',
                      borderRadius: '6px',
                      color: msg.added ? '#9ca3af' : '#1A1A1A',
                      fontSize: '12px',
                      fontWeight: '500',
                      cursor: msg.added ? 'not-allowed' : 'pointer',
                      opacity: msg.added ? 0.7 : 1
                    }}
                  >
                    {msg.added ? '✓ Added' : getAddButtonText()}
                  </button>
                </div>
              )}
            </div>
          ))}

          {isThinking && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 14px',
              backgroundColor: '#1A1A1A',
              borderRadius: '12px',
              maxWidth: '85%',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              <div style={{
                fontSize: '12px',
                color: '#666666',
                fontStyle: 'italic'
              }}>
                Analyzing...
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div style={{
          padding: '12px 16px',
          paddingBottom: '24px',
          borderTop: '1px solid #2C2C2C',
          backgroundColor: '#1A1A1A'
        }}>
          {/* Voice recording / transcribing indicator */}
          {(isRecording || isTranscribing) && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 4px 10px',
            }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                backgroundColor: isTranscribing ? '#FF9F0A' : '#FF453A',
                animation: isRecording ? 'recPulse 1s ease-in-out infinite' : 'none',
              }} />
              <span style={{ color: '#aaa', fontSize: 13 }}>
                {isTranscribing ? 'Transcribing...' : `Recording ${formatRecordingTime(recordingSeconds)}`}
              </span>
              {isRecording && (
                <span style={{ color: '#555', fontSize: 12, marginLeft: 'auto' }}>tap mic to stop</span>
              )}
            </div>
          )}

          {/* Voice error */}
          {voiceError && !isRecording && !isTranscribing && (
            <div style={{ color: '#FF453A', fontSize: 12, padding: '4px 4px 8px' }}>{voiceError}</div>
          )}

          {/* Image preview */}
          {pendingImage && (
            <div style={{
              position: 'relative',
              display: 'inline-block',
              marginBottom: '8px'
            }}>
              <img
                src={pendingImage}
                alt="Selected food"
                style={{
                  height: '72px',
                  width: '72px',
                  objectFit: 'cover',
                  borderRadius: '8px',
                  border: '2px solid #0A84FF',
                  display: 'block'
                }}
              />
              <button
                onClick={onImageClear}
                style={{
                  position: 'absolute',
                  top: '-6px',
                  right: '-6px',
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  backgroundColor: '#ef4444',
                  border: 'none',
                  color: '#1A1A1A',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  lineHeight: 1
                }}
              >
                ×
              </button>
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
            {/* Hidden file input — capture="environment" opens rear camera on mobile */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />

            {/* Camera button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isThinking}
              title="Take a photo or choose from library"
              style={{
                padding: '10px 12px',
                backgroundColor: pendingImage ? '#0A84FF' : 'transparent',
                border: `1px solid ${pendingImage ? '#0A84FF' : '#2C2C2C'}`,
                borderRadius: '8px',
                cursor: isThinking ? 'not-allowed' : 'pointer',
                lineHeight: 1,
                flexShrink: 0,
                opacity: isThinking ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <CameraIcon size={20} color={pendingImage ? '#fff' : '#888888'} strokeWidth={1.75} />
            </button>

            {/* Barcode scan button */}
            <button
              onClick={() => setShowBarcodeScanner(true)}
              disabled={isThinking}
              title="Scan a product barcode"
              style={{
                padding: '10px 12px',
                backgroundColor: 'transparent',
                border: '1px solid #2C2C2C',
                borderRadius: '8px',
                cursor: isThinking ? 'not-allowed' : 'pointer',
                lineHeight: 1,
                flexShrink: 0,
                opacity: isThinking ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <BarcodeIcon size={20} color="#888888" strokeWidth={1.75} />
            </button>

            {/* Voice record button */}
            <button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isThinking || isTranscribing}
              title={isRecording ? 'Stop recording' : 'Record what you ate'}
              style={{
                padding: '10px 12px',
                backgroundColor: isRecording ? '#FF453A' : 'transparent',
                border: `1px solid ${isRecording ? '#FF453A' : '#2C2C2C'}`,
                borderRadius: '8px',
                cursor: (isThinking || isTranscribing) ? 'not-allowed' : 'pointer',
                lineHeight: 1,
                flexShrink: 0,
                opacity: (isThinking || isTranscribing) ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                animation: isRecording ? 'recRing 1.2s ease-in-out infinite' : 'none',
                boxShadow: isRecording ? '0 0 0 0 rgba(255,69,58,0.4)' : 'none',
              }}
            >
              <MicIcon size={20} color={isRecording ? '#fff' : '#888888'} strokeWidth={1.75} />
            </button>

            <textarea
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder={pendingImage ? 'Optional: add context (e.g. "I had half of this")' : 'Describe your meal...'}
              disabled={isThinking}
              style={{
                flex: 1,
                padding: '10px 14px',
                backgroundColor: '#0D0D0D',
                border: '1px solid #2C2C2C',
                borderRadius: '8px',
                color: '#FFFFFF',
                fontSize: '16px',
                fontFamily: 'inherit',
                resize: 'none',
                minHeight: '44px',
                maxHeight: '100px'
              }}
              rows={1}
            />
            <button
              onClick={onSend}
              disabled={(!input.trim() && !pendingImage) || isThinking}
              style={{
                padding: '10px 18px',
                backgroundColor: (input.trim() || pendingImage) && !isThinking ? '#0A84FF' : '#2C2C2C',
                border: 'none',
                borderRadius: '8px',
                color: (input.trim() || pendingImage) && !isThinking ? '#fff' : '#666666',
                fontSize: '13px',
                fontWeight: '500',
                cursor: (input.trim() || pendingImage) && !isThinking ? 'pointer' : 'not-allowed'
              }}
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
