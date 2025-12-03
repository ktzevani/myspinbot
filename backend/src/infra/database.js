import { Pool } from "pg";
import { getConfiguration } from "../config.js";

// TODO: Use common data models instead of hard-coded ones.
// TODO: Consider replacing with orm.

const MIGRATIONS = [
  `
  CREATE TABLE IF NOT EXISTS jobs (
    job_id UUID PRIMARY KEY,
    status TEXT NOT NULL,
    progress NUMERIC DEFAULT 0,
    last_graph JSONB,
    created TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
`,
  `
  CREATE TABLE IF NOT EXISTS job_events (
    event_id BIGSERIAL PRIMARY KEY,
    job_id UUID NOT NULL REFERENCES jobs(job_id) ON DELETE CASCADE,
    status TEXT,
    progress NUMERIC,
    data JSONB,
    created TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
`,
  `CREATE INDEX IF NOT EXISTS idx_job_events_job_id ON job_events(job_id);`,
];

class Database {
  constructor(configuration) {
    this.pool = new Pool({
      connectionString: configuration.persistence.url,
      max: configuration.persistence.pool.max,
      idleTimeoutMillis: configuration.persistence.pool.idleMs,
    });
    this.isInitialized = false;
    process.on("SIGTERM", () => this.stop());
    process.on("SIGINT", () => this.stop());
  }

  async start() {
    if (!this.isInitialized) {
      await this.pool.query("SELECT 1;");
      for (const statement of MIGRATIONS) {
        await this.pool.query(statement);
      }
      this.isInitialized = true;
    }
  }

  async stop() {
    await this.pool.end();
    this.isInitialized = false;
  }

  getPool() {
    if (this.isInitialized) {
      return this.pool;
    }
  }
}

async function factory() {
  const db = new Database(getConfiguration());
  await db.start();
  return db;
}

export const db = await factory();
export default db;
