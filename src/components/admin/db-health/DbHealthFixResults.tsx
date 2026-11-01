import { formatWhen } from "@/lib/cron/schedule";
import { buildFixResultsView, formatChange, type FixResultView, type FixResultRow } from "@/lib/db-health/fix-results";

const n = (v: number) => v.toLocaleString("en-US");

function Figure({ label, value, sub, tone }: Readonly<{ label: string; value: string; sub?: string; tone?: "good" | "muted" }>) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className={`text-base font-semibold tabular-nums ${tone === "good" ? "text-emerald-700" : tone === "muted" ? "text-slate-400" : "text-slate-900"}`}>{value}</p>
      {sub ? <p className="text-[11px] text-slate-500">{sub}</p> : null}
    </div>
  );
}

function Row({ r, now, total }: Readonly<{ r: FixResultView; now: number; total?: boolean }>) {
  const measured = r.measured !== null;
  return (
    <div className={`px-4 py-3 ${total ? "bg-slate-50" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900">{r.label}</p>
        {r.step ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">Step {r.step}</span> : null}
      </div>
      <div className="mt-2 grid grid-cols-3 gap-3">
        <Figure label="Before, measured" value={n(r.before)} sub={r.shareOfTotal !== null ? `${r.shareOfTotal}% of all requests` : "a day"} />
        <Figure label="After, projected" value={n(r.projected)} sub={formatChange(r.projectedChange)} tone="good" />
        {measured ? (
          <Figure label="After, measured" value={n(r.measured!)} sub={formatChange(r.measuredChange)} tone="good" />
        ) : (
          <Figure label="After, measured" value="Not measured yet" tone="muted" />
        )}
      </div>
      {measured && r.measuredAt ? <p className="mt-1 text-[11px] text-slate-500">Measured {formatWhen(new Date(r.measuredAt), new Date(now))}. {r.source}.</p> : null}
      {r.note ? <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{r.note}</p> : null}
    </div>
  );
}

/**
 * Requests per day before a database load fix and after it. Numbers and percentages
 * only. The projected column is arithmetic on the stored counts, the measured column
 * is filled once the fix has run for a full day.
 */
export function DbHealthFixResults({ rows, now }: Readonly<{ rows: FixResultRow[]; now: number }>) {
  const view = buildFixResultsView(rows);
  if (!view.total && view.areas.length === 0) {
    return <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">Not recorded yet. Run the Database health fix results SQL in the Supabase SQL editor to turn this on.</p>;
  }
  const fixedAt = rows.map((r) => r.fixed_at).find((v): v is string => !!v);
  return (
    <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
      {view.total ? <Row r={view.total} now={now} total /> : null}
      {view.areas.map((a) => <Row key={a.area} r={a} now={now} />)}
      <p className="bg-slate-50 px-4 py-2 text-[11px] leading-relaxed text-slate-500">
        Requests per day from the Supabase API log, counted over 24 hours.{fixedAt ? ` Fixes went live ${formatWhen(new Date(fixedAt), new Date(now))}.` : ""} Projected is worked out from the change made, not measured. Measured is added a full day after each fix.
      </p>
    </div>
  );
}
