import { initializeApp, getApps } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyCGG2RZtz7PbdJw5QewBl15qKDyibHIAVc",
  authDomain: "edunet-b38ce.firebaseapp.com",
  projectId: "edunet-b38ce",
  storageBucket: "edunet-b38ce.firebasestorage.app",
  messagingSenderId: "608156581464",
  appId: "1:608156581464:web:9746b5e1761bdf6185942d",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

let messagingInstance = null;

function getMessagingInstance() {
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
  if (!("Notification" in window)) return null;
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;

  const messaging = getMessagingInstance();
  if (!messaging) return null;

  try {
    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
    const token = await getToken(messaging, {
      vapidKey: process.env.REACT_APP_FIREBASE_VAPID_KEY,
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

export { app };
