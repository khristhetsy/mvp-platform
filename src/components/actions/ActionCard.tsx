"use client";

import { ActionOrchestrationBadges } from "@/components/actions/ActionOrchestrationBadges";
import { ActionStatusBadge } from "@/components/actions/ActionStatusBadge";
import type { NextBestAction } from "@/lib/next-best-actions/types";

function isDisplayOverdue(action: NextBestAction): boolean {
  if (action.status === "overdue") return true;
  if (!action.dueAt) return false;
  if (!action.status || !["open", "snoozed", "blocked"].includes(action.status)) return false;
  return new Date(action.dueAt).getTime() < Date.now();
}

const PRIORITY_STYLE: Record<string, { borderColor: string; iconColor: string; dotBg: string; ctaBg: string; ctaColor: string }> = {
  critical: { borderColor: "#FCA5A5", iconColor: "#A32D2D", dotBg: "#FEF2F2",  ctaBg: "#FCEBEB", ctaColor: "#A32D2D" },
  high:     { borderColor: "#FCD34D", iconColor: "#854F0B", dotBg: "#FFFBEB",  ctaBg: "#FEF3CD", ctaColor: "#854F0B" },
  medium:   { borderColor: "#A5B4FC", iconColor: "#534AB7", dotBg: "#EEF2FF",  ctaBg: "#EEEDFB", ctaColor: "#534AB7" },
  normal:   { borderColor: "#CBD5E1", iconColor: "#475569", dotBg: "#F8FAFC",  ctaBg: "#F1F5F9", ctaColor: "#475569" },
  low:      { borderColor: "#CBD5E1", iconColor: "#94a3b8", dotBg: "#F8FAFC",  ctaBg: "#F1F5F9", ctaColor: "#94a3b8" },
};

const CTA_LABEL: Record<string, string> = {
  critical: "Resolve",
  high: "Review",
  medium: "Open",
  normal: "Open",
  low: "Open",
};

export function ActionCard({
  action,
  selected,
  onSelect,
  onOpen,
}: Readonly<{
  action: NextBestAction;
  selected: boolean;
  onSelect: (checked: boolean) => void;
  onOpen: () => void;
}>) {
  const overdue = isDisplayOverdue(action);
  const p = action.priority ?? "normal";
  const style = PRIORITY_STYLE[p] ?? PRIORITY_STYLE.normal;
  const ctaLabel = CTA_LABEL[p] ?? "Open";

  return (
    <article
      style={{
        background: "#ffffff",
        border: `0.5px solid ${style.borderColor}`,
        borderLeft: `3px solid ${style.iconColor}`,
        borderRadius: "0 10px 10px 0",
        boxShadow: "0 1px 3px rgb(12 35 64 / 0.06)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
          padding: "12px 14px",
          background: overdue ? (p === "critical" ? "#FEF2F2" : "#FFFBEB") : "#ffffff",
          transition: "background 0.15s",
        }}
      >
        {action.persistedId ? (
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => onSelect(e.target.checked)}
            style={{ marginTop: 3, flexShrink: 0, accentColor: style.iconColor }}
            aria-label={`Select ${action.title}`}
          />
        ) : null}

        <button
          type="button"
          onClick={onOpen}
          aria-label={`Open action: ${action.title}`}
          style={{ minWidth: 0, flex: 1, textAlign: "left", background: "none", border: "none", cursor: "pointer", padding: 0 }}
        >
          {/* Category + badges row */}
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginBottom: 5 }}>
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                padding: "2px 7px",
                borderRadius: 6,
                background: style.dotBg,
                color: style.iconColor,
              }}
            >
              {action.category.replaceAll("_", " ")}
            </span>
            <ActionStatusBadge status={action.status} />
            <ActionOrchestrationBadges action={action} />
          </div>

          {/* Title */}
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#0c2340", lineHeight: 1.4 }}>
            {action.title}
          </p>

          {/* Description */}
          {action.description ? (
            <p style={{ margin: "3px 0 0", fontSize: 12, color: "#475569", lineHeight: 1.5, WebkitLineClamp: 2, display: "-webkit-box", WebkitBoxOrient: "vertical", overflow: "hidden" }}>
              {action.description}
            </p>
          ) : null}

          {/* Reason */}
          {action.reason ? (
            <p style={{ margin: "3px 0 0", fontSize: 11, color: "#94a3b8" }}>
              {action.reason}
            </p>
          ) : null}

          {/* Due date */}
          {action.dueAt ? (
            <p style={{ margin: "4px 0 0", fontSize: 11, fontWeight: overdue ? 600 : 400, color: overdue ? "#A32D2D" : "#94a3b8" }}>
              {overdue ? "⚠ Overdue · " : "Due "}
              {new Date(action.dueAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </p>
          ) : null}
        </button>

        {/* CTA */}
        <button
          type="button"
          onClick={onOpen}
          style={{
            flexShrink: 0,
            fontSize: 11,
            fontWeight: 600,
            padding: "5px 12px",
            borderRadius: 8,
            border: "none",
            cursor: "pointer",
            background: style.ctaBg,
            color: style.ctaColor,
            alignSelf: "flex-start",
            marginTop: 2,
            whiteSpace: "nowrap",
          }}
        >
          {ctaLabel} →
        </button>
      </div>
    </article>
  );
}
