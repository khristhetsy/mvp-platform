import type { ReactNode } from "react";
import type { OperationalStatus } from "@/lib/ui/design-tokens";
import { metricAccentBorder } from "@/lib/ui/design-tokens";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SparklineChart } from "@/components/ui/charts/SparklineChart";
import { ClickableCard, drilldownHoverClass } from "@/components/ui/drilldown";

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
  href,
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
  href?: string;
}>) {
  const border = metricAccentBorder[accent] ?? metricAccentBorder.slate;
  const trendSymbol =
    trend === "up" ? "↑" : trend === "down" ? "↓" : trend === "flat" ? "→" : null;
  const trendColor =
    trend === "up" ? "text-emerald-600" : trend === "down" ? "text-red-600" : "text-slate-500";

  const card = (
    <div
      className={`flex h-full min-h-[8.75rem] flex-col rounded-xl border border-slate-200/80 bg-white shadow-[var(--shadow-card)] ${href ? `cursor-pointer ${drilldownHoverClass}` : "transition hover:border-slate-300 hover:shadow-[var(--shadow-panel)]"} ${
        urgency ? "ring-1 ring-amber-200" : ""
      }`}
    >
      <div className={`flex h-full flex-col rounded-xl border-l-[3px] ${border}`}>
        <div className="flex flex-1 flex-col p-5">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-slate-500">{label}</p>
            {statusLabel ? <StatusBadge label={statusLabel} status={status} dot /> : null}
          </div>
          <div className="mt-1.5 flex flex-1 flex-col justify-between gap-2">
            <div className="flex items-end justify-between gap-2">
              <div className="flex min-w-0 items-baseline gap-2">
                <p className="truncate font-mono text-xl font-semibold tabular-nums tracking-tight text-[var(--navy)]">{value}</p>
                {trendSymbol ? (
                  <span className={`shrink-0 text-xs font-medium ${trendColor}`} aria-label={`Trend ${trend}`}>
                    {trendSymbol}
                  </span>
                ) : null}
              </div>
              {sparklineValues && sparklineValues.length > 1 ? (
                <SparklineChart values={sparklineValues} width={72} height={28} />
              ) : null}
            </div>
            {detail ? <p className="line-clamp-2 text-xs leading-5 text-slate-600">{detail}</p> : null}
            {lastUpdated ? (
              <p className="font-mono text-[10px] text-slate-500">Updated {lastUpdated}</p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );

  if (!href) {
    return card;
  }

  return (
    <ClickableCard href={href} ariaLabel={`View ${label}`}>
      {card}
    </ClickableCard>
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
    <section className="space-y-3">
      {(title || action) && (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            {title ? <h3 className="text-sm font-semibold text-[var(--navy)]">{title}</h3> : null}
            {subtitle ? <p className="mt-0.5 text-xs leading-5 text-slate-500">{subtitle}</p> : null}
          </div>
          {action}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 [&>*]:h-full">{children}</div>
    </section>
  );
}
