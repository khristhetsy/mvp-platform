"use client";

import { useState } from "react";
import { sectorLabel } from "@/lib/icfo-events/sectors";
import { RUBRIC_DIMENSIONS } from "@/lib/icfo-events/types";
import type { SpeakerApplication, SpeakerApplicationStatus } from "@/lib/icfo-events/types";

const STATUS_STYLES: Record<SpeakerApplicationStatus, string> = {
  submitted: "bg-blue-50 text-blue-700",
  under_review: "bg-amber-50 text-amber-700",
  approved: "bg-emerald-50 text-emerald-700",
  declined: "bg-slate-100 text-slate-500",
};

const DIM_LABELS: Record<string, string> = {
  relevance: "Relevance",
  credibility: "Credibility",
  sector_fit: "Sector fit",
  audience_value: "Audience value",
};

const KIND_LABELS: Record<string, string> = {
  presenter: "Presenter",
  panelist: "Panelist",
  founder_showcase: "Founder showcase",
};

function ReviewPanel({
  application,
  onDecided,
}: {
  application: SpeakerApplication;
  onDecided: (a: SpeakerApplication) => void;
}) {
  const [scores, setScores] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    RUBRIC_DIMENSIONS.forEach((d) => (init[d] = application.rubricScores[d] ?? 3));
    return init;
  });
  const [note, setNote] = useState(application.decisionNote ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(action: "approve" | "decline") {
    if (action === "decline" && !note.trim()) {
      setError("A note is required when declining.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/events/applications/${application.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note: note || undefined, rubricScores: scores }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Decision failed.");
      onDecided(json.application as SpeakerApplication);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Decision failed.");
    } finally {
      setBusy(false);
    }
  }

  const total = RUBRIC_DIMENSIONS.reduce((sum, d) => sum + (scores[d] ?? 0), 0);

  return (
    <div className="mt-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {RUBRIC_DIMENSIONS.map((d) => (
          <label key={d} className="flex items-center justify-between gap-3 text-sm">
            <span className="text-[var(--text-secondary)]">{DIM_LABELS[d] ?? d}</span>
            <select
              value={scores[d]}
              onChange={(e) => setScores((s) => ({ ...s, [d]: Number(e.target.value) }))}
              className="rounded-md border border-[var(--border-subtle)] px-2 py-1 text-sm"
            >
              {[0, 1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <p className="mt-2 text-xs text-[var(--text-muted)]">Total score: {total} / 20</p>

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        placeholder="Reviewer note (required to decline)"
        className="mt-3 w-full rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm"
      />

      {error && <p className="mt-2 text-sm text-rose-700">{error}</p>}

      <div className="mt-3 flex gap-2">
        <button
          disabled={busy}
          onClick={() => decide("approve")}
          className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          Approve
        </button>
        <button
          disabled={busy}
          onClick={() => decide("decline")}
          className="rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-sm font-medium text-[var(--text-secondary)] disabled:opacity-50"
        >
          Decline
        </button>
      </div>
    </div>
  );
}

export function ApplicationsQueue({ initialApplications }: { initialApplications: SpeakerApplication[] }) {
  const [applications, setApplications] = useState(initialApplications);
  const [openId, setOpenId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "open" | "approved" | "declined">("open");

  function onDecided(updated: SpeakerApplication) {
    setApplications((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    setOpenId(null);
  }

  const visible = applications.filter((a) => {
    if (filter === "all") return true;
    if (filter === "open") return a.status === "submitted" || a.status === "under_review";
    if (filter === "approved") return a.status === "approved";
    return a.status === "declined";
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <h1 className="text-xl font-semibold text-[var(--text-primary)]">Speaker applications</h1>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        Score each applicant against the rubric, then approve or decline. Approving adds them to the
        event roster and notifies them.
      </p>

      <div className="mt-4 flex gap-2">
        {(["open", "approved", "declined", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition ${
              filter === f
                ? "bg-[var(--indigo)] text-white"
                : "border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-slate-50"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-3">
        {visible.length === 0 ? (
          <div className="rounded-xl border border-[var(--border-subtle)] bg-white px-5 py-12 text-center text-sm text-[var(--text-muted)]">
            No applications in this view.
          </div>
        ) : (
          visible.map((a) => (
            <div key={a.id} className="rounded-xl border border-[var(--border-subtle)] bg-white p-5 shadow-[var(--shadow-panel)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-[var(--indigo-soft)] px-2 py-0.5 text-xs font-medium text-[var(--indigo)]">
                      {KIND_LABELS[a.kind] ?? a.kind}
                    </span>
                    {a.sectorSlug && (
                      <span className="text-xs text-[var(--text-muted)]">{sectorLabel(a.sectorSlug)}</span>
                    )}
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[a.status]}`}>
                      {a.status.replace("_", " ")}
                    </span>
                  </div>
                  <h2 className="mt-2 font-semibold text-[var(--navy)]">{a.topic}</h2>
                  <p className="text-sm text-[var(--text-muted)]">
                    {a.applicantName ?? "Applicant"} · {a.applicantRole}
                    {a.eventTitle ? ` · ${a.eventTitle}` : ""}
                  </p>
                  {a.bio && <p className="mt-2 max-w-2xl text-sm text-[var(--text-secondary)]">{a.bio}</p>}
                  {a.links.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {a.links.map((l) => (
                        <a key={l} href={l} target="_blank" rel="noopener noreferrer" className="text-xs text-[var(--blue)] underline">
                          {l.replace(/^https?:\/\//, "").slice(0, 40)}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
                {(a.status === "submitted" || a.status === "under_review") && (
                  <button
                    onClick={() => setOpenId(openId === a.id ? null : a.id)}
                    className="cap-btn-primary flex-none rounded-md px-3 py-1.5 text-sm font-medium"
                  >
                    {openId === a.id ? "Close" : "Review"}
                  </button>
                )}
              </div>

              {openId === a.id && <ReviewPanel application={a} onDecided={onDecided} />}

              {a.status === "declined" && a.decisionNote && (
                <p className="mt-2 text-xs text-[var(--text-muted)]">Note: {a.decisionNote}</p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
