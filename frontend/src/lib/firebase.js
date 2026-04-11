import { initializeApp, getApps } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

// Use env vars with fallback to existing hardcoded values
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "AIzaSyCGG2RZtz7PbdJw5QewBl15qKDyibHIAVc",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "edunet-b38ce.firebaseapp.com",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "edunet-b38ce",
  storageBucket: "edunet-b38ce.firebasestorage.app",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "608156581464",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "1:608156581464:web:9746b5e1761bdf6185942d",
};

const VAPID_KEY = process.env.REACT_APP_FIREBASE_VAPID_KEY || "";

// Check if Firebase is configured (at least projectId is set)
const isFirebaseConfigured = Boolean(firebaseConfig.projectId);

if (!isFirebaseConfigured) {
  console.warn("Firebase no configurado. Push notifications deshabilitadas.");
}

const app = isFirebaseConfigured && getApps().length === 0
  ? initializeApp(firebaseConfig)
  : getApps().length > 0 ? getApps()[0] : null;

let messagingInstance = null;

function getMessagingInstance() {
  if (!app) return null;
  if (!messagingInstance && typeof window !== "undefined" && "Notification" in window) {
    try {
      messagingInstance = getMessaging(app);
    } catch (e) {
      console.warn("Firebase Messaging not supported:", e);
    }
  }
  return messagingInstance;
}

export async function requestNotificationPermission() {
  if (!isFirebaseConfigured || !app) {
    console.warn("Firebase no configurado, skip requestPermission.");
    return null;
  }
  if (!("Notification" in window)) return null;
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;

  const messaging = getMessagingInstance();
  if (!messaging) return null;

  try {
    // Use the existing PWA service worker (which now includes Firebase Messaging
    // via importScripts) instead of registering a separate firebase-messaging-sw.js.
    // This avoids a scope conflict that breaks PWA installability.
    const registration = await navigator.serviceWorker.ready;
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
    return token;
  } catch (e) {
    console.error("Error getting FCM token:", e);
    return null;
  }
}

export function onForegroundMessage(callback) {
  const messaging = getMessagingInstance();
  if (!messaging) return () => {};
  return onMessage(messaging, (payload) => {
    callback(payload);
  });
}

export { app, isFirebaseConfigured };
