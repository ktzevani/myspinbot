// components/UploadForm.tsx
"use client";

import React, { useRef, useState } from "react";
import { postGenerate, type Job } from "@/lib/api";
import { JobType } from "@/lib/enums";

export default function UploadForm({ onJob }: { onJob: (job: Job) => void }) {
  const imgFileRef = useRef<HTMLInputElement | null>(null);
  const audioFileRef = useRef<HTMLInputElement | null>(null);
  const [prompt, setPrompt] = useState("");
  const [refTxt, setRefTxt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const imgFile = imgFileRef.current?.files?.[0];
    const audioFile = audioFileRef.current?.files?.[0];
    if (!imgFile) return setError("Please select an image.");
    if (!audioFile) return setError("Please select an audio sample.");
    if (!prompt.trim()) return setError("Please enter a prompt.");

    setBusy(true);
    try {
      const { type, jobId, progress, status } = await postGenerate({
        imgFile,
        audioFile,
        prompt,
        refTxt,
      });
      onJob({
        jobId: jobId,
        type: JobType.GENERATE,
        prompt,
        progress: progress,
        status: status,
        createdAt: Date.now(),
      });
      setPrompt("");
      setRefTxt("");
      if (imgFileRef.current) imgFileRef.current.value = "";
      if (audioFileRef.current) audioFileRef.current.value = "";
    } catch (err: any) {
      setError(err?.message ?? "Failed to start generation.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="image-file"
            className="block text-sm font-medium text-gray-700"
          >
            Image
          </label>
          <input
            id="image-file"
            data-testid="image-file-input"
            ref={imgFileRef}
            type="file"
            accept="image/*"
            className="mt-1 w-full rounded-lg border bg-white px-3 py-2 file:mr-3 file:cursor-pointer file:rounded-lg file:border file:bg-white file:px-3 file:py-2 file:hover:bg-gray-50"
          />
        </div>
        <div>
          <label
            htmlFor="audio-file"
            className="block text-sm font-medium text-gray-700"
          >
            Voice Sample
          </label>
          <input
            id="audio-file"
            data-testid="audio-file-input"
            ref={audioFileRef}
            type="file"
            accept="audio/*"
            className="mt-1 w-full rounded-lg border bg-white px-3 py-2 file:mr-3 file:cursor-pointer file:rounded-lg file:border file:bg-white file:px-3 file:py-2 file:hover:bg-gray-50"
          />
        </div>
      </div>
      <div>
        <label htmlFor="prompt" className="block text-sm font-medium text-gray-700">
          Audio Sample Reference Text
        </label>
        <div className="mt-1 flex flex-col gap-3 sm:flex-row">
          <input
            id="reference-text"
            type="text"
            placeholder="Enter text…"
            value={refTxt}
            onChange={(e) => setRefTxt(e.target.value)}
            className="flex-1 rounded-lg border px-3 py-2"
          />
        </div>
      </div>
      <div>
        <label htmlFor="prompt" className="block text-sm font-medium text-gray-700">
          Prompt
        </label>
        <div className="mt-1 flex flex-col gap-3 sm:flex-row">
          <input
            id="prompt"
            type="text"
            placeholder="Enter prompt…"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="flex-1 rounded-lg border px-3 py-2"
          />
          <button type="submit" disabled={busy} className="rounded-lg border bg-white px-4 py-2 shadow-sm hover:shadow disabled:opacity-50">
            {busy ? "Submitting…" : "Generate"}
          </button>
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <p className="text-xs text-gray-500">
        Phase 3: generates a video given then input audio and portrait image (chained jobs).
      </p>
    </form>
  );
}
