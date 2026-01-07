// lib/enums.ts
export enum JobStatus {
  QUEUED = "queued",
  RUNNING = "running",
  COMPLETED = "completed",
  FAILED = "failed",
  NOT_FOUND = "not_found",
}

export enum JobType {
  TRAIN = "train",
  GENERATE = "generate"
}

export enum WsAction {
  SUBSCRIBE = "subscribe",
  UNSUBSCRIBE = "unsubscribe",
  RESPONSE = "response",
}

export enum WsResponse {
  SUBSCRIBED = "subscribed",
  UNSUBSCRIBED = "unsubscribed",
}
