import { closeQueues } from "../src/core/queue";
import { afterAll } from "vitest";

afterAll(async () => {
  await closeQueues();
});
