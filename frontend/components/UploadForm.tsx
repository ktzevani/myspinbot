// components/UploadForm.tsx
"use client";

import React, { useRef, useState } from "react";
import { postTrain, type Job } from "@/lib/api";

export default function UploadForm({ onJob }: { onJob: (job: Job) => void }) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const file = fileRef.current?.files?.[0];
    if (!file) return setError("Please select an image.");
    if (!prompt.trim()) return setError("Please enter a prompt.");

    setBusy(true);
    try {
      const { type, jobId, progress, status } = await postTrain({
        file,
        prompt,
      });
      onJob({
        jobId: jobId,
        type: "train",
        prompt,
        progress: progress,
        status: status,
        createdAt: Date.now(),
      });
      setPrompt("");
      if (fileRef.current) fileRef.current.value = "";
    } catch (err: any) {
      setError(err?.message ?? "Failed to start training.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-3">
        <label
          className="block text-sm font-medium text-gray-700"
          htmlFor="file-input"
        >
          Image
        </label>
        <input
          data-testid="file-input"
          ref={fileRef}
          type="file"
          accept="image/*"
          className="file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border file:bg-white file:hover:bg-gray-50 file:cursor-pointer border rounded-lg px-3 py-2 w-full sm:w-auto"
        />
        <input
          type="text"
          placeholder="Enter prompt…"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="flex-1 border rounded-lg px-3 py-2"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg px-4 py-2 border shadow-sm hover:shadow disabled:opacity-50"
        >
          {busy ? "Submitting…" : "Train → Generate"}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <p className="text-xs text-gray-500">
        Phase 1: trains a LoRA from your image then generates a video (chained
        jobs).
      </p>
    </form>
  );
}
