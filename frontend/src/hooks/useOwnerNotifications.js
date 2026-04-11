import { useEffect, useRef } from "react";
import { requestNotificationPermission, onForegroundMessage } from "../lib/firebase";

const API = process.env.REACT_APP_BACKEND_URL;

const OWNER_LIKE_ROLES = ["owner", "admin", "director", "super_admin", "coordinator"];

/**
 * Hook that requests browser notification permissions and registers
 * the FCM device token for Owner / Admin / Director roles.
 * Mirrors what useParentNotifications does for parent users.
 */
export function useOwnerNotifications(token, userRole) {
  const registeredRef = useRef(false);
  const isOwnerLike = OWNER_LIKE_ROLES.includes(userRole);

  // Register FCM token on mount (once)
  useEffect(() => {
    if (!token || !isOwnerLike || registeredRef.current) return;
    registeredRef.current = true;

    (async () => {
      try {
        const fcmToken = await requestNotificationPermission();
        if (fcmToken) {
          await fetch(`${API}/api/notifications/register-device`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              fcm_token: fcmToken,
              platform: "web",
              user_agent: navigator.userAgent,
            }),
          });
        }
      } catch (e) {
        console.warn("Owner FCM registration failed:", e);
      }
    })();
  }, [token, isOwnerLike]);

  // Foreground FCM listener — triggers notification refresh in NotificationBell
  useEffect(() => {
    if (!token || !isOwnerLike) return;
    const unsubscribe = onForegroundMessage((payload) => {
      console.log("[Owner FCM] Foreground message:", payload?.notification?.title);
    });
    return unsubscribe;
  }, [token, isOwnerLike]);
}
