"use client";

import { useState } from "react";
import { formatApiError } from "@/lib/api/errors";
import type { Database } from "@/lib/supabase/types";

type Question = Database["public"]["Tables"]["deal_room_questions"]["Row"];

export function DealRoomQuestionsPanel({
  roomId,
  viewerRole,
  initialQuestions,
}: {
  roomId: string;
  viewerRole: "founder" | "investor";
  initialQuestions: Question[];
}) {
  const [questions, setQuestions] = useState<Question[]>(initialQuestions);
  const [category, setCategory] = useState("other");
  const [questionText, setQuestionText] = useState("");
  const [responseById, setResponseById] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function ask() {
    setLoading("ask");
    setError(null);
    try {
      const res = await fetch(`/api/deal-room/${encodeURIComponent(roomId)}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, question: questionText }),
      });
      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) throw json;
      setQuestions((v) => [json.question as Question, ...v]);
      setQuestionText("");
    } catch (e) {
      setError(formatApiError(e, "Unable to create question."));
    } finally {
      setLoading(null);
    }
  }

  async function respond(questionId: string) {
    setLoading(`respond:${questionId}`);
    setError(null);
    try {
      const res = await fetch(`/api/deal-room/${encodeURIComponent(roomId)}/questions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, response: responseById[questionId] ?? "", status: "open" }),
      });
      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) throw json;
      const updated = json.question as Question;
      setQuestions((v) => v.map((q) => (q.id === updated.id ? updated : q)));
    } catch (e) {
      setError(formatApiError(e, "Unable to respond."));
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-4">
      {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">{error}</div> : null}

      {viewerRole === "investor" ? (
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <p className="text-sm font-semibold text-slate-900">Ask a diligence question</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <select className="rounded-lg border border-slate-200 px-3 py-2 text-sm" value={category} onChange={(e) => setCategory(e.target.value)}>
              {["financial","legal","traction","market","product","team","compliance","operations","other"].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <button
              type="button"
              disabled={loading !== null || !questionText.trim()}
              onClick={() => void ask()}
              className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {loading === "ask" ? "Posting…" : "Post question"}
            </button>
          </div>
          <textarea
            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            rows={3}
            value={questionText}
            onChange={(e) => setQuestionText(e.target.value)}
            placeholder="Ask a structured due diligence question…"
          />
        </div>
      ) : null}

      {questions.length === 0 ? (
        <p className="text-sm text-slate-600">No questions yet.</p>
      ) : (
        <div className="space-y-3">
          {questions.map((q) => (
            <div key={q.id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{q.category} · {q.status}</p>
              <p className="mt-1 font-medium text-slate-900">{q.question}</p>
              {q.founder_response ? (
                <p className="mt-2 text-slate-700"><span className="font-semibold">Founder:</span> {q.founder_response}</p>
              ) : viewerRole === "founder" ? (
                <div className="mt-2 space-y-2">
                  <textarea
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    rows={2}
                    value={responseById[q.id] ?? ""}
                    onChange={(e) => setResponseById((v) => ({ ...v, [q.id]: e.target.value }))}
                    placeholder="Respond (no legal advice; keep factual and educational)…"
                  />
                  <button
                    type="button"
                    disabled={loading !== null || !(responseById[q.id] ?? "").trim()}
                    onClick={() => void respond(q.id)}
                    className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                  >
                    {loading === `respond:${q.id}` ? "Saving…" : "Send response"}
                  </button>
                </div>
              ) : (
                <p className="mt-2 text-slate-500">Awaiting founder response.</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

