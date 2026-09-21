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
  ring,
  flag,
  unit,
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
  ring?: {
    percent: number | null;
    center?: string;
    sublabel?: string;
    color?: string;
    gate?: number | null;
    pending?: boolean;
    title?: string;
  };
  flag?: { text: string; tone?: "good" | "warn" | "bad" } | null;
  unit?: string;
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
      ring={ring}
      flag={flag}
      unit={unit}
    />
  );
}
