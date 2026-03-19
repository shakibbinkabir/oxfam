import { useEffect, useRef, useState } from "react";

const WS_URL = (import.meta.env.VITE_WS_URL || "ws://localhost:8000") + "/api/v1/ws";
const RECONNECT_DELAY = 3000;
const PING_INTERVAL = 30000;

export default function useWebSocket(onMessage) {
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);
  const pingTimer = useRef(null);
  const onMessageRef = useRef(onMessage);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    onMessageRef.current = onMessage;
  });

  useEffect(() => {
    function connect() {
      if (wsRef.current?.readyState === WebSocket.OPEN) return;

      try {
        const ws = new WebSocket(WS_URL);

        ws.onopen = () => {
          setConnected(true);
          pingTimer.current = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send("ping");
            }
          }, PING_INTERVAL);
        };

        ws.onmessage = (event) => {
          if (event.data === "pong") return;
          try {
            const data = JSON.parse(event.data);
            onMessageRef.current?.(data);
          } catch {
            // ignore non-JSON messages
          }
        };

        ws.onclose = () => {
          setConnected(false);
          clearInterval(pingTimer.current);
          reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY);
        };

        ws.onerror = () => {
          ws.close();
        };

        wsRef.current = ws;
      } catch {
        reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY);
      }
    }

    connect();

    return () => {
      clearTimeout(reconnectTimer.current);
      clearInterval(pingTimer.current);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return { connected };
}
