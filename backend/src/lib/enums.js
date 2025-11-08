// lib/enums.js
export const JobStatus = Object.freeze({
  QUEUED: "queued",
  RUNNING: "running",
  COMPLETED: "completed",
  FAILED: "failed",
  NOT_FOUND: "not_found",
});

export const WsAction = Object.freeze({
  SUBSCRIBE: "subscribe",
  UNSUBSCRIBE: "unsubscribe",
  RESPONSE: "response",
});

export const WsResponse = Object.freeze({
  SUBSCRIBED: "subscribed",
  UNSUBSCRIBED: "unsubscribed",
  FAILED: "failed",
});
