// Firebase configuration
// ⚠️ Replace these values with your Firebase project config
// Get them from: Firebase Console → Project Settings → General → Your apps → Web app

import { initializeApp } from 'firebase/app';
import {
  initializeAuth,
  // @ts-ignore - getReactNativePersistence is exported from RN-specific entry
  getReactNativePersistence,
  getAuth,
} from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: "AIzaSyAArmcZLmi67OLq1IqZzN8dsK3AygxHAak",
  authDomain: "securityiniot.firebaseapp.com",
  projectId: "securityiniot",
  storageBucket: "securityiniot.firebasestorage.app",
  messagingSenderId: "346987293181",
  appId: "1:346987293181:web:a17da4ad33390668ab1194",
  measurementId: "G-509HCZB2WY",
  databaseURL: "https://securityiniot-default-rtdb.asia-southeast1.firebasedatabase.app",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Note: Mobile App không truy cập Realtime Database trực tiếp nữa
// Tất cả dữ liệu đi qua Backend API (bảo mật hơn)

// Initialize Firebase Auth with persistence
let auth: ReturnType<typeof getAuth>;

if (typeof getReactNativePersistence === 'function') {
  // React Native environment
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} else {
  // Fallback (web or Node)
  auth = getAuth(app);
}

export { auth };
export default app;
