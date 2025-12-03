import JobRepository from "../../core/job-repository.js";

export async function getJobs(query = {}) {
  const jobRepo = new JobRepository();
  const limit = Math.min(Math.max(Number(query?.limit) || 20, 1), 100);
  const offset = Math.max(Number(query?.offset) || 0, 0);
  const jobs = await jobRepo.listJobs({ limit, offset });
  return { jobs, pagination: { limit, offset } };
}

export async function getJobById(jobId) {
  const jobRepo = new JobRepository();
  const result = await jobRepo.getJobWithDetails(jobId);
  if (!result) {
    return { error: `Job ${jobId} not found.` };
  }
  return result;
}
