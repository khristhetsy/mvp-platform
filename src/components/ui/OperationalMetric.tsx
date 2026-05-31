import type { ReactNode } from "react";
import type { OperationalStatus } from "@/lib/ui/design-tokens";
import { metricAccentBorder } from "@/lib/ui/design-tokens";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SparklineChart } from "@/components/ui/charts/SparklineChart";

export function OperationalMetric({
  label,
  value,
  detail,
  accent = "slate",
  trend,
  sparklineValues,
  lastUpdated,
  statusLabel,
  status = "neutral",
  urgency,
}: Readonly<{
  label: string;
  value: string;
  detail?: string;
  accent?: keyof typeof metricAccentBorder | string;
  trend?: "up" | "down" | "flat";
  sparklineValues?: number[];
  lastUpdated?: string | null;
  statusLabel?: string;
  status?: OperationalStatus;
  urgency?: boolean;
}>) {
  const border = metricAccentBorder[accent] ?? metricAccentBorder.slate;
  const trendSymbol =
    trend === "up" ? "↑" : trend === "down" ? "↓" : trend === "flat" ? "→" : null;
  const trendColor =
    trend === "up" ? "text-emerald-600" : trend === "down" ? "text-red-600" : "text-slate-500";

  return (
    <div
      className={`rounded-xl border border-slate-200/80 bg-white shadow-[var(--shadow-panel)] transition hover:border-slate-300 ${
        urgency ? "ring-1 ring-amber-200" : ""
      }`}
    >
      <div className={`rounded-xl border-l-[3px] ${border}`}>
        <div className="p-3.5">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</p>
            {statusLabel ? <StatusBadge label={statusLabel} status={status} dot /> : null}
          </div>
          <div className="mt-1 flex items-end justify-between gap-2">
            <div className="flex items-baseline gap-2">
              <p className="font-mono text-xl font-semibold tabular-nums tracking-tight text-slate-950">{value}</p>
              {trendSymbol ? (
                <span className={`text-xs font-medium ${trendColor}`} aria-label={`Trend ${trend}`}>
                  {trendSymbol}
                </span>
              ) : null}
            </div>
            {sparklineValues && sparklineValues.length > 1 ? (
              <SparklineChart values={sparklineValues} width={72} height={28} />
            ) : null}
          </div>
          {detail ? <p className="mt-1 text-xs leading-5 text-slate-600">{detail}</p> : null}
          {lastUpdated ? (
            <p className="mt-1.5 font-mono text-[10px] text-slate-400">Updated {lastUpdated}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function MetricRow({
  title,
  subtitle,
  action,
  children,
}: Readonly<{
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}>) {
  return (
    <section className="space-y-2.5">
      {(title || action) && (
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            {title ? <h3 className="text-sm font-semibold text-slate-900">{title}</h3> : null}
            {subtitle ? <p className="text-xs text-slate-500">{subtitle}</p> : null}
          </div>
          {action}
        </div>
      )}
      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">{children}</div>
    </section>
  );
}
