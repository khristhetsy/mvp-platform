"use client";

import { useRouter } from "next/navigation";
import { AlertTriangle, RefreshCw } from "lucide-react";

/**
 * Inline banner for surfacing a page-level data-load failure instead of
 * silently rendering empty content. Includes a Retry that re-runs the server
 * render via router.refresh().
 */
export function PageErrorAlert({
  message = "We couldn't load this data. Please try again.",
  className = "",
}: Readonly<{ message?: string; className?: string }>) {
  const router = useRouter();
  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#F7C1C1] bg-[#FCEBEB] px-4 py-3 text-sm text-[#A32D2D] ${className}`}>
      <span className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden /> {message}
      </span>
      <button
        type="button"
        onClick={() => router.refresh()}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[#F0999B] bg-white px-3 py-1.5 text-xs font-semibold text-[#A32D2D] hover:bg-[#FCEBEB]"
      >
        <RefreshCw className="h-3.5 w-3.5" /> Retry
      </button>
    </div>
  );
}
