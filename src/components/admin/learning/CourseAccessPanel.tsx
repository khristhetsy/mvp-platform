"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Who can take a course: everyone, or invitation only. The access list itself sits under this in the course editor. */
export function CourseAccessPanel({ courseId, accessMode }: { courseId: string; accessMode: "open" | "invite_only" }) {
  const router = useRouter();
  const [mode, setMode] = useState(accessMode);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function choose(next: "open" | "invite_only") {
    if (next === mode) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch(`/api/admin/learning/courses/${courseId}/access`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessMode: next }),
      });
      if (!r.ok) throw new Error(((await r.json().catch(() => ({}))) as { error?: string }).error ?? "Could not save.");
      setMode(next);
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  const seg = (on: boolean) => `px-3 py-1.5 text-xs font-medium ${on ? "bg-[#0A1A40] text-white" : "bg-white text-slate-700 hover:bg-slate-50"} disabled:opacity-60`;
  return (
    <div>
      <div className="inline-flex overflow-hidden rounded-lg border border-slate-200">
        <button type="button" disabled={busy} className={seg(mode === "open")} onClick={() => choose("open")}>Everyone</button>
        <button type="button" disabled={busy} className={seg(mode === "invite_only")} onClick={() => choose("invite_only")}>Invitation only</button>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        {mode === "open"
          ? "Everyone with Learning access can see and take this course."
          : "Only people on the access list below can see and take this course."}
      </p>
      {msg ? <p className="mt-2 text-xs text-red-600">{msg}</p> : null}
    </div>
  );
}
