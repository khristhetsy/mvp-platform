import { OperationalMetric } from "@/components/ui/OperationalMetric";

export function MetricCard({
  label,
  value,
  detail,
  accent = "indigo",
  trend,
  sparklineValues,
  lastUpdated,
  statusLabel,
  status,
  urgency,
  href,
}: Readonly<{
  label: string;
  value: string;
  detail: string;
  accent?: "indigo" | "violet" | "blue" | "slate";
  trend?: "up" | "down" | "flat";
  sparklineValues?: number[];
  lastUpdated?: string | null;
  statusLabel?: string;
  status?: "neutral" | "info" | "success" | "warning" | "danger" | "pending";
  urgency?: boolean;
  href?: string;
}>) {
  return (
    <OperationalMetric
      label={label}
      value={value}
      detail={detail}
      accent={accent}
      trend={trend}
      sparklineValues={sparklineValues}
      lastUpdated={lastUpdated}
      statusLabel={statusLabel}
      status={status}
      urgency={urgency}
      href={href}
    />
  );
}
