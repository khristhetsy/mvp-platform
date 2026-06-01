import type { SpvExecutionReadinessSummary } from "@/lib/document-execution/types";

export function formatDocuSignStatusLabel(summary: SpvExecutionReadinessSummary): string {
  if (summary.docusignStatus === "not_connected") {
    return summary.readyForFutureEsign
      ? "Not connected · Ready for future e-sign"
      : "Not connected";
  }
  return "Ready for future e-sign";
}

export function formatExecutionPct(pct: number): string {
  return `${pct}%`;
}
