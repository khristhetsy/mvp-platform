"use client";

import { useState } from "react";
import { formatApiError } from "@/lib/api/errors";
import type { Database } from "@/lib/supabase/types";

type Question = Database["public"]["Tables"]["deal_room_questions"]["Row"];

export type DealRoomCompanySnapshot = {
  companyName: string;
  industry: string | null;
  businessDescription: string | null;
  revenueStage: string | null;
  fundingAmount: number | null;
  geography: string | null;
};

// ---------------------------------------------------------------------------
// AI draft generation — pure client-side, no API calls
// ---------------------------------------------------------------------------

const CATEGORY_TEMPLATES: Record<
  string,
  (q: string, c: DealRoomCompanySnapshot) => string
> = {
  financial: (_q, c) => {
    const stage = c.revenueStage ? ` We are currently at ${c.revenueStage} stage.` : "";
    return `Thank you for this question.${stage} [Provide your current ARR/MRR, e.g. "$[X]K MRR growing at [X]% MoM."] Our unit economics show [gross margin %, CAC, LTV]. [Describe your current runway and burn rate, e.g. "We have [X] months of runway at current burn of $[X]K/month."] Happy to share our financial model under NDA if helpful.`;
  },
  legal: (_q, c) => {
    return `${c.companyName} is incorporated as a [C-Corp / LLC] in [state/country]. We have [X] shareholders on the cap table, with founders holding [X]%. [Describe any IP assignments, NDAs, or material contracts relevant to this question.] There are no outstanding litigation matters or material legal encumbrances at this time. I can share our cap table summary or relevant agreements on request.`;
  },
  traction: (_q, c) => {
    const geo = c.geography ? ` currently operating in ${c.geography}` : "";
    return `${c.companyName}${geo} has achieved [key traction metric, e.g. "X paying customers / $XK ARR / X% month-over-month growth"]. [Add 1-2 additional proof points: retention rate, NPS, pilot results, etc.] Our strongest growth channel has been [channel], and we see [leading indicator] as the clearest signal of product-market fit.`;
  },
  market: (_q, _c) => {
    return `The total addressable market (TAM) for [your market] is estimated at $[X]B globally, with our initial serviceable addressable market (SAM) at $[X]B. [Cite a credible source, e.g. "per [Gartner / internal analysis]."] We are targeting [ICP description] as our beachhead segment, with a land-and-expand motion into [adjacent segments]. [Add any competitive positioning or differentiation notes.]`;
  },
  product: (_q, c) => {
    const stage = c.revenueStage ? ` at ${c.revenueStage} stage` : "";
    return `${c.companyName}${stage} offers [one-line product description]. The core technology is built on [stack/approach], which enables [key differentiator]. [Describe current product maturity: "We shipped our GA release in [month/year] and have [X] active users / integrations."] Our roadmap for the next 6 months focuses on [top 1-2 priorities]. [Note any proprietary tech, patents, or moats.]`;
  },
  team: (_q, c) => {
    return `${c.companyName} was founded by [Founder 1 background] and [Founder 2 background]. The team has deep expertise in [domain 1] and [domain 2], with prior experience at [notable companies / exits if applicable]. We currently have [X] full-time employees. [Name any key advisors or board members.] We are hiring for [open roles] to accelerate [function].`;
  },
  compliance: (_q, _c) => {
    return `[Describe your regulatory status: e.g. "We operate under [specific regulation] and have [license/certification/exemption] in [jurisdictions]."] We conduct [compliance process] on a [frequency] basis. [Note any pending regulatory approvals or material compliance risks and how they are being addressed.] Happy to share documentation or connect you with our legal counsel for a deeper dive.`;
  },
  operations: (_q, c) => {
    const geo = c.geography ? ` headquartered in ${c.geography}` : "";
    return `${c.companyName}${geo} operates with a team of [X] full-time and [X] contractors. Our core operations include [key process 1] and [key process 2]. [Describe key vendor/supplier relationships, SLAs, or infrastructure dependencies.] We have [describe scalability approach: "built our infrastructure to scale to [X] without additional headcount / key hires"].`;
  },
  other: (_q, c) => {
    return `Thank you for the question. [Start with a direct answer to what was asked.] At ${c.companyName}, [provide relevant context or supporting detail]. [If this requires a longer answer or supporting documents, note: "Happy to share [document / reference] or schedule a call to walk through this in more detail."]`;
  },
};

function generateAnswerDraft(question: Question, company: DealRoomCompanySnapshot): string {
  const category = question.category ?? "other";
  const template = CATEGORY_TEMPLATES[category] ?? CATEGORY_TEMPLATES.other;
  return template(question.question ?? "", company);
}

// ---------------------------------------------------------------------------
// Q&A coach button + panel
// ---------------------------------------------------------------------------

function QACoachPanel({
  question,
  company,
  onInsert,
}: {
  question: Question;
  company: DealRoomCompanySnapshot;
  onInsert: (draft: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const draft = generateAnswerDraft(question, company);

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold transition"
        style={{
          background: open ? "#EEEDFE" : "white",
          color: open ? "#534AB7" : "#6366f1",
          border: "1px solid #c7d2fe",
        }}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5z"
            stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        </svg>
        AI draft
        <svg
          width="8" height="8" viewBox="0 0 24 24" fill="none" aria-hidden="true"
          style={{ transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "rotate(0)" }}
        >
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open ? (
        <div
          className="mt-2 rounded-xl border p-3"
          style={{ borderColor: "#c7d2fe", background: "#fafaff", animation: "fadeUp .18s ease both" }}
        >
          <p className="mb-2 text-[10px] leading-relaxed text-slate-400">
            Category-matched draft. Edit the{" "}
            <span className="font-semibold text-slate-600">[brackets]</span>{" "}
            with your actual figures before inserting.
          </p>
          <p className="mb-2.5 whitespace-pre-wrap rounded-lg bg-white px-3 py-2.5 font-mono text-[10px] leading-relaxed text-slate-700 ring-1 ring-slate-200">
            {draft}
          </p>
          <button
            type="button"
            onClick={() => { onInsert(draft); setOpen(false); }}
            className="rounded-full px-3 py-1 text-[10px] font-semibold text-white transition hover:opacity-90"
            style={{ background: "#534AB7" }}
          >
            Insert draft
          </button>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

export function DealRoomQuestionsPanel({
  roomId,
  viewerRole,
  initialQuestions,
  companySnapshot,
}: {
  roomId: string;
  viewerRole: "founder" | "investor";
  initialQuestions: Question[];
  companySnapshot?: DealRoomCompanySnapshot;
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
      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
          {error}
        </div>
      ) : null}

      {viewerRole === "investor" ? (
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <p className="text-sm font-semibold text-slate-900">Ask a diligence question</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <select
              aria-label="Question category"
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
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
            aria-label="Due diligence question"
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
            <div
              key={q.id}
              className="rounded-xl border border-slate-200 bg-white p-3.5 text-sm shadow-sm"
            >
              {/* Category + status header */}
              <div className="mb-2 flex items-center gap-2">
                <span
                  className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em]"
                  style={{ background: "#EEEDFE", color: "#534AB7" }}
                >
                  {q.category ?? "other"}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] ${
                    q.status === "resolved"
                      ? "bg-[#EAF3DE] text-[#1E6D3C]"
                      : q.status === "clarification_requested"
                      ? "bg-[#FAEEDA] text-[#854F0B]"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {q.status ?? "open"}
                </span>
              </div>

              {/* Question text */}
              <p className="font-medium text-slate-900">{q.question}</p>

              {/* Response area */}
              {q.founder_response ? (
                <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700 ring-1 ring-slate-100">
                  <span className="font-semibold text-slate-800">Your response: </span>
                  {q.founder_response}
                </div>
              ) : viewerRole === "founder" ? (
                <div className="mt-3 space-y-2">
                  {/* AI draft coach */}
                  {companySnapshot ? (
                    <QACoachPanel
                      question={q}
                      company={companySnapshot}
                      onInsert={(draft) =>
                        setResponseById((v) => ({ ...v, [q.id]: draft }))
                      }
                    />
                  ) : null}

                  <textarea
                    aria-label="Founder response"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100"
                    rows={3}
                    value={responseById[q.id] ?? ""}
                    onChange={(e) =>
                      setResponseById((v) => ({ ...v, [q.id]: e.target.value }))
                    }
                    placeholder="Respond (no legal advice; keep factual and educational)…"
                  />
                  <button
                    type="button"
                    disabled={loading !== null || !(responseById[q.id] ?? "").trim()}
                    onClick={() => void respond(q.id)}
                    className="rounded-lg px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    style={{ background: "#534AB7" }}
                  >
                    {loading === `respond:${q.id}` ? "Saving…" : "Send response"}
                  </button>
                </div>
              ) : (
                <p className="mt-2 text-xs text-slate-400">Awaiting founder response.</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
