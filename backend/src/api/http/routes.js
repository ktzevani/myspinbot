import { getMetrics } from "./metricsController.js";
import { getCapabilitiesManifest } from "./capabilitiesController.js";
import { submitTrainJob, getJobStatus } from "./jobController.js";

async function capabilitiesRoute(fastify) {
    fastify.get("/capabilities", async (_req, reply) => {
        return reply.send(await getCapabilitiesManifest());
    });
}

async function healthRoute(fastify) {
    fastify.get('/health', async () => ({ status: 'ok' }));
}

async function metricsRoute(fastify) {
    fastify.get("/metrics", async (_req, reply) => {
        const { type, metrics } = getMetrics();
        reply.header("Content-Type", type);
        return metrics;
    });
}

async function statusRoute(fastify) {
    fastify.get("/status/:id", async (req, reply) => {
        return reply.send(await getJobStatus(req.params));
    });
}

async function trainRoute(fastify) {
    fastify.post("/train", async (_, reply) => {
        return reply.send(await submitTrainJob());
    });
}

export async function registerRoutes(app) {
    await app.register(healthRoute);
    await app.register(metricsRoute);
    await app.register(capabilitiesRoute, { prefix: "/api" });
    await app.register(statusRoute, { prefix: "/api" });
    await app.register(trainRoute, { prefix: "/api" });
}