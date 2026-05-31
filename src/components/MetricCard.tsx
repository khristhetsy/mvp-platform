import { OperationalMetric } from "@/components/ui/OperationalMetric";

export function MetricCard({
  label,
  value,
  detail,
  accent = "indigo",
  trend,
  lastUpdated,
  statusLabel,
  status,
  urgency,
}: Readonly<{
  label: string;
  value: string;
  detail: string;
  accent?: "indigo" | "violet" | "blue" | "slate";
  trend?: "up" | "down" | "flat";
  lastUpdated?: string | null;
  statusLabel?: string;
  status?: "neutral" | "info" | "success" | "warning" | "danger" | "pending";
  urgency?: boolean;
}>) {
  return (
    <OperationalMetric
      label={label}
      value={value}
      detail={detail}
      accent={accent}
      trend={trend}
      lastUpdated={lastUpdated}
      statusLabel={statusLabel}
      status={status}
      urgency={urgency}
    />
  );
}
