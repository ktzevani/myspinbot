// backend/debug.js
import { GenericContainer } from "testcontainers";
import { spawn } from "child_process";

const redisContainer = await new GenericContainer("redis:8.2-alpine")
  .withExposedPorts(6379)
  .start();

const redisUrl = `redis://${redisContainer.getHost()}:${redisContainer.getMappedPort(6379)}`;
console.log(`[debug] Redis container started at ${redisUrl}`);

process.env.REDIS_URL = redisUrl;

// Spawn your backend process with the same env
const child = spawn("node", ["src/index.js"], {
  stdio: "inherit",
  env: process.env,
});

const cleanup = async () => {
  console.log("\n[debug] Cleaning up Redis container...");
  await redisContainer.stop();
  process.exit(0);
};

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
process.on("exit", cleanup);
