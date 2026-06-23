"use client";

import { useState } from "react";
import type { ActionCenterAnalytics } from "@/lib/actions/types";
import type { NextBestAction } from "@/lib/next-best-actions/types";

const CIRC = 2 * Math.PI * 22;

/* ── Donut card ── */
function DonutCard({
  label,
  value,
  max,
  color,
  trackColor,
  textColor,
  bgColor,
  borderColor,
  onClick,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  trackColor: string;
  textColor: string;
  bgColor?: string;
  borderColor?: string;
  onClick: () => void;
}) {
  const filled = max > 0 ? Math.min(value / max, 1) * CIRC : 0;
  const offset = CIRC - filled;

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: bgColor ?? "#fff",
        border: `0.5px solid ${borderColor ?? "#e2e6ed"}`,
        borderRadius: 14,
        padding: "16px 12px",
        cursor: "pointer",
        textAlign: "center",
        width: "100%",
        transition: "box-shadow .15s",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 16px rgba(12,35,64,.10)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
      }}
    >
      <svg width="56" height="56" viewBox="0 0 56 56" style={{ display: "block", margin: "0 auto 10px" }}>
        <circle cx="28" cy="28" r="22" fill="none" stroke={trackColor} strokeWidth="7" />
        <circle
          cx="28" cy="28" r="22"
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeDasharray={CIRC}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 28 28)"
        />
        <text x="28" y="33" textAnchor="middle" fontSize="13" fontWeight="600" fill={textColor}>
          {value}
        </text>
      </svg>
      <div style={{ fontSize: 11, fontWeight: 600, color: textColor }}>{value}</div>
      <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>{label}</div>
    </button>
  );
}

/* ── Stat box ── */
function StatBox({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{ background: "#f8fafc", border: "0.5px solid #e2e6ed", borderRadius: 10, padding: "10px 14px", flex: 1 }}>
      <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 600, color: color ?? "#0f172a" }}>{value}</div>
    </div>
  );
}

/* ── Priority badge ── */
function PriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    critical: { bg: "#fee2e2", color: "#991b1b" },
    high: { bg: "#fef3c7", color: "#92400e" },
    medium: { bg: "#dbeafe", color: "#1e40af" },
    low: { bg: "#f1f5f9", color: "#475569" },
  };
  const s = map[priority] ?? map.low;
  return (
    <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 20, background: s.bg, color: s.color }}>
      {priority}
    </span>
  );
}

/* ── Bottom drawer ── */
type DrawerKey = "pending" | "overdue" | "completed" | "opportunities";

function Drawer({
  drawerKey,
  analytics,
  actions,
  onClose,
}: {
  drawerKey: DrawerKey;
  analytics: ActionCenterAnalytics;
  actions: NextBestAction[];
  onClose: () => void;
}) {
  const totalOpen = analytics.open;
  const pending = analytics.pendingRequirements ?? 0;
  const overdue = analytics.overdue;
  const completed = analytics.completedThisWeek;
  const opportunities = analytics.activeOpportunities ?? 0;

  const overdueActions = actions.filter(
    // eslint-disable-next-line react-hooks/purity
    (a) => a.status === "overdue" || (a.dueAt && new Date(a.dueAt).getTime() < Date.now()),
  );
  const pendingActions = actions
    .filter((a) => a.status === "open" || a.status === "blocked")
    .slice(0, 4);
  const completedActions = actions.filter((a) => a.status === "completed").slice(0, 4);
  const byCategory = analytics.byCategory ?? {};

  type DrawerConfig = {
    title: string;
    subtitle: string;
    accentColor: string;
    stats: Array<{ label: string; value: string | number; color?: string }>;
    breakdown: React.ReactNode;
    explanation: string;
    advice: { intro: string; items: string[] };
  };

  const configs: Record<DrawerKey, DrawerConfig> = {
    pending: {
      title: "Pending Requirements",
      subtitle: "Actions requiring your input",
      accentColor: "#6366f1",
      stats: [
        { label: "Pending", value: pending, color: "#6366f1" },
        { label: "Total open", value: totalOpen },
        { label: "% of open", value: totalOpen > 0 ? `${Math.round((pending / totalOpen) * 100)}%` : "—" },
      ],
      breakdown: (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {pendingActions.length === 0 ? (
            <p style={{ fontSize: 12, color: "#94a3b8" }}>No pending actions right now.</p>
          ) : (
            pendingActions.map((a) => (
              <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 8 }}>
                <span style={{ fontSize: 12, color: "#0f172a" }}>{a.title}</span>
                <PriorityBadge priority={a.priority} />
              </div>
            ))
          )}
        </div>
      ),
      explanation: `You have ${pending} pending requirement${pending !== 1 ? "s" : ""} out of ${totalOpen} open actions. These are items blocking deal progress — resolving them unlocks the next steps in your pipeline.`,
      advice: {
        intro: `With ${pending} pending item${pending !== 1 ? "s" : ""}, clearing them this week directly accelerates your active deals.`,
        items: [
          `Tackle the highest-priority pending action first — critical and high items move deals forward faster than resolving multiple low-priority ones.`,
          `Block 30 minutes today to work through your ${pending} pending requirement${pending !== 1 ? "s" : ""} — investors who clear their queue weekly see 2× faster deal closings.`,
          `If any pending item is blocked waiting on a third party, flag it using the action menu so admins can follow up on your behalf.`,
        ],
      },
    },

    overdue: {
      title: "Overdue Actions",
      subtitle: "Actions past their due date",
      accentColor: "#ef4444",
      stats: [
        { label: "Overdue", value: overdue, color: "#ef4444" },
        { label: "Total open", value: totalOpen },
        { label: "% overdue", value: totalOpen > 0 ? `${Math.round((overdue / totalOpen) * 100)}%` : "—" },
      ],
      breakdown: (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {overdueActions.length === 0 ? (
            <p style={{ fontSize: 12, color: "#94a3b8" }}>No overdue actions — great work.</p>
          ) : (
            overdueActions.slice(0, 5).map((a) => {
              const daysOver = a.dueAt
                // eslint-disable-next-line react-hooks/purity
                ? Math.floor((Date.now() - new Date(a.dueAt).getTime()) / 86400000)
                : null;
              return (
                <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", background: "#fff", border: "0.5px solid #fca5a5", borderRadius: 8 }}>
                  <span style={{ fontSize: 12, color: "#0f172a" }}>{a.title}</span>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 20, background: "#fee2e2", color: "#991b1b" }}>
                    {daysOver != null ? `${daysOver}d overdue` : "overdue"}
                  </span>
                </div>
              );
            })
          )}
        </div>
      ),
      explanation: `${overdue} of your ${totalOpen} open actions are past due. Overdue actions slow your deal pipeline — founders and admins may be waiting on your response before moving forward.`,
      advice: {
        intro: `You have ${overdue} overdue action${overdue !== 1 ? "s" : ""}. Resolving them signals responsiveness and keeps your deals active.`,
        items: [
          `Address the most overdue item first — the longer an action sits, the more it signals disengagement to founders waiting on your response.`,
          `If an overdue action is no longer relevant, mark it complete or dismiss it so your queue stays accurate and clean.`,
          `Set a recurring 15-minute slot each morning to clear actions before they go overdue — investors with 0 overdue items close deals 2× faster on the platform.`,
        ],
      },
    },

    completed: {
      title: "Completed This Week",
      subtitle: "Actions resolved in the last 7 days",
      accentColor: "#22c55e",
      stats: [
        { label: "Completed", value: completed, color: "#16a34a" },
        { label: "Today", value: analytics.completedToday },
        { label: "Completion rate", value: totalOpen + completed > 0 ? `${Math.round((completed / (totalOpen + completed)) * 100)}%` : "—" },
      ],
      breakdown: (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {completedActions.length === 0 ? (
            <p style={{ fontSize: 12, color: "#94a3b8" }}>No completed actions fetched yet — check back after resolving items.</p>
          ) : (
            completedActions.map((a) => (
              <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", background: "#fff", border: "0.5px solid #86efac", borderRadius: 8 }}>
                <span style={{ fontSize: 12, color: "#0f172a" }}>{a.title}</span>
                <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 20, background: "#dcfce7", color: "#14532d" }}>done</span>
              </div>
            ))
          )}
          {Object.keys(byCategory).length > 0 && (
            <div style={{ marginTop: 4 }}>
              {Object.entries(byCategory).slice(0, 4).map(([cat, count]) => (
                <div key={cat} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "0.5px solid #f1f5f9", fontSize: 12, color: "#475569" }}>
                  <span>{cat.replaceAll("_", " ")}</span>
                  <span style={{ fontWeight: 600, color: "#0f172a" }}>{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ),
      explanation: `You've completed ${completed} action${completed !== 1 ? "s" : ""} this week${analytics.completedToday > 0 ? `, including ${analytics.completedToday} today` : ""}. Consistent action completion keeps your investor profile active and deal pipeline moving.`,
      advice: {
        intro: `${completed} completed actions this week is a ${completed >= 5 ? "strong" : completed >= 2 ? "solid" : "starting"} pace. Here's how to keep the momentum.`,
        items: [
          `Aim for at least 5 completed actions per week — this places you in the top 25% of active investors on the platform.`,
          `Follow up on completed intro requests within 48 hours — the window for warm connections is short after an admin facilitates the intro.`,
          `Review your ${totalOpen} remaining open actions and prioritize any tied to active deal rooms where founders may be waiting.`,
        ],
      },
    },

    opportunities: {
      title: "Active Opportunities",
      subtitle: "Live deals matching your investment thesis",
      accentColor: "#8b5cf6",
      stats: [
        { label: "Opportunities", value: opportunities, color: "#7c3aed" },
        { label: "Open actions", value: totalOpen },
        { label: "Pending reqs", value: pending },
      ],
      breakdown: (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {Object.keys(byCategory).length === 0 ? (
            <p style={{ fontSize: 12, color: "#94a3b8" }}>No category breakdown available yet.</p>
          ) : (
            Object.entries(byCategory).slice(0, 6).map(([cat, count]) => (
              <div key={cat} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 8 }}>
                <span style={{ fontSize: 12, color: "#0f172a" }}>{cat.replaceAll("_", " ")}</span>
                <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 20, background: "#ede9fe", color: "#5b21b6" }}>{count}</span>
              </div>
            ))
          )}
        </div>
      ),
      explanation: `You have ${opportunities} active opportunit${opportunities !== 1 ? "ies" : "y"} in your pipeline. These are live deals on the platform that match your investment thesis and are awaiting your engagement.`,
      advice: {
        intro: `With ${opportunities} active opportunit${opportunities !== 1 ? "ies" : "y"}, staying engaged this week keeps you competitive against other investors reviewing the same deals.`,
        items: [
          `Express interest on your top-matched opportunities within 72 hours — early interest signals to founders and admins that you're an active investor.`,
          `Request intros on deals where you've saved or expressed interest — investors who take this step are 3× more likely to receive founder meeting invitations.`,
          `Review the deal room documents for any opportunity where you've already expressed interest — deep diligence conversations lead to better terms and faster closes.`,
        ],
      },
    },
  };

  const cfg = configs[drawerKey];

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", zIndex: 50, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
      onClick={onClose}
    >
      <div
        style={{ background: "#fff", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 680, maxHeight: "82vh", overflowY: "auto", padding: 24 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#0f172a" }}>{cfg.title}</div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>{cfg.subtitle}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ width: 28, height: 28, borderRadius: "50%", border: "0.5px solid #e2e6ed", background: "#f8fafc", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#475569" }}
          >
            ✕
          </button>
        </div>

        {/* Stats row */}
        <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
          {cfg.stats.map((s) => (
            <StatBox key={s.label} label={s.label} value={s.value} color={s.color} />
          ))}
        </div>

        {/* Breakdown */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Breakdown</div>
          {cfg.breakdown}
        </div>

        {/* What this means */}
        <div style={{ background: "#f8fafc", borderLeft: `3px solid ${cfg.accentColor}`, borderRadius: "0 8px 8px 0", padding: "10px 12px", marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: cfg.accentColor, marginBottom: 4 }}>What this means</div>
          <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.6 }}>{cfg.explanation}</div>
        </div>

        {/* AI advice */}
        <div style={{ background: "linear-gradient(135deg,#0c2340 0%,#1a3a60 100%)", borderRadius: 12, padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <div style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(255,255,255,.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
              AI
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>Investor Intelligence</div>
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,.75)", lineHeight: 1.6, marginBottom: 12 }}
            dangerouslySetInnerHTML={{ __html: cfg.advice.intro }}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {cfg.advice.items.map((item, i) => (
              <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{ width: 20, height: 20, borderRadius: "50%", background: "rgba(255,255,255,.15)", fontSize: 11, fontWeight: 700, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {i + 1}
                </span>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,.85)", lineHeight: 1.5 }}>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Main export ── */
export function InvestorActionAnalyticsCards({
  analytics,
  actions,
}: {
  analytics: ActionCenterAnalytics;
  actions: NextBestAction[];
}) {
  const [open, setOpen] = useState<DrawerKey | null>(null);

  const totalOpen = analytics.open || 1; // avoid div/0
  const pending = analytics.pendingRequirements ?? 0;
  const overdue = analytics.overdue;
  const completed = analytics.completedThisWeek;
  const opportunities = analytics.activeOpportunities ?? 0;

  const maxVal = Math.max(pending, overdue, completed, opportunities, 1);

  const cards: Array<{
    key: DrawerKey;
    label: string;
    value: number;
    max: number;
    color: string;
    trackColor: string;
    textColor: string;
    bgColor?: string;
    borderColor?: string;
  }> = [
    {
      key: "pending",
      label: "Pending",
      value: pending,
      max: Math.max(totalOpen, 1),
      color: "#6366f1",
      trackColor: "#f1f5f9",
      textColor: "#0f172a",
    },
    {
      key: "overdue",
      label: "Overdue",
      value: overdue,
      max: Math.max(totalOpen, 1),
      color: "#ef4444",
      trackColor: "#fee2e2",
      textColor: "#991b1b",
      bgColor: "#fff8f8",
      borderColor: "#fca5a5",
    },
    {
      key: "completed",
      label: "Completed",
      value: completed,
      max: Math.max(completed + totalOpen, 1),
      color: "#22c55e",
      trackColor: "#dcfce7",
      textColor: "#14532d",
      bgColor: "#f0fdf4",
      borderColor: "#86efac",
    },
    {
      key: "opportunities",
      label: "Opportunities",
      value: opportunities,
      max: Math.max(maxVal, 1),
      color: "#8b5cf6",
      trackColor: "#f1f5f9",
      textColor: "#0f172a",
    },
  ];

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
        {cards.map((c) => (
          <DonutCard
            key={c.key}
            label={c.label}
            value={c.value}
            max={c.max}
            color={c.color}
            trackColor={c.trackColor}
            textColor={c.textColor}
            bgColor={c.bgColor}
            borderColor={c.borderColor}
            onClick={() => setOpen(c.key)}
          />
        ))}
      </div>

      {open !== null && (
        <Drawer
          drawerKey={open}
          analytics={analytics}
          actions={actions}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
}
