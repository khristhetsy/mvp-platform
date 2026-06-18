"use client";

import { useMemo } from "react";
import type { EnrichedOutreachTarget } from "@/lib/founder-crm/outreach";

type NudgeUrgency = "overdue" | "due";

type Nudge = {
  id: string;
  name: string;
  subtitle: string | null;
  daysSince: number;
  urgency: NudgeUrgency;
  status: string;
};

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
}

const ACTIVE_STATUSES = new Set(["contacted", "responded", "meeting_scheduled", "selected"]);

export function FollowUpNudgesPanel({ targets }: { targets: EnrichedOutreachTarget[] }) {
  const nudges = useMemo<Nudge[]>(() => {
    return targets
      .filter((t) => t.last_contacted_at && ACTIVE_STATUSES.has(t.status))
      .map((t) => ({ t, days: daysSince(t.last_contacted_at!) }))
      .filter(({ days }) => days >= 7)
      .map(({ t, days }) => ({
        id: t.id,
        name: t.displayName,
        subtitle: t.displaySubtitle,
        daysSince: days,
        urgency: days >= 14 ? ("overdue" as const) : ("due" as const),
        status: t.status,
      }))
      .sort((a, b) => b.daysSince - a.daysSince);
  }, [targets]);

  if (nudges.length === 0) return null;

  const overdue = nudges.filter((n) => n.urgency === "overdue");
  const due = nudges.filter((n) => n.urgency === "due");

  return (
    <div style={{
      background: "white",
      border: "0.5px solid #fde68a",
      borderRadius: 14,
      overflow: "hidden",
      marginBottom: 0,
    }}>
      {/* Header */}
      <div style={{
        background: "#fffbeb",
        borderBottom: "0.5px solid #fde68a",
        padding: "12px 16px",
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
            stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#92400e" }}>
          {nudges.length} investor{nudges.length !== 1 ? "s" : ""} need{nudges.length === 1 ? "s" : ""} a follow-up
        </span>
        <span style={{ fontSize: 11, color: "#b45309", marginLeft: "auto" }}>
          Benchmark: reply within 5 business days
        </span>
      </div>

      {/* Nudge rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {[...overdue, ...due].map((nudge, i) => (
          <div
            key={nudge.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "11px 16px",
              borderBottom: i < nudges.length - 1 ? "0.5px solid #fef3c7" : "none",
            }}
          >
            {/* Avatar */}
            <div style={{
              width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
              background: nudge.urgency === "overdue" ? "#fee2e2" : "#fef3c7",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, fontWeight: 700,
              color: nudge.urgency === "overdue" ? "#b91c1c" : "#92400e",
            }}>
              {nudge.name[0]?.toUpperCase() ?? "?"}
            </div>

            {/* Name + subtitle */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#111827", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {nudge.name}
              </p>
              {nudge.subtitle && (
                <p style={{ fontSize: 11, color: "#6b7280", margin: 0 }}>{nudge.subtitle}</p>
              )}
            </div>

            {/* Days badge */}
            <div style={{
              padding: "3px 10px", borderRadius: 20, flexShrink: 0,
              background: nudge.urgency === "overdue" ? "#fee2e2" : "#fef3c7",
              color: nudge.urgency === "overdue" ? "#b91c1c" : "#92400e",
              fontSize: 11, fontWeight: 600,
            }}>
              {nudge.urgency === "overdue" ? "⚠ " : ""}{nudge.daysSince}d ago
            </div>

            {/* Status chip */}
            <div style={{
              padding: "2px 8px", borderRadius: 20, flexShrink: 0,
              background: "#f1f5f9", color: "#475569",
              fontSize: 10, fontWeight: 600, textTransform: "capitalize",
              display: "none",
            }}
              className="hidden md:block"
            >
              {nudge.status.replace(/_/g, " ")}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
