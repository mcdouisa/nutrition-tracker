// lib/aiFetch.js — calls Lytz's AI routes as the signed-in person.
// The routes refuse requests without a valid (non-anonymous) sign-in token.

import { auth } from './firebase'

export const AI_SIGN_IN_MESSAGE = 'Sign in to use AI features.'

export async function aiFetch(url, options = {}) {
  const user = auth?.currentUser
  if (!user || user.isAnonymous) throw new Error(AI_SIGN_IN_MESSAGE)
  const token = await user.getIdToken()
  return fetch(url, {
    ...options,
    headers: { ...(options.headers || {}), Authorization: `Bearer ${token}` },
  })
}
