"use client";

import { useCallback, useMemo, useState } from "react";
import UploadForm from "@/components/UploadForm";
import StatusCard from "@/components/StatusCard";
import type { Job } from "@/lib/api";
import { useWebSocket } from "@/lib/useWebSocket";

export default function Page() {
  const [jobs, setJobs] = useState<Record<string, Job>>({});

  const onJob = useCallback((job: Job) => {
    setJobs((prev) => ({ ...prev, [job.jobId]: job }));
  }, []);

  const onUpdate = useCallback((u: Partial<Job> & { jobId: string }) => {
    setJobs((prev) => {
      const old = prev[u.jobId] ?? {
        jobId: u.jobId,
        type: u.type,
        status: u.status,
        progress: u.progress,
        createdAt: Date.now(),
      };
      const merged: Job = { ...old, ...u };
      return { ...prev, [u.jobId]: merged };
    });
  }, []);

  useWebSocket(onUpdate);

  const sorted = useMemo(
    () =>
      Object.values(jobs).sort(
        (a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)
      ),
    [jobs]
  );

  return (
    <div className="space-y-6">
      <UploadForm onJob={onJob} />
      <div className="grid gap-4">
        {sorted.map((job) => (
          <StatusCard key={job.jobId} job={job} />
        ))}
      </div>
    </div>
  );
}
