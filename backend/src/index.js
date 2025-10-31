import Fastify from 'fastify';
import cors from '@fastify/cors';
import healthRoute from './routes/health.js';
import metricsRoute from './routes/metrics.js';

const app = Fastify({ logger: true });

// --- Enable CORS for local dev ---
await app.register(cors, {
  origin: [
    'http://localhost:3001',      // local dev (Next.js)
    'https://ui.myspinbot.local'  // production via Traefik
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  credentials: true,
});

// --- Register routes ---
app.register(healthRoute);
app.register(metricsRoute);

const port = 3000;
app.listen({ port, host: '0.0.0.0' })
  .then(() => console.log(`API running on port ${port}`))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
