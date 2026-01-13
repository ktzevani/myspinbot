import { JobStatus, JobType } from "./enums";

export interface Job {
  jobId: string;
  type: JobType;
  prompt?: string;
  progress: number; // 0..1
  status: JobStatus;
  resultUrl?: string;
  createdAt: number;
  parentJobId?: string; // for generate linked to train
}

export interface GenerateResponse {
  type: JobType;
  jobId: string;
  progress: number;
  status: JobStatus;
}

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  "https://api.myspinbot.local";

export async function postGenerate(opts: {
  imgFile: File;
  audioFile: File;
  prompt: string;
  refTxt: string;
}): Promise<GenerateResponse> {
  const formData = new FormData();
  formData.append("image_file", opts.imgFile);
  formData.append("audio_file", opts.audioFile);
  formData.append(
    "data",
    JSON.stringify({
      pipeline: {
        mode: "generate",
        variant: "f5tts_infinitetalk",
      },
      params: {
        prompt: opts.prompt,
        refText: opts.refTxt,
      }
    })
  );
  const res = await fetch(`${API_BASE}/api/generate`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error(`Generation failed: ${res.status}`);
  return res.json();
}

export function wsUrl(): string {
  // http[s] -> ws[s]
  const base = API_BASE.replace(/^http/, "ws");
  return `${base}/ws`;
}

export async function getJobResult(jobId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/api/jobs/${jobId}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch job result: ${res.status}`);
  }
  const result = await res.json();
  if (result && result?.job?.lastGraph?.nodes) {
    const renderNode = result?.job?.lastGraph?.nodes.find(
      (node: any) => node.id === "render_video_infinitetalk"
    );
    if (renderNode && renderNode.output) {
      return renderNode.output;
    }
  }
  return null;
}
