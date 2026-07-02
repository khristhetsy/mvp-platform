"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";

// ---------------------------------------------------------------------------
// Types (serializable from server)
// ---------------------------------------------------------------------------

export type CommandCenterRoom = {
  id: string;
  title: string;
  status: string;
  updatedAt: string;
  unansweredCount: number;
  pendingDocRequests: number;
};

export type CommandCenterInvestor = {
  id: string;
  name: string;
  investorType: string;
  outreachStatus: string;
  meetingRequested: string;
  lastContactDate: string | null;
  nextFollowUpDate: string | null;
  matchScore: number | null;
  notes: string | null;
};

export type CommandCenterProps = {
  rooms: CommandCenterRoom[];
  investors: CommandCenterInvestor[];
  readinessScore: number;
  pledgedAmount: number;
  fundingTarget: number | null;
  companyName: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

function relDate(iso: string | null): string {
  if (!iso) return "—";
  const d = daysSince(iso);
  if (d === null) return "—";
  if (d === 0) return "Today";
  if (d === 1) return "Yesterday";
  return `${d}d ago`;
}

// ---------------------------------------------------------------------------
// Section: Deal rooms
// ---------------------------------------------------------------------------

function RoomsSection({ rooms }: { rooms: CommandCenterRoom[] }) {
  if (rooms.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 p-5 text-center text-sm text-slate-400">
        No active deal rooms.{" "}
        <Link href="/founder/deal-room" className="font-semibold" style={{ color: "#534AB7" }}>
          Open a room →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {rooms.map((room) => {
        const staleDays = daysSince(room.updatedAt);
        const isStale = staleDays !== null && staleDays >= 4;
        const isUrgent = staleDays !== null && staleDays >= 8;
        const hasActions = room.unansweredCount > 0 || room.pendingDocRequests > 0;

        return (
          <Link
            key={room.id}
            href={`/founder/deal-room/${room.id}`}
            className="flex items-center justify-between gap-3 rounded-xl border px-4 py-3 transition hover:shadow-sm"
            style={{
              borderColor: isUrgent ? "#fca5a5" : isStale ? "#fde68a" : "#e0e7ff",
              background: isUrgent ? "#fff9f9" : isStale ? "#fffdf7" : "white",
            }}
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-900">{room.title}</p>
              <p className="text-[11px] text-slate-400">Last activity: {relDate(room.updatedAt)}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {room.unansweredCount > 0 ? (
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-[9px] font-bold text-red-700">
                  {room.unansweredCount} Q
                </span>
              ) : null}
              {room.pendingDocRequests > 0 ? (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-bold text-amber-700">
                  {room.pendingDocRequests} docs
                </span>
              ) : null}
              {!hasActions && !isStale ? (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-bold text-emerald-700">
                  Active
                </span>
              ) : null}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M9 18l6-6-6-6" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section: Investor follow-ups
// ---------------------------------------------------------------------------

function FollowUpsSection({ investors }: { investors: CommandCenterInvestor[] }) {
  const overdue = investors.filter((inv) => {
    const until = daysUntil(inv.nextFollowUpDate);
    return until !== null && until <= 0;
  });
  const upcoming = investors.filter((inv) => {
    const until = daysUntil(inv.nextFollowUpDate);
    return until !== null && until > 0 && until <= 7;
  });
  const noContact = investors.filter(
    (inv) => !inv.nextFollowUpDate && inv.outreachStatus === "contacted",
  );

  const all = [...overdue, ...upcoming, ...noContact].slice(0, 8);

  if (all.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 p-5 text-center text-sm text-slate-400">
        No pending follow-ups.{" "}
        <Link href="/founder/investor-pipeline" className="font-semibold" style={{ color: "#534AB7" }}>
          View pipeline →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {all.map((inv) => {
        const until = daysUntil(inv.nextFollowUpDate);
        const isOverdue = until !== null && until <= 0;
        const daysLabel =
          until === null
            ? "No follow-up set"
            : until === 0
            ? "Due today"
            : until < 0
            ? `${Math.abs(until)}d overdue`
            : `Due in ${until}d`;

        return (
          <div
            key={inv.id}
            className="flex items-center justify-between gap-3 rounded-xl border px-4 py-3"
            style={{
              borderColor: isOverdue ? "#fca5a5" : "#e2e8f0",
              background: isOverdue ? "#fff9f9" : "white",
            }}
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-900">{inv.name}</p>
              <p className="text-[11px] text-slate-400">
                {inv.investorType} · Last contact: {relDate(inv.lastContactDate)}
              </p>
            </div>
            <span
              className="shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
              style={{
                background: isOverdue ? "#FEE2E2" : "#EFF6FF",
                color: isOverdue ? "#B91C1C" : "#1D4ED8",
              }}
            >
              {daysLabel}
            </span>
          </div>
        );
      })}

      <Link
        href="/founder/investor-pipeline"
        className="block pt-1 text-center text-xs font-semibold"
        style={{ color: "#534AB7" }}
      >
        View full pipeline →
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section: Raise metrics strip
// ---------------------------------------------------------------------------

function MetricsStrip({
  readinessScore,
  pledgedAmount,
  fundingTarget,
  roomCount,
  overdueFollowUps,
}: {
  readinessScore: number;
  pledgedAmount: number;
  fundingTarget: number | null;
  roomCount: number;
  overdueFollowUps: number;
}) {
  const pledgePct =
    fundingTarget && fundingTarget > 0
      ? Math.min(100, Math.round((pledgedAmount / fundingTarget) * 100))
      : null;

  const metrics = [
    {
      label: "Readiness",
      value: `${readinessScore}`,
      sub: "/100",
      color: readinessScore >= 80 ? "#16a34a" : readinessScore >= 65 ? "#d97706" : "#dc2626",
    },
    {
      label: "Active rooms",
      value: `${roomCount}`,
      sub: "",
      color: "#534AB7",
    },
    {
      label: "Pledged",
      value: pledgePct !== null ? `${pledgePct}%` : "$0",
      sub: pledgePct !== null ? " of target" : " raised",
      color: pledgePct && pledgePct >= 50 ? "#16a34a" : "#534AB7",
    },
    {
      label: "Follow-ups",
      value: `${overdueFollowUps}`,
      sub: " overdue",
      color: overdueFollowUps > 0 ? "#dc2626" : "#16a34a",
    },
  ];

  return (
    <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {metrics.map((m) => (
        <div
          key={m.label}
          className="rounded-xl px-4 py-3 text-center"
          style={{ background: "#F8F7FD" }}
        >
          <p className="text-xl font-bold" style={{ color: m.color }}>
            {m.value}
            <span className="text-sm font-normal text-slate-400">{m.sub}</span>
          </p>
          <p className="mt-0.5 text-[11px] font-medium text-slate-500">{m.label}</p>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

type TabKey = "rooms" | "followups";

export function RaiseCommandCenter({
  rooms,
  investors,
  readinessScore,
  pledgedAmount,
  fundingTarget,
  companyName,
}: CommandCenterProps) {
  const t = useTranslations("founderCmp");
  const [tab, setTab] = useState<TabKey>("rooms");

  const urgentRooms   = rooms.filter((r) => daysSince(r.updatedAt) !== null && (daysSince(r.updatedAt) ?? 0) >= 4);
  const overdueInvs   = investors.filter((inv) => daysUntil(inv.nextFollowUpDate) !== null && (daysUntil(inv.nextFollowUpDate) ?? 1) <= 0);
  const totalActions  = rooms.reduce((s, r) => s + r.unansweredCount + r.pendingDocRequests, 0);

  const tabs: { key: TabKey; label: string; badge?: number }[] = [
    { key: "rooms", label: "Deal rooms", badge: rooms.length },
    { key: "followups", label: "Follow-ups", badge: overdueInvs.length || undefined },
  ];

  return (
    <div className="space-y-6">
      {/* Alert banner */}
      {(urgentRooms.length > 0 || overdueInvs.length > 0 || totalActions > 0) ? (
        <div
          className="flex items-start gap-3 rounded-xl border p-4"
          style={{ borderColor: "#fca5a5", background: "#fff9f9" }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="mt-0.5 shrink-0" aria-hidden="true">
            <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
              stroke="#dc2626" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-red-900">{t("action_required")}</p>
            <p className="mt-0.5 text-xs text-red-700">
              {[
                totalActions > 0 && `${totalActions} pending question${totalActions > 1 ? "s" : ""} or doc request${totalActions > 1 ? "s" : ""}`,
                urgentRooms.length > 0 && `${urgentRooms.length} deal room${urgentRooms.length > 1 ? "s" : ""} going cold`,
                overdueInvs.length > 0 && `${overdueInvs.length} overdue follow-up${overdueInvs.length > 1 ? "s" : ""}`,
              ].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
      ) : null}

      {/* Metrics strip */}
      <MetricsStrip
        readinessScore={readinessScore}
        pledgedAmount={pledgedAmount}
        fundingTarget={fundingTarget}
        roomCount={rooms.length}
        overdueFollowUps={overdueInvs.length}
      />

      {/* Tab panel */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {/* Tab bar */}
        <div className="flex border-b border-slate-100">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className="flex items-center gap-1.5 px-5 py-3 text-xs font-semibold transition"
              style={{
                color: tab === t.key ? "#534AB7" : "#64748b",
                borderBottom: tab === t.key ? "2px solid #534AB7" : "2px solid transparent",
                background: "transparent",
              }}
            >
              {t.label}
              {t.badge ? (
                <span
                  className="rounded-full px-1.5 py-0.5 text-[9px] font-bold"
                  style={{
                    background: tab === t.key ? "#EEEDFE" : "#f1f5f9",
                    color: tab === t.key ? "#534AB7" : "#64748b",
                  }}
                >
                  {t.badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        <div className="p-4">
          {tab === "rooms" ? <RoomsSection rooms={rooms} /> : <FollowUpsSection investors={investors} />}
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Investor matches", href: "/founder/matching", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" },
          { label: "Documents", href: "/founder/documents", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
          { label: "Capital raise", href: "/founder/capital-raise", icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
          { label: "Readiness", href: "/founder/readiness", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
        ].map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-700 transition hover:border-indigo-200 hover:bg-[#EEEDFE] hover:text-[#534AB7]"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d={link.icon} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
