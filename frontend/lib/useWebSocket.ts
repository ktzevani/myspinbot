// lib/useWebSocket.ts
"use client";

import { useEffect, useRef } from "react";
import type { Job } from "./api";
import { wsUrl } from "./api";

type OnUpdate = (update: Partial<Job> & { jobId: string }) => void;

export function useWebSocket(onUpdate: OnUpdate) {
  const socketRef = useRef<WebSocket | null>(null);
  const backoffRef = useRef(500); // ms, capped

  useEffect(() => {
    let aborted = false;

    const connect = () => {
      if (aborted) return;
      const ws = new WebSocket(wsUrl());
      socketRef.current = ws;

      ws.onopen = () => {
        backoffRef.current = 500;
      };

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data as string);
          // Expecting: { jobId, status, progress, type, resultUrl, parentJobId, prompt }
          if (msg && msg.jobId) onUpdate(msg);
        } catch {
          // ignore malformed
        }
      };

      ws.onclose = () => {
        if (aborted) return;
        const delay = Math.min(backoffRef.current, 8000);
        setTimeout(connect, delay);
        backoffRef.current = Math.min(backoffRef.current * 2, 8000);
      };

      ws.onerror = () => ws.close();
    };

    connect();
    return () => {
      aborted = true;
      socketRef.current?.close();
    };
  }, [onUpdate]);
}
