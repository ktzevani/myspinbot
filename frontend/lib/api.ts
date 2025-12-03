// export type JobStatus = "queued" | "processing" | "done" | "failed";
// export type JobType = "train" | "generate";

export interface Job {
  jobId: string;
  type: string;
  prompt?: string;
  progress: number; // 0..1
  status: string;
  resultUrl?: string;
  createdAt: number;
  parentJobId?: string; // for generate linked to train
}

export interface TrainResponse {
  type: string;
  jobId: string;
  progress: number;
  status: string;
}

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  "https://api.myspinbot.local";

export async function postTrain(opts: {
  file: File;
  prompt: string;
}): Promise<TrainResponse> {
  const res = await fetch(`${API_BASE}/api/train`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      mode: "train_and_generate",
      variant: "svd_wav2lip",
      prompt: opts.prompt,
      // placeholder for future options/profile; backend is tolerant
    }),
  });
  if (!res.ok) throw new Error(`Train failed: ${res.status}`);
  return res.json();
}

export function wsUrl(): string {
  // http[s] -> ws[s]
  const base = API_BASE.replace(/^http/, "ws");
  return `${base}/ws`;
}
