import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { getFunnelStats } from "@/lib/fit/analytics";

export const dynamic = "force-dynamic";
export const metadata = { title: "Fit funnel" };

export default async function AdminFitPage() {
  const profile = await requireRole(["admin", "analyst"]);
  const stats = await getFunnelStats().catch(() => null);

  const top = stats?.reached[0]?.count || 0;
  const pct = (n: number) => (top > 0 ? Math.round((n / top) * 100) : 0);

  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle="Fit funnel">
      <div className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">Fit funnel</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">Where arrivals drop off across the four questions — the funnel&rsquo;s primary diagnostic.</p>

        {!stats || stats.arrivals === 0 ? (
          <div className="mt-6 rounded-xl border border-[var(--border-subtle)] bg-white px-5 py-12 text-center text-sm text-[var(--text-muted)]">
            No sessions yet.
          </div>
        ) : (
          <>
            <div className="mt-5 grid grid-cols-3 gap-3">
              {[["Arrivals", stats.arrivals], ["Emails captured", stats.captured], ["Saw a real match", stats.matched]].map(([label, n]) => (
                <div key={label as string} className="rounded-xl border border-[var(--border-subtle)] bg-white p-4">
                  <p className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">{label}</p>
                  <p className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">{n as number}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-xl border border-[var(--border-subtle)] bg-white p-5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Drop-off</p>
              <div className="mt-3 flex flex-col gap-2.5">
                {stats.reached.map((r) => (
                  <div key={r.step} className="flex items-center gap-3 text-[13px]">
                    <span className="w-28 flex-shrink-0 text-[var(--text-secondary)]">{r.label}</span>
                    <div className="h-5 flex-1 overflow-hidden rounded bg-slate-100">
                      <div className="h-5 rounded bg-indigo-500" style={{ width: `${pct(r.count)}%` }} />
                    </div>
                    <span className="w-20 flex-shrink-0 text-right text-[var(--text-secondary)]">{r.count} · {pct(r.count)}%</span>
                  </div>
                ))}
              </div>
              {stats.zeroMatch > 0 ? (
                <p className="mt-3 text-[12px] text-[var(--text-muted)]">{stats.zeroMatch} of those who reached the match screen saw no match — capture-and-nurture leads.</p>
              ) : null}
            </div>

            <div className="mt-6 rounded-xl border border-[var(--border-subtle)] bg-white p-5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">By source</p>
              <table className="mt-3 w-full text-[13px]">
                <tbody>
                  {stats.bySource.slice(0, 20).map((s) => (
                    <tr key={s.tag} className="border-b border-[var(--border-subtle)] last:border-0">
                      <td className="py-1.5 font-mono text-[12px] text-[var(--text-secondary)]">{s.tag}</td>
                      <td className="py-1.5 text-right text-[var(--text-secondary)]">{s.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
