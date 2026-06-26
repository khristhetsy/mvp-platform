import type { ComponentType } from "react";

export type TickerTone = "teal" | "indigo" | "blue" | "amber";

export type TickerItem = {
  Icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  tone: TickerTone;
  label: string;
  detail?: string;
  when: string;
};

const TONE: Record<TickerTone, string> = {
  teal: "bg-[var(--teal-muted)] text-[var(--teal)]",
  indigo: "bg-[var(--indigo-soft)] text-[var(--indigo)]",
  blue: "bg-[var(--blue-muted)] text-[var(--blue)]",
  amber: "bg-amber-50 text-amber-600",
};

/**
 * Illustrative "live activity" marquee for marketing pages. CSS-only animation
 * (no client JS). Content is a sample product preview, not live platform data.
 */
export function MarketingLiveTicker({
  items,
  label = "Live · Private Market activity",
}: Readonly<{ items: TickerItem[]; label?: string }>) {
  const loop = [...items, ...items];
  return (
    <div className="cap-marquee-host">
      <div className="mb-3 flex items-center justify-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-slate-400">
        <span className="cap-ping inline-block h-1.5 w-1.5 rounded-full bg-[var(--teal)] text-[var(--teal)]" />
        {label}
      </div>
      {/* Static, screen-reader-only list — announces each item once, no motion. */}
      <ul className="sr-only">
        {items.map((it, i) => (
          <li key={`sr-${it.label}-${i}`}>
            {it.label}
            {it.detail ? `, ${it.detail}` : ""} — {it.when}
          </li>
        ))}
      </ul>
      <div
        aria-hidden="true"
        className="relative flex h-[52px] items-center overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[var(--shadow-panel)]"
      >
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-white to-transparent" aria-hidden />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-white to-transparent" aria-hidden />
        <div className="cap-marquee flex w-max items-center whitespace-nowrap pl-6">
          {loop.map((it, i) => {
            const Icon = it.Icon;
            return (
              <span
                key={`${it.label}-${i}`}
                className="flex h-5 items-center gap-2 border-r border-slate-200 px-5 text-[12.5px] text-slate-600"
              >
                <span className={`flex h-[18px] w-[18px] items-center justify-center rounded-md ${TONE[it.tone]}`}>
                  <Icon className="h-3 w-3" strokeWidth={2} />
                </span>
                <span className="font-mono text-[12px] font-semibold text-[var(--navy)]">{it.label}</span>
                {it.detail ? (
                  <span className="font-mono text-[11.5px] text-slate-500">{it.detail}</span>
                ) : null}
                <span className="font-mono text-[10px] text-slate-400">{it.when}</span>
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
