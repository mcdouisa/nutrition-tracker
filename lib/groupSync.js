import { doc, setDoc, getDoc, getDocs, updateDoc, collection, query, where, arrayUnion, arrayRemove } from 'firebase/firestore'
import { db, isConfigured } from './firebase'

function generateCode(len = 6) {
  // No I, O, 0, 1 to avoid confusion when sharing verbally
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export async function createGroup(userId, name, displayName) {
  if (!isConfigured || !db) return null
  const code = generateCode()
  const groupId = `g-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  const group = {
    id: groupId, name, code,
    createdBy: userId,
    createdAt: new Date().toISOString(),
    memberIds: [userId],
    challenges: [],
  }
  await setDoc(doc(db, 'groups', groupId), group)
  await setDoc(doc(db, 'groupCodes', code), { groupId })
  await setDoc(doc(db, 'groups', groupId, 'members', userId), {
    userId, displayName, joinedAt: new Date().toISOString(), isCreator: true,
  })
  return group
}

export async function joinGroup(userId, code, displayName) {
  if (!isConfigured || !db) return { error: 'Not configured' }
  const codeSnap = await getDoc(doc(db, 'groupCodes', code.toUpperCase().trim()))
  if (!codeSnap.exists()) return { error: 'Invalid code — double-check and try again' }
  const { groupId } = codeSnap.data()
  const groupSnap = await getDoc(doc(db, 'groups', groupId))
  if (!groupSnap.exists()) return { error: 'Group not found' }
  const group = groupSnap.data()
  if (group.memberIds.includes(userId)) return { error: 'You\'re already in this group' }
  await updateDoc(doc(db, 'groups', groupId), { memberIds: arrayUnion(userId) })
  await setDoc(doc(db, 'groups', groupId, 'members', userId), {
    userId, displayName, joinedAt: new Date().toISOString(), isCreator: false,
  })
  return { groupId, group }
}

export async function loadUserGroups(userId) {
  if (!isConfigured || !db) return []
  try {
    const q = query(collection(db, 'groups'), where('memberIds', 'array-contains', userId))
    const snap = await getDocs(q)
    return snap.docs.map(d => d.data())
  } catch { return [] }
}

export async function loadGroupMembers(groupId) {
  if (!isConfigured || !db) return []
  try {
    const snap = await getDocs(collection(db, 'groups', groupId, 'members'))
    return snap.docs.map(d => d.data())
  } catch { return [] }
}

export async function addChallenge(groupId, challenge) {
  if (!isConfigured || !db) return
  const ref = doc(db, 'groups', groupId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return
  await updateDoc(ref, { challenges: [...(snap.data().challenges || []), challenge] })
}

export async function removeChallenge(groupId, challengeId) {
  if (!isConfigured || !db) return
  const ref = doc(db, 'groups', groupId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return
  await updateDoc(ref, {
    challenges: snap.data().challenges.filter(c => c.id !== challengeId)
  })
}

export async function checkInChallenge(groupId, userId, challengeId, dateStr) {
  if (!isConfigured || !db) return
  const ref = doc(db, 'groups', groupId, 'progress', userId)
  await setDoc(ref, {
    [challengeId]: { checkIns: arrayUnion(dateStr) },
    updatedAt: new Date().toISOString(),
  }, { merge: true })
}

export async function uncheckInChallenge(groupId, userId, challengeId, dateStr) {
  if (!isConfigured || !db) return
  const ref = doc(db, 'groups', groupId, 'progress', userId)
  await setDoc(ref, {
    [challengeId]: { checkIns: arrayRemove(dateStr) },
    updatedAt: new Date().toISOString(),
  }, { merge: true })
}

export async function loadGroupProgress(groupId) {
  if (!isConfigured || !db) return {}
  try {
    const snap = await getDocs(collection(db, 'groups', groupId, 'progress'))
    const out = {}
    snap.docs.forEach(d => { out[d.id] = d.data() })
    return out
  } catch { return {} }
}

export async function leaveGroup(groupId, userId) {
  if (!isConfigured || !db) return
  await updateDoc(doc(db, 'groups', groupId), { memberIds: arrayRemove(userId) })
}

// ── Shared data (opt-in per group) ────────────────────────────────────────────

export async function setSharing(groupId, userId, sharing) {
  if (!isConfigured || !db) return
  await setDoc(doc(db, 'groups', groupId, 'sharedData', userId), {
    sharing, updatedAt: new Date().toISOString()
  }, { merge: true })
}

export async function pushWeightToGroup(groupId, userId, weightHistory) {
  if (!isConfigured || !db) return
  await setDoc(doc(db, 'groups', groupId, 'sharedData', userId), {
    weightHistory, updatedAt: new Date().toISOString()
  }, { merge: true })
}

export async function loadGroupSharedData(groupId) {
  if (!isConfigured || !db) return {}
  try {
    const snap = await getDocs(collection(db, 'groups', groupId, 'sharedData'))
    const out = {}
    snap.docs.forEach(d => { out[d.id] = d.data() })
    return out
  } catch { return {} }
}

// Push weight to all groups where the user has bodyWeight sharing enabled
export async function syncWeightToGroups(userId, weightHistory) {
  if (!isConfigured || !db) return
  try {
    const q = query(collection(db, 'groups'), where('memberIds', 'array-contains', userId))
    const snap = await getDocs(q)
    await Promise.all(snap.docs.map(async groupDoc => {
      const groupId = groupDoc.id
      const sharedSnap = await getDoc(doc(db, 'groups', groupId, 'sharedData', userId))
      if (sharedSnap.exists() && sharedSnap.data().sharing?.bodyWeight) {
        await pushWeightToGroup(groupId, userId, weightHistory)
      }
    }))
  } catch (e) { console.error('Weight sync to groups failed:', e) }
}
