"use client";

import { useState } from "react";

type Suggestion = { kind: string; text: string; target: "fix-it" | "capacity" };
type Answer = { question: string; text: string | null; reason?: string; suggestions: Suggestion[] };

const QUESTIONS = ["Why is it slow?", "What should I do first?", "Is it safe to pause a job?"];
const COMPUTE = "https://supabase.com/dashboard/project/raowjbhbtmwkycmwvavd/settings/compute-and-disk";

/**
 * Asks the model to explain the readings. It drafts words only. The suggested actions are
 * chosen by rules on the server and sent back as pointers to the buttons under Fix it,
 * so nothing runs from here and a person confirms every change there.
 */
export function DbHealthAskAi() {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function ask(question: string) {
    const text = question.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/db-health/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: text }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) setError(typeof j.error === "string" ? j.error : "Couldn't ask. Try again.");
      else setAnswer({ question: text, text: typeof j.text === "string" ? j.text : null, reason: typeof j.reason === "string" ? j.reason : undefined, suggestions: Array.isArray(j.suggestions) ? j.suggestions : [] });
      setQ("");
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-indigo-200 bg-gradient-to-b from-indigo-50 to-white p-4">
      <div className="flex flex-wrap gap-2">
        {QUESTIONS.map((s) => (
          <button key={s} type="button" disabled={busy} onClick={() => ask(s)} className="rounded-full border border-indigo-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 disabled:opacity-50">{s}</button>
        ))}
      </div>

      {error ? <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">{error}</p> : null}

      {busy ? <p className="mt-3 text-xs text-indigo-700">Reading the numbers…</p> : null}

      {answer && !busy ? (
        <div className="mt-3 space-y-2">
          <p className="ml-auto max-w-[92%] rounded-2xl rounded-br-sm bg-indigo-600 px-3.5 py-2 text-sm text-white">{answer.question}</p>
          <div className="max-w-[92%] rounded-2xl rounded-bl-sm border border-slate-200 bg-white px-3.5 py-2.5 text-sm leading-relaxed text-slate-800">
            {answer.text ? <p>{answer.text}</p> : <p className="text-slate-500">No explanation available. {answer.reason ?? ""}</p>}
            {answer.suggestions.length ? (
              <div className="mt-2 border-t border-slate-100 pt-2">
                <p className="text-xs font-semibold text-slate-700">What the readings suggest, in order</p>
                <ol className="mt-1 list-decimal space-y-1 pl-5 text-xs text-slate-700">
                  {answer.suggestions.map((s) => (
                    <li key={s.text}>
                      {s.text}{" "}
                      {s.target === "capacity" ? (
                        <a href={COMPUTE} target="_blank" rel="noopener noreferrer" className="font-semibold text-indigo-700 hover:underline">Open compute settings</a>
                      ) : (
                        <a href="#fix-it" className="font-semibold text-indigo-700 hover:underline">Go to Fix it</a>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <form onSubmit={(e) => { e.preventDefault(); void ask(q); }} className="mt-3 flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} maxLength={300} placeholder="Ask a question about these numbers" aria-label="Ask a question about the database health" className="min-w-0 flex-1 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm" />
        <button type="submit" disabled={busy || !q.trim()} className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Ask</button>
      </form>
      <p className="mt-2 text-[11px] text-slate-500">The AI explains and suggests. It cannot change anything, and you confirm every action under Fix it. It cannot change your Supabase plan. Each question counts toward your AI budget.</p>
    </div>
  );
}
