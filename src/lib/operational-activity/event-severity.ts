import type { OperationalEventSeverity } from "@/lib/operational-activity/types";

export const OPERATIONAL_SEVERITY_ORDER: Record<OperationalEventSeverity, number> = {
  info: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

export function normalizeOperationalSeverity(value: string | null | undefined): OperationalEventSeverity {
  const lower = value?.toLowerCase();
  if (lower === "low" || lower === "medium" || lower === "high" || lower === "critical") {
    return lower;
  }
  return "info";
}

export function complianceSeverityToOperational(severity: string): OperationalEventSeverity {
  return normalizeOperationalSeverity(severity);
}
