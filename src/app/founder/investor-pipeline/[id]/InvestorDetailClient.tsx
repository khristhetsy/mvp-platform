"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type PipelineStage = "new" | "contacted" | "interested" | "meeting" | "committed" | "passed";

const STAGES: { id: PipelineStage; label: string; color: string }[] = [
  { id: "new", label: "New", color: "#185FA5" },
  { id: "contacted", label: "Contacted", color: "#BA7517" },
  { id: "interested", label: "Interested", color: "#534AB7" },
  { id: "meeting", label: "Meeting", color: "#1D9E75" },
  { id: "committed", label: "Committed", color: "#0F6E56" },
  { id: "passed", label: "Passed", color: "#A32D2D" },
];

export type PipelineInvestorDetail = {
  id: string;
  name: string;
  investor_type: string;
  investment_size: string | null;
  pledge_amount: number | null;
  match_score: number | null;
  pipeline_stage: PipelineStage;
  meeting_requested: string;
  source: string;
  platform_investor_id: string | null;
  preferred_stages: string[] | null;
  focus_sectors: string[] | null;
  location: string | null;
  notes: string | null;
};

export function InvestorDetailClient({ investor }: { investor: PipelineInvestorDetail }) {
  const router = useRouter();
  const [stage, setStage] = useState<PipelineStage>(investor.pipeline_stage ?? "new");
  const [notes, setNotes] = useState(investor.notes ?? "");
  const [savingNote, setSavingNote] = useState(false);
  const [introState, setIntroState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [followState, setFollowState] = useState<"idle" | "loading" | "done" | "error">("idle");

  const isMember = Boolean(investor.platform_investor_id);

  async function changeStage(next: PipelineStage) {
    setStage(next);
    await fetch(`/api/founder/investor-pipeline/${investor.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pipeline_stage: next }),
    });
    router.refresh();
  }

  async function saveNote() {
    setSavingNote(true);
    await fetch(`/api/founder/investor-pipeline/${investor.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    });
    setSavingNote(false);
    router.refresh();
  }

  async function requestIntro() {
    if (!isMember) return;
    setIntroState("loading");
    try {
      const res = await fetch("/api/founder/matching/intro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ref: investor.platform_investor_id }),
      });
      setIntroState(res.ok ? "done" : "error");
    } catch {
      setIntroState("error");
    }
  }

  async function addFollowUp() {
    setFollowState("loading");
    try {
      const res = await fetch("/api/founder/matching/follow-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: investor.name, firm: null, investorType: investor.investor_type }),
      });
      setFollowState(res.ok ? "done" : "error");
    } catch {
      setFollowState("error");
    }
  }

  const metric = (label: string, value: string, color?: string) => (
    <div>
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</p>
      <p className="mt-1 text-lg font-medium tabular-nums" style={{ color: color ?? "var(--text-primary)" }}>{value}</p>
    </div>
  );

  const row = (label: string, value: string) => (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <span style={{ color: "var(--text-secondary)" }}>{label}</span>
      <span className="text-right" style={{ color: "var(--text-primary)" }}>{value}</span>
    </div>
  );

  return (
    <div>
      <Link href="/founder/investor-pipeline" className="text-sm font-medium text-indigo-600 hover:underline">← Investor CRM</Link>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={requestIntro}
            disabled={!isMember || introState === "loading" || introState === "done"}
            className="rounded-lg bg-[var(--brand-indigo,#2E78F5)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            title={isMember ? "" : "Introductions to prospects are coordinated by iCapOS"}
          >
            {introState === "loading" ? "Requesting…" : introState === "done" ? "Introduction requested ✓" : "Request introduction"}
          </button>
          <button
            type="button"
            onClick={addFollowUp}
            disabled={followState === "loading" || followState === "done"}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {followState === "loading" ? "Adding…" : followState === "done" ? "Added to follow-up ✓" : "Add to follow-up"}
          </button>
        </div>

        {/* Stage stepper */}
        <div className="mt-5 flex flex-wrap gap-2">
          {STAGES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => changeStage(s.id)}
              className="rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
              style={stage === s.id
                ? { background: s.color, color: "#fff" }
                : { border: "0.5px solid var(--border, #e2e8f0)", color: "var(--text-secondary, #64748b)" }}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Title */}
        <div className="mt-6 flex items-center gap-2">
          <h1 className="text-xl font-semibold text-slate-900">{investor.name}</h1>
          {!isMember && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">Prospect</span>}
        </div>
        <p className="mt-0.5 text-sm text-slate-500">{investor.investor_type}</p>

        {/* Metrics */}
        <div className="mt-5 grid grid-cols-2 gap-5 border-b border-slate-100 pb-5 sm:grid-cols-4">
          {metric("Check size", investor.investment_size ?? "—")}
          {metric("Match score", investor.match_score != null ? `${investor.match_score}%` : "—", investor.match_score != null && investor.match_score >= 70 ? "#0F6E56" : undefined)}
          {metric("Amount pledged", investor.pledge_amount != null ? `$${investor.pledge_amount.toLocaleString()}` : "—")}
          {metric("Stage", STAGES.find((s) => s.id === stage)?.label ?? "New")}
        </div>

        {/* Details — no contact information */}
        <div className="mt-5 grid gap-x-10 border-b border-slate-100 pb-5 sm:grid-cols-2">
          {row("Investor type", investor.investor_type)}
          {row("Source", investor.source === "platform_match" ? "Matching" : "Manual")}
          {row("Focus sectors", investor.focus_sectors?.length ? investor.focus_sectors.join(", ") : "—")}
          {row("Geography", investor.location ?? "—")}
          {row("Preferred stages", investor.preferred_stages?.length ? investor.preferred_stages.join(", ") : "—")}
          {row("Meeting", investor.meeting_requested === "none" ? "None" : investor.meeting_requested)}
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
          <span aria-hidden="true">🔒</span> Contact details are hidden — introductions are coordinated through iCapOS.
        </div>

        {/* Notes */}
        <div className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Private notes</p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            placeholder="Add a private note…"
            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          />
          <button
            type="button"
            onClick={saveNote}
            disabled={savingNote}
            className="mt-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {savingNote ? "Saving…" : "Save note"}
          </button>
        </div>
      </div>
    </div>
  );
}
