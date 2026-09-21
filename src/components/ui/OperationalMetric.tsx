import type { ReactNode } from "react";
import type { OperationalStatus } from "@/lib/ui/design-tokens";
import { metricAccentBorder } from "@/lib/ui/design-tokens";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SparklineChart } from "@/components/ui/charts/SparklineChart";
import { ClickableCard, drilldownHoverClass } from "@/components/ui/drilldown";
import { ScoreRing } from "@/components/ui/ScoreRing";

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
  ring,
  flag,
  unit,
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
  /** Draws a circle graph beside the value. Needs a denominator to be honest:
   *  pass `pending` when the metric has no ceiling and nothing recorded yet. */
  ring?: {
    /** 0–100 fill. */
    percent: number | null;
    /** Text in the middle — usually the raw count, not the percentage. */
    center?: string;
    /** Small caption under it, e.g. "of 42". */
    sublabel?: string;
    color?: string;
    /** Threshold tick, so a score reads as a distance. */
    gate?: number | null;
    pending?: boolean;
    title?: string;
  };
  /** Coloured footer line under the detail — the one fact that changes what you
   *  would do today. Omitted when the underlying number isn't loaded, rather than
   *  filled with something invented. */
  flag?: { text: string; tone?: "good" | "warn" | "bad" } | null;
  /** Small caption beside the value, e.g. "of 42", "gate 65". */
  unit?: string;
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
      <div className="flex flex-1 flex-col p-5">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-slate-500">{label}</p>
            {statusLabel ? <StatusBadge label={statusLabel} status={status} dot /> : null}
          </div>
          <div className="mt-2.5 flex flex-1 flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                {ring ? (
                  <ScoreRing
                    score={ring.percent}
                    size={50}
                    color={ring.color}
                    label={ring.center}
                    sublabel={ring.sublabel}
                    gate={ring.gate}
                    pending={ring.pending}
                    title={ring.title ?? label}
                  />
                ) : null}
                <div className="min-w-0">
                  <p className="truncate font-mono text-xl font-semibold tabular-nums tracking-tight text-slate-950">
                    {value}
                    {trendSymbol ? (
                      <span className={`ml-1.5 text-xs font-medium ${trendColor}`} aria-label={`Trend ${trend}`}>
                        {trendSymbol}
                      </span>
                    ) : null}
                  </p>
                  {unit ? <p className="mt-0.5 truncate text-[11.5px] text-slate-500">{unit}</p> : null}
                </div>
              </div>
              {sparklineValues && sparklineValues.length > 1 ? (
                <SparklineChart values={sparklineValues} width={72} height={28} />
              ) : null}
            </div>
            {/* Footer: the denominator and the fact worth acting on. */}
            <div className="mt-auto pt-1">
              {detail ? <p className="line-clamp-2 text-xs leading-5 text-slate-600">{detail}</p> : null}
              {flag ? (
                <p
                  className={`mt-1 line-clamp-2 text-[11.5px] leading-4 ${
                    flag.tone === "bad" ? "text-red-700" : flag.tone === "good" ? "text-emerald-700" : "text-amber-700"
                  }`}
                >
                  {flag.tone === "good" ? "✓ " : flag.tone ? "⚠ " : ""}
                  {flag.text}
                </p>
              ) : null}
              {lastUpdated ? (
                <p className="mt-1 font-mono text-[10px] text-slate-500">Updated {lastUpdated}</p>
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
            {title ? <h3 className="text-sm font-semibold text-slate-950">{title}</h3> : null}
            {subtitle ? <p className="mt-0.5 text-xs leading-5 text-slate-500">{subtitle}</p> : null}
          </div>
          {action}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 [&>*]:h-full">{children}</div>
    </section>
  );
}
