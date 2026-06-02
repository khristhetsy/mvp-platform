"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AdminBetaFeedbackActions({ feedbackId, status }: { feedbackId: string; status: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function updateStatus(nextStatus: "reviewing" | "resolved" | "dismissed") {
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/beta-feedback/${feedbackId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(typeof payload.error === "string" ? payload.error : "Update failed.");
        return;
      }
      setMessage(`Marked ${nextStatus}.`);
      router.refresh();
    } catch {
      setMessage("Update failed.");
    } finally {
      setLoading(false);
    }
  }

  if (status === "resolved" || status === "dismissed") {
    return <span className="text-xs text-slate-500">{status}</span>;
  }

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {status === "open" ? (
        <button
          type="button"
          disabled={loading}
          onClick={() => void updateStatus("reviewing")}
          className="rounded border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 disabled:opacity-60"
        >
          Start review
        </button>
      ) : null}
      <button
        type="button"
        disabled={loading}
        onClick={() => void updateStatus("resolved")}
        className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800 disabled:opacity-60"
      >
        Resolve
      </button>
      <button
        type="button"
        disabled={loading}
        onClick={() => void updateStatus("dismissed")}
        className="rounded border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 disabled:opacity-60"
      >
        Dismiss
      </button>
      {message ? <span className="text-xs text-slate-500">{message}</span> : null}
    </div>
  );
}
