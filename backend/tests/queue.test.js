import { describe, it, expect } from "vitest";
import { enqueueTrainJob, getJobStatus } from "../src/controllers/queue.js";

describe("BullMQ integration", () => {
  it("adds a job and retrieves status", async () => {
    const id = await enqueueTrainJob({ dataset: "unit-test" });
    const status = await getJobStatus(id);
    expect(status).toHaveProperty("state");
  });
});
