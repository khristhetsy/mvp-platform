import type { PlatformAnalyticsSnapshot } from "@/lib/analytics/types";

function escapeCsv(value: unknown): string {
  const text = value == null ? "" : String(value);
  if (text.includes(",") || text.includes("\"") || text.includes("\n")) {
    return `"${text.replace(/"/g, "\"\"")}"`;
  }
  return text;
}

export function analyticsSnapshotToCsv(snapshot: PlatformAnalyticsSnapshot): string {
  const lines: string[] = [];

  lines.push("section,key,value");
  for (const [k, v] of Object.entries(snapshot.metrics)) {
    lines.push(["metrics", k, v].map(escapeCsv).join(","));
  }

  for (const [groupKey, seriesList] of Object.entries(snapshot.trends)) {
    for (const series of seriesList) {
      lines.push(["trend_total", `${groupKey}.${series.key}`, series.total].map(escapeCsv).join(","));
    }
  }

  for (const card of snapshot.bottlenecks.cards) {
    lines.push(["bottleneck", card.key, card.count].map(escapeCsv).join(","));
  }

  lines.push("bottleneck_entities,entity_type,entity_id,label,age_days,href,reason");
  for (const row of snapshot.bottlenecks.entities) {
    lines.push(
      [
        "entity",
        row.entityType,
        row.entityId,
        row.label,
        row.ageDays,
        row.href,
        row.reason,
      ]
        .map(escapeCsv)
        .join(","),
    );
  }

  return lines.join("\n");
}

