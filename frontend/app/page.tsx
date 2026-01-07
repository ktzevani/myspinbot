"use client";

import { useCallback, useMemo, useState } from "react";
import UploadForm from "@/components/UploadForm";
import StatusCard from "@/components/StatusCard";
import type { Job } from "@/lib/api";
import { useWebSocket } from "@/lib/ws";
import { JobStatus } from "@/lib/enums";

export default function Page() {
  const [jobs, setJobs] = useState<Record<string, Job>>({});

  const onJob = useCallback((job: Job) => {
    subscribe(job.jobId);
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
      if (merged.status === JobStatus.COMPLETED) {
        unsubscribe(u.jobId);
      }
      return { ...prev, [u.jobId]: merged };
    });
  }, []);

  const { subscribe, unsubscribe } = useWebSocket(onUpdate);

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
