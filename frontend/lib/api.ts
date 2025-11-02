export type JobStatus = "queued" | "processing" | "done" | "failed";
export type JobType = "train" | "generate";

export interface Job {
  jobId: string;
  type: JobType;
  prompt?: string;
  progress?: number; // 0..1
  status: JobStatus;
  resultUrl?: string;
  createdAt: number;
  parentJobId?: string; // for generate linked to train
}

export interface TrainResponse {
  trainJobId: string;
}

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  "https://api.myspinbot.local";

export async function postTrain(opts: {
  file: File;
  prompt: string;
}): Promise<TrainResponse> {
  const form = new FormData();
  form.set("image", opts.file);
  form.set("prompt", opts.prompt);

  const res = await fetch(`${API_BASE}/api/train`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error(`Train failed: ${res.status}`);
  return res.json();
}

export function wsUrl(): string {
  // http[s] -> ws[s]
  const base = API_BASE.replace(/^http/, "ws");
  return `${base}/ws`;
}
