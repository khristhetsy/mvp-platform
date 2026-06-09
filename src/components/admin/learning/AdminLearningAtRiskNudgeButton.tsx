"use client";

import { useState } from "react";
import { formatApiError } from "@/lib/api/errors";

export function AdminLearningAtRiskNudgeButton({
  founderId,
  companyId,
  daysInactive,
  percentComplete,
  lastActivityAt,
}: {
  founderId: string;
  companyId: string;
  daysInactive: number;
  percentComplete: number;
  lastActivityAt: string | null;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function sendNudge() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/learning/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          founderId,
          companyId,
          type: "inactivity_nudge",
          metadata: {
            daysInactive,
            percentComplete,
            lastActivityAt,
          },
        }),
      });
      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        throw new Error(typeof json.error === "string" ? json.error : "Unable to send nudge.");
      }
      setSent(true);
    } catch (err) {
      setError(formatApiError(err, "Unable to send nudge."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={loading || sent}
        onClick={() => void sendNudge()}
        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
      >
        {sent ? "Nudge sent" : loading ? "Sending…" : "Send nudge"}
      </button>
      {error ? <span className="max-w-[10rem] text-right text-[10px] text-rose-700">{error}</span> : null}
    </div>
  );
}
