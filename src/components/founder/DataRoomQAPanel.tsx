"use client";

import { useState } from "react";
import { MessageCircleQuestion } from "lucide-react";
import type { DataRoomQuestion } from "@/lib/data-room/qa";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function QuestionRow({ q }: { q: DataRoomQuestion }) {
  const [answer, setAnswer] = useState(q.answer ?? "");
  const [savedAnswer, setSavedAnswer] = useState(q.answer);
  const [editing, setEditing] = useState(!q.answer);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const text = answer.trim();
    if (!text) return setError("Enter an answer.");
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/founder/data-room/questions/${q.id}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer: text }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error ?? "Could not save.");
        return;
      }
      setSavedAnswer(text);
      setEditing(false);
    } catch {
      setError("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-slate-800">{q.question}</p>
          <p className="mt-0.5 text-xs text-slate-400">
            {q.investorName ?? "Investor"}
            {q.documentLabel ? ` · on ${q.documentLabel}` : ""} · {timeAgo(q.createdAt)}
          </p>
        </div>
        {!savedAnswer && (
          <span className="flex-none rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
            Awaiting answer
          </span>
        )}
      </div>

      {savedAnswer && !editing ? (
        <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2">
          <p className="text-sm text-slate-700">{savedAnswer}</p>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="mt-1 text-xs font-medium text-[var(--brand-indigo,#2E78F5)] hover:underline"
          >
            Edit answer
          </button>
        </div>
      ) : (
        <div className="mt-2">
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            rows={2}
            maxLength={4000}
            placeholder="Write your answer…"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800"
          />
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
          <div className="mt-1.5 flex gap-2">
            <button
              type="button"
              onClick={save}
              disabled={busy}
              className="rounded-lg bg-[var(--brand-indigo,#2E78F5)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-60"
            >
              {busy ? "Saving…" : savedAnswer ? "Update answer" : "Post answer"}
            </button>
            {savedAnswer && (
              <button
                type="button"
                onClick={() => {
                  setAnswer(savedAnswer);
                  setEditing(false);
                  setError(null);
                }}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

/**
 * Founder-facing data-room Q&A: investor questions with inline answering.
 * Pass questions from listCompanyQuestions().
 */
export function DataRoomQAPanel({ questions }: { questions: DataRoomQuestion[] }) {
  const unanswered = questions.filter((q) => !q.answer).length;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[var(--shadow-panel)] sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-950">Investor Q&amp;A</h2>
          <p className="mt-1 text-sm text-slate-600">Questions investors asked about your data room.</p>
        </div>
        {unanswered > 0 && (
          <span className="flex-none rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
            {unanswered} to answer
          </span>
        )}
      </div>

      <div className="mt-4">
        {questions.length === 0 ? (
          <div className="flex flex-col items-center py-6 text-center">
            <MessageCircleQuestion className="h-6 w-6 text-slate-300" />
            <p className="mt-2 text-sm text-slate-500">
              No questions yet. Investors with access can ask here — answers show in their data-room view.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 border-t border-slate-100">
            {questions.map((q) => (
              <QuestionRow key={q.id} q={q} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
