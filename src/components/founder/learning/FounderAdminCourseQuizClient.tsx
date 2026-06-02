"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatApiError } from "@/lib/api/errors";

type Question = {
  id: string;
  order_index: number;
  prompt: string;
  options: string[];
};

export function FounderAdminCourseQuizClient({
  courseId,
  quizId,
  questions,
  retryLimit,
}: {
  courseId: string;
  quizId: string;
  questions: Question[];
  retryLimit: number | null;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ score: number; passed: boolean; attemptsUsed?: number; attemptsRemaining?: number } | null>(null);

  const canSubmit = useMemo(() => questions.length > 0, [questions.length]);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/founder/learning/admin-courses/${encodeURIComponent(courseId)}/quiz/${encodeURIComponent(quizId)}/submit`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers }),
        },
      );
      const json = (await res.json().catch(() => ({}))) as any;
      if (!res.ok) throw json;
      setResult(json);
      router.refresh();
    } catch (e) {
      setError(formatApiError(e, "Quiz submission failed."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {retryLimit != null ? (
        <p className="text-xs text-slate-500">Retry limit: {retryLimit}</p>
      ) : (
        <p className="text-xs text-slate-500">No retry limit configured.</p>
      )}

      {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">{error}</div> : null}
      {result ? (
        <div className={`rounded-lg border px-3 py-2 text-sm ${result.passed ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
          Score: <span className="font-semibold">{result.score}%</span> · {result.passed ? "Passed" : "Not passed"}
          {typeof result.attemptsRemaining === "number" ? (
            <span className="ml-2 text-xs text-slate-600">Attempts remaining: {result.attemptsRemaining}</span>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-4">
        {questions.map((q, idx) => (
          <div key={q.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-900">
              {idx + 1}. {q.prompt}
            </p>
            <div className="mt-2 space-y-2">
              {q.options.map((opt, i) => (
                <label key={i} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                  <input
                    type="radio"
                    name={q.id}
                    checked={answers[q.id] === i}
                    onChange={() => setAnswers((v) => ({ ...v, [q.id]: i }))}
                  />
                  <span>{opt}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        disabled={saving || !canSubmit}
        onClick={() => void submit()}
        className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {saving ? "Submitting…" : "Submit quiz"}
      </button>
    </div>
  );
}

