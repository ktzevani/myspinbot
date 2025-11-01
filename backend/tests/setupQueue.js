import { closeQueues } from "../src/controllers/queue";
import { afterAll } from "vitest";

afterAll(async () => {
  await closeQueues();
});
