"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CoachCourseRow } from "@/lib/learning/coach/admin";

// Kept here, not imported from review-pack, which uses server only modules (crypto, email).
const REVIEW_LABEL: Record<CoachCourseRow["review"], string> = {
  not_reviewed: "Not reviewed by counsel",
  reviewed: "Reviewed by counsel",
  changed: "Wording changed since counsel review",
};

const CHIP: Record<CoachCourseRow["review"], string> = {
  reviewed: "bg-green-50 text-green-700",
  not_reviewed: "bg-amber-50 text-amber-700",
  changed: "bg-red-50 text-red-600",
};

/** Counsel review status for one coach course, with the form that records a sign off. */
export function CounselReviewPanel({ row, canRecord, today }: Readonly<{ row: CoachCourseRow; canRecord: boolean; today: string }>) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewerName, setReviewerName] = useState("");
  const [reference, setReference] = useState("");
  const [reviewedOn, setReviewedOn] = useState(today);

  async function record(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/learning/coach/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseKey: row.key, reviewerName, reference, reviewedOn }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      const body = res ? ((await res.json().catch(() => ({}))) as { error?: string }) : {};
      setError(body.error ?? "Could not save.");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{row.title}</p>
          <p className="mt-1 text-xs text-slate-500">
            {row.review === "reviewed" && row.reviewer
              ? `Reviewed by ${row.reviewer} on ${row.reviewedOn}.`
              : row.review === "changed"
                ? "The wording changed after the last review. The coach is off for founders until counsel reviews it again."
                : "Founders cannot use the coach until counsel has reviewed this wording."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${CHIP[row.review]}`}>{REVIEW_LABEL[row.review]}</span>
          <Link
            href={`/admin/learning/coach/review/${row.key}`}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Open review pack
          </Link>
          {canRecord && row.review !== "reviewed" ? (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
            >
              Record review
            </button>
          ) : null}
        </div>
      </div>

      {open ? (
        <form onSubmit={(e) => void record(e)} className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-3">
          <label className="text-xs font-medium text-slate-600">
            Counsel who reviewed it
            <input
              required
              value={reviewerName}
              onChange={(e) => setReviewerName(e.target.value)}
              maxLength={200}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
            />
          </label>
          <label className="text-xs font-medium text-slate-600">
            Reference (email or matter number)
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              maxLength={300}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
            />
          </label>
          <label className="text-xs font-medium text-slate-600">
            Date reviewed
            <input
              required
              type="date"
              max={today}
              value={reviewedOn}
              onChange={(e) => setReviewedOn(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
            />
          </label>
          <p className="text-[11px] text-slate-500 sm:col-span-3">
            This records that counsel reviewed the wording shown in the review pack today. If any word changes later, the review no longer applies.
          </p>
          <div className="flex items-center gap-3 sm:col-span-3">
            <button type="submit" disabled={busy} className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">
              {busy ? "Saving…" : "Save review"}
            </button>
            {error ? <span className="text-xs text-red-600">{error}</span> : null}
          </div>
        </form>
      ) : null}
    </div>
  );
}
