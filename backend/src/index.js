import Fastify from "fastify";
import cors from "@fastify/cors";
import { registerRoutes as registerHttpRoutes } from "./api/http/routes.js";
import { registerRoutes as registerWsRoutes } from "./api/ws/routes.js";
import _executor_singleton from "./core/executor.js";
import _db_singleton from "./infra/database.js";

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

// -- Enable WebSocket Server
await registerWsRoutes(app);

// --- Register HTTP routes ---
await registerHttpRoutes(app);

const port = 3000;
app
  .listen({ port, host: "0.0.0.0" })
  .then(() => console.log(`API running on port ${port}`))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
