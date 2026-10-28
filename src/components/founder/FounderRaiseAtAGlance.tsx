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
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map((t, i) => {
          const span = tiles.length % 2 === 1 && i === tiles.length - 1 ? "col-span-2 sm:col-span-1" : "";
          const inner = (
            <>
              <div className="text-[11px] text-[var(--text-secondary)]">{t.label}</div>
              <div className={`text-xl font-semibold ${t.valueClass ?? "text-[var(--text-primary)]"}`}>{t.value}</div>
              {t.sub ? <div className={`text-[10.5px] ${t.href ? "text-[var(--brand-indigo,#2E78F5)]" : "text-[var(--text-muted)]"}`}>{t.sub}</div> : null}
            </>
          );
          return t.href ? (
            <Link key={t.label} href={t.href} className={`rounded-xl bg-[var(--surface-1,#f1f5f9)] p-3 transition-colors hover:bg-slate-100 ${span}`}>
              {inner}
            </Link>
          ) : (
            <div key={t.label} className={`rounded-xl bg-[var(--surface-1,#f1f5f9)] p-3 ${span}`}>
              {inner}
            </div>
          );
        })}
      </div>
    </div>
  );
}
