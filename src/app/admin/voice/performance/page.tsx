import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { loadPerformance } from "@/lib/voice/performance";

export const dynamic = "force-dynamic";

export default async function VoicePerformancePage() {
  const profile = await requireRole(["admin", "analyst"]);
  const { summary, variants } = await loadPerformance().catch(() => ({
    summary: { totalCalls: 0, booked: 0, bookedRate: 0, optOuts: 0, optOutRate: 0, transfers: 0, avgDuration: 0 },
    variants: [] as { variantId: string | null; label: string; calls: number; booked: number; bookedRate: number }[],
  }));

  const cards = [
    { label: "Booked-demo rate", value: `${summary.bookedRate}%`, sub: `${summary.booked} of ${summary.totalCalls}` },
    { label: "Opt-out rate", value: `${summary.optOutRate}%`, sub: "compliance canary", danger: summary.optOutRate > 3 },
    { label: "Calls", value: summary.totalCalls.toLocaleString(), sub: "attempts" },
    { label: "Transfers", value: summary.transfers.toLocaleString(), sub: "to human" },
    { label: "Avg duration", value: `${Math.round(summary.avgDuration / 6) / 10}m`, sub: `${summary.avgDuration}s` },
  ];

  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle={profile.role} profileEmail={profile.email ?? undefined}>
      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: "#1A6CE4" }}>Measure · Voice</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-950">Performance</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">Booked-demo rate is the north star; opt-out rate is the compliance canary — watch it, not just conversions.</p>
        </div>

        {summary.totalCalls === 0 && (
          <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">No calls recorded yet. Metrics populate once the pilot runs — dialing is currently dormant.</div>
        )}

        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {cards.map((c) => (
            <div key={c.label} className="rounded-xl bg-slate-50 p-4 text-center">
              <div className={`text-2xl font-semibold ${c.danger ? "text-rose-600" : "text-slate-900"}`}>{c.value}</div>
              <div className="mt-0.5 text-[11px] text-slate-500">{c.label}</div>
              <div className="text-[10px] text-slate-400">{c.sub}</div>
            </div>
          ))}
        </div>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-800">A/B variant significance</div>
          {variants.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-400">No variant data yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2 font-semibold">Variant</th>
                  <th className="px-4 py-2 font-semibold">Calls</th>
                  <th className="px-4 py-2 font-semibold">Booked</th>
                  <th className="px-4 py-2 font-semibold">Booked rate</th>
                </tr>
              </thead>
              <tbody>
                {variants.map((v) => (
                  <tr key={v.variantId ?? "none"} className="border-b border-slate-50 last:border-0">
                    <td className="px-4 py-2 font-medium text-slate-800">{v.label}</td>
                    <td className="px-4 py-2 text-slate-600">{v.calls}</td>
                    <td className="px-4 py-2 text-slate-600">{v.booked}</td>
                    <td className="px-4 py-2 font-semibold text-slate-800">{v.bookedRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </AppShell>
  );
}
