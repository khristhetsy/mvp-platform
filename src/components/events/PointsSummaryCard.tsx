import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { CREDITS_ENABLED, getBalance, listCatalog } from "@/lib/icfo-events/credits";

/** Member-facing iCFO Points hero card for the Founder/Investor dashboards.
 *  Self-contained async server component: reads the viewer's balance + catalog,
 *  shows progress to the next reward, and links to the full wallet. Renders
 *  nothing unless the Points program is enabled. Balance is shown in Points only
 *  — never a dollar value. */
export async function PointsSummaryCard({ profileId }: { profileId: string }) {
  if (!CREDITS_ENABLED || !profileId) return null;

  const supabase = await createServerSupabaseClient();
  const [balance, catalog] = await Promise.all([
    getBalance(supabase, profileId).catch(() => 0),
    listCatalog(supabase, true).catch(() => []),
  ]);

  const sorted = [...catalog].sort((a, b) => a.cost - b.cost);
  const next = sorted.find((c) => c.cost > balance) ?? null;
  const gap = next ? next.cost - balance : 0;
  const pct = next ? Math.max(8, Math.min(100, Math.round((balance / next.cost) * 100))) : 100;
  const top = sorted.slice(0, 3);

  return (
    <section
      className="relative mb-6 overflow-hidden rounded-2xl p-5 text-white"
      style={{ background: "linear-gradient(120deg,#0c2340,#1c5fd0)" }}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-white/70">iCFO Points balance</p>
          <p className="mt-0.5 text-4xl font-extrabold">
            {balance.toLocaleString()} <span className="text-base font-bold text-white/85">Points</span>
          </p>
          <p className="mt-1 text-xs text-white/80">No cash value · redeemable for iCFO services</p>
        </div>
        <div className="flex gap-2">
          <Link href="/credits" className="rounded-lg bg-white px-3.5 py-2 text-xs font-bold text-[var(--navy)]">Open wallet</Link>
          <Link href="/legal/credits" className="rounded-lg bg-white/15 px-3.5 py-2 text-xs font-bold text-white">Program terms</Link>
        </div>
      </div>

      {next && (
        <div className="mt-4 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/20">
            <div className="h-full rounded-full bg-white" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-xs text-white/85">
            <b>{gap.toLocaleString()} Points</b> to {next.title}
          </p>
        </div>
      )}

      {top.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {top.map((item) => (
            <Link
              key={item.id}
              href="/credits"
              className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20"
            >
              {item.title} · {item.cost.toLocaleString()} pts
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
