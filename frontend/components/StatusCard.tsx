// components/StatusCard.tsx
import React from "react";
import ProgressBar from "./ProgressBar";
import type { Job } from "@/lib/api";
import { JobStatus } from "@/lib/enums";

function pillColor(status: Job["status"]) {
  switch (status) {
    case JobStatus.QUEUED:
      return "bg-gray-200 text-gray-800";
    case JobStatus.RUNNING:
      return "bg-blue-200 text-blue-900";
    case JobStatus.COMPLETED:
      return "bg-green-200 text-green-900";
    case JobStatus.FAILED:
      return "bg-red-200 text-red-900";
    default:
      return "bg-gray-200 text-gray-800";
  }
}

export default function StatusCard({ job }: { job: Job }) {
  return (
    <div className="rounded-2xl border p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="font-medium">
          #{job.jobId.slice(0, 8)} •{" "}
          {job.type === "train" ? "Training" : "Generating"}
        </div>
        <span
          className={`text-xs px-2 py-1 rounded-full ${pillColor(job.status)}`}
        >
          {job.status}
        </span>
      </div>

      {job.prompt && (
        <div className="text-sm text-gray-700">
          <span className="font-medium">Prompt:</span> {job.prompt}
        </div>
      )}

      <ProgressBar value={job.progress} />

      <div className="flex items-center justify-between text-xs text-gray-500">
        <div>{Math.round((job.progress ?? 0) * 100)}%</div>
        {job.resultUrl && job.status === "done" && (
          <a
            className="underline"
            href={job.resultUrl}
            target="_blank"
            rel="noreferrer"
          >
            View result
          </a>
        )}
      </div>
    </div>
  );
}
