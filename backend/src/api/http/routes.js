import { getMetrics } from "./metrics-controller.js";
import { getCapabilitiesManifest } from "./capabilities-controller.js";
import {
  submitTrainJob,
  submitGenerationJob,
  getJobStatus,
} from "./job-controller.js";
import { getJobById, getJobs } from "./history-controller.js";
import { uploadBuffer } from "../../services/storage.js";

async function capabilitiesRoute(fastify) {
  fastify.get("/capabilities", async (_req, reply) => {
    return reply.send(await getCapabilitiesManifest());
  });
}

async function healthRoute(fastify) {
  fastify.get("/health", async () => ({ status: "ok" }));
}

async function metricsRoute(fastify) {
  fastify.get("/metrics", async (_req, reply) => {
    const { type, metrics } = await getMetrics();
    reply.header("Content-Type", type);
    return metrics;
  });
}

async function statusRoute(fastify) {
  fastify.get("/status/:jobId", async (req, reply) => {
    return reply.send(await getJobStatus(req.params?.jobId));
  });
}

async function trainRoute(fastify) {
  fastify.post("/train", async (req, reply) => {
    return reply.send(await submitTrainJob(req.body || {}));
  });
}

async function generateRoute(fastify) {
  fastify.post("/generate", async (req, reply) => {
    const parts = req.parts();

    let imagePath = null;
    let audioPath = null;
    let metadata = null;

    for await (const part of parts) {
      if (part.type === "file") {
        // Handle the files
        const buffer = await part.toBuffer();
        if (part.fieldname === "image_file") {
          imagePath = await uploadBuffer(buffer, part.filename);
        } else if (part.fieldname === "audio_file") {
          audioPath = await uploadBuffer(buffer, part.filename);
        }
      } else {
        // Handle the text fields (the 'data' field containing your JSON)
        if (part.fieldname === "data") {
          try {
            metadata = JSON.parse(part.value);
          } catch (e) {
            return reply
              .status(400)
              .send({ error: "Invalid JSON in data field" });
          }
        }
      }
    }

    return reply.send(
      await submitGenerationJob({
        renderInput: { imagePath },
        genInput: [{ audioPath }],
        ...metadata,
      })
    );
  });
}

async function historyRoutes(fastify) {
  fastify.get("/jobs", async (req, reply) => {
    return reply.send(await getJobs(req.query));
  });
  fastify.get("/jobs/:jobId", async (req, reply) => {
    const result = await getJobById(req.params?.jobId);
    if (result?.error) {
      reply.code(404);
    }
    return reply.send(result);
  });
}

export async function registerRoutes(app) {
  await app.register(healthRoute);
  await app.register(metricsRoute);
  await app.register(capabilitiesRoute, { prefix: "/api" });
  await app.register(statusRoute, { prefix: "/api" });
  await app.register(trainRoute, { prefix: "/api" });
  await app.register(generateRoute, { prefix: "/api" });
  await app.register(historyRoutes, { prefix: "/api" });
}
