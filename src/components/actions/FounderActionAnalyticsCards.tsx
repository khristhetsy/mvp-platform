"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import type { ActionCenterAnalytics } from "@/lib/actions/types";
import type { NextBestAction } from "@/lib/next-best-actions/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type DrawerKey = "active" | "overdue" | "escalated" | "completed";

// ---------------------------------------------------------------------------
// SVG Icons
// ---------------------------------------------------------------------------
function IconActivity() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}
function IconAlert() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}
function IconArrow() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
    </svg>
  );
}
function IconCheck() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Clickable stat card
// ---------------------------------------------------------------------------
function AnalyticsCard({
  label,
  value,
  icon,
  iconBg,
  iconColor,
  valueFg,
  onClick,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  valueFg: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full text-left overflow-hidden rounded-[14px] border border-slate-200/80 bg-white p-4 transition-all hover:border-slate-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20 active:scale-[0.99]"
      style={{ boxShadow: "0 1px 3px rgb(12 35 64 / 0.06)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div
          className="flex items-center justify-center rounded-[9px] shrink-0"
          style={{ width: 34, height: 34, background: iconBg, color: iconColor }}
        >
          {icon}
        </div>
        <span
          className="font-bold leading-none"
          style={{ fontSize: 26, fontVariantNumeric: "tabular-nums", color: valueFg }}
        >
          {value}
        </span>
      </div>
      <p
        className="mt-3 uppercase tracking-wide"
        style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.05em", color: "#64748b" }}
      >
        {label}
      </p>
      <p className="mt-2 text-[11px] font-medium" style={{ color: iconColor }}>
        View breakdown →
      </p>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Drawer stat box
// ---------------------------------------------------------------------------
function DStatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2.5 ring-1 ring-slate-100 text-center">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="mt-0.5 font-mono text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Breakdown row
// ---------------------------------------------------------------------------
const PRI_CLS: Record<string, string> = {
  critical: "bg-[#FCEBEB] text-[#A32D2D]",
  high:     "bg-[#FAEEDA] text-[#854F0B]",
  medium:   "bg-[#EEEDFE] text-[#1A6CE4]",
  low:      "bg-slate-100 text-slate-500",
  normal:   "bg-slate-100 text-slate-600",
};

function BRow({ name, badge, badgeCls }: { name: string; badge: string; badgeCls: string }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 py-2 text-xs last:border-0">
      <span className="min-w-0 flex-1 truncate text-slate-800">{name}</span>
      <span className={`ml-3 shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold ${badgeCls}`}>
        {badge}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AI advice box
// ---------------------------------------------------------------------------
function AdviceBox({ lines }: { lines: string[] }) {
  return (
    <div className="mt-4 rounded-xl p-4" style={{ background: "#1e1b4b" }}>
      <div className="mb-3 flex items-center gap-2">
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
          style={{ background: "#2E78F5" }}
        >
          AI
        </div>
        <span className="text-sm font-medium" style={{ color: "#e0e7ff" }}>
          Founder Intelligence
        </span>
      </div>
      <div className="space-y-2.5">
        {lines.map((line, i) => (
          <div key={i} className="flex gap-2 text-xs leading-relaxed">
            <span className="shrink-0 font-semibold" style={{ color: "#818cf8" }}>{i + 1}.</span>
            <span style={{ color: "#c7d2fe" }}>{line}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Drawer content per key
// ---------------------------------------------------------------------------
function DrawerContent({
  drawerKey,
  analytics,
  actions,
  needsAttention,
  onClose,
}: {
  drawerKey: DrawerKey;
  analytics: ActionCenterAnalytics;
  actions: NextBestAction[];
  needsAttention: NextBestAction[];
  onClose: () => void;
}) {
  const t = useTranslations("sharedCmp");
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();

  const overdueActions = actions.filter(
    (a) => a.status === "overdue" || (a.dueAt && new Date(a.dueAt).getTime() < now),
  );
  const escalatedActions = actions.filter((a) => a.status === "escalated");
  const activeActions = actions.filter(
    (a) =>
      a.status !== "overdue" &&
      a.status !== "escalated" &&
      a.status !== "completed" &&
      a.status !== "dismissed" &&
      !(a.dueAt && new Date(a.dueAt).getTime() < now),
  );

  const closeBtn = (
    <button
      type="button"
      onClick={onClose}
      className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
      aria-label="Close"
    >
      ✕
    </button>
  );

  // ── Active ─────────────────────────────────────────────────────────────────
  if (drawerKey === "active") {
    const criticalCount = analytics.byPriority?.critical ?? 0;
    const highCount = analytics.byPriority?.high ?? 0;
    const mediumCount = analytics.byPriority?.medium ?? 0;
    const displayActions = activeActions.slice(0, 8);

    return (
      <div className="px-5 pb-6 pt-5">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="text-base font-semibold text-slate-900">{t("active_actions")}</p>
            <p className="mt-0.5 text-xs text-slate-500">{t("open_items_that_need_your_attention")}</p>
          </div>
          {closeBtn}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <DStatBox label={t("total_active")} value={String(analytics.open)} />
          <DStatBox label={t("critical")} value={String(criticalCount)} />
          <DStatBox label={t("high_priority")} value={String(highCount)} />
        </div>

        <p className="mt-5 text-xs font-semibold text-slate-900">{t("action_breakdown")}</p>
        <div className="mt-2">
          {displayActions.length === 0 ? (
            <p className="py-2 text-xs text-slate-500">{t("no_active_actions_right_now")}</p>
          ) : (
            displayActions.map((a) => (
              <BRow
                key={a.persistedId ?? a.id}
                name={a.title}
                badge={a.priority}
                badgeCls={PRI_CLS[a.priority] ?? PRI_CLS.normal}
              />
            ))
          )}
          {activeActions.length > 8 && (
            <p className="pt-2 text-[11px] text-slate-400">
              +{activeActions.length - 8} more — scroll the action list below to see all
            </p>
          )}
        </div>

        <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3 ring-1 ring-slate-100">
          <p className="mb-1 text-[11px] font-semibold text-slate-700">{t("what_this_means")}</p>
          <p className="text-xs leading-relaxed text-slate-600">
            {analytics.open === 0
              ? "You have no active actions. This is either very good or your inbox hasn't synced yet — check again in a moment."
              : `You have ${analytics.open} active action${analytics.open === 1 ? "" : "s"} open. ${criticalCount > 0 ? `${criticalCount} of these are critical and block investor readiness or compliance milestones.` : "None are critical right now."} Active actions represent work that has been identified but not yet resolved.`}
          </p>
        </div>

        <AdviceBox
          lines={[
            criticalCount > 0
              ? `${criticalCount} critical action${criticalCount === 1 ? "" : "s"} should be your first focus today — these directly impact your investor readiness score and listing visibility.`
              : analytics.open > 0
              ? `You have ${analytics.open} active actions but none are critical. Focus on the high-priority ones first, then work through medium and low in order.`
              : "No active actions — a great sign. Use this window to review your readiness score and data room completeness.",
            highCount > 0
              ? `${highCount} high-priority action${highCount === 1 ? "" : "s"} are next in line. These typically involve investor engagement or document gaps that slow fundraising velocity.`
              : mediumCount > 0
              ? `Your ${mediumCount} medium-priority action${mediumCount === 1 ? "" : "s"} are manageable. Batching similar tasks (e.g., all document uploads together) reduces context-switching and gets more done.`
              : "Keep your action list short. Closing even 1–2 items per day compounds quickly over a fundraise cycle.",
            analytics.open > 10
              ? `${analytics.open} open actions is high for a founder. Consider focusing only on critical and high-priority items this week, and snoozeing the rest until after your next investor meeting.`
              : `Your queue of ${analytics.open} is manageable. Pick the top 3 for today and commit to completing them before checking email.`,
          ]}
        />
      </div>
    );
  }

  // ── Overdue ────────────────────────────────────────────────────────────────
  if (drawerKey === "overdue") {
    const critOverdue = overdueActions.filter((a) => a.priority === "critical").length;
    const highOverdue = overdueActions.filter((a) => a.priority === "high").length;
    const displayActions = overdueActions.slice(0, 8);

    return (
      <div className="px-5 pb-6 pt-5">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="text-base font-semibold text-slate-900">{t("overdue_actions")}</p>
            <p className="mt-0.5 text-xs text-slate-500">{t("past_their_due_date_and_still_open")}</p>
          </div>
          {closeBtn}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <DStatBox label={t("overdue")} value={String(analytics.overdue)} />
          <DStatBox label={t("critical_overdue")} value={String(critOverdue)} />
          <DStatBox label={t("high_priority")} value={String(highOverdue)} />
        </div>

        <p className="mt-5 text-xs font-semibold text-slate-900">{t("overdue_breakdown")}</p>
        <div className="mt-2">
          {displayActions.length === 0 ? (
            <p className="py-2 text-xs text-slate-500">
              {analytics.overdue > 0
                ? "Overdue actions exist but aren't shown in the current filter — switch to the Overdue tab to see them."
                : "No overdue actions. "}
            </p>
          ) : (
            displayActions.map((a) => (
              <BRow
                key={a.persistedId ?? a.id}
                name={a.title}
                badge={`Overdue · ${a.priority}`}
                badgeCls="bg-[#FCEBEB] text-[#A32D2D]"
              />
            ))
          )}
        </div>

        <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3 ring-1 ring-slate-100">
          <p className="mb-1 text-[11px] font-semibold text-slate-700">{t("what_this_means")}</p>
          <p className="text-xs leading-relaxed text-slate-600">
            {analytics.overdue === 0
              ? "You have no overdue actions — all open items are within their timeframes."
              : `${analytics.overdue} action${analytics.overdue === 1 ? " is" : "s are"} past due. ${critOverdue > 0 ? `${critOverdue} of these are critical — they may already be affecting your investor readiness score.` : "None are critical, but left unresolved they can compound into compliance or investor trust issues."}`}
          </p>
        </div>

        <AdviceBox
          lines={[
            analytics.overdue === 0
              ? "No overdue actions — excellent. Keep your queue reviewed weekly to maintain this."
              : critOverdue > 0
              ? `${critOverdue} critical overdue item${critOverdue === 1 ? " needs" : "s need"} immediate attention. These are the ones most likely to come up in an investor due diligence call — resolve them before your next meeting.`
              : `You have ${analytics.overdue} overdue action${analytics.overdue === 1 ? "" : "s"}. Start with the highest-priority one — completing it removes the most drag from your fundraise.`,
            analytics.overdue > 0
              ? `For each overdue action, the question isn't "when can I do it" — it's "is this still relevant?" Dismiss anything that no longer applies and focus your energy on what's live.`
              : "If you're consistently at zero overdue, you're ahead of 80% of founders on the platform. Use this time proactively on investor engagement.",
            analytics.overdue >= 5
              ? `With ${analytics.overdue} overdue items, batching is key. Block 90 minutes this week to clear the list — don't try to resolve them one-off between meetings.`
              : analytics.overdue > 0
              ? `${analytics.overdue} overdue item${analytics.overdue === 1 ? " is" : "s are"} manageable in a single focused session. Schedule 30 minutes before end of week.`
              : "Staying at zero overdue signals operational discipline — something investors notice in due diligence.",
          ]}
        />
      </div>
    );
  }

  // ── Escalated ──────────────────────────────────────────────────────────────
  if (drawerKey === "escalated") {
    const displayActions = escalatedActions.slice(0, 8);
    const alsoInNeeds = needsAttention.filter((a) => a.status === "escalated");

    return (
      <div className="px-5 pb-6 pt-5">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="text-base font-semibold text-slate-900">{t("escalated_actions")}</p>
            <p className="mt-0.5 text-xs text-slate-500">{t("flagged_as_requiring_urgent_review")}</p>
          </div>
          {closeBtn}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <DStatBox label={t("escalated")} value={String(analytics.escalated)} />
          <DStatBox label={t("in_needs_attention")} value={String(alsoInNeeds.length)} />
          <DStatBox label={t("total_open")} value={String(analytics.open)} />
        </div>

        <p className="mt-5 text-xs font-semibold text-slate-900">{t("escalated_breakdown")}</p>
        <div className="mt-2">
          {displayActions.length === 0 ? (
            <p className="py-2 text-xs text-slate-500">
              {analytics.escalated > 0
                ? "Escalated actions exist — switch to the Escalated tab to see them all."
                : "No escalated actions."}
            </p>
          ) : (
            displayActions.map((a) => (
              <BRow
                key={a.persistedId ?? a.id}
                name={a.title}
                badge="Escalated"
                badgeCls="bg-[#FAEEDA] text-[#854F0B]"
              />
            ))
          )}
        </div>

        <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3 ring-1 ring-slate-100">
          <p className="mb-1 text-[11px] font-semibold text-slate-700">{t("what_this_means")}</p>
          <p className="text-xs leading-relaxed text-slate-600">
            {analytics.escalated === 0
              ? "No escalated actions — nothing has been flagged as requiring urgent follow-up."
              : `${analytics.escalated} action${analytics.escalated === 1 ? " has been" : "s have been"} escalated. Escalation means the system or a reviewer has flagged these as requiring your direct attention — typically because of inactivity, a compliance gap, or a time-sensitive investor interaction.`}
          </p>
        </div>

        <AdviceBox
          lines={[
            analytics.escalated === 0
              ? "No escalated actions. If you see escalations appear, treat them as same-day priorities — they're flagged because automated follow-ups haven't resolved them."
              : `${analytics.escalated} escalated item${analytics.escalated === 1 ? " requires" : "s require"} direct action from you today. These cannot be resolved by the system — only you can unblock them.`,
            analytics.escalated > 0
              ? "For each escalated action, read the reason and take the smallest possible next step — even sending a one-line response unblocks most escalations."
              : "Investors occasionally escalate intro requests that go unanswered for 72+ hours. Responding to all intro requests within 48 hours is the best way to prevent escalations.",
            analytics.escalated > 2
              ? `${analytics.escalated} simultaneous escalations is unusual. This may indicate a systemic gap — for example, a category of actions you're consistently deferring. Review what these have in common.`
              : analytics.escalated > 0
              ? "One or two escalations is normal during a busy fundraise period. Clear these before your next investor call."
              : "Keeping escalations at zero builds a strong operational track record — something that matters in board-level or institutional investor due diligence.",
          ]}
        />
      </div>
    );
  }

  // ── Completed this week ───────────────────────────────────────────────────
  const completedToday = analytics.completedToday ?? 0;
  const weeklyRate = analytics.completedThisWeek > 0
    ? Math.round((analytics.completedThisWeek / 7) * 10) / 10
    : 0;

  return (
    <div className="px-5 pb-6 pt-5">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <p className="text-base font-semibold text-slate-900">{t("completed_this_week")}</p>
          <p className="mt-0.5 text-xs text-slate-500">{t("actions_resolved_in_the_last_7_days")}</p>
        </div>
        {closeBtn}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <DStatBox label={t("this_week")} value={String(analytics.completedThisWeek)} />
        <DStatBox label={t("today")} value={String(completedToday)} />
        <DStatBox label={t("daily_avg")} value={weeklyRate > 0 ? `${weeklyRate}/day` : "0/day"} />
      </div>

      <p className="mt-5 text-xs font-semibold text-slate-900">{t("completion_summary")}</p>
      <div className="mt-2">
        <BRow
          name="Completed this week"
          badge={`${analytics.completedThisWeek} actions`}
          badgeCls="bg-[#EAF3DE] text-[#1E6D3C]"
        />
        <BRow
          name="Completed today"
          badge={`${completedToday} actions`}
          badgeCls="bg-[#EAF3DE] text-[#1E6D3C]"
        />
        <BRow
          name="Still open"
          badge={`${analytics.open} remaining`}
          badgeCls="bg-[#EEEDFE] text-[#1A6CE4]"
        />
        {analytics.overdue > 0 && (
          <BRow
            name="Overdue (still open)"
            badge={`${analytics.overdue} items`}
            badgeCls="bg-[#FCEBEB] text-[#A32D2D]"
          />
        )}
      </div>

      <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3 ring-1 ring-slate-100">
        <p className="mb-1 text-[11px] font-semibold text-slate-700">{t("what_this_means")}</p>
        <p className="text-xs leading-relaxed text-slate-600">
          {analytics.completedThisWeek === 0
            ? "No actions completed this week yet. Completing actions updates your readiness score and signals operational momentum to the platform."
            : `You've resolved ${analytics.completedThisWeek} action${analytics.completedThisWeek === 1 ? "" : "s"} this week${completedToday > 0 ? `, including ${completedToday} today` : ""}. Each completed action improves your investor-readiness score and reduces the surface area investors can question in due diligence.`}
        </p>
      </div>

      <AdviceBox
        lines={[
          analytics.completedThisWeek === 0
            ? "Complete at least 1 action today to start building momentum. Even a small win — like uploading a document — improves your readiness score."
            : analytics.completedThisWeek >= 5
            ? `${analytics.completedThisWeek} completions this week is strong. Consistency matters — founders who maintain 3+ completions per week close their rounds 40% faster on average.`
            : `${analytics.completedThisWeek} this week is a solid start. Aim for a daily rate of ${Math.max(1, Math.ceil((analytics.open + analytics.overdue) / 14))} to clear your backlog in 2 weeks.`,
          analytics.open > 0
            ? `You still have ${analytics.open} open action${analytics.open === 1 ? "" : "s"}. Prioritise the critical and high-priority ones — they have the highest impact on your next investor conversation.`
            : "All actions resolved — your queue is clean. This is the ideal time to proactively reach out to investors who have expressed interest.",
          weeklyRate >= 2
            ? `At ${weeklyRate} completions per day, you're on track to resolve your remaining actions within ${Math.ceil((analytics.open + analytics.overdue) / weeklyRate)} days. Maintain this pace.`
            : analytics.completedThisWeek > 0
            ? "Increase your daily completion rate by batching similar actions — all document uploads together, all investor responses together. Batching reduces setup time per action."
            : "Set a target of 1 action per day this week. Small, consistent progress builds the operational credibility that institutional investors look for.",
        ]}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------
export function FounderActionAnalyticsCards({
  analytics,
  actions,
  needsAttention,
}: {
  analytics: ActionCenterAnalytics;
  actions: NextBestAction[];
  needsAttention: NextBestAction[];
}) {
  const t = useTranslations("sharedCmp");
  const [open, setOpen] = useState<DrawerKey | null>(null);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <AnalyticsCard
          label={t("active")}
          value={analytics.open}
          icon={<IconActivity />}
          iconBg="#EEEDFB"
          iconColor="#2E78F5"
          valueFg="#1A6CE4"
          onClick={() => setOpen("active")}
        />
        <AnalyticsCard
          label={t("overdue")}
          value={analytics.overdue}
          icon={<IconAlert />}
          iconBg="#FCEBEB"
          iconColor="#A32D2D"
          valueFg={analytics.overdue > 0 ? "#A32D2D" : "#0c2340"}
          onClick={() => setOpen("overdue")}
        />
        <AnalyticsCard
          label={t("escalated")}
          value={analytics.escalated}
          icon={<IconArrow />}
          iconBg="#FEF3CD"
          iconColor="#854F0B"
          valueFg={analytics.escalated > 0 ? "#854F0B" : "#0c2340"}
          onClick={() => setOpen("escalated")}
        />
        <AnalyticsCard
          label={t("completed_this_week")}
          value={analytics.completedThisWeek}
          icon={<IconCheck />}
          iconBg="#E1F5EE"
          iconColor="#3B6D11"
          valueFg="#3B6D11"
          onClick={() => setOpen("completed")}
        />
      </div>

      {/* Slide-up drawer */}
      <div
        className="pointer-events-none fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
        style={{
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 200ms",
        }}
      >
        <div
          className="absolute inset-0"
          style={{ background: "rgba(12, 35, 64, 0.28)" }}
          onClick={() => setOpen(null)}
        />
        <div
          className="relative w-full overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
          style={{
            maxWidth: 448,
            maxHeight: 536,
            transform: open ? "translateY(0)" : "translateY(40px)",
            transition: "transform 280ms cubic-bezier(0.32, 0.72, 0, 1)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {open && (
            <DrawerContent
              drawerKey={open}
              analytics={analytics}
              actions={actions}
              needsAttention={needsAttention}
              onClose={() => setOpen(null)}
            />
          )}
        </div>
      </div>
    </>
  );
}
