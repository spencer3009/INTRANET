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
let authRejected = false;  // true after server rejects WS with 403/1008
let lastPageView = null;   // { page, requestCount } — resent on every (re)open
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
    // Resend last known page view so the Support Panel populates even if
    // the route was visited before the socket finished connecting.
    if (lastPageView) {
      try {
        ws.send(JSON.stringify({
          type: "page_view",
          page: lastPageView.page,
          request_count: lastPageView.requestCount,
        }));
      } catch { /* ignore */ }
    }
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

  ws.onclose = (event) => {
    _notifyStatus(false);
    clearInterval(pingTimer);
    pingTimer = null;
    ws = null;
    // 1008 (Policy Violation) or 4401/4403 => FastAPI rejected the WS
    // because the JWT is missing/expired/invalid. Do NOT reconnect:
    // every retry will fail the same way, spamming the backend logs
    // and masking the real cause.
    const code = event?.code;
    const isAuthReject = code === 1008 || code === 4401 || code === 4403;
    if (isAuthReject) {
      authRejected = true;
      manualClose = true;
      reconnectAttempts = 0;
      if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
      try {
        window.dispatchEvent(new CustomEvent("auth:expired", {
          detail: { source: "websocket", code }
        }));
      } catch { /* ignore */ }
      return;
    }
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
  // If we've already been told by the server that this token is invalid,
  // refuse to try again until closeNotificationSocket() is called (which
  // happens on login / explicit logout / new token).
  if (authRejected) return;
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
  // Always cache the latest navigation so we can replay it when the socket
  // (re)opens — fixes cases where the tracker fires before the WS is ready.
  lastPageView = { page: pageName, requestCount };
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
  authRejected = false;   // reset so a fresh login can reopen the socket
  lastPageView = null;   // wipe on logout so next user doesn't inherit it
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
