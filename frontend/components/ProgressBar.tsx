// components/ProgressBar.tsx
import React from "react";

export default function ProgressBar({ value }: { value: number | undefined }) {
  const pct = Math.max(0, Math.min(100, Math.round((value ?? 0) * 100)));
  return (
    <div className="w-full h-2 rounded bg-gray-200 dark:bg-gray-800 overflow-hidden">
      <div
        className="h-full rounded bg-blue-500 transition-[width] duration-300 ease-out"
        style={{ width: `${pct}%` }}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        role="progressbar"
      />
    </div>
  );
}
