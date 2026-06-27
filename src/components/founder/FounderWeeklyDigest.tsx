"use client";

import { useState } from "react";
import Link from "next/link";
import { computeDataRoomState } from "@/lib/data-room/completeness";
import type { DocumentRecord } from "@/lib/supabase/types";

/* ─────────────────────────── types ──────────────────────────── */

type Room = { id: string; title: string; status: string; updated_at: string };
type Doc  = { id: string; file_name: string | null; document_type: string | null; created_at: string | null };

type Props = Readonly<{
  rooms: Room[];
  documents: Doc[];
  unresolvedQCount: number;
  readinessScore: number;
  strongMatchCount: number;
  investorActivityTotal: number;
  companyCreatedAt: string | null;
  founderName: string;
}>;

/* ─────────────────────────── helpers ────────────────────────── */

function weekNumber(createdAt: string | null): number {
  if (!createdAt) return 1;
  const ms = Date.now() - new Date(createdAt).getTime();
  return Math.max(1, Math.ceil(ms / (7 * 86_400_000)));
}

function currentWeekRange(): string {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(monday)} – ${fmt(sunday)}`;
}

function daysSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
}

function relTime(iso: string): string {
  const d = daysSince(iso);
  if (d === 0) return "Today";
  if (d === 1) return "Yesterday";
  return `${d}d ago`;
}

function computeActivity(
  rooms: Room[],
  docs: Doc[],
): Array<{ text: string; when: string; type: "room" | "doc" | "positive" }> {
  const items: Array<{ text: string; when: string; type: "room" | "doc" | "positive"; sortMs: number }> = [];

  for (const r of rooms) {
    const d = daysSince(r.updated_at);
    if (d <= 7) {
      items.push({
        text: `Deal room "${r.title}" had activity`,
        when: relTime(r.updated_at),
        type: "room",
        sortMs: new Date(r.updated_at).getTime(),
      });
    }
  }

  for (const doc of docs) {
    if (!doc.created_at) continue;
    const d = daysSince(doc.created_at);
    if (d <= 7) {
      const label = doc.file_name
        ?? (doc.document_type?.replace(/_/g, " ").toLowerCase() ?? "document");
      items.push({
        text: `Uploaded "${label}"`,
        when: relTime(doc.created_at),
        type: "doc",
        sortMs: new Date(doc.created_at).getTime(),
      });
    }
  }

  items.sort((a, b) => b.sortMs - a.sortMs);

  if (items.length === 0) {
    items.push({
      text: "No document or deal room activity this week yet",
      when: "",
      type: "positive",
      sortMs: 0,
    });
  }

  return items.slice(0, 5).map(({ text, when, type }) => ({ text, when, type }));
}

function computePriorities(opts: {
  rooms: Room[];
  unresolvedQCount: number;
  readinessScore: number;
  strongMatchCount: number;
}): string[] {
  const p: string[] = [];

  // Stale rooms first
  const staleRooms = opts.rooms.filter((r) => daysSince(r.updated_at) >= 4);
  if (staleRooms.length > 0) {
    p.push(
      staleRooms.length === 1
        ? `Re-engage deal room "${staleRooms[0].title}" before it goes cold.`
        : `Re-engage ${staleRooms.length} quiet deal rooms before investors disengage.`,
    );
  }

  // Unanswered questions
  if (opts.unresolvedQCount > 0) {
    p.push(
      `Answer ${opts.unresolvedQCount} open investor question${opts.unresolvedQCount === 1 ? "" : "s"} — response speed is a strong signal.`,
    );
  }

  // Readiness gap
  if (opts.readinessScore < 80) {
    const gap = 80 - opts.readinessScore;
    p.push(
      gap <= 10
        ? `You're ${gap} points from the 80 threshold — one or two uploads will cross it.`
        : `Bring your readiness score from ${opts.readinessScore} to 80 — that unlocks institutional investor conversations.`,
    );
  }

  // Strong matches
  if (opts.strongMatchCount > 0) {
    p.push(
      `Contact your ${opts.strongMatchCount} strong investor match${opts.strongMatchCount === 1 ? "" : "es"} — the best window is within 14 days of matching.`,
    );
  }

  // Positive fallback
  if (p.length === 0) {
    p.push("Keep your deal rooms active and maintain your response time below 24h.");
    p.push("Upload any outstanding diligence documents to strengthen your readiness score.");
    p.push("Review your investor matches and start outreach to the strongest fits.");
  }

  return p.slice(0, 3);
}

/* ─────────────────────────── component ─────────────────────── */

export function FounderWeeklyDigest({
  rooms,
  documents,
  unresolvedQCount,
  readinessScore,
  strongMatchCount,
  investorActivityTotal,
  companyCreatedAt,
  founderName,
}: Props) {
  const [open, setOpen] = useState(true);

  const wk          = weekNumber(companyCreatedAt);
  const dateRange   = currentWeekRange();
  const dataRoom    = computeDataRoomState(documents as unknown as DocumentRecord[]);
  const activity    = computeActivity(rooms, documents);
  const priorities  = computePriorities({ rooms, unresolvedQCount, readinessScore, strongMatchCount });
  const firstName   = founderName.split(" ")[0] || founderName;

  // Counts for highlights
  const docsThisWeek   = documents.filter((d) => d.created_at && daysSince(d.created_at) <= 7).length;
  const roomsThisWeek  = rooms.filter((r) => daysSince(r.updated_at) <= 7).length;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* Gradient accent bar */}
      <div style={{ height: 3, background: "linear-gradient(90deg,#534AB7,#7c3aed,#06b6d4)" }} />

      {/* Header row — always visible */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg text-sm"
            style={{ background: "#EEEDFE" }}
          >
            📋
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">
              Week {wk} of your raise
            </p>
            <p className="text-[11px] text-slate-400">{dateRange}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span
            className="hidden rounded-full px-2.5 py-1 text-[10px] font-semibold sm:inline"
            style={{ background: "#EEEDFE", color: "#534AB7" }}
          >
            {priorities.length} priorities this week
          </span>
          <svg
            width="16" height="16" viewBox="0 0 24 24" fill="none"
            aria-hidden="true"
            style={{ transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
          >
            <path d="M6 9l6 6 6-6" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </button>

      {/* Expandable body */}
      {open ? (
        <div className="border-t border-slate-100 px-5 pb-5 pt-4">
          {/* Greeting */}
          <p className="mb-5 text-sm text-slate-600">
            Here&apos;s your capital raise briefing for the week, {firstName}.
          </p>

          {/* Data room completeness — top priority when incomplete */}
          {!dataRoom.fullComplete ? (
            <Link
              href="/founder/readiness/data-room"
              className="mb-5 flex items-center justify-between gap-3 rounded-xl border px-4 py-3"
              style={{ borderColor: dataRoom.coreComplete ? "#C0DDE0" : "#FAC775", background: dataRoom.coreComplete ? "#F0F9FB" : "#FDF6EA" }}
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">
                  Data room {dataRoom.percent}% complete
                </p>
                <p className="text-xs text-slate-600">
                  {dataRoom.coreComplete
                    ? `${dataRoom.missingCount} document${dataRoom.missingCount === 1 ? "" : "s"} left for a full diligence package.`
                    : `Missing investor-access essentials: ${dataRoom.coreMissing.map((i) => i.label).join(", ")}.`}
                </p>
              </div>
              <span className="flex-none rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white">Finish →</span>
            </Link>
          ) : null}

          {/* Highlights row */}
          <div className="mb-5 grid grid-cols-3 gap-3">
            {[
              { label: "Investor signals", value: investorActivityTotal, sub: "total this raise" },
              { label: "Active rooms", value: roomsThisWeek, sub: "updated this week" },
              { label: "Docs uploaded", value: docsThisWeek, sub: "this week" },
            ].map((h) => (
              <div
                key={h.label}
                className="rounded-xl px-3 py-3 text-center"
                style={{ background: "#F8F7FD" }}
              >
                <p className="text-xl font-semibold" style={{ color: "#534AB7" }}>{h.value}</p>
                <p className="mt-0.5 text-[11px] font-medium text-slate-600">{h.label}</p>
                <p className="text-[10px] text-slate-400">{h.sub}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            {/* What happened */}
            <div>
              <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                What happened
              </p>
              <div className="space-y-2">
                {activity.map((item, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <div
                      style={{
                        width: 6, height: 6, borderRadius: "50%", flexShrink: 0, marginTop: 5,
                        background: item.type === "doc" ? "#534AB7" : item.type === "room" ? "#7c3aed" : "#e2e8f0",
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-slate-700 leading-relaxed">{item.text}</p>
                      {item.when ? (
                        <p className="text-[10px] text-slate-400">{item.when}</p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Priorities */}
            <div>
              <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                This week&apos;s priorities
              </p>
              <div className="space-y-2">
                {priorities.map((p, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2.5 rounded-lg px-3 py-2.5"
                    style={{ background: "#F8F7FD" }}
                  >
                    <span
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white mt-0.5"
                      style={{ background: "#534AB7" }}
                    >
                      {i + 1}
                    </span>
                    <p className="text-xs leading-relaxed text-slate-700">{p}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
