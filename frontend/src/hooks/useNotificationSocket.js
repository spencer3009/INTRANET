import { useEffect, useCallback, useState } from "react";

/**
 * Singleton WebSocket connection for /api/ws/notifications.
 *
 * Why singleton?
 *   Previously every mount of NotificationBell (and any other consumer)
 *   spawned its own WebSocket, so the same user could hold 4+ open WS
 *   connections simultaneously, wasting backend memory and complicating
 *   the active_sessions tracker.
 *
 * Behavior:
 *   - First subscriber opens the socket.
 *   - Subsequent subscribers reuse the same socket (just add a listener).
 *   - Socket is only torn down when the LAST subscriber unmounts AND
 *     there are no reconnection attempts pending (logout/app close path).
 *   - Reconnect with exponential backoff (5s → 10s → 20s, capped at 30s).
 */

let ws = null;
let currentToken = null;
let reconnectTimer = null;
let pingTimer = null;
let reconnectAttempts = 0;
let manualClose = false;
const listeners = new Set();         // Set<(data) => void>
const statusListeners = new Set();   // Set<(isConnected: boolean) => void>

function _notifyStatus(isConnected) {
  statusListeners.forEach((cb) => {
    try { cb(isConnected); } catch { /* ignore */ }
  });
}

function _broadcast(data) {
  listeners.forEach((cb) => {
    try { cb(data); } catch { /* ignore */ }
  });
}

function _openSocket(token) {
  const backendUrl = process.env.REACT_APP_BACKEND_URL || window.location.origin;
  const wsProtocol = window.location.protocol === "https:" ? "wss" : "ws";
  const wsHost = backendUrl.replace(/^https?:\/\//, "") || window.location.host;
  const url = `${wsProtocol}://${wsHost}/api/ws/notifications?token=${token}`;

  try {
    ws = new WebSocket(url);
  } catch {
    _scheduleReconnect(token);
    return;
  }

  ws.onopen = () => {
    reconnectAttempts = 0;
    _notifyStatus(true);
    // Keepalive: ping every 30s
    clearInterval(pingTimer);
    pingTimer = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) ws.send("ping");
    }, 30000);
  };

  ws.onmessage = (event) => {
    if (event.data === "pong") return;
    try {
      const data = JSON.parse(event.data);
      _broadcast(data);
    } catch {
      /* ignore non-JSON */
    }
  };

  ws.onclose = () => {
    _notifyStatus(false);
    clearInterval(pingTimer);
    pingTimer = null;
    ws = null;
    if (!manualClose && listeners.size > 0) {
      _scheduleReconnect(currentToken);
    }
  };

  ws.onerror = () => {
    try { ws && ws.close(); } catch { /* ignore */ }
  };
}

function _scheduleReconnect(token) {
  if (reconnectTimer) return;
  reconnectAttempts += 1;
  const delay = Math.min(5000 * Math.pow(2, reconnectAttempts - 1), 30000);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (listeners.size > 0 && token) _openSocket(token);
  }, delay);
}

function _ensureConnection(token) {
  if (!token) return;
  manualClose = false;
  // If socket already open for same token, nothing to do
  if (ws && ws.readyState === WebSocket.OPEN && currentToken === token) return;
  // If token changed while socket was open, close old one first
  if (ws && currentToken !== token) {
    manualClose = true;
    try { ws.close(); } catch { /* ignore */ }
    ws = null;
    manualClose = false;
  }
  currentToken = token;
  if (!ws || ws.readyState >= WebSocket.CLOSING) {
    _openSocket(token);
  }
}

/**
 * Send a page-view event through the shared socket so the Support Panel
 * can display the page each connected user is currently viewing.
 * Safely no-ops if the socket is not open.
 */
export function sendPageView(pageName, requestCount = 0) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(JSON.stringify({
        type: "page_view",
        page: pageName,
        request_count: requestCount,
      }));
    } catch { /* ignore */ }
  }
}

/**
 * Call on logout / app close to tear down the shared socket.
 * Components that just unmount should NOT call this; they just
 * unsubscribe via the useEffect cleanup returned by the hook.
 */
export function closeNotificationSocket() {
  manualClose = true;
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
  if (ws) {
    try { ws.close(); } catch { /* ignore */ }
    ws = null;
  }
  currentToken = null;
  reconnectAttempts = 0;
}

export function useNotificationSocket(token, onNotification) {
  const [isConnected, setIsConnected] = useState(
    () => !!(ws && ws.readyState === WebSocket.OPEN)
  );

  const handleStatus = useCallback((connected) => {
    setIsConnected(connected);
  }, []);

  useEffect(() => {
    if (!token || !onNotification) return undefined;
    listeners.add(onNotification);
    statusListeners.add(handleStatus);
    _ensureConnection(token);
    return () => {
      listeners.delete(onNotification);
      statusListeners.delete(handleStatus);
      // Do NOT close the socket here — other components may still use it.
      // closeNotificationSocket() is only called from logout.
    };
  }, [token, onNotification, handleStatus]);

  return { isConnected };
}
