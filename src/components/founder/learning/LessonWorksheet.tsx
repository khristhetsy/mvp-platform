"use client";

import { useEffect, useState } from "react";

type Props = {
  moduleSlug: string;
  lessonId: string;
  worksheetPrompt: string;
};

type Submission = {
  content: string;
  submittedAt: string;
  adminFeedback: string | null;
};

type Status = "idle" | "submitting" | "submitted" | "error";

export function LessonWorksheet({ moduleSlug, lessonId, worksheetPrompt }: Props) {
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [existingSubmission, setExistingSubmission] = useState<Submission | null>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    void (async () => {
      const params = new URLSearchParams({ moduleSlug, lessonId });
      const res = await fetch(`/api/founder/learning/worksheets?${params.toString()}`);
      if (!res.ok) return;
      const json = (await res.json()) as { submission: Submission | null };
      if (json.submission) {
        setExistingSubmission(json.submission);
        setEditing(false);
      }
    })();
  }, [moduleSlug, lessonId]);

  async function submit() {
    setStatus("submitting");
    try {
      const res = await fetch("/api/founder/learning/worksheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleSlug, lessonId, content }),
      });
      if (!res.ok) throw new Error("submit failed");
      const json = (await res.json()) as { submittedAt?: string };
      setExistingSubmission({
        content,
        submittedAt: json.submittedAt ?? new Date().toISOString(),
        adminFeedback: null,
      });
      setEditing(false);
      setStatus("submitted");
    } catch {
      setStatus("error");
    }
  }

  const showingSubmission = existingSubmission && !editing;

  return (
    <div className="rounded-xl border border-dashed border-indigo-200 bg-indigo-50/40 p-4">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-indigo-700">Worksheet</p>
      <p className="mb-3 text-sm text-indigo-900">{worksheetPrompt}</p>

      {showingSubmission ? (
        <div>
          <div className="mb-2 rounded-lg border border-indigo-100 bg-white p-3">
            <p className="mb-1 text-xs text-slate-500">
              Your submission · {new Date(existingSubmission.submittedAt).toLocaleString()}
            </p>
            <p className="text-sm text-slate-700">{existingSubmission.content}</p>
          </div>
          {existingSubmission.adminFeedback ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <p className="mb-1 text-xs font-semibold text-emerald-700">Coach feedback</p>
              <p className="text-sm text-emerald-900">{existingSubmission.adminFeedback}</p>
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => {
              setEditing(true);
              setContent(existingSubmission.content);
              setStatus("idle");
            }}
            className="mt-2 text-xs text-indigo-600"
          >
            Edit submission
          </button>
        </div>
      ) : (
        <div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write your answer here…"
            rows={4}
            maxLength={5000}
            className="w-full rounded-lg border border-indigo-200 bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <div className="mt-2 flex items-center justify-between">
            <p className="text-xs text-slate-400">{content.length}/5000</p>
            <button
              type="button"
              disabled={content.length < 10 || status === "submitting"}
              onClick={() => void submit()}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              {status === "submitting" ? "Submitting…" : "Submit"}
            </button>
          </div>
          {status === "submitted" ? (
            <p className="mt-2 text-xs text-emerald-700">Submitted — your coach will review this.</p>
          ) : null}
          {status === "error" ? (
            <p className="mt-2 text-xs text-red-700">Unable to submit. Please try again.</p>
          ) : null}
        </div>
      )}
    </div>
  );
}
