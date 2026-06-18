"use client";

import { use, useState } from "react";
import Link from "next/link";
import {
  CAPITAL_STAGE_META,
  type CapitalStage,
} from "@/lib/learning/capital-stages";

const STAGES: CapitalStage[] = ["stage_0", "stage_1", "stage_2", "stage_3"];

export function DeliverablePageClient({
  params,
}: {
  params: Promise<{ stage: string }>;
}) {
  const { stage: stageParam } = use(params);
  const stage = stageParam as CapitalStage;

  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [aiScore, setAiScore] = useState<number | null>(null);
  const [aiFeedback, setAiFeedback] = useState<string | null>(null);

  if (!STAGES.includes(stage)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <p className="text-sm text-slate-500">Stage not found.</p>
          <Link href="/founder/learning" className="mt-4 inline-block text-sm text-indigo-600 hover:underline">
            ← Back to Learning Hub
          </Link>
        </div>
      </div>
    );
  }

  const meta = CAPITAL_STAGE_META[stage];

  const handleSubmit = async () => {
    if (!content.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/learning/deliverables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          capitalStage: stage,
          deliverableId: meta.deliverable.id,
          contentText: content,
        }),
      });
      const data = await res.json();
      setSubmitted(true);
      if (data.aiScore != null) setAiScore(data.aiScore);
      if (data.aiFeedback) setAiFeedback(data.aiFeedback);
    } catch {
      // silent
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-6 py-3">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link
            href={`/founder/learning/stages/${stage}`}
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            ← {meta.label}
          </Link>
          <span
            className="rounded-md px-2 py-0.5 text-[10px] font-semibold"
            style={{ background: meta.bgColor, color: meta.color }}
          >
            {meta.icon} Stage deliverable
          </span>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-6 py-10 space-y-6">
        {/* Header */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            {meta.label}
          </p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">{meta.deliverable.title}</h1>
          <p className="mt-2 text-base text-slate-600">{meta.deliverable.description}</p>
        </div>

        {/* Submission form */}
        {!submitted ? (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
              <h2 className="text-sm font-semibold text-slate-900">Your submission</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Paste or write your deliverable below. Claude will review and score it.
              </p>
            </div>
            <div className="p-6">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full rounded-xl border border-slate-200 p-4 text-sm text-slate-800 placeholder-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                rows={14}
                placeholder={`Paste your ${meta.deliverable.title} here…`}
              />
              <div className="mt-4 flex items-center justify-between">
                <p className="text-xs text-slate-400">{content.length} characters</p>
                <button
                  onClick={handleSubmit}
                  disabled={submitting || content.trim().length < 50}
                  className="rounded-xl px-6 py-2.5 text-sm font-semibold text-white transition disabled:opacity-50"
                  style={{ background: meta.color }}
                >
                  {submitting ? "Submitting & scoring…" : "Submit for AI review"}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl border border-green-200 bg-green-50 p-6">
              <p className="text-sm font-semibold text-green-800">✓ Deliverable submitted</p>
              {aiScore != null && (
                <div className="mt-3 flex items-center gap-3">
                  <span className="text-3xl font-bold" style={{ color: meta.color }}>{aiScore}</span>
                  <span className="text-sm text-slate-500">/ 100 AI score</span>
                </div>
              )}
              {aiFeedback && (
                <p className="mt-3 text-sm text-slate-700">{aiFeedback}</p>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setSubmitted(false); }}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Resubmit
              </button>
              <Link
                href={`/founder/learning/stages/${stage}`}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-white"
                style={{ background: meta.color }}
              >
                Back to {meta.label}
              </Link>
            </div>
          </div>
        )}

        {/* Tips */}
        <div
          className="rounded-2xl border p-5"
          style={{ borderColor: meta.borderColor, background: meta.bgColor }}
        >
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: meta.color }}>
            {meta.icon} Tips for a strong submission
          </p>
          <ul className="mt-3 space-y-1.5 text-sm text-slate-700">
            <li>→ Be specific — vague answers score lower than concrete, evidence-backed content.</li>
            <li>→ Show your numbers — revenue, users, growth rate, burn, runway.</li>
            <li>→ Address the investor&apos;s perspective — what risk does this de-risk?</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
