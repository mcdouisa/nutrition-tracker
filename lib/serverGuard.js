// lib/serverGuard.js — protects the AI routes (server only).
// Every AI call must come from a signed-in Lytz account (not anonymous), stay
// under per-person limits, and send a reasonably sized request.

import { createRemoteJWKSet, jwtVerify } from 'jose'
import { NextResponse } from 'next/server'

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
const GOOGLE_KEYS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
)

// Per person: requests per hour and per day. Counted per server instance, so
// this is a brake on abuse, not an exact quota (set a Groq spend cap too).
const LIMITS = { hour: 60, day: 300 }
const usage = new Map() // uid -> timestamps (ms)

async function verifyUser(request) {
  const header = request.headers.get('authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token || !PROJECT_ID) return null
  try {
    const { payload } = await jwtVerify(token, GOOGLE_KEYS, {
      issuer: `https://securetoken.google.com/${PROJECT_ID}`,
      audience: PROJECT_ID,
    })
    // Anonymous accounts are free to create in bulk, so they don't get AI
    if (!payload.sub || payload.firebase?.sign_in_provider === 'anonymous') return null
    return payload.sub
  } catch {
    return null
  }
}

function overLimit(uid) {
  const now = Date.now()
  const recent = (usage.get(uid) || []).filter(t => now - t < 864e5)
  const lastHour = recent.filter(t => now - t < 36e5).length
  if (lastHour >= LIMITS.hour || recent.length >= LIMITS.day) {
    usage.set(uid, recent)
    return true
  }
  recent.push(now)
  usage.set(uid, recent)
  if (usage.size > 5000) usage.delete(usage.keys().next().value)
  return false
}

// Returns { uid } when the request may go ahead, or { response } to send back instead
export async function guardAiRequest(request) {
  const uid = await verifyUser(request)
  if (!uid) {
    return { response: NextResponse.json({ error: 'Sign in to use AI features.' }, { status: 401 }) }
  }
  if (overLimit(uid)) {
    return { response: NextResponse.json({ error: "You've hit today's AI limit. Try again later." }, { status: 429 }) }
  }
  return { uid }
}

// Reject bodies over maxBytes before reading them
export function tooLarge(request, maxBytes) {
  const length = Number(request.headers.get('content-length') || 0)
  return length > maxBytes
}

export const tooLargeResponse = () =>
  NextResponse.json({ error: 'That request is too large.' }, { status: 413 })

// Generic message for anything that went wrong upstream (details stay in server logs)
export const aiErrorResponse = (status = 502) =>
  NextResponse.json({ error: "The AI couldn't answer right now. Try again in a moment." }, { status })

// A data URL image no larger than ~4.5 MB
export function validImage(image) {
  return typeof image === 'string' && /^data:image\/(jpeg|png|webp|heic|heif);base64,/.test(image) && image.length < 6_000_000
}
