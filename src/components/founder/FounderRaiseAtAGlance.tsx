import Link from "next/link";

/** Compact "raise at a glance" row — consolidates readiness / matched / pledged /
 *  activity into four tiles, each with an optional gate-aware action link. */
export type GlanceTile = {
  label: string;
  value: string;
  valueClass?: string;
  sub?: string;
  href?: string;
};

export function FounderRaiseAtAGlance({ tiles }: { tiles: GlanceTile[] }) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.05em] text-[var(--text-muted)]">Your raise at a glance</p>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {tiles.map((t) => {
          const inner = (
            <>
              <div className="text-[11px] text-[var(--text-secondary)]">{t.label}</div>
              <div className={`text-xl font-semibold ${t.valueClass ?? "text-[var(--text-primary)]"}`}>{t.value}</div>
              {t.sub ? <div className={`text-[10.5px] ${t.href ? "text-[var(--brand-indigo,#2E78F5)]" : "text-[var(--text-muted)]"}`}>{t.sub}</div> : null}
            </>
          );
          return t.href ? (
            <Link key={t.label} href={t.href} className="rounded-xl bg-[var(--surface-1,#f1f5f9)] p-3 transition-colors hover:bg-slate-100">
              {inner}
            </Link>
          ) : (
            <div key={t.label} className="rounded-xl bg-[var(--surface-1,#f1f5f9)] p-3">
              {inner}
            </div>
          );
        })}
      </div>
    </div>
  );
}
