// AI Chat Modal Component (mobile optimized)
import { useRef } from 'react'

// Compress image to max 900px JPEG before sending to API
function compressImage(file) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const MAX = 900
        let w = img.width, h = img.height
        if (w > MAX || h > MAX) {
          if (w > h) { h = Math.round(h * MAX / w); w = MAX }
          else { w = Math.round(w * MAX / h); h = MAX }
        }
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        canvas.getContext('2d').drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', 0.75))
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })
}

export function AIChatModal({ messages, input, pendingImage, isThinking, metrics, viewDate, onInputChange, onImageSelect, onImageClear, onSend, onAddEstimates, onClose }) {
  const fileInputRef = useRef(null)

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
        backgroundColor: '#fff',
        borderRadius: '16px 16px 0 0',
        width: '100%',
        maxWidth: '600px',
        height: '85vh',
        maxHeight: '600px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 -4px 30px rgba(0,0,0,0.2)'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #e0e0e0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#fafafa'
        }}>
          <div>
            <h2 style={{
              margin: 0,
              fontSize: '16px',
              fontWeight: '600',
              color: '#1a1a1a',
              letterSpacing: '-0.3px'
            }}>
              🤖 AI Assistant
            </h2>
            <div style={{
              fontSize: '12px',
              color: viewDate !== null ? '#d97706' : '#999',
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
              backgroundColor: '#fff',
              border: '1px solid #e0e0e0',
              borderRadius: '6px',
              color: '#666',
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
          backgroundColor: '#fafafa'
        }}>
          {messages.length === 0 && (
            <div style={{
              textAlign: 'center',
              padding: '32px 16px',
              color: '#999'
            }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>💬</div>
              <div style={{ fontSize: '14px', marginBottom: '6px', fontWeight: '500', color: '#666' }}>
                Ask me about your meals!
              </div>
              <div style={{ fontSize: '12px', lineHeight: '1.8' }}>
                Type a description:<br />
                "Chicken breast with rice"<br />
                <br />
                Or tap 📷 to:<br />
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
                backgroundColor: msg.role === 'user' ? '#5f8a8f' : '#fff',
                color: msg.role === 'user' ? '#fff' : '#1a1a1a',
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
                  backgroundColor: msg.added ? '#f5f5f5' : '#f0fdf4',
                  border: msg.added ? '1px solid #d1d5db' : '1px solid #bbf7d0',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  maxWidth: '85%'
                }}>
                  <div style={{
                    fontSize: '11px',
                    fontWeight: '600',
                    color: msg.added ? '#6b7280' : '#166534',
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
                          color: msg.added ? '#6b7280' : '#1a1a1a',
                          fontWeight: '500'
                        }}>
                          <span style={{ color: msg.added ? '#9ca3af' : (m.color || '#666') }}>{m.name}:</span>{' '}
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
                      color: msg.added ? '#9ca3af' : '#fff',
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
              backgroundColor: '#fff',
              borderRadius: '12px',
              maxWidth: '85%',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              <div style={{
                fontSize: '12px',
                color: '#999',
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
          borderTop: '1px solid #e0e0e0',
          backgroundColor: '#fff'
        }}>
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
                  border: '2px solid #5f8a8f',
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
                  color: '#fff',
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
                backgroundColor: pendingImage ? '#5f8a8f' : '#f3f4f6',
                border: `1px solid ${pendingImage ? '#5f8a8f' : '#e0e0e0'}`,
                borderRadius: '8px',
                fontSize: '18px',
                cursor: isThinking ? 'not-allowed' : 'pointer',
                lineHeight: 1,
                flexShrink: 0,
                opacity: isThinking ? 0.5 : 1
              }}
            >
              📷
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
                backgroundColor: '#fafafa',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                color: '#1a1a1a',
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
                backgroundColor: (input.trim() || pendingImage) && !isThinking ? '#5f8a8f' : '#e0e0e0',
                border: 'none',
                borderRadius: '8px',
                color: (input.trim() || pendingImage) && !isThinking ? '#fff' : '#999',
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
