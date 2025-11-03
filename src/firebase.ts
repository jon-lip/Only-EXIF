import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getAnalytics, isSupported, type Analytics } from 'firebase/analytics'

// Firebase configuration
const firebaseConfig = {
  apiKey: 'AIzaSyANAAs6SdDHo_ob9Ix6aLprkJVnA8m1xdQ',
  authDomain: 'onlyexif.firebaseapp.com',
  projectId: 'onlyexif',
  storageBucket: 'onlyexif.firebasestorage.app',
  messagingSenderId: '962452635370',
  appId: '1:962452635370:web:9be8c1d5d721cc0f412193',
  measurementId: 'G-37CQZZBLN9'
}

export const firebaseApp: FirebaseApp = initializeApp(firebaseConfig)

let analyticsInstance: Analytics | null = null

export async function getAnalyticsInstance(): Promise<Analytics | null> {
  if (analyticsInstance) return analyticsInstance
  if (typeof window === 'undefined') return null
  // Analytics only runs in supported, secure browser contexts
  const supported = await isSupported().catch(() => false)
  if (!supported) return null
  try {
    analyticsInstance = getAnalytics(firebaseApp)
  } catch {
    analyticsInstance = null
  }
  return analyticsInstance
}


