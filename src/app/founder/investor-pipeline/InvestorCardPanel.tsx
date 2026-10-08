"use client";

/**
 * Investor CRM: the detail panel that slides in from the right when a board card
 * is clicked. A quick look without leaving the board; "Open full record" goes to
 * /founder/investor-pipeline/[id] for everything else.
 *
 * Contact details stay hidden here as everywhere else in the founder CRM (the
 * page only loads safe columns), so the panel has no email row. Email and
 * Schedule meeting link to the pages that already do those jobs.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarPlus, ExternalLink, Mail, X } from "lucide-react";
import { ScoreRing } from "@/components/ui/ScoreRing";

export type PanelStage = { id: string; label: string; color: string };

export type PanelInvestor = {
  id: string;
  name: string;
  location: string | null;
  investor_type: string;
  investment_size: string | null;
  pledge_amount: number | null;
  match_score: number | null;
  pipeline_stage: string;
  source: "manual" | "platform_match";
  platform_investor_id: string | null;
  preferred_stages: string[] | null;
  focus_sectors: string[] | null;
  last_contact_date?: string | null;
  next_follow_up_date?: string | null;
};

type Note = { id: string; body: string; created_at: string };

/** Every date shows in Pacific time. A bare YYYY-MM-DD is a calendar day, shown as is. */
function formatDay(value: string | null | undefined): string {
  if (!value) return "None yet";
  const bare = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const d = new Date(bare ? `${value}T12:00:00Z` : value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric", timeZone: bare ? "UTC" : "America/Los_Angeles",
  });
}

function formatStamp(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return `${d.toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles",
  })} PT`;
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";
}

export function InvestorCardPanel({
  investor, stages, onClose, onStageChange,
}: {
  investor: PanelInvestor;
  stages: PanelStage[];
  onClose: () => void;
  onStageChange: (id: string, stage: string) => void;
}) {
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);

  useEffect(() => {
    // The parent keys this panel by investor id, so notes start empty for each one.
    let live = true;
    fetch(`/api/founder/investor-pipeline/${investor.id}/notes`)
      .then((r) => (r.ok ? r.json() : { notes: [] }))
      .then((j: { notes?: Note[] }) => { if (live) setNotes(j.notes ?? []); })
      .catch(() => { if (live) setNotes([]); });
    return () => { live = false; };
  }, [investor.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function addNote() {
    const body = draft.trim();
    if (!body) { setNoteError("Write a note first."); return; }
    setSaving(true);
    setNoteError(null);
    try {
      const r = await fetch(`/api/founder/investor-pipeline/${investor.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const j = (await r.json().catch(() => ({}))) as { note?: Note; error?: string };
      if (!r.ok || !j.note) { setNoteError(j.error ?? "Couldn't save the note. Try again."); return; }
      setNotes((prev) => [j.note as Note, ...(prev ?? [])]);
      setDraft("");
    } finally {
      setSaving(false);
    }
  }

  const stage = stages.find((s) => s.id === (investor.pipeline_stage ?? "new")) ?? stages[0];
  const prospect = investor.source === "platform_match" && !investor.platform_investor_id;
  const rows: Array<[string, string]> = [
    ["Investment size", investor.investment_size ?? "Not set"],
    ["Pledged", investor.pledge_amount != null ? `$${investor.pledge_amount.toLocaleString()}` : "None yet"],
    ["Source", investor.source === "platform_match" ? "Platform match" : "Added by you"],
    ["Location", investor.location ?? "Not set"],
    ["Last contact", formatDay(investor.last_contact_date)],
    ["Next follow up", formatDay(investor.next_follow_up_date)],
  ];
  const chips = [...(investor.preferred_stages ?? []), ...(investor.focus_sectors ?? [])];

  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ background: "rgba(12,35,64,0.25)" }} onClick={onClose}>
      <aside
        role="dialog"
        aria-label={`${investor.name} details`}
        className="flex h-full w-full max-w-[420px] flex-col bg-white shadow-2xl enterprise-animate-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b px-5 py-4" style={{ borderColor: "var(--border-subtle)" }}>
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-indigo-50 text-sm font-semibold text-indigo-700">
              {initials(investor.name)}
            </span>
            <div className="min-w-0">
              <h3 className="truncate text-base font-semibold" style={{ color: "var(--text-primary)" }}>{investor.name}</h3>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {investor.investor_type || "Investor"}{prospect ? " · Prospect" : ""}
              </p>
            </div>
          </div>
          <div className="flex flex-none items-center gap-2">
            <ScoreRing score={investor.match_score} size={42} sublabel="match" />
            <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 hover:bg-slate-100" style={{ color: "var(--text-muted)" }}>
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <div className="flex flex-wrap gap-2">
            <Link href="/founder/deploy" className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12.5px] font-medium hover:bg-slate-50" style={{ borderColor: "var(--border-subtle)", color: "var(--text-primary)" }}>
              <Mail className="h-4 w-4" aria-hidden="true" /> Email
            </Link>
            <Link href="/founder/schedule" className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12.5px] font-medium hover:bg-slate-50" style={{ borderColor: "var(--border-subtle)", color: "var(--text-primary)" }}>
              <CalendarPlus className="h-4 w-4" aria-hidden="true" /> Schedule meeting
            </Link>
            <Link href={`/founder/investor-pipeline/${investor.id}`} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12.5px] font-medium hover:bg-slate-50" style={{ borderColor: "var(--border-subtle)", color: "var(--blue)" }}>
              <ExternalLink className="h-4 w-4" aria-hidden="true" /> Open full record
            </Link>
          </div>

          <div>
            <div className="flex items-center justify-between border-b py-2 text-[13px]" style={{ borderColor: "var(--border-subtle)" }}>
              <span style={{ color: "var(--text-secondary)" }}>Stage</span>
              <select
                value={stage?.id ?? "new"}
                onChange={(e) => onStageChange(investor.id, e.target.value)}
                className="rounded-md border px-1.5 py-1 text-[12px]"
                style={{ borderColor: "var(--border-subtle)", color: "var(--text-primary)" }}
                aria-label={`Move ${investor.name} to another stage`}
              >
                {stages.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
            <div className="flex items-center justify-between border-b py-2 text-[13px]" style={{ borderColor: "var(--border-subtle)" }}>
              <span style={{ color: "var(--text-secondary)" }}>Match score</span>
              <span style={{ color: "var(--text-primary)" }}>{investor.match_score != null ? investor.match_score : "Not scored"}</span>
            </div>
            {rows.map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-3 border-b py-2 text-[13px]" style={{ borderColor: "var(--border-subtle)" }}>
                <span style={{ color: "var(--text-secondary)" }}>{label}</span>
                <span className="text-right" style={{ color: "var(--text-primary)" }}>{value}</span>
              </div>
            ))}
          </div>

          {chips.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs" style={{ color: "var(--text-muted)" }}>Stages and sectors</p>
              <div className="flex flex-wrap gap-1.5">
                {chips.map((c) => <span key={c} className="rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{c}</span>)}
              </div>
            </div>
          )}

          <div>
            <p className="mb-1.5 text-xs" style={{ color: "var(--text-muted)" }}>Notes</p>
            <textarea
              value={draft}
              onChange={(e) => { setDraft(e.target.value); if (noteError) setNoteError(null); }}
              placeholder="Add a note"
              rows={3}
              className="w-full rounded-lg border px-3 py-2 text-[13px]"
              style={{ borderColor: "var(--border-subtle)" }}
            />
            {noteError ? <p className="mt-1 text-[12px] text-red-600">{noteError}</p> : null}
            <div className="mt-2 flex justify-end">
              <button type="button" onClick={addNote} disabled={saving} className="cap-btn-primary rounded-lg px-3 py-1.5 text-[12.5px] font-semibold disabled:opacity-50">
                {saving ? "Saving…" : "Add note"}
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {notes === null ? (
                <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>Loading notes…</p>
              ) : notes.length === 0 ? (
                <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>No notes yet.</p>
              ) : notes.map((n) => (
                <div key={n.id} className="rounded-lg border px-3 py-2" style={{ borderColor: "var(--border-subtle)" }}>
                  <p className="whitespace-pre-wrap text-[13px]" style={{ color: "var(--text-primary)" }}>{n.body}</p>
                  <p className="mt-1 text-[11px]" style={{ color: "var(--text-muted)" }}>{formatStamp(n.created_at)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
