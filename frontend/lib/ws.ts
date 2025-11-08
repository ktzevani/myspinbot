// lib/ws.ts
"use client";

import { useCallback, useEffect, useRef } from "react";
import type { Job } from "./api";
import { wsUrl } from "./api";
import { WsAction, WsResponse } from "./enums";

type OnUpdate = (update: Partial<Job> & { jobId: string }) => void;

export function useWebSocket(onUpdate: OnUpdate) {
  const socketRef = useRef<WebSocket | null>(null);
  const backoffRef = useRef(500);
  const abortedRef = useRef(false);

  // --- Helper: safely send message if connected ---
  const send = useCallback((payload: any) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(payload));
    }
  }, []);

  // --- Helpers for specific WS actions ---
  const subscribe = useCallback(
    (jobId: string) => {
      send({ action: WsAction.SUBSCRIBE, jobId });
    },
    [send]
  );

  const unsubscribe = useCallback(
    (jobId: string) => {
      send({ action: WsAction.UNSUBSCRIBE, jobId });
    },
    [send]
  );

  useEffect(() => {
    abortedRef.current = false;

    const connect = () => {
      if (abortedRef.current) return;
      const ws = new WebSocket(wsUrl());
      socketRef.current = ws;
      ws.onopen = () => {
        console.log("[ws] Connection established.");
        backoffRef.current = 500;
      };
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data as string);
        if (
          msg?.action === WsAction.RESPONSE &&
          msg?.message === WsResponse.SUBSCRIBED
        ) {
          console.log(`[ws] Subscribed to job:${msg.jobId}`);
        } else if (
          msg?.action === WsAction.RESPONSE &&
          msg?.message === WsResponse.UNSUBSCRIBED
        ) {
          console.log(`[ws] Unsubscribed from job:${msg.jobId}`);
        } else if (msg?.type === "update") {
          onUpdate(msg);
        }
      };
      ws.onclose = () => {
        if (abortedRef.current) return;
        const delay = Math.min(backoffRef.current, 8000);
        console.log(`[ws] Connection closed, retrying in ${delay}ms`);
        setTimeout(connect, delay);
        backoffRef.current = Math.min(backoffRef.current * 2, 8000);
      };
      ws.onerror = (err) => {
        console.log(`[ws] Connection error: ${err.toString()}`);
        ws.close();
      };
    };

    connect();

    return () => {
      abortedRef.current = true;
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [onUpdate]);

  return { send, subscribe, unsubscribe };
}
