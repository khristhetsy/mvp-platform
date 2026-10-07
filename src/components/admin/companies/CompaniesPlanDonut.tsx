"use client";

/**
 * Admin, Companies: founder accounts by plan as one circle graph, with MRR in
 * the middle. Each slice is clickable and filters the table to those accounts.
 */
export type PlanSliceKey = "paying" | "free" | "pending" | "other";

export type PlanSlice = { key: PlanSliceKey; label: string; count: number; color: string };

const R = 40;
const C = 2 * Math.PI * R;

export function CompaniesPlanDonut({
  slices,
  mrr,
  active,
  onSelect,
}: {
  slices: PlanSlice[];
  mrr: string;
  active: PlanSliceKey | null;
  onSelect: (key: PlanSliceKey | null) => void;
}) {
  const total = slices.reduce((s, x) => s + x.count, 0);
  const shown = slices.filter((s) => s.count > 0 || s.key !== "other");
  let offset = 0;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-7 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
      <svg width="150" height="150" viewBox="0 0 100 100" role="img" aria-label={`Founder accounts by plan: ${shown.map((s) => `${s.label} ${s.count}`).join(", ")}. MRR ${mrr}.`}>
        <circle cx="50" cy="50" r={R} fill="none" stroke="#E2E8F0" strokeWidth="12" />
        {total > 0 &&
          slices.map((s) => {
            if (s.count === 0) return null;
            const len = (s.count / total) * C;
            const el = (
              <circle
                key={s.key}
                cx="50"
                cy="50"
                r={R}
                fill="none"
                stroke={s.color}
                strokeWidth={active === s.key ? 15 : 12}
                strokeDasharray={`${len} ${C}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 50 50)"
                style={{ cursor: "pointer", opacity: active && active !== s.key ? 0.35 : 1, transition: "opacity 120ms" }}
                onClick={() => onSelect(active === s.key ? null : s.key)}
              >
                <title>{`${s.label}: ${s.count}`}</title>
              </circle>
            );
            offset += len;
            return el;
          })}
        <text x="50" y="49" textAnchor="middle" style={{ fontSize: 14, fontWeight: 600, fill: "#0f172a" }}>{mrr}</text>
        <text x="50" y="61" textAnchor="middle" style={{ fontSize: 7, fill: "#64748b" }}>MRR</text>
      </svg>

      <div className="flex min-w-[220px] flex-col gap-1 text-sm">
        {shown.map((s) => {
          const pct = total ? Math.round((s.count / total) * 100) : 0;
          const on = active === s.key;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => onSelect(on ? null : s.key)}
              aria-pressed={on}
              className={`grid grid-cols-[10px_1fr_auto] items-center gap-x-3 rounded-md px-2 py-1 text-left hover:bg-slate-50 ${on ? "bg-slate-50 font-semibold" : ""}`}
            >
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
              <span className="text-slate-700">{s.label}</span>
              <span className="text-right font-semibold tabular-nums text-slate-900">
                {s.count} <span className="font-normal text-slate-400">{pct}%</span>
              </span>
            </button>
          );
        })}
        <div className="mt-1 grid grid-cols-[10px_1fr_auto] items-center gap-x-3 border-t border-slate-100 px-2 pt-1.5">
          <span />
          <span className="text-slate-500">Founder accounts</span>
          <span className="text-right font-semibold tabular-nums text-slate-900">{total}</span>
        </div>
      </div>

      <p className="ml-auto max-w-[220px] text-xs text-slate-500">
        {active ? (
          <>
            Showing {slices.find((s) => s.key === active)?.label.toLowerCase()} only.{" "}
            <button type="button" onClick={() => onSelect(null)} className="font-medium text-indigo-600 hover:text-indigo-700">Show all</button>
          </>
        ) : (
          "Hover a slice to see its count. Click a slice to filter the table to those companies."
        )}
      </p>
    </div>
  );
}
