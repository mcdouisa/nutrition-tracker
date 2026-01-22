// AI Chat Modal Component
export function AIChatModal({ messages, input, isThinking, onInputChange, onSend, onAddEstimates, onClose }) {
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
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: '#fff',
        borderRadius: '12px',
        maxWidth: '600px',
        width: '100%',
        height: '600px',
        maxHeight: '85vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #e0e0e0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#fafafa'
        }}>
          <div>
            <h2 style={{
              margin: 0,
              fontSize: '18px',
              fontWeight: '600',
              color: '#1a1a1a',
              letterSpacing: '-0.3px'
            }}>
              🤖 AI Nutrition Assistant
            </h2>
            <div style={{
              fontSize: '13px',
              color: '#999',
              marginTop: '4px'
            }}>
              Describe your meal and get nutrition estimates
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              backgroundColor: '#fff',
              border: '1px solid #e0e0e0',
              borderRadius: '6px',
              color: '#666',
              fontSize: '14px',
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
          padding: '24px',
          backgroundColor: '#fafafa'
        }}>
          {messages.length === 0 && (
            <div style={{
              textAlign: 'center',
              padding: '40px 20px',
              color: '#999'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>💬</div>
              <div style={{ fontSize: '15px', marginBottom: '8px', fontWeight: '500', color: '#666' }}>
                Ask me about your meals!
              </div>
              <div style={{ fontSize: '13px', lineHeight: '1.6' }}>
                Examples:<br />
                "I just ate a chicken breast with rice and broccoli"<br />
                "How many calories in a large pizza slice?"<br />
                "I had oatmeal with banana and peanut butter"
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} style={{
              marginBottom: '16px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start'
            }}>
              <div style={{
                maxWidth: '80%',
                padding: '12px 16px',
                backgroundColor: msg.role === 'user' ? '#1a1a1a' : '#fff',
                color: msg.role === 'user' ? '#fff' : '#1a1a1a',
                borderRadius: '12px',
                fontSize: '14px',
                lineHeight: '1.5',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                whiteSpace: 'pre-wrap'
              }}>
                {msg.content}
              </div>

              {msg.estimates && (
                <button
                  onClick={() => onAddEstimates(msg.estimates)}
                  style={{
                    marginTop: '8px',
                    padding: '8px 16px',
                    backgroundColor: '#10b981',
                    border: 'none',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '13px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                  }}
                >
                  ✓ Add to Today's Nutrition
                </button>
              )}
            </div>
          ))}

          {isThinking && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 16px',
              backgroundColor: '#fff',
              borderRadius: '12px',
              maxWidth: '80%',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              <div style={{
                fontSize: '13px',
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
          padding: '16px 24px',
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
                padding: '12px 16px',
                backgroundColor: '#fafafa',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                color: '#1a1a1a',
                fontSize: '14px',
                fontFamily: 'inherit',
                resize: 'none',
                minHeight: '44px',
                maxHeight: '120px'
              }}
              rows={1}
            />
            <button
              onClick={onSend}
              disabled={!input.trim() || isThinking}
              style={{
                padding: '12px 24px',
                backgroundColor: input.trim() && !isThinking ? '#1a1a1a' : '#e0e0e0',
                border: 'none',
                borderRadius: '8px',
                color: input.trim() && !isThinking ? '#fff' : '#999',
                fontSize: '14px',
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
