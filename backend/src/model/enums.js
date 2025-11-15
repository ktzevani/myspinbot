import schema from "../../config/schemas/jobs/job-messaging.schema.json" assert { type: "json" };
import { enumFromSchema } from "../lib/utils.js";

export const JobStatus = enumFromSchema(schema, "$defs.JobStatus");

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
