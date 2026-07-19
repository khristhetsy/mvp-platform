"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Admin button: generate (or regenerate) the course-scoped FINAL quiz for one
 * course from its published lessons. Gates completion at 80%, unlimited retries.
 * Does not modify lesson content.
 */
export function AdminCourseQuizGenerator({ courseId }: Readonly<{ courseId: string }>) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/learning/courses/${encodeURIComponent(courseId)}/generate-quiz`, {
        method: "POST",
      });
      const j = (await res.json()) as { ok?: boolean; questionCount?: number; error?: string };
      if (!res.ok || !j.ok) throw new Error(j.error ?? "Quiz generation failed.");
      setMsg(`Final quiz created — ${j.questionCount} questions · 80% to pass. Founders must pass it to complete the course.`);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Quiz generation failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => void run()}
        disabled={busy}
        className="rounded-lg bg-[#2E78F5] px-3 py-2 text-xs font-semibold text-white hover:bg-[#1A6CE4] disabled:opacity-50"
      >
        {busy ? "Generating…" : "Generate final quiz (AI)"}
      </button>
      <p className="mt-2 text-xs text-slate-500">
        Builds a graded completion quiz from this course&apos;s lessons. Lesson content is not changed. Regenerating replaces the current quiz.
      </p>
      {msg ? <p className="mt-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{msg}</p> : null}
      {err ? <p className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{err}</p> : null}
    </div>
  );
}
