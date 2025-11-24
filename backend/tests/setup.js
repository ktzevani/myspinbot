import { afterAll } from "vitest";
import jobQueue from "../src/core/job-queue.js";

afterAll(async () => {
  await jobQueue.freeResources();
});
