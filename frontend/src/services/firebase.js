import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Firebase's web config is public client configuration, not an Admin secret.
// Defaults let the Vercel build work even when optional VITE_* overrides have
// not been added in the project dashboard.
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyCRakMImm2C_h8DWzIdsymz9p7s8Gw6qFU',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'freshcatch-ai.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'freshcatch-ai',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'freshcatch-ai.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '700006049129',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:700006049129:web:7a4aae56c6be2d434c49f8'
};

const missing = Object.entries(config).filter(([, value]) => !value).map(([key]) => key);
if (missing.length) {
  console.warn(`Firebase is not configured. Set the VITE_FIREBASE_* variables (missing: ${missing.join(', ')}).`);
}

const app = initializeApp(config);
export const firebaseAuth = getAuth(app);
export const firestore = getFirestore(app);
