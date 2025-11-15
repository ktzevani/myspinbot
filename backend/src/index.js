import Fastify from "fastify";
import cors from "@fastify/cors";

const app = Fastify({ logger: true });

// --- Enable CORS for local dev ---
await app.register(cors, {
  origin: [
    "http://localhost:3001", // local dev (Next.js)
    "https://ui.myspinbot.local", // production via Traefik
  ],
  methods: ["GET", "POST", "OPTIONS"],
  credentials: true,
});

// --- Register routes ---
await app.register(import("./routes/health.js"));
await app.register(import("./routes/metrics.js"));
await app.register(import("./routes/ws.js"));
await app.register(import("./routes/capabilities.js", { prefix: "/api" }));
await app.register(import("./routes/status.js"), { prefix: "/api" });
await app.register(import("./routes/train.js"), { prefix: "/api" });

const port = 3000;
app
  .listen({ port, host: "0.0.0.0" })
  .then(() => console.log(`API running on port ${port}`))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
