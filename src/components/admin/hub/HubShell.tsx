"use client";

// Shared admin hub shell: navy→royal gradient header, hub-internal tabs with live
// count badges, active tab driven by the parent (synced to ?tab=). Standalone —
// Marketing Hub migration onto this shell is a later task.

import type { ReactNode } from "react";

export type HubTab = { key: string; label: string; badge?: { count: number; tone: "red" | "amber" } };

const BADGE_TONE: Record<"red" | "amber", { bg: string; color: string }> = {
  red: { bg: "#FCEBEB", color: "#A32D2D" },
  amber: { bg: "#FAEEDA", color: "#854F0B" },
};

export function HubShell({
  title,
  subtitle,
  tabs,
  activeTab,
  onTabChange,
  children,
  flat = false,
}: {
  title: string;
  subtitle?: string;
  tabs: HubTab[];
  activeTab: string;
  onTabChange: (key: string) => void;
  children: ReactNode;
  /** Flat header (no gradient banner): dark title + underlined tab row. */
  flat?: boolean;
}) {
  const tabRow = (
    <div style={{ display: "flex", gap: 2, marginTop: flat ? 12 : 14, flexWrap: "wrap", borderBottom: flat ? "0.5px solid var(--border)" : undefined }}>
      {tabs.map((tab) => {
        const on = tab.key === activeTab;
        const activeColor = flat ? "#1A6CE4" : "#fff";
        const idleColor = flat ? "var(--muted-foreground)" : "#B7CBEF";
        return (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: on ? 600 : 500,
              color: on ? activeColor : idleColor, background: "transparent", border: "none", cursor: "pointer",
              padding: "9px 14px", borderBottom: on ? `2px solid ${activeColor}` : "2px solid transparent",
            }}
          >
            {tab.label}
            {tab.badge && tab.badge.count > 0 && (
              <span style={{ fontSize: 10.5, fontWeight: 700, borderRadius: 10, padding: "1px 7px", background: BADGE_TONE[tab.badge.tone].bg, color: BADGE_TONE[tab.badge.tone].color }}>
                {tab.badge.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );

  if (flat) {
    return (
      <div>
        <div style={{ padding: "2px 2px 0" }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".14em", color: "var(--muted-foreground)" }}>Admin workspace</div>
          <h1 style={{ fontSize: 22, fontWeight: 600, margin: "3px 0 0", letterSpacing: "-0.01em", color: "var(--foreground)" }}>{title}</h1>
          {subtitle && <div style={{ fontSize: 12.5, color: "var(--muted-foreground)" }}>{subtitle}</div>}
          {tabRow}
        </div>
        <div style={{ marginTop: 16 }}>{children}</div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ background: "linear-gradient(120deg, #0A1A40 0%, #12275C 55%, #1A6CE4 140%)", borderRadius: 14, padding: "18px 22px 0", color: "#fff", boxShadow: "0 1px 3px rgb(12 35 64 / 0.18)" }}>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".16em", color: "#9DBBF0" }}>Admin workspace</div>
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: "4px 0 2px", letterSpacing: "-0.01em" }}>{title}</h1>
        {subtitle && <div style={{ fontSize: 12.5, color: "#C7D7F5" }}>{subtitle}</div>}
        {tabRow}
      </div>
      <div style={{ marginTop: 16 }}>{children}</div>
    </div>
  );
}
