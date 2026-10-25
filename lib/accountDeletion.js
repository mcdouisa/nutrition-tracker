// lib/accountDeletion.js — permanently delete a person's account and everything stored about them.
// Order: confirm identity first, then delete data, then the sign-in itself, then this device's copy.

import { db, auth } from './firebase'
import {
  collection, getDocs, doc, deleteDoc, query, where, updateDoc, arrayRemove, writeBatch
} from 'firebase/firestore'
import { EmailAuthProvider, reauthenticateWithCredential, deleteUser } from 'firebase/auth'
import { clearDeviceStorage, clearDeviceDatabase } from './deviceData'

// Everything stored under users/{uid}
const USER_COLLECTIONS = ['dailyData', 'history', 'notifications', 'bodyWeight', 'workoutSessions', 'settings', 'workout']

async function deleteAll(snapshot) {
  const docs = snapshot.docs
  for (let i = 0; i < docs.length; i += 400) {
    const batch = writeBatch(db)
    docs.slice(i, i + 400).forEach(d => batch.delete(d.ref))
    await batch.commit()
  }
}

// Step 1: prove it's really them (Firebase requires a recent sign-in to delete an account)
export async function confirmIdentity(password) {
  const user = auth?.currentUser
  if (!user) throw new Error('You are not signed in.')
  if (!user.email) return // non-password sign-in methods don't need this here
  try {
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password))
  } catch (e) {
    if (['auth/wrong-password', 'auth/invalid-credential'].includes(e.code)) throw new Error('That password is incorrect.')
    if (e.code === 'auth/too-many-requests') throw new Error('Too many attempts. Wait a few minutes and try again.')
    throw new Error('Could not confirm it is you. Please try again.')
  }
}

// Step 2: delete every piece of data, then the account, then this device's copy
export async function deleteAccountAndData(onProgress = () => {}) {
  const user = auth?.currentUser
  if (!user || !db) throw new Error('You are not signed in.')
  const uid = user.uid

  onProgress('Deleting your logs and settings…')
  for (const name of USER_COLLECTIONS) {
    await deleteAll(await getDocs(collection(db, 'users', uid, name)))
  }

  onProgress('Removing you from groups…')
  const groups = await getDocs(query(collection(db, 'groups'), where('memberIds', 'array-contains', uid)))
  for (const g of groups.docs) {
    for (const sub of ['members', 'progress', 'sharedData']) {
      await deleteDoc(doc(db, 'groups', g.id, sub, uid)).catch(() => {})
    }
    await updateDoc(g.ref, { memberIds: arrayRemove(uid) })
  }

  onProgress('Deleting shared programs and feedback…')
  await deleteAll(await getDocs(query(collection(db, 'publicWorkouts'), where('authorId', '==', uid))))
  await deleteAll(await getDocs(query(collection(db, 'feedback'), where('userId', '==', uid))))

  onProgress('Deleting your profile…')
  await deleteDoc(doc(db, 'userProfiles', uid)).catch(() => {})
  await deleteDoc(doc(db, 'users', uid)).catch(() => {})

  onProgress('Deleting your account…')
  await deleteUser(user)

  clearDeviceStorage()
  await clearDeviceDatabase()
}

// For people using Lytz without an account: everything lives on this device
export async function deleteDeviceOnlyData() {
  clearDeviceStorage()
  await clearDeviceDatabase()
}
