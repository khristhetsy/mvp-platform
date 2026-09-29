"use client";

import type { Meter } from "@/lib/matching/matchable-points";

/**
 * The onboarding meter: points the matching engine can score, out of the
 * points this profile could earn. Counts matchable answers, not screens.
 */
export function MatchablePointsMeter({ meter, className = "" }: Readonly<{ meter: Meter; className?: string }>) {
  const pct = meter.totalPoints > 0 ? Math.round((meter.answeredPoints / meter.totalPoints) * 100) : 0;
  return (
    <aside
      className={`rounded-2xl border border-slate-200 bg-white p-5 ${className}`}
      aria-label="Matchable points"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Matchable points</p>
      <p className="mt-2 flex items-baseline gap-1.5">
        <span className="text-3xl font-bold tracking-tight text-[#0A1A40]">{meter.answeredPoints}</span>
        <span className="text-sm text-slate-500">of {meter.totalPoints} points</span>
      </p>
      <div
        className="mt-3 h-2 rounded-full bg-slate-200"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={meter.totalPoints}
        aria-valuenow={meter.answeredPoints}
      >
        <div className="h-2 rounded-full bg-[#1A6CE4] transition-all" style={{ width: `${pct}%` }} />
      </div>
      <ul className="mt-4 space-y-2">
        {meter.rows.map((row) => (
          <li key={row.label} className={`flex items-center gap-2.5 text-[13px] ${row.answered ? "text-slate-900" : "text-slate-500"}`}>
            {row.answered ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1A6CE4" strokeWidth="2.5" aria-hidden>
                <path d="M5 12l5 5L20 7" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" aria-hidden>
                <circle cx="12" cy="12" r="8" />
              </svg>
            )}
            <span className="flex-1">{row.label}</span>
            <span className="font-semibold">{row.weight}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 border-t border-slate-200 pt-3 text-xs leading-5 text-slate-500">
        Points are the matching engine weights. Fields read by a person are not scored.
      </p>
    </aside>
  );
}

/** Marks a free-text field the matcher does not score. */
export function ReadByPersonBadge() {
  return (
    <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-800">
      Read by a person
    </span>
  );
}

/** A multi-select row of chips. Values are what gets stored. */
export function ChipMultiSelect({
  options,
  selected,
  onChange,
  disabled,
  ariaLabel,
}: Readonly<{
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  ariaLabel: string;
}>) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={ariaLabel}>
      {options.map((o) => {
        const on = selected.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            disabled={disabled}
            aria-pressed={on}
            onClick={() => onChange(on ? selected.filter((v) => v !== o.value) : [...selected, o.value])}
            className={`rounded-full border px-3 py-1.5 text-[13px] transition disabled:opacity-60 ${
              on
                ? "border-[#1A6CE4] bg-[#E6F1FB] font-medium text-[#0C4FB0]"
                : "border-slate-300 bg-white text-slate-700 hover:border-[#1A6CE4]"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
