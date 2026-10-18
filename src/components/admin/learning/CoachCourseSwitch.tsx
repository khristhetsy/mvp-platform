"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CoachCourseRow } from "@/lib/learning/coach/admin";

/** The per course coach switch. Disabled, with the reason, when the course has no coach steps. */
export function CoachCourseSwitch({ row }: Readonly<{ row: CoachCourseRow }>) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    if (busy || !row.ready) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/learning/coach/courses", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseKey: row.key, enabled: !row.enabled }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      const body = res ? ((await res.json().catch(() => ({}))) as { error?: string }) : {};
      setError(body.error ?? "Could not save.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={row.enabled}
        aria-label={`AI IR Coach for ${row.title}`}
        disabled={busy || !row.ready}
        onClick={() => void toggle()}
        className={`relative h-5 w-9 rounded-full transition disabled:cursor-not-allowed disabled:opacity-40 ${row.enabled ? "bg-indigo-600" : "bg-slate-300"}`}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${row.enabled ? "left-[18px]" : "left-0.5"}`} />
      </button>
      <span className="text-xs text-slate-600">{row.enabled ? "On" : "Off"}</span>
      {!row.ready && row.blocker ? <span className="text-[11px] text-slate-400">{row.blocker}</span> : null}
      {error ? <span className="text-[11px] text-red-600">{error}</span> : null}
    </div>
  );
}
