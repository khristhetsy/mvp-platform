"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
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
// Response time helpers
// ---------------------------------------------------------------------------

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function ResponseTimeBadge({ createdAt, respondedAt }: { createdAt: string | null; respondedAt: string | null }) {
  if (respondedAt) {
    const days = daysSince(createdAt);
    const responded = daysSince(respondedAt);
    const label = responded === 0 ? "responded today" : `responded in ${days ?? "?"}d`;
    return (
      <span style={{ fontSize: 9, fontWeight: 600, background: "#EAF3DE", color: "#1E6D3C", padding: "2px 7px", borderRadius: 20 }}>
        ✓ {label}
      </span>
    );
  }
  const days = daysSince(createdAt);
  if (days === null) return null;
  if (days === 0) {
    return (
      <span style={{ fontSize: 9, fontWeight: 600, background: "#E6F1FB", color: "#185FA5", padding: "2px 7px", borderRadius: 20 }}>
        asked today
      </span>
    );
  }
  const urgent = days >= 3;
  return (
    <span style={{
      fontSize: 9, fontWeight: 600, padding: "2px 7px", borderRadius: 20,
      background: urgent ? "#FCEBEB" : "#FAEEDA",
      color: urgent ? "#A32D2D" : "#854F0B",
    }}>
      {urgent ? "⚠ " : ""}{days}d unanswered
    </span>
  );
}

// ---------------------------------------------------------------------------
// Pattern intelligence banner
// ---------------------------------------------------------------------------

const CATEGORY_LABELS: Record<string, string> = {
  financial: "Financial",
  legal: "Legal",
  traction: "Traction",
  market: "Market",
  product: "Product",
  team: "Team",
  compliance: "Compliance",
  operations: "Operations",
  other: "Other",
};

const PATTERN_SIGNALS: Record<string, string> = {
  financial: "Investor is closely scrutinising your financials — be thorough with unit economics and runway.",
  legal: "Multiple legal questions indicate heightened due diligence — consider proactively sharing cap table and IP assignments.",
  traction: "Investor focus on traction suggests they want more proof points — lead with your strongest retention or growth metrics.",
  market: "Heavy market focus — strengthen your TAM/SAM narrative with a credible third-party source.",
  team: "Team questions signal they are evaluating execution risk — highlight relevant domain expertise and key hires.",
  product: "Multiple product questions — clarify your technical moat and roadmap clearly.",
  compliance: "Compliance scrutiny — prepare to share any licenses, certifications, or regulatory status documents.",
  operations: "Operational questions suggest they want to validate scalability — be specific about your infrastructure and key vendor dependencies.",
};

function IntelligenceBanner({ questions }: { questions: Question[] }) {
  const t = useTranslations("sharedCmp");
  const unanswered = questions.filter((q) => !q.founder_response);
  const oldestUnanswered = unanswered.reduce<number>((max, q) => {
    const d = daysSince(q.created_at ? String(q.created_at) : null) ?? 0;
    return d > max ? d : max;
  }, 0);

  // Category frequency map
  const freq: Record<string, number> = {};
  for (const q of questions) {
    const cat = q.category ?? "other";
    freq[cat] = (freq[cat] ?? 0) + 1;
  }
  const focusedCategories = Object.entries(freq)
    .filter(([, count]) => count >= 2)
    .sort(([, a], [, b]) => b - a);

  if (questions.length === 0) return null;

  return (
    <div style={{ background: "#EEEDFE", borderRadius: 12, padding: "12px 14px", marginBottom: 16, display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5z"
            stroke="#2E78F5" strokeWidth="2" strokeLinejoin="round" fill="#2E78F5" />
        </svg>
        <span style={{ fontSize: 10, fontWeight: 700, color: "#2E78F5", textTransform: "uppercase", letterSpacing: ".07em" }}>
          Deal room intelligence
        </span>
      </div>

      {/* Stats row */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Chip label={`${questions.length} questions`} color="#2E78F5" bg="#DDD9F9" />
        <Chip label={`${unanswered.length} unanswered`} color={unanswered.length > 0 ? "#854F0B" : "#1E6D3C"} bg={unanswered.length > 0 ? "#FAEEDA" : "#EAF3DE"} />
        {oldestUnanswered >= 1 && (
          <Chip
            label={`oldest unanswered: ${oldestUnanswered}d ${oldestUnanswered >= 3 ? "⚠" : ""}`}
            color={oldestUnanswered >= 3 ? "#A32D2D" : "#854F0B"}
            bg={oldestUnanswered >= 3 ? "#FCEBEB" : "#FAEEDA"}
          />
        )}
        <Chip label={t("benchmark_respond_within_24h")} color="#185FA5" bg="#E6F1FB" />
      </div>

      {/* Pattern signals */}
      {focusedCategories.map(([cat, count]) => (
        <div key={cat} style={{ background: "white", borderRadius: 8, padding: "8px 10px", display: "flex", gap: 8, alignItems: "flex-start" }}>
          <span style={{ fontSize: 9, fontWeight: 700, background: "#EEEDFE", color: "#2E78F5", padding: "2px 6px", borderRadius: 10, whiteSpace: "nowrap", marginTop: 1 }}>
            {CATEGORY_LABELS[cat] ?? cat} ×{count}
          </span>
          <p style={{ fontSize: 11, color: "#1A6CE4", margin: 0, lineHeight: 1.5 }}>
            {PATTERN_SIGNALS[cat] ?? `${count} questions in this category — address them comprehensively.`}
          </p>
        </div>
      ))}
    </div>
  );
}

function Chip({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 600, color, background: bg, padding: "3px 8px", borderRadius: 20 }}>
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// AI draft panel — calls real API
// ---------------------------------------------------------------------------

function QACoachPanel({
  roomId,
  question,
  company,
  onInsert,
}: {
  roomId: string;
  question: Question;
  company: DealRoomCompanySnapshot;
  onInsert: (draft: string) => void;
}) {
  const t = useTranslations("sharedCmp");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchDraft() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/deal-room/${encodeURIComponent(roomId)}/ai-draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: question.id,
          question: question.question ?? "",
          category: question.category ?? "other",
          companySnapshot: company,
        }),
      });
      const json = await res.json() as { draft?: string; error?: string };
      if (!res.ok) throw new Error(json.error ?? "AI draft failed.");
      setDraft(json.draft ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to generate draft.");
    } finally {
      setLoading(false);
    }
  }

  function handleToggle() {
    const next = !open;
    setOpen(next);
    if (next && !draft && !loading) void fetchDraft();
  }

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={handleToggle}
        className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold transition"
        style={{
          background: open ? "#EEEDFE" : "white",
          color: open ? "#2E78F5" : "#6366f1",
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
          style={{ borderColor: "#c7d2fe", background: "#fafaff" }}
        >
          {loading ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 0" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ animation: "spin 1s linear infinite" }}>
                <circle cx="12" cy="12" r="10" stroke="#c7d2fe" strokeWidth="3" />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="#2E78F5" strokeWidth="3" strokeLinecap="round" />
              </svg>
              <span style={{ fontSize: 11, color: "#2E78F5" }}>{t("generating_ai_draft")}</span>
            </div>
          ) : error ? (
            <p style={{ fontSize: 11, color: "#A32D2D", margin: 0 }}>{error}</p>
          ) : draft ? (
            <>
              <p className="mb-2 text-[10px] leading-relaxed text-slate-400">
                AI-generated draft. Edit the{" "}
                <span className="font-semibold text-slate-600">[brackets]</span>{" "}
                with your actual figures before inserting.
              </p>
              <p className="mb-2.5 whitespace-pre-wrap rounded-lg bg-white px-3 py-2.5 font-mono text-[10px] leading-relaxed text-slate-700 ring-1 ring-slate-200">
                {draft}
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => { onInsert(draft); setOpen(false); }}
                  className="rounded-full px-3 py-1 text-[10px] font-semibold text-white transition hover:opacity-90"
                  style={{ background: "#2E78F5" }}
                >
                  Insert draft
                </button>
                <button
                  type="button"
                  onClick={() => void fetchDraft()}
                  className="rounded-full px-3 py-1 text-[10px] font-semibold transition hover:opacity-80"
                  style={{ background: "white", color: "#2E78F5", border: "1px solid #c7d2fe" }}
                >
                  Regenerate
                </button>
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
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
  const t = useTranslations("sharedCmp");
  const [questions, setQuestions] = useState<Question[]>(initialQuestions);
  const [category, setCategory] = useState("other");
  const [questionText, setQuestionText] = useState("");
  const [responseById, setResponseById] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Sorted: unanswered first, then by age desc
  const sortedQuestions = useMemo(() => {
    return [...questions].sort((a, b) => {
      const aUnanswered = !a.founder_response ? 1 : 0;
      const bUnanswered = !b.founder_response ? 1 : 0;
      if (aUnanswered !== bUnanswered) return bUnanswered - aUnanswered;
      return new Date(String(b.created_at ?? 0)).getTime() - new Date(String(a.created_at ?? 0)).getTime();
    });
  }, [questions]);

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

      {/* Intelligence banner — founder only */}
      {viewerRole === "founder" && questions.length > 0 && (
        <IntelligenceBanner questions={questions} />
      )}

      {/* Investor: ask a question */}
      {viewerRole === "investor" ? (
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <p className="text-sm font-semibold text-slate-900">{t("ask_a_diligence_question")}</p>
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
            placeholder={t("ask_a_structured_due_diligence_question")}
          />
        </div>
      ) : null}

      {sortedQuestions.length === 0 ? (
        <p className="text-sm text-slate-600">{t("no_questions_yet")}</p>
      ) : (
        <div className="space-y-3">
          {sortedQuestions.map((q) => (
            <div
              key={q.id}
              className="rounded-xl border border-slate-200 bg-white p-3.5 text-sm shadow-sm"
            >
              {/* Category + status + response time */}
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span
                  className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em]"
                  style={{ background: "#EEEDFE", color: "#2E78F5" }}
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
                <ResponseTimeBadge
                  createdAt={q.created_at ? String(q.created_at) : null}
                  respondedAt={q.responded_at ? String(q.responded_at) : null}
                />
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
                      roomId={roomId}
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
                    placeholder={t("respond_no_legal_advice_keep_factual_and_edu")}
                  />
                  <button
                    type="button"
                    disabled={loading !== null || !(responseById[q.id] ?? "").trim()}
                    onClick={() => void respond(q.id)}
                    className="rounded-lg px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    style={{ background: "#2E78F5" }}
                  >
                    {loading === `respond:${q.id}` ? "Saving…" : "Send response"}
                  </button>
                </div>
              ) : (
                <p className="mt-2 text-xs text-slate-400">{t("awaiting_founder_response")}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
