import { useState, useEffect, useCallback, useRef } from "react";
import { requestNotificationPermission, onForegroundMessage } from "../lib/firebase";

const API = process.env.REACT_APP_BACKEND_URL;

export function useParentNotifications(token) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const registeredRef = useRef(false);

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  // Register FCM token
  useEffect(() => {
    if (!token || registeredRef.current) return;
    registeredRef.current = true;

    (async () => {
      try {
        const fcmToken = await requestNotificationPermission();
        if (fcmToken) {
          await fetch(`${API}/api/notifications/register-token`, {
            method: "POST",
            headers,
            body: JSON.stringify({ token: fcmToken }),
          });
        }
      } catch (e) {
        console.warn("FCM registration failed:", e);
      }
    })();
  }, [token]);

  // Fetch unread count
  const fetchUnreadCount = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/api/notifications/unread-count`, { headers });
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.count);
      }
    } catch {}
  }, [token]);

  // Fetch notifications list
  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/notifications/list`, { headers });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch {}
    setLoading(false);
  }, [token]);

  // Mark as read
  const markRead = useCallback(async (notificationId = null) => {
    if (!token) return;
    await fetch(`${API}/api/notifications/mark-read`, {
      method: "POST",
      headers,
      body: JSON.stringify({ notification_id: notificationId }),
    });
    fetchUnreadCount();
    fetchNotifications();
  }, [token]);

  // Listen for foreground messages
  useEffect(() => {
    if (!token) return;
    const unsubscribe = onForegroundMessage((payload) => {
      fetchUnreadCount();
      fetchNotifications();
    });
    return unsubscribe;
  }, [token]);

  // Initial fetch + poll every 30s
  useEffect(() => {
    if (!token) return;
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [token, fetchUnreadCount]);

  return {
    unreadCount,
    notifications,
    loading,
    fetchNotifications,
    fetchUnreadCount,
    markRead,
  };
}
