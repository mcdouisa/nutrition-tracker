'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../lib/AuthContext'
import {
  createGroup, joinGroup, loadUserGroups, loadGroupMembers,
  addChallenge, removeChallenge, checkInChallenge, uncheckInChallenge,
  loadGroupProgress, leaveGroup, loadGroupSharedData, setSharing, pushWeightToGroup,
} from '../../lib/groupSync'
import { loadBodyWeightHistory } from '../../lib/dataSync'
import { loadUserProfile } from '../../lib/dataSync'

const C = {
  bg: '#0D0D0D', card: '#1A1A1A', card2: '#242424', border: '#2C2C2C',
  accent: '#0A84FF', accentBg: 'rgba(10,132,255,0.12)',
  white: '#FFFFFF', muted: '#888888', faint: '#3A3A3A',
  success: '#30D158', successBg: 'rgba(48,209,88,0.12)',
  danger: '#FF453A', dangerBg: 'rgba(255,69,58,0.12)',
  purple: '#BF5AF2', purpleBg: 'rgba(191,90,242,0.12)',
  orange: '#FF9F0A', orangeBg: 'rgba(255,159,10,0.12)',
}
const font = { heading: "'Barlow Condensed', sans-serif", body: "'DM Sans', sans-serif" }

const CHALLENGE_TYPES = [
  { id: 'workout',   label: 'Complete a Workout',  icon: '🏋️', desc: 'Check in every time you finish a workout' },
  { id: 'nutrition', label: 'Log Your Meals',       icon: '🥗', desc: 'Check in every day you track your nutrition' },
  { id: 'water',     label: 'Hit Water Goal',       icon: '💧', desc: 'Check in when you reach your daily water target' },
  { id: 'steps',     label: 'Hit Step Goal',        icon: '👟', desc: 'Check in when you hit your step target' },
  { id: 'custom',    label: 'Custom Goal',          icon: '🎯', desc: 'Define your own daily challenge' },
]

function today() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000)
}

function fmtDate(iso) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ── CREATE GROUP MODAL ────────────────────────────────────────────────────────
function CreateModal({ displayName, onClose, onCreated }) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const { user } = useAuth()

  const handleCreate = async () => {
    if (!name.trim()) return
    setLoading(true)
    const group = await createGroup(user.uid, name.trim(), displayName)
    setLoading(false)
    if (group) onCreated(group)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(8px)', zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: C.card, borderRadius: '22px 22px 0 0', width: '100%', maxWidth: 600, padding: '24px 20px 40px' }} onClick={e => e.stopPropagation()}>
        <div style={{ width: 36, height: 4, background: C.border, borderRadius: 2, margin: '0 auto 20px' }} />
        <h3 style={{ fontFamily: font.heading, fontSize: 22, fontWeight: 900, color: C.white, letterSpacing: 1, marginBottom: 20 }}>CREATE GROUP</h3>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: 1.5, marginBottom: 6 }}>GROUP NAME</label>
        <input autoFocus value={name} onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleCreate()}
          placeholder="e.g. Monday Crew, Work Wellness..."
          style={{ width: '100%', background: C.card2, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 16px', fontSize: 15, color: C.white, outline: 'none', marginBottom: 20 }} />
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, background: 'none', border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, color: C.muted, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleCreate} disabled={!name.trim() || loading} style={{ flex: 2, background: name.trim() && !loading ? `linear-gradient(90deg,${C.accent},#5856D6)` : C.faint, border: 'none', borderRadius: 12, padding: 14, fontFamily: font.heading, fontSize: 18, fontWeight: 700, letterSpacing: 1, color: C.white, cursor: 'pointer' }}>
            {loading ? 'Creating...' : 'CREATE'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── JOIN GROUP MODAL ──────────────────────────────────────────────────────────
function JoinModal({ displayName, onClose, onJoined }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { user } = useAuth()

  const handleJoin = async () => {
    if (code.trim().length < 6) return
    setLoading(true); setError('')
    const result = await joinGroup(user.uid, code.trim(), displayName)
    setLoading(false)
    if (result.error) { setError(result.error); return }
    onJoined(result.group || result.groupId)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(8px)', zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: C.card, borderRadius: '22px 22px 0 0', width: '100%', maxWidth: 600, padding: '24px 20px 40px' }} onClick={e => e.stopPropagation()}>
        <div style={{ width: 36, height: 4, background: C.border, borderRadius: 2, margin: '0 auto 20px' }} />
        <h3 style={{ fontFamily: font.heading, fontSize: 22, fontWeight: 900, color: C.white, letterSpacing: 1, marginBottom: 8 }}>JOIN A GROUP</h3>
        <p style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>Enter the 6-character code your friend shared with you.</p>
        <input autoFocus value={code} onChange={e => setCode(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === 'Enter' && handleJoin()}
          maxLength={6} placeholder="ABC123"
          style={{ width: '100%', background: C.card2, border: `1px solid ${error ? C.danger : C.border}`, borderRadius: 12, padding: '14px 16px', fontSize: 24, fontWeight: 700, color: C.white, outline: 'none', marginBottom: 8, textAlign: 'center', letterSpacing: 6, fontFamily: font.heading }} />
        {error && <p style={{ fontSize: 13, color: C.danger, marginBottom: 12 }}>{error}</p>}
        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <button onClick={onClose} style={{ flex: 1, background: 'none', border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, color: C.muted, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleJoin} disabled={code.length < 6 || loading} style={{ flex: 2, background: code.length >= 6 && !loading ? `linear-gradient(90deg,${C.success},#20b857)` : C.faint, border: 'none', borderRadius: 12, padding: 14, fontFamily: font.heading, fontSize: 18, fontWeight: 700, letterSpacing: 1, color: C.white, cursor: 'pointer' }}>
            {loading ? 'Joining...' : 'JOIN'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── ADD CHALLENGE MODAL ───────────────────────────────────────────────────────
function AddChallengeModal({ groupId, userId, onClose, onAdded }) {
  const [type, setType] = useState('workout')
  const [title, setTitle] = useState('')
  const [target, setTarget] = useState('30')
  const [endDate, setEndDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 30)
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  })
  const [loading, setLoading] = useState(false)

  const selectedType = CHALLENGE_TYPES.find(t => t.id === type)

  const handleAdd = async () => {
    setLoading(true)
    const challenge = {
      id: `ch-${Date.now()}`,
      type,
      title: (type === 'custom' ? title.trim() : selectedType.label) || selectedType.label,
      icon: selectedType.icon,
      target: parseInt(target) || 30,
      startDate: today(),
      endDate,
      createdBy: userId,
      createdAt: new Date().toISOString(),
    }
    await addChallenge(groupId, challenge)
    setLoading(false)
    onAdded(challenge)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(8px)', zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: C.card, borderRadius: '22px 22px 0 0', width: '100%', maxWidth: 600, padding: '24px 20px 40px', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ width: 36, height: 4, background: C.border, borderRadius: 2, margin: '0 auto 20px' }} />
        <h3 style={{ fontFamily: font.heading, fontSize: 22, fontWeight: 900, color: C.white, letterSpacing: 1, marginBottom: 20 }}>ADD CHALLENGE</h3>

        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: 1.5, marginBottom: 10 }}>CHALLENGE TYPE</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {CHALLENGE_TYPES.map(t => (
            <button key={t.id} onClick={() => setType(t.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: type === t.id ? C.accentBg : C.card2, border: `1px solid ${type === t.id ? 'rgba(10,132,255,0.4)' : C.border}`, borderRadius: 12, cursor: 'pointer', textAlign: 'left' }}>
              <span style={{ fontSize: 20 }}>{t.icon}</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: type === t.id ? C.accent : C.white }}>{t.label}</div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{t.desc}</div>
              </div>
            </button>
          ))}
        </div>

        {type === 'custom' && (
          <>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: 1.5, marginBottom: 6 }}>CUSTOM GOAL NAME</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Meditate daily, No sugar..."
              style={{ width: '100%', background: C.card2, border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 14px', fontSize: 14, color: C.white, outline: 'none', marginBottom: 16 }} />
          </>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: 1.5, marginBottom: 6 }}>CHECK-IN TARGET</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input value={target} onChange={e => setTarget(e.target.value)} inputMode="numeric"
                style={{ width: 70, background: C.card2, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px', fontSize: 15, color: C.white, outline: 'none', textAlign: 'center' }} />
              <span style={{ fontSize: 13, color: C.muted }}>days</span>
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: 1.5, marginBottom: 6 }}>END DATE</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              style={{ width: '100%', background: C.card2, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px', fontSize: 13, color: C.white, outline: 'none', colorScheme: 'dark' }} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, background: 'none', border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, color: C.muted, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleAdd} disabled={loading || (type === 'custom' && !title.trim())} style={{ flex: 2, background: !loading ? `linear-gradient(90deg,${C.purple},#9a3fcc)` : C.faint, border: 'none', borderRadius: 12, padding: 14, fontFamily: font.heading, fontSize: 18, fontWeight: 700, letterSpacing: 1, color: C.white, cursor: 'pointer' }}>
            {loading ? 'Adding...' : 'ADD CHALLENGE'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── GROUP DETAIL ──────────────────────────────────────────────────────────────
function GroupDetail({ group, userId, displayName, onBack, onGroupUpdated }) {
  const [members, setMembers] = useState([])
  const [progress, setProgress] = useState({})
  const [sharedData, setSharedData] = useState({})
  const [showAddChallenge, setShowAddChallenge] = useState(false)
  const [showCode, setShowCode] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [sharingWeight, setSharingWeight] = useState(false)
  const [syncingWeight, setSyncingWeight] = useState(false)

  useEffect(() => {
    loadGroupMembers(group.id).then(setMembers)
    loadGroupProgress(group.id).then(setProgress)
    loadGroupSharedData(group.id).then(data => {
      setSharedData(data)
      setSharingWeight(data[userId]?.sharing?.bodyWeight || false)
    })
  }, [group.id])

  const handleToggleWeightSharing = async (enable) => {
    setSharingWeight(enable)
    await setSharing(group.id, userId, { bodyWeight: enable })
    if (enable) {
      setSyncingWeight(true)
      const history = await loadBodyWeightHistory(userId, 90)
      if (history.length > 0) {
        await pushWeightToGroup(group.id, userId, history)
        setSharedData(prev => ({
          ...prev,
          [userId]: { ...(prev[userId] || {}), sharing: { bodyWeight: true }, weightHistory: history }
        }))
      }
      setSyncingWeight(false)
    } else {
      setSharedData(prev => ({
        ...prev,
        [userId]: { ...(prev[userId] || {}), sharing: { bodyWeight: false }, weightHistory: [] }
      }))
    }
  }

  const todayStr = today()
  const isCreator = group.createdBy === userId

  const handleCheckIn = async (challengeId, alreadyDone) => {
    const fn = alreadyDone ? uncheckInChallenge : checkInChallenge
    await fn(group.id, userId, challengeId, todayStr)
    setProgress(prev => {
      const existing = prev[userId]?.[challengeId]?.checkIns || []
      const updated = alreadyDone
        ? existing.filter(d => d !== todayStr)
        : [...existing, todayStr]
      return { ...prev, [userId]: { ...(prev[userId] || {}), [challengeId]: { checkIns: updated } } }
    })
  }

  const handleRemoveChallenge = async (challengeId) => {
    await removeChallenge(group.id, challengeId)
    onGroupUpdated({ ...group, challenges: group.challenges.filter(c => c.id !== challengeId) })
  }

  const handleLeave = async () => {
    if (!window.confirm('Leave this group?')) return
    setLeaving(true)
    await leaveGroup(group.id, userId)
    onBack()
  }

  return (
    <div style={{ fontFamily: font.body, background: C.bg, minHeight: '100dvh', color: C.white }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;900&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap'); *,*::before,*::after{box-sizing:border-box;margin:0;padding:0} button{cursor:pointer;font-family:inherit} input{font-family:inherit;color:#fff}`}</style>

      {showAddChallenge && (
        <AddChallengeModal groupId={group.id} userId={userId} onClose={() => setShowAddChallenge(false)}
          onAdded={ch => {
            setShowAddChallenge(false)
            onGroupUpdated({ ...group, challenges: [...(group.challenges || []), ch] })
          }} />
      )}

      <header style={{ position: 'sticky', top: 0, zIndex: 50, background: `${C.bg}f2`, backdropFilter: 'blur(14px)', borderBottom: `1px solid ${C.border}`, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onBack} style={{ background: C.card2, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px', color: C.white, lineHeight: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, letterSpacing: 2 }}>FITNESS GROUP</div>
          <div style={{ fontFamily: font.heading, fontWeight: 900, fontSize: 22, letterSpacing: 0.5 }}>{group.name.toUpperCase()}</div>
        </div>
        <button onClick={() => setShowCode(s => !s)} style={{ background: C.accentBg, border: '1px solid rgba(10,132,255,0.3)', borderRadius: 10, padding: '8px 12px', fontSize: 12, fontWeight: 700, color: C.accent }}>
          {showCode ? 'Hide' : 'Share Code'}
        </button>
      </header>

      <div style={{ padding: '16px 16px 120px' }}>

        {/* Share code banner */}
        {showCode && (
          <div style={{ background: C.accentBg, border: '1px solid rgba(10,132,255,0.3)', borderRadius: 16, padding: '16px 20px', marginBottom: 20, textAlign: 'center' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: 2, marginBottom: 8 }}>INVITE CODE — SHARE WITH FRIENDS</div>
            <div style={{ fontFamily: font.heading, fontSize: 44, fontWeight: 900, color: C.accent, letterSpacing: 10 }}>{group.code}</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 8 }}>They enter this code on the Groups page to join</div>
          </div>
        )}

        {/* Members */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: 2, marginBottom: 12 }}>MEMBERS ({members.length})</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {members.map(m => (
              <div key={m.userId} style={{ background: C.card, border: `1px solid ${m.userId === userId ? 'rgba(10,132,255,0.4)' : C.border}`, borderRadius: 20, padding: '6px 14px', fontSize: 13, fontWeight: 600, color: m.userId === userId ? C.accent : C.white }}>
                {m.displayName}{m.isCreator ? ' ★' : ''}{m.userId === userId ? ' (you)' : ''}
              </div>
            ))}
          </div>
        </div>

        {/* ── SHARED STATS ──────────────────────────────────────────── */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: 2, marginBottom: 12 }}>SHARED STATS</div>

          {/* My weight sharing toggle */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '14px 16px', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.white }}>Share My Body Weight</div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                  {sharingWeight ? 'Your weight is visible to the group — updates automatically' : 'Only you can see your weight'}
                </div>
              </div>
              <button onClick={() => handleToggleWeightSharing(!sharingWeight)} disabled={syncingWeight} style={{
                width: 48, height: 28, borderRadius: 14, border: 'none', cursor: 'pointer',
                background: sharingWeight ? C.success : C.faint,
                position: 'relative', transition: 'background 0.2s', flexShrink: 0,
              }}>
                <div style={{
                  position: 'absolute', top: 3, left: sharingWeight ? 23 : 3,
                  width: 22, height: 22, borderRadius: '50%', background: C.white,
                  transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                }} />
              </button>
            </div>
            {syncingWeight && <div style={{ fontSize: 12, color: C.muted, marginTop: 8 }}>Syncing your weight history...</div>}
          </div>

          {/* Weight leaderboard */}
          {(() => {
            const weightEntries = members
              .map(m => {
                const history = sharedData[m.userId]?.weightHistory || []
                if (!sharedData[m.userId]?.sharing?.bodyWeight || history.length === 0) return null
                const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date))
                const start = sorted[0]
                const current = sorted[sorted.length - 1]
                const change = parseFloat((current.weight - start.weight).toFixed(1))
                return { ...m, start, current, change }
              })
              .filter(Boolean)
              .sort((a, b) => a.change - b.change) // most lost first

            if (weightEntries.length === 0) return (
              <div style={{ background: C.card2, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 13, color: C.muted }}>No one is sharing weight yet — toggle above to start</div>
              </div>
            )

            return (
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, letterSpacing: 1.5 }}>WEIGHT LEADERBOARD</div>
                  <div style={{ fontSize: 11, color: C.faint, marginTop: 2 }}>Ranked by most weight lost</div>
                </div>
                {weightEntries.map((m, i) => {
                  const isMe = m.userId === userId
                  const lost = m.change < 0
                  const gained = m.change > 0
                  const color = lost ? C.success : gained ? C.danger : C.muted
                  return (
                    <div key={m.userId} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: i < weightEntries.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                      <span style={{ fontFamily: font.heading, fontWeight: 900, fontSize: 16, color: i === 0 ? C.orange : C.muted, width: 20, textAlign: 'center' }}>{i + 1}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: isMe ? C.accent : C.white }}>
                          {m.displayName}{isMe ? ' (you)' : ''}
                        </div>
                        <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                          Started {m.start.weight} {m.start.unit} → Now {m.current.weight} {m.current.unit}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontFamily: font.heading, fontSize: 20, fontWeight: 900, color, lineHeight: 1 }}>
                          {lost ? '' : gained ? '+' : ''}{m.change}
                        </div>
                        <div style={{ fontSize: 10, color: C.muted }}>{m.current.unit}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </div>

        {/* Challenges */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: 2 }}>CHALLENGES</div>
          {isCreator && (
            <button onClick={() => setShowAddChallenge(true)} style={{ background: C.purpleBg, border: '1px solid rgba(191,90,242,0.3)', borderRadius: 8, padding: '5px 12px', fontSize: 12, fontWeight: 700, color: C.purple }}>
              + Add
            </button>
          )}
        </div>

        {(!group.challenges || group.challenges.length === 0) && (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '32px 20px', textAlign: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🎯</div>
            <div style={{ fontSize: 15, color: C.muted }}>No challenges yet.</div>
            {isCreator && <div style={{ fontSize: 13, color: C.faint, marginTop: 4 }}>Tap "+ Add" to create the first one.</div>}
          </div>
        )}

        {(group.challenges || []).map(ch => {
          const myCheckIns = progress[userId]?.[ch.id]?.checkIns || []
          const doneToday = myCheckIns.includes(todayStr)
          const totalDays = daysBetween(ch.startDate, ch.endDate) + 1
          const elapsed = Math.min(Math.max(daysBetween(ch.startDate, todayStr) + 1, 0), totalDays)
          const isExpired = todayStr > ch.endDate

          // Build leaderboard
          const leaderboard = members.map(m => {
            const checkIns = progress[m.userId]?.[ch.id]?.checkIns || []
            return { ...m, count: checkIns.length }
          }).sort((a, b) => b.count - a.count)

          return (
            <div key={ch.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, marginBottom: 16, overflow: 'hidden' }}>
              {/* Challenge header */}
              <div style={{ padding: '16px 16px 12px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: C.purpleBg, border: '1px solid rgba(191,90,242,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                    {ch.icon}
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: C.white }}>{ch.title}</div>
                    <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                      {fmtDate(ch.startDate)} – {fmtDate(ch.endDate)} · {ch.target} day target
                    </div>
                  </div>
                </div>
                {isCreator && (
                  <button onClick={() => handleRemoveChallenge(ch.id)} style={{ background: 'none', border: 'none', color: C.faint, fontSize: 18, lineHeight: 1, padding: 4 }}>×</button>
                )}
              </div>

              {/* Progress bar */}
              <div style={{ padding: '0 16px 12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontSize: 11, color: C.muted }}>Day {elapsed} of {totalDays}</span>
                  <span style={{ fontSize: 11, color: C.muted }}>Target: {ch.target} check-ins</span>
                </div>
                <div style={{ height: 4, background: C.faint, borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min((elapsed / totalDays) * 100, 100)}%`, background: `linear-gradient(90deg,${C.purple},#9a3fcc)`, borderRadius: 2, transition: 'width 0.4s ease' }} />
                </div>
              </div>

              {/* Check-in button */}
              {!isExpired && (
                <div style={{ padding: '0 16px 14px' }}>
                  <button onClick={() => handleCheckIn(ch.id, doneToday)} style={{
                    width: '100%', padding: '13px', borderRadius: 12, border: 'none', cursor: 'pointer',
                    background: doneToday ? C.successBg : `linear-gradient(90deg,${C.purple},#9a3fcc)`,
                    border: doneToday ? '1px solid rgba(48,209,88,0.4)' : 'none',
                    fontFamily: font.heading, fontSize: 17, fontWeight: 700, letterSpacing: 1.5,
                    color: doneToday ? C.success : C.white,
                  }}>
                    {doneToday ? '✓ CHECKED IN TODAY' : 'CHECK IN'}
                  </button>
                </div>
              )}
              {isExpired && (
                <div style={{ padding: '0 16px 14px' }}>
                  <div style={{ background: C.card2, borderRadius: 10, padding: '10px', textAlign: 'center', fontSize: 13, color: C.muted }}>Challenge ended</div>
                </div>
              )}

              {/* Leaderboard */}
              <div style={{ borderTop: `1px solid ${C.border}`, padding: '12px 16px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, letterSpacing: 2, marginBottom: 10 }}>LEADERBOARD</div>
                {leaderboard.map((m, i) => {
                  const pct = ch.target > 0 ? Math.min((m.count / ch.target) * 100, 100) : 0
                  const isMe = m.userId === userId
                  return (
                    <div key={m.userId} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <span style={{ fontFamily: font.heading, fontWeight: 900, fontSize: 14, color: i === 0 ? C.orange : C.muted, width: 16, textAlign: 'center' }}>{i + 1}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: isMe ? C.accent : C.white, minWidth: 80, flex: 1 }}>{m.displayName}{isMe ? ' (you)' : ''}</span>
                      <div style={{ flex: 2, height: 6, background: C.faint, borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: i === 0 ? `linear-gradient(90deg,${C.orange},#e08800)` : isMe ? `linear-gradient(90deg,${C.accent},#5856D6)` : `linear-gradient(90deg,${C.success},#20b857)`, borderRadius: 3, transition: 'width 0.4s ease' }} />
                      </div>
                      <span style={{ fontFamily: font.heading, fontWeight: 900, fontSize: 14, color: i === 0 ? C.orange : C.muted, minWidth: 28, textAlign: 'right' }}>{m.count}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        {/* Leave group */}
        {!isCreator && (
          <button onClick={handleLeave} disabled={leaving} style={{ width: '100%', background: 'none', border: `1px solid rgba(255,69,58,0.3)`, borderRadius: 12, padding: '12px', fontSize: 14, fontWeight: 600, color: C.danger, cursor: 'pointer', marginTop: 8 }}>
            {leaving ? 'Leaving...' : 'Leave Group'}
          </button>
        )}
      </div>
    </div>
  )
}

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────
export default function GroupsPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [showJoin, setShowJoin] = useState(false)
  const [activeGroup, setActiveGroup] = useState(null)

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.replace('/login'); return }

    loadUserProfile(user.uid).then(profile => {
      setDisplayName(profile?.displayName || user.email?.split('@')[0] || 'You')
      setIsAdmin(profile?.isAdmin || false)
      if (!profile?.isAdmin) { setLoading(false); return }
      loadUserGroups(user.uid).then(g => { setGroups(g); setLoading(false) })
    })
  }, [user, authLoading])

  if (authLoading || loading) {
    return (
      <div style={{ background: C.bg, minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', border: `3px solid ${C.border}`, borderTopColor: C.accent, animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div style={{ fontFamily: font.body, background: C.bg, minHeight: '100dvh', color: C.white, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, textAlign: 'center' }}>
        <style>{`*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}`}</style>
        <div style={{ fontSize: 52, marginBottom: 20 }}>👥</div>
        <h2 style={{ fontFamily: font.heading, fontSize: 28, fontWeight: 900, letterSpacing: 1, marginBottom: 12 }}>COMING SOON</h2>
        <p style={{ fontSize: 15, color: C.muted, maxWidth: 280, lineHeight: 1.6, marginBottom: 28 }}>
          Fitness groups are on the way. We're putting the finishing touches on to make sure everything works perfectly for you.
        </p>
        <button onClick={() => router.push('/')} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 28px', fontSize: 14, fontWeight: 600, color: C.muted, cursor: 'pointer' }}>
          Back to Home
        </button>
      </div>
    )
  }

  if (activeGroup) {
    return (
      <GroupDetail
        group={activeGroup}
        userId={user.uid}
        displayName={displayName}
        onBack={() => setActiveGroup(null)}
        onGroupUpdated={updated => {
          setActiveGroup(updated)
          setGroups(prev => prev.map(g => g.id === updated.id ? updated : g))
        }}
      />
    )
  }

  return (
    <div style={{ fontFamily: font.body, background: C.bg, minHeight: '100dvh', color: C.white }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;900&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap'); *,*::before,*::after{box-sizing:border-box;margin:0;padding:0} button{cursor:pointer;font-family:inherit} input{font-family:inherit}`}</style>

      {showCreate && (
        <CreateModal displayName={displayName} onClose={() => setShowCreate(false)}
          onCreated={g => { setGroups(prev => [...prev, g]); setShowCreate(false); setActiveGroup(g) }} />
      )}
      {showJoin && (
        <JoinModal displayName={displayName} onClose={() => setShowJoin(false)}
          onJoined={async (groupOrId) => {
            setShowJoin(false)
            const refreshed = await loadUserGroups(user.uid)
            setGroups(refreshed)
            const joined = refreshed.find(g => typeof groupOrId === 'string' ? g.id === groupOrId : g.id === groupOrId?.id)
            if (joined) setActiveGroup(joined)
          }} />
      )}

      {/* Header */}
      <header style={{ position: 'sticky', top: 0, zIndex: 50, background: `${C.bg}f2`, backdropFilter: 'blur(14px)', borderBottom: `1px solid ${C.border}`, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.push('/')} style={{ background: C.card2, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px', color: C.white, lineHeight: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, letterSpacing: 2 }}>LYTZ</div>
            <div style={{ fontFamily: font.heading, fontWeight: 900, fontSize: 22 }}>FITNESS GROUPS</div>
          </div>
        </div>
      </header>

      <div style={{ padding: '20px 16px 40px' }}>

        {/* Create / Join buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 28 }}>
          <button onClick={() => setShowCreate(true)} style={{ background: `linear-gradient(135deg,${C.accent},#5856D6)`, border: 'none', borderRadius: 16, padding: '18px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 24, marginBottom: 4 }}>➕</div>
            <div style={{ fontFamily: font.heading, fontSize: 16, fontWeight: 700, letterSpacing: 1, color: C.white }}>CREATE GROUP</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>Get a shareable code</div>
          </button>
          <button onClick={() => setShowJoin(true)} style={{ background: `linear-gradient(135deg,${C.success},#20b857)`, border: 'none', borderRadius: 16, padding: '18px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 24, marginBottom: 4 }}>🔗</div>
            <div style={{ fontFamily: font.heading, fontSize: 16, fontWeight: 700, letterSpacing: 1, color: C.white }}>JOIN GROUP</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>Enter a friend's code</div>
          </button>
        </div>

        {/* Groups list */}
        {groups.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: C.muted }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>👥</div>
            <div style={{ fontSize: 18, fontWeight: 600, color: C.white, marginBottom: 8 }}>No groups yet</div>
            <div style={{ fontSize: 14 }}>Create a group or join one with a code to get started.</div>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: 2, marginBottom: 12 }}>YOUR GROUPS</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {groups.map(g => {
                const activeChallenges = (g.challenges || []).filter(c => today() <= c.endDate).length
                return (
                  <button key={g.id} onClick={() => setActiveGroup(g)} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: '16px', textAlign: 'left', cursor: 'pointer', width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ fontFamily: font.heading, fontSize: 20, fontWeight: 900, color: C.white, letterSpacing: 0.5 }}>{g.name.toUpperCase()}</div>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <span style={{ background: C.card2, border: `1px solid ${C.border}`, borderRadius: 8, padding: '4px 10px', fontSize: 12, color: C.muted }}>
                        {g.memberIds.length} member{g.memberIds.length !== 1 ? 's' : ''}
                      </span>
                      {activeChallenges > 0 && (
                        <span style={{ background: C.purpleBg, border: '1px solid rgba(191,90,242,0.3)', borderRadius: 8, padding: '4px 10px', fontSize: 12, color: C.purple }}>
                          {activeChallenges} active challenge{activeChallenges !== 1 ? 's' : ''}
                        </span>
                      )}
                      <span style={{ background: C.accentBg, border: '1px solid rgba(10,132,255,0.25)', borderRadius: 8, padding: '4px 10px', fontSize: 12, color: C.accent, fontFamily: font.heading, fontWeight: 700, letterSpacing: 1 }}>
                        {g.code}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
