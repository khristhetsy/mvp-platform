"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { InvestorActivityRow } from "@/lib/data/investor-crm";

/* ── Config per activity type ── */
type ActivityConfig = {
  label: string;
  emoji: string;
  bg: string;
  color: string;
  badgeBg: string;
  badgeColor: string;
  note: string;
  filterKey: "interest" | "intros" | "messages" | "other";
};

const ACTIVITY_CONFIG: Record<string, ActivityConfig> = {
  saved_deal: {
    label: "Deal Saved",
    emoji: "🔖",
    bg: "#fef9c3", color: "#854d0e",
    badgeBg: "#fef9c3", badgeColor: "#854d0e",
    note: "Added to your watchlist for further review.",
    filterKey: "other",
  },
  expressed_interest: {
    label: "Expressed Interest",
    emoji: "⭐",
    bg: "#dbeafe", color: "#1e40af",
    badgeBg: "#dbeafe", badgeColor: "#1e40af",
    note: "Non-binding indication of interest submitted. Deal room access unlocked.",
    filterKey: "interest",
  },
  requested_intro: {
    label: "Intro Requested",
    emoji: "🤝",
    bg: "#ecfdf5", color: "#065f46",
    badgeBg: "#ecfdf5", badgeColor: "#065f46",
    note: "Intro request sent to admin for founder connection.",
    filterKey: "intros",
  },
  follow_up_requested: {
    label: "Follow-up",
    emoji: "🔁",
    bg: "#fef3c7", color: "#92400e",
    badgeBg: "#fef3c7", badgeColor: "#92400e",
    note: "Follow-up flagged for this opportunity.",
    filterKey: "other",
  },
  pledge_amount_submitted: {
    label: "Pledge Submitted",
    emoji: "💰",
    bg: "#dcfce7", color: "#14532d",
    badgeBg: "#dcfce7", badgeColor: "#14532d",
    note: "Indicative pledge amount submitted for this round.",
    filterKey: "interest",
  },
  message_thread_created: {
    label: "Thread Started",
    emoji: "💬",
    bg: "#ede9fe", color: "#5b21b6",
    badgeBg: "#ede9fe", badgeColor: "#5b21b6",
    note: "New message thread opened with the founder.",
    filterKey: "messages",
  },
  message_sent: {
    label: "Message Sent",
    emoji: "💬",
    bg: "#ede9fe", color: "#5b21b6",
    badgeBg: "#ede9fe", badgeColor: "#5b21b6",
    note: "Message sent via deal room thread.",
    filterKey: "messages",
  },
  meeting_requested: {
    label: "Meeting Requested",
    emoji: "📅",
    bg: "#e0e7ff", color: "#3730a3",
    badgeBg: "#e0e7ff", badgeColor: "#3730a3",
    note: "Meeting request submitted to the founder.",
    filterKey: "intros",
  },
  meeting_accepted: {
    label: "Meeting Accepted",
    emoji: "✅",
    bg: "#ecfdf5", color: "#065f46",
    badgeBg: "#ecfdf5", badgeColor: "#065f46",
    note: "Founder accepted your meeting request.",
    filterKey: "intros",
  },
  meeting_declined: {
    label: "Meeting Declined",
    emoji: "❌",
    bg: "#fee2e2", color: "#991b1b",
    badgeBg: "#fee2e2", badgeColor: "#991b1b",
    note: "Founder declined this meeting request.",
    filterKey: "intros",
  },
  report_viewed: {
    label: "Report Viewed",
    emoji: "📄",
    bg: "#f1f5f9", color: "#475569",
    badgeBg: "#f1f5f9", badgeColor: "#475569",
    note: "Full investor diligence report accessed.",
    filterKey: "other",
  },
  spv_interest_expressed: {
    label: "SPV Interest",
    emoji: "🏦",
    bg: "#f0fdf4", color: "#166534",
    badgeBg: "#f0fdf4", badgeColor: "#166534",
    note: "Expressed interest in SPV participation for this company.",
    filterKey: "interest",
  },
};

const FALLBACK_CONFIG: ActivityConfig = {
  label: "Activity",
  emoji: "📌",
  bg: "#f1f5f9", color: "#475569",
  badgeBg: "#f1f5f9", badgeColor: "#475569",
  note: "",
  filterKey: "other",
};

type FilterKey = "all" | "interest" | "intros" | "messages";

const FILTER_TABS: Array<{ key: FilterKey; label: string }> = [
  { key: "all", label: "All" },
  { key: "interest", label: "Interest" },
  { key: "intros", label: "Intros" },
  { key: "messages", label: "Messages" },
];

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fullTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

export function InvestorActivityTimelineClient({
  activities,
  error,
}: {
  activities: InvestorActivityRow[];
  error?: string | null;
}) {
  const t = useTranslations("sharedCmp");
  const [filter, setFilter] = useState<FilterKey>("all");

  const filtered = filter === "all"
    ? activities
    : activities.filter((a) => (ACTIVITY_CONFIG[a.activity_type] ?? FALLBACK_CONFIG).filterKey === filter);

  /* summary counts */
  const counts = {
    interest: activities.filter((a) => (ACTIVITY_CONFIG[a.activity_type] ?? FALLBACK_CONFIG).filterKey === "interest").length,
    intros:   activities.filter((a) => (ACTIVITY_CONFIG[a.activity_type] ?? FALLBACK_CONFIG).filterKey === "intros").length,
    messages: activities.filter((a) => (ACTIVITY_CONFIG[a.activity_type] ?? FALLBACK_CONFIG).filterKey === "messages").length,
  };

  /* group by day */
  const groups: Array<{ day: string; items: InvestorActivityRow[] }> = [];
  for (const row of filtered) {
    const day = dayLabel(row.created_at);
    const last = groups[groups.length - 1];
    if (last && last.day === day) {
      last.items.push(row);
    } else {
      groups.push({ day, items: [row] });
    }
  }

  const card: React.CSSProperties = {
    background: "#fff",
    border: "0.5px solid #e2e6ed",
    borderRadius: 16,
    overflow: "hidden",
    boxShadow: "0 1px 3px rgba(12,35,64,.06)",
  };

  return (
    <div style={card}>
      {/* Header */}
      <div style={{ padding: "16px 18px 14px", borderBottom: "0.5px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap" as const, gap: 8 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>{t("recent_activity")}</div>
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 3 }}>{t("your_marketplace_actions_last_30_days")}</div>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {FILTER_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              style={{
                fontSize: 11,
                padding: "4px 10px",
                borderRadius: 20,
                border: "none",
                background: filter === t.key ? "#f1f5f9" : "none",
                color: filter === t.key ? "#0f172a" : "#94a3b8",
                fontWeight: filter === t.key ? 500 : 400,
                cursor: "pointer",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", borderBottom: "0.5px solid #f1f5f9" }}>
        {[
          { val: activities.length, lbl: "Actions",  color: "#6366f1" },
          { val: counts.interest,   lbl: "Interest", color: "#2563eb" },
          { val: counts.intros,     lbl: "Intros",   color: "#7c3aed" },
          { val: counts.messages,   lbl: "Messages", color: "#1D9E75" },
        ].map((s) => (
          <div key={s.lbl} style={{ padding: "10px 14px", textAlign: "center", borderRight: "0.5px solid #f1f5f9" }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: s.color }}>{s.val}</div>
            <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 1 }}>{s.lbl}</div>
          </div>
        ))}
      </div>

      {/* Timeline */}
      {error ? (
        <p style={{ padding: "16px 18px", fontSize: 13, color: "#b91c1c" }}>Unable to load activity: {error}</p>
      ) : filtered.length === 0 ? (
        <p style={{ padding: "24px 18px", fontSize: 13, color: "#94a3b8", textAlign: "center" }}>
          {activities.length === 0
            ? "No activity yet. Save a deal or express interest to see your timeline here."
            : "No activity matching this filter."}
        </p>
      ) : (
        <div style={{ padding: "4px 0" }}>
          {groups.map((group) => (
            <div key={group.day}>
              {/* Day label */}
              <div style={{ fontSize: 10, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" as const, letterSpacing: "0.08em", padding: "12px 18px 6px" }}>
                {group.day}
              </div>

              {group.items.map((row, idx) => {
                const cfg = ACTIVITY_CONFIG[row.activity_type] ?? FALLBACK_CONFIG;
                const isLast = idx === group.items.length - 1;

                return (
                  <div key={row.id} style={{ display: "flex", gap: 0, padding: "0 18px" }}>
                    {/* Left col: dot + line */}
                    <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "center", width: 36, flexShrink: 0, paddingTop: 2 }}>
                      <div style={{ width: 28, height: 28, borderRadius: "50%", background: cfg.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0, zIndex: 1 }}>
                        {cfg.emoji}
                      </div>
                      {!isLast && (
                        <div style={{ width: 2, flex: 1, minHeight: 16, margin: "2px 0", background: "#f1f5f9", borderRadius: 1 }} />
                      )}
                    </div>

                    {/* Right content */}
                    <div style={{ flex: 1, padding: "2px 0 16px 12px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: cfg.badgeBg, color: cfg.badgeColor }}>
                          {cfg.label}
                        </span>
                        <span style={{ fontSize: 10, color: "#94a3b8", whiteSpace: "nowrap" as const, marginTop: 2 }}>
                          {relativeTime(row.created_at)}
                        </span>
                      </div>
                      {row.company_id ? (
                        <Link
                          href={`/investor/opportunities/${row.company_id}/report`}
                          style={{ fontSize: 13, fontWeight: 500, color: "#4f46e5", marginTop: 4, display: "block", textDecoration: "none" }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.textDecoration = "underline"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.textDecoration = "none"; }}
                        >
                          {row.company_name ?? "Unknown company"} →
                        </Link>
                      ) : (
                        <div style={{ fontSize: 13, fontWeight: 500, color: "#0f172a", marginTop: 4 }}>
                          {row.company_name ?? "Unknown company"}
                        </div>
                      )}
                      <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 1 }}>
                        {fullTime(row.created_at)}
                      </div>
                      {cfg.note && (
                        <div style={{ fontSize: 11, color: "#64748b", marginTop: 5, background: "#f8fafc", borderRadius: 8, padding: "6px 10px", borderLeft: "2px solid #e2e6ed", lineHeight: 1.5 }}>
                          {cfg.note}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      {filtered.length > 0 && (
        <div style={{ padding: "12px 18px", borderTop: "0.5px solid #f1f5f9", textAlign: "center" }}>
          <span style={{ fontSize: 12, color: "#6366f1", fontWeight: 500 }}>
            Showing {filtered.length} of {activities.length} actions
          </span>
        </div>
      )}
    </div>
  );
}
