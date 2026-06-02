import type { RiskSeverity } from "@/lib/predictive-intelligence/types";

export function riskSeverityBadgeStatus(severity: RiskSeverity): "neutral" | "info" | "warning" | "danger" {
  if (severity === "critical") return "danger";
  if (severity === "high") return "warning";
  if (severity === "medium") return "info";
  return "neutral";
}

export function formatRiskScore(score: number): string {
  const n = Math.round(score);
  if (!Number.isFinite(n)) return "—";
  return `${n}/100`;
}

function escapeCsv(value: unknown): string {
  const text = value == null ? "" : String(value);
  if (text.includes(",") || text.includes("\"") || text.includes("\n")) {
    return `"${text.replace(/"/g, "\"\"")}"`;
  }
  return text;
}

export function insightsSnapshotToCsv(input: {
  generatedAt: string;
  windowDays: number;
  signals: Array<{ id: string; type: string; severity: string; score: number; confidence: string; title: string; entityType: string; entityId: string | null; href: string }>;
  recommendations: Array<{ id: string; priority: string; title: string; href: string; entityType: string; entityId: string | null; sourceSignalType: string }>;
}): string {
  const lines: string[] = [];
  lines.push("section,key,value");
  lines.push(["meta", "generatedAt", input.generatedAt].map(escapeCsv).join(","));
  lines.push(["meta", "windowDays", input.windowDays].map(escapeCsv).join(","));
  lines.push("signals,id,type,severity,score,confidence,title,entity_type,entity_id,href");
  for (const s of input.signals) {
    lines.push(
      [
        "signal",
        s.id,
        s.type,
        s.severity,
        s.score,
        s.confidence,
        s.title,
        s.entityType,
        s.entityId ?? "",
        s.href,
      ]
        .map(escapeCsv)
        .join(","),
    );
  }
  lines.push("recommendations,id,priority,title,entity_type,entity_id,href,source_signal_type");
  for (const r of input.recommendations) {
    lines.push(
      [
        "recommendation",
        r.id,
        r.priority,
        r.title,
        r.entityType,
        r.entityId ?? "",
        r.href,
        r.sourceSignalType,
      ]
        .map(escapeCsv)
        .join(","),
    );
  }
  return lines.join("\n");
}

