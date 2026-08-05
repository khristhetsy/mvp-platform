"use client";

import { useState } from "react";
import { MessageCircleQuestion, Send } from "lucide-react";
import type { DataRoomQuestion } from "@/lib/data-room/qa";

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Investor-facing data-room Q&A: ask the founder a question and see answers.
 * Pass the company id and the investor's own questions (listInvestorQuestions()).
 */
export function InvestorDataRoomQA({
  companyId,
  companyName,
  initialQuestions,
}: {
  companyId: string;
  companyName?: string | null;
  initialQuestions: DataRoomQuestion[];
}) {
  const [questions, setQuestions] = useState(initialQuestions);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function submit() {
    const question = text.trim();
    if (!question) return setError("Type your question first.");
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/investor/data-room/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, question }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error ?? "Could not submit your question.");
        return;
      }
      // Optimistically add it to the top (answer pending).
      setQuestions((prev) => [
        {
          id: `pending-${Date.now()}`,
          companyId,
          investorId: "",
          investorName: null,
          documentId: null,
          documentLabel: null,
          question,
          answer: null,
          answeredAt: null,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      setText("");
      setSent(true);
      setTimeout(() => setSent(false), 2500);
    } catch {
      setError("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <MessageCircleQuestion className="h-5 w-5 text-[var(--brand-indigo,#2E78F5)]" />
        <h2 className="text-base font-semibold text-slate-950">
          Ask {companyName ? companyName : "the founder"} a question
        </h2>
      </div>
      <p className="mt-1 text-sm text-slate-600">
        Questions go straight to the founder. You&rsquo;ll see their answer here.
      </p>

      <div className="mt-4">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="e.g. Can you share monthly churn for the last 12 months?"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800"
        />
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand-indigo,#2E78F5)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
          >
            <Send className="h-3.5 w-3.5" />
            {busy ? "Sending…" : "Send question"}
          </button>
          {sent && <span className="text-xs text-emerald-600">Sent — the founder has been notified.</span>}
        </div>
      </div>

      {questions.length > 0 && (
        <ul className="mt-6 divide-y divide-slate-100 border-t border-slate-100">
          {questions.map((q) => (
            <li key={q.id} className="py-3">
              <p className="text-sm font-medium text-slate-800">{q.question}</p>
              <p className="mt-0.5 text-xs text-slate-400">You · {fmtDate(q.createdAt)}</p>
              {q.answer ? (
                <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2">
                  <p className="text-xs font-medium text-slate-500">Founder&rsquo;s answer</p>
                  <p className="mt-0.5 text-sm text-slate-700">{q.answer}</p>
                </div>
              ) : (
                <p className="mt-1 text-xs italic text-slate-400">Awaiting the founder&rsquo;s answer.</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
