import { loadNetworkStats, type MixRow } from "@/lib/marketing-site/network-stats";

/**
 * Network supply proof (upgrade brief Step 1). Renders verifiable, aggregate
 * network figures from data/network-stats.json ONLY — no hardcoded numbers, no
 * investor names. Sits directly below the hero so the verifiable numbers precede
 * the illustrative matched-investor card. loadNetworkStats() throws on any TKTK,
 * so the build fails loudly rather than shipping placeholders.
 */

function BarGroup({ title, rows }: { title: string; rows: MixRow[] }) {
  const max = Math.max(...rows.map((r) => r.pct), 1);
  return (
    <div>
      <div className="font-site-mono text-[11px] font-semibold uppercase tracking-wider text-site-muted">{title}</div>
      <div className="mt-3 space-y-2.5">
        {rows.map((r) => (
          <div key={r.label}>
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-site-navy">{r.label}</span>
              <span className="font-site-mono text-site-muted">{r.pct}%</span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-site-line">
              <div className="h-full rounded-full bg-site-blue" style={{ width: `${(r.pct / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function NetworkSupply() {
  const s = loadNetworkStats();
  if (!s) return null; // figures still TKTK — omit the section until populated
  return (
    <section className="bg-site-paper px-6 py-16">
      <div className="mx-auto max-w-6xl">
        <p className="font-site-mono text-xs font-semibold uppercase tracking-[0.16em] text-site-blue">The supply side</p>
        <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span className="font-site-display text-5xl font-extrabold tracking-tight text-site-navy">{s.active_mandates.toLocaleString()}</span>
          <span className="text-lg font-medium text-site-muted">active investor mandates in the iCFO network</span>
        </div>

        <div className="mt-10 grid gap-8 md:grid-cols-3">
          <BarGroup title="Stage" rows={s.stage_mix} />
          <BarGroup title="Sector" rows={s.sector_mix} />
          <BarGroup title="Geography" rows={s.geography_mix} />
        </div>

        <div className="mt-8 flex flex-wrap items-baseline gap-x-3 rounded-xl border border-site-line bg-white px-5 py-4">
          <span className="font-site-display text-2xl font-bold text-site-blue">{s.median_monthly_cap.toLocaleString()}</span>
          <span className="text-sm text-site-muted">median monthly acceptance cap per mandate</span>
        </div>

        <p className="mt-6 max-w-3xl font-site-mono text-[11px] leading-5 text-site-muted/80">
          Aggregate figures describe mandates registered in the iCFO network; they are not a guarantee that any given company will be matched.
        </p>
        <p className="mt-2 font-site-mono text-[10px] text-site-muted/60">Last updated {s.last_updated}</p>
      </div>
    </section>
  );
}
