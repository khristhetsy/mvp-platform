"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Admin button: generate a completion quiz for every published course that
 * doesn't have one yet (80% pass, unlimited retries). Lesson content untouched.
 */
export function AdminQuizBackfillButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    if (!window.confirm("Generate a completion quiz for every published course that is missing one? This can take a minute.")) return;
    setBusy(true);
    setResult(null);
    setErr(null);
    try {
      const res = await fetch("/api/admin/learning/backfill-quizzes", { method: "POST" });
      const j = (await res.json()) as { ok?: boolean; missingQuiz?: number; generated?: number; error?: string };
      if (!res.ok || !j.ok) throw new Error(j.error ?? "Backfill failed.");
      setResult(`Generated ${j.generated} quiz${j.generated === 1 ? "" : "zes"} for ${j.missingQuiz} course${j.missingQuiz === 1 ? "" : "s"} that were missing one.`);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Backfill failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => void run()}
        disabled={busy}
        className="rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
      >
        {busy ? "Generating quizzes…" : "Backfill missing quizzes"}
      </button>
      {result ? <span className="text-[11px] text-emerald-700">{result}</span> : null}
      {err ? <span className="text-[11px] text-red-600">{err}</span> : null}
    </div>
  );
}
