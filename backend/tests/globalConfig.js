import { RedisContainer } from "@testcontainers/redis";

let container = null;

export default async function setup() {
  console.log("[globalSetup] Starting shared Redis container...");
  container = await new RedisContainer("redis:8.2-alpine").start();
  process.env.REDIS_URL = `redis://${container.getHost()}:${container.getMappedPort(6379)}`;
  console.log(`[globalSetup] Redis started at ${process.env.REDIS_URL}`);
  // Return teardown function (Vitest will call it once after all tests)
  return async () => {
    console.log("[globalTeardown] Stopping Redis container...");
    await container.stop();
    console.log("[globalTeardown] Redis stopped.");
  };
}
