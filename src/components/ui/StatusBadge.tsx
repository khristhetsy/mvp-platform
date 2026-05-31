import type { OperationalStatus } from "@/lib/ui/design-tokens";
import { statusStyles } from "@/lib/ui/design-tokens";

export function StatusBadge({
  label,
  status = "neutral",
  dot = false,
}: Readonly<{
  label: string;
  status?: OperationalStatus;
  dot?: boolean;
}>) {
  const styles = statusStyles[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${styles.badge}`}
    >
      {dot ? <span className={`h-1.5 w-1.5 rounded-full ${styles.dot}`} aria-hidden /> : null}
      {label}
    </span>
  );
}

export function severityToStatus(severity: string): OperationalStatus {
  switch (severity?.toLowerCase()) {
    case "critical":
      return "danger";
    case "high":
      return "warning";
    case "medium":
      return "pending";
    case "low":
      return "info";
    default:
      return "neutral";
  }
}
