import { useEffect, useRef, useCallback, useState } from "react";

/**
 * Custom hook for WebSocket connection to receive real-time notifications.
 * Automatically connects, reconnects on disconnect, and handles ping/pong keepalive.
 */
export function useNotificationSocket(token, onNotification) {
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);
  const pingTimer = useRef(null);
  const [isConnected, setIsConnected] = useState(false);

  const connect = useCallback(() => {
    if (!token) return;

    // Build WebSocket URL from the backend URL or current location
    const backendUrl = process.env.REACT_APP_BACKEND_URL || window.location.origin;
    const wsProtocol = window.location.protocol === "https:" ? "wss" : "ws";
    const wsHost = backendUrl.replace(/^https?:\/\//, "") || window.location.host;
    const wsUrl = `${wsProtocol}://${wsHost}/api/ws/notifications?token=${token}`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        // Start keepalive ping every 30 seconds
        pingTimer.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send("ping");
          }
        }, 30000);
      };

      ws.onmessage = (event) => {
        if (event.data === "pong") return; // Ignore keepalive response
        try {
          const data = JSON.parse(event.data);
          if (onNotification) {
            onNotification(data);
          }
        } catch (e) {
          // Ignore non-JSON messages
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        clearInterval(pingTimer.current);
        // Reconnect after 5 seconds
        reconnectTimer.current = setTimeout(connect, 5000);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch (e) {
      // Retry after 5 seconds on error
      reconnectTimer.current = setTimeout(connect, 5000);
    }
  }, [token, onNotification]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      clearInterval(pingTimer.current);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return { isConnected };
}
