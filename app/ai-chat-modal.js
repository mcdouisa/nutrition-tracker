// AI Chat Modal Component (mobile optimized)
export function AIChatModal({ messages, input, isThinking, metrics, onInputChange, onSend, onAddEstimates, onClose }) {
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSend()
    }
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
              color: '#999',
              marginTop: '2px'
            }}>
              Describe your meal for estimates
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
              <div style={{ fontSize: '12px', lineHeight: '1.6' }}>
                Examples:<br />
                "Chicken breast with rice"<br />
                "Large pizza slice"<br />
                "Oatmeal with banana"
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
                {msg.content}
              </div>

              {msg.estimates && (
                <div style={{
                  marginTop: '6px',
                  backgroundColor: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  maxWidth: '85%'
                }}>
                  <div style={{
                    fontSize: '11px',
                    fontWeight: '600',
                    color: '#166534',
                    marginBottom: '6px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    Will add:
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
                          color: '#1a1a1a',
                          fontWeight: '500'
                        }}>
                          <span style={{ color: m.color || '#666' }}>{m.name}:</span>{' '}
                          {val}{m.unit ? ` ${m.unit}` : ''}
                        </div>
                      )
                    })}
                  </div>
                  <button
                    onClick={() => onAddEstimates(msg.estimates)}
                    style={{
                      width: '100%',
                      padding: '8px 14px',
                      backgroundColor: '#10b981',
                      border: 'none',
                      borderRadius: '6px',
                      color: '#fff',
                      fontSize: '12px',
                      fontWeight: '500',
                      cursor: 'pointer'
                    }}
                  >
                    ✓ Add to Today
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
          <div style={{ display: 'flex', gap: '8px' }}>
            <textarea
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Describe your meal..."
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
              disabled={!input.trim() || isThinking}
              style={{
                padding: '10px 18px',
                backgroundColor: input.trim() && !isThinking ? '#5f8a8f' : '#e0e0e0',
                border: 'none',
                borderRadius: '8px',
                color: input.trim() && !isThinking ? '#fff' : '#999',
                fontSize: '13px',
                fontWeight: '500',
                cursor: input.trim() && !isThinking ? 'pointer' : 'not-allowed'
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
