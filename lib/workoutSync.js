// lib/workoutSync.js - Workout programs, sessions, and context passing
import { doc, setDoc, getDoc, collection, getDocs, deleteDoc, updateDoc, increment } from 'firebase/firestore'
import { db, isConfigured } from './firebase'

const PROGRAMS_KEY = 'lytz-workout-programs'
const SESSIONS_KEY = 'lytz-workout-sessions'
const ACTIVE_KEY   = 'lytz-workout-active'
const CURRENT_KEY  = 'lytz-workout-current'

// ── Default seed program ────────────────────────────────────────────────────
export const PROGRAM_TYPES = {
  strength:   { label: 'Strength',   emoji: '🏋️', desc: 'Sets, reps & weight tracking' },
  bodyweight: { label: 'Bodyweight', emoji: '💪', desc: 'No equipment, reps only' },
  running:    { label: 'Running',    emoji: '🏃', desc: 'Miles/km & pace tracking' },
  stretching: { label: 'Stretching', emoji: '🧘', desc: 'Hold durations & mobility' },
}

export const DEFAULT_PROGRAM = {
  id: 'ppl-default',
  type: 'strength',
  name: 'Push / Pull / Legs',
  description: '5-day strength & hypertrophy split',
  createdAt: new Date().toISOString(),
  days: [
    {
      id: 'd1', dayNumber: 1, name: 'Chest & Triceps',
      grad: 'linear-gradient(135deg,#0a1628,#1a2744)', accent: '#0A84FF',
      exercises: [
        { id: 'e1', name: 'Barbell Bench Press', sets: [
          { type: 'working', reps: '6-8', weight: '185', rest: '90' },
          { type: 'working', reps: '6-8', weight: '185', rest: '90' },
          { type: 'working', reps: '6-8', weight: '185', rest: '90' },
          { type: 'working', reps: '6-8', weight: '185', rest: '90' },
        ]},
        { id: 'e2', name: 'Incline Dumbbell Press', sets: [
          { type: 'working', reps: '10-12', weight: '70', rest: '75' },
          { type: 'working', reps: '10-12', weight: '70', rest: '75' },
          { type: 'working', reps: '10-12', weight: '70', rest: '75' },
        ]},
        { id: 'e3', name: 'Cable Fly', sets: [
          { type: 'working', reps: '12-15', weight: '40', rest: '60' },
          { type: 'working', reps: '12-15', weight: '40', rest: '60' },
          { type: 'working', reps: '12-15', weight: '40', rest: '60' },
        ]},
        { id: 'e4', name: 'Tricep Pushdown', sets: [
          { type: 'working', reps: '12-15', weight: '55', rest: '60' },
          { type: 'working', reps: '12-15', weight: '55', rest: '60' },
          { type: 'working', reps: '12-15', weight: '55', rest: '60' },
        ]},
        { id: 'e5', name: 'Skull Crushers', sets: [
          { type: 'working', reps: '10-12', weight: '65', rest: '60' },
          { type: 'working', reps: '10-12', weight: '65', rest: '60' },
          { type: 'drop',    reps: '15',    weight: '45', rest: '45' },
        ]},
      ],
    },
    {
      id: 'd2', dayNumber: 2, name: 'Back & Biceps',
      grad: 'linear-gradient(135deg,#0a2818,#183a22)', accent: '#30D158',
      exercises: [
        { id: 'e6', name: 'Deadlift', sets: [
          { type: 'working', reps: '4-6', weight: '275', rest: '120' },
          { type: 'working', reps: '4-6', weight: '275', rest: '120' },
          { type: 'working', reps: '4-6', weight: '275', rest: '120' },
        ]},
        { id: 'e7', name: 'Barbell Row', sets: [
          { type: 'working', reps: '6-8', weight: '165', rest: '90' },
          { type: 'working', reps: '6-8', weight: '165', rest: '90' },
          { type: 'working', reps: '6-8', weight: '165', rest: '90' },
          { type: 'working', reps: '6-8', weight: '165', rest: '90' },
        ]},
        { id: 'e8', name: 'Pull-ups', sets: [
          { type: 'amrap', reps: '∞', weight: 'BW', rest: '90' },
          { type: 'amrap', reps: '∞', weight: 'BW', rest: '90' },
          { type: 'amrap', reps: '∞', weight: 'BW', rest: '90' },
        ]},
        { id: 'e9', name: 'Barbell Curl', sets: [
          { type: 'working', reps: '10-12', weight: '85', rest: '60' },
          { type: 'working', reps: '10-12', weight: '85', rest: '60' },
          { type: 'working', reps: '10-12', weight: '85', rest: '60' },
        ]},
        { id: 'e10', name: 'Hammer Curl', sets: [
          { type: 'working', reps: '12-15', weight: '35', rest: '60' },
          { type: 'drop',    reps: '20',    weight: '25', rest: '45' },
        ]},
      ],
    },
    {
      id: 'd3', dayNumber: 3, name: 'Legs & Glutes',
      grad: 'linear-gradient(135deg,#280a0a,#3a1010)', accent: '#FF453A',
      exercises: [
        { id: 'e11', name: 'Back Squat', sets: [
          { type: 'working', reps: '5', weight: '225', rest: '120' },
          { type: 'working', reps: '5', weight: '225', rest: '120' },
          { type: 'working', reps: '5', weight: '225', rest: '120' },
          { type: 'working', reps: '5', weight: '225', rest: '120' },
          { type: 'working', reps: '5', weight: '225', rest: '120' },
        ]},
        { id: 'e12', name: 'Romanian Deadlift', sets: [
          { type: 'working', reps: '8-10', weight: '185', rest: '90' },
          { type: 'working', reps: '8-10', weight: '185', rest: '90' },
          { type: 'working', reps: '8-10', weight: '185', rest: '90' },
        ]},
        { id: 'e13', name: 'Leg Press', sets: [
          { type: 'working', reps: '12-15', weight: '360', rest: '90' },
          { type: 'working', reps: '12-15', weight: '360', rest: '90' },
          { type: 'drop',    reps: '20',    weight: '270', rest: '60' },
        ]},
        { id: 'e14', name: 'Leg Curl', sets: [
          { type: 'working', reps: '12-15', weight: '120', rest: '60' },
          { type: 'working', reps: '12-15', weight: '120', rest: '60' },
          { type: 'working', reps: '12-15', weight: '120', rest: '60' },
        ]},
        { id: 'e15', name: 'Calf Raise', sets: [
          { type: 'working', reps: '15-20', weight: '160', rest: '45' },
          { type: 'working', reps: '15-20', weight: '160', rest: '45' },
          { type: 'amrap',   reps: '∞',     weight: '130', rest: '45' },
        ]},
      ],
    },
    {
      id: 'd4', dayNumber: 4, name: 'Shoulders & Traps',
      grad: 'linear-gradient(135deg,#1a0a28,#2a1440)', accent: '#BF5AF2',
      exercises: [
        { id: 'e16', name: 'Overhead Press', sets: [
          { type: 'working', reps: '6-8', weight: '135', rest: '90' },
          { type: 'working', reps: '6-8', weight: '135', rest: '90' },
          { type: 'working', reps: '6-8', weight: '135', rest: '90' },
          { type: 'working', reps: '6-8', weight: '135', rest: '90' },
        ]},
        { id: 'e17', name: 'Lateral Raise', sets: [
          { type: 'working', reps: '12-15', weight: '25', rest: '60' },
          { type: 'working', reps: '12-15', weight: '25', rest: '60' },
          { type: 'drop',    reps: '20',    weight: '15', rest: '45' },
        ]},
        { id: 'e18', name: 'Front Raise', sets: [
          { type: 'working', reps: '12-15', weight: '25', rest: '60' },
          { type: 'working', reps: '12-15', weight: '25', rest: '60' },
          { type: 'working', reps: '12-15', weight: '25', rest: '60' },
        ]},
        { id: 'e19', name: 'Barbell Shrug', sets: [
          { type: 'working', reps: '10-12', weight: '225', rest: '60' },
          { type: 'working', reps: '10-12', weight: '225', rest: '60' },
          { type: 'working', reps: '10-12', weight: '225', rest: '60' },
        ]},
      ],
    },
    {
      id: 'd5', dayNumber: 5, name: 'Arms',
      grad: 'linear-gradient(135deg,#28180a,#3a2810)', accent: '#FF9F0A',
      exercises: [
        { id: 'e20', name: 'Barbell Curl', sets: [
          { type: 'working', reps: '8-10', weight: '95', rest: '75' },
          { type: 'working', reps: '8-10', weight: '95', rest: '75' },
          { type: 'working', reps: '8-10', weight: '95', rest: '75' },
        ]},
        { id: 'e21', name: 'Preacher Curl', sets: [
          { type: 'working', reps: '10-12', weight: '70', rest: '60' },
          { type: 'working', reps: '10-12', weight: '70', rest: '60' },
          { type: 'drop',    reps: '15',    weight: '50', rest: '45' },
        ]},
        { id: 'e22', name: 'Close Grip Bench', sets: [
          { type: 'working', reps: '8-10', weight: '145', rest: '75' },
          { type: 'working', reps: '8-10', weight: '145', rest: '75' },
          { type: 'working', reps: '8-10', weight: '145', rest: '75' },
        ]},
        { id: 'e23', name: 'Overhead Tricep Extension', sets: [
          { type: 'working', reps: '10-12', weight: '90', rest: '60' },
          { type: 'working', reps: '10-12', weight: '90', rest: '60' },
          { type: 'drop',    reps: '15',    weight: '65', rest: '45' },
        ]},
      ],
    },
  ],
}

// ── Local storage helpers ───────────────────────────────────────────────────
export function getPrograms() {
  if (typeof window === 'undefined') return [DEFAULT_PROGRAM]
  try {
    const data = localStorage.getItem(PROGRAMS_KEY)
    if (data) return JSON.parse(data)
    const defaults = [DEFAULT_PROGRAM]
    localStorage.setItem(PROGRAMS_KEY, JSON.stringify(defaults))
    return defaults
  } catch { return [DEFAULT_PROGRAM] }
}

export function savePrograms(programs) {
  if (typeof window === 'undefined') return
  localStorage.setItem(PROGRAMS_KEY, JSON.stringify(programs))
}

export function getActiveProgramId() {
  if (typeof window === 'undefined') return DEFAULT_PROGRAM.id
  return localStorage.getItem(ACTIVE_KEY) || DEFAULT_PROGRAM.id
}

export function setActiveProgramId(id) {
  if (typeof window === 'undefined') return
  localStorage.setItem(ACTIVE_KEY, id)
}

export function getSessions() {
  if (typeof window === 'undefined') return []
  try {
    const data = localStorage.getItem(SESSIONS_KEY)
    return data ? JSON.parse(data) : []
  } catch { return [] }
}

export function saveSession(session) {
  if (typeof window === 'undefined') return
  const sessions = getSessions()
  sessions.unshift(session)
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions))
}

// Passing workout context between pages (home → detail → log)
export function setCurrentWorkout(programId, dayId) {
  if (typeof window === 'undefined') return
  localStorage.setItem(CURRENT_KEY, JSON.stringify({ programId, dayId }))
}

export function getCurrentWorkout() {
  if (typeof window === 'undefined') return null
  try {
    const data = localStorage.getItem(CURRENT_KEY)
    return data ? JSON.parse(data) : null
  } catch { return null }
}

// Returns Set of dayIds completed in the current ISO week
export function getCompletedDaysThisWeek(sessions, programId) {
  const now = new Date()
  const dayOfWeek = now.getDay() // 0=Sun
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7))
  monday.setHours(0, 0, 0, 0)

  const completed = new Set()
  sessions.forEach((s) => {
    if (s.programId !== programId) return
    const d = new Date(s.date)
    if (d >= monday) completed.add(s.dayId)
  })
  return completed
}

// ── Firestore sync ─────────────────────────────────────────────────────────
export async function syncProgramsToFirestore(userId, programs) {
  if (!isConfigured || !db || !userId) return
  try {
    await setDoc(
      doc(db, 'users', userId, 'workout', 'programs'),
      { programs, updatedAt: new Date().toISOString() }
    )
  } catch (e) { console.error('Workout sync error:', e) }
}

export async function loadProgramsFromFirestore(userId) {
  if (!isConfigured || !db || !userId) return null
  try {
    const snap = await getDoc(doc(db, 'users', userId, 'workout', 'programs'))
    return snap.exists() ? snap.data().programs : null
  } catch { return null }
}

export async function syncSessionToFirestore(userId, session) {
  if (!isConfigured || !db || !userId) return
  try {
    await setDoc(doc(db, 'users', userId, 'workoutSessions', session.id), session)
  } catch (e) { console.error('Session sync error:', e) }
}

// ── Public workout sharing ──────────────────────────────────────────────────
export async function publishProgram(userId, program) {
  if (!isConfigured || !db || !userId) return false
  try {
    await setDoc(doc(db, 'publicWorkouts', program.id), {
      ...program,
      authorId: userId,
      publishedAt: new Date().toISOString(),
    })
    return true
  } catch (e) { console.error('Publish error:', e); return false }
}

export async function unpublishProgram(programId) {
  if (!isConfigured || !db) return
  try { await deleteDoc(doc(db, 'publicWorkouts', programId)) }
  catch (e) { console.error('Unpublish error:', e) }
}

export async function getPublicPrograms() {
  if (!isConfigured || !db) return []
  try {
    const snap = await getDocs(collection(db, 'publicWorkouts'))
    return snap.docs.map(d => d.data())
  } catch { return [] }
}

export async function incrementProgramCopies(programId, delta = 1) {
  if (!isConfigured || !db) return
  try {
    await updateDoc(doc(db, 'publicWorkouts', programId), { copies: increment(delta) })
  } catch { /* program might be demo/local */ }
}
