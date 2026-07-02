"use client";

import type { ReadinessBenchmark } from "@/lib/data/readiness-benchmark";

const ACCENT = "#2E78F5";

function PercentileBar({ percentile }: { percentile: number }) {
  return (
    <div style={{ position: "relative", height: 8, background: "#e0e7ff", borderRadius: 99, overflow: "hidden" }}>
      <div style={{
        position: "absolute", left: 0, top: 0, bottom: 0,
        width: `${percentile}%`,
        background: `linear-gradient(90deg, #818cf8, ${ACCENT})`,
        borderRadius: 99,
        transition: "width 0.6s ease",
      }} />
    </div>
  );
}

function getLabel(percentile: number): { text: string; color: string } {
  if (percentile >= 80) return { text: "Top performer", color: "#065f46" };
  if (percentile >= 60) return { text: "Above average", color: "#1d4ed8" };
  if (percentile >= 40) return { text: "On track", color: ACCENT };
  if (percentile >= 20) return { text: "Room to grow", color: "#92400e" };
  return { text: "Getting started", color: "#6b7280" };
}

export function ReadinessBenchmarkBanner({ benchmark }: { benchmark: ReadinessBenchmark }) {
  const { percentile, totalCompanies, stagePercentile, stageCount, stage } = benchmark;
  const topPct = 100 - percentile;
  const label = getLabel(percentile);
  const stageLabel = stage?.replace(/_/g, " ");

  return (
    <div style={{
      background: "white",
      border: `0.5px solid ${ACCENT}30`,
      borderRadius: 14,
      padding: "16px 20px",
      display: "flex",
      flexDirection: "column",
      gap: 12,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5z"
              stroke={ACCENT} strokeWidth="2" strokeLinejoin="round" fill={ACCENT} />
          </svg>
          <span style={{ fontSize: 11, fontWeight: 700, color: ACCENT, textTransform: "uppercase", letterSpacing: ".07em" }}>
            Platform benchmark
          </span>
        </div>
        <span style={{
          fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
          background: "#EEEDFE", color: label.color,
        }}>
          {label.text}
        </span>
      </div>

      {/* Global percentile */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: 13, color: "#374151" }}>
            You&apos;re in the{" "}
            <strong style={{ color: ACCENT }}>top {topPct}%</strong>
            {" "}of {totalCompanies.toLocaleString()} companies on the platform
          </span>
          <span style={{ fontSize: 12, fontWeight: 700, color: ACCENT }}>{percentile}th percentile</span>
        </div>
        <PercentileBar percentile={percentile} />
      </div>

      {/* Stage-relative percentile */}
      {stagePercentile !== null && stageCount !== null && stageCount > 1 && (
        <div style={{ borderTop: "0.5px solid #e0e7ff", paddingTop: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: "#6b7280" }}>
              Among <strong style={{ color: "#374151" }}>{stageLabel}</strong> companies ({stageCount} total)
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#374151" }}>{stagePercentile}th percentile</span>
          </div>
          <PercentileBar percentile={stagePercentile} />
        </div>
      )}
    </div>
  );
}
