import { db } from "../infra/database.js";

// TODO: Consider replacing with orm.

export default class JobRepository {
  constructor() {
    this.pool = db.getPool();
  }

  #safeJson(value) {
    if (!value) return null;
    try {
      return typeof value === "string" ? JSON.parse(value) : value;
    } catch (_err) {
      return null;
    }
  }

  async upsertJob({ jobId, status, progress, graph, created }) {
    await this.pool.query(
      `
    INSERT INTO jobs (job_id, status, progress, last_graph, created)
    VALUES ($1, $2, $3, $4, to_timestamp($5))
    ON CONFLICT (job_id) DO UPDATE
    SET
      status = EXCLUDED.status,
      progress = EXCLUDED.progress,
      last_graph = COALESCE(EXCLUDED.last_graph, jobs.last_graph),
      created = COALESCE(EXCLUDED.created, jobs.created)
  `,
      [
        jobId,
        status,
        progress,
        this.#safeJson(graph),
        Math.floor(Number(created) / 1000),
      ]
    );
  }

  async appendJobEvent({ jobId, status = null, progress = null, data = null }) {
    await this.pool.query(
      `
      INSERT INTO job_events (job_id, status, progress, data)
      VALUES ($1, $2, $3, $4)
    `,
      [jobId, status, progress, data]
    );
  }

  async updateJobStatus(jobId, status) {
    await this.pool.query(
      `
      UPDATE jobs
      SET status = $2
      WHERE job_id = $1
    `,
      [jobId, status]
    );
  }

  async updateJobProgress(jobId, progress) {
    await this.pool.query(
      `
      UPDATE jobs
      SET progress = $2
      WHERE job_id = $1
    `,
      [jobId, progress]
    );
  }

  async updateJobGraph(jobId, graph, created) {
    await this.pool.query(
      `
      UPDATE jobs
      SET last_graph = $2, created = to_timestamp($3)
      WHERE job_id = $1
    `,
      [jobId, this.#safeJson(graph), Math.floor(Number(created) / 1000)]
    );
  }

  async listJobs({ limit = 20, offset = 0 } = {}) {
    const { rows } = await this.pool.query(
      `
      SELECT job_id, status, progress, created
      FROM jobs
      ORDER BY created DESC
      LIMIT $1 OFFSET $2
    `,
      [limit, offset]
    );
    return rows.map((row) => ({
      jobId: row.job_id,
      status: row.status,
      progress: Number(row.progress ?? 0),
      created: row.created.getTime(),
    }));
  }

  async getJobWithDetails(jobId) {
    const jobResult = await this.pool.query(
      `
      SELECT job_id, status, progress, last_graph, created
      FROM jobs
      WHERE job_id = $1
    `,
      [jobId]
    );
    if (jobResult.rowCount === 0) return null;

    const job = jobResult.rows[0];
    const eventsResult = await this.pool.query(
      `
      SELECT event_id, status, progress, data, created
      FROM job_events
      WHERE job_id = $1
      ORDER BY created DESC
      LIMIT 50
    `,
      [jobId]
    );

    return {
      job: {
        jobId: job.job_id,
        status: job.status,
        progress: Number(job.progress ?? 0),
        lastGraph: job.last_graph,
        created: job.created.getTime(),
      },
      events: eventsResult.rows.map((row) => ({
        eventId: row.event_id,
        status: row.status,
        progress: row.progress === null ? null : Number(row.progress),
        data: row.data,
        created: row.created.getTime(),
      })),
    };
  }
}
