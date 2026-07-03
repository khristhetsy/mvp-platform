import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { listCallAttempts } from "@/lib/voice/performance";

export const dynamic = "force-dynamic";

function fmt(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default async function VoiceCallsPage() {
  const profile = await requireRole(["admin", "analyst"]);
  const calls = await listCallAttempts(100).catch(() => []);

  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle={profile.role} profileEmail={profile.email ?? undefined}>
      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: "#1A6CE4" }}>Measure · Voice</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-950">Call review</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">Every attempt, auditable: disposition, recording, transcript, and the compliance trail tied to consent evidence.</p>
        </div>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          {calls.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-slate-400">No calls recorded yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2 font-semibold">Contact</th>
                  <th className="px-4 py-2 font-semibold">Disposition</th>
                  <th className="px-4 py-2 font-semibold">Booked</th>
                  <th className="px-4 py-2 font-semibold">Duration</th>
                  <th className="px-4 py-2 font-semibold">When</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {calls.map((c) => (
                  <tr key={c.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-2 font-medium text-slate-800">{c.contactId}</td>
                    <td className="px-4 py-2 capitalize text-slate-600">{c.disposition ?? "—"}</td>
                    <td className="px-4 py-2">{c.booked ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Booked</span> : <span className="text-slate-400">—</span>}</td>
                    <td className="px-4 py-2 text-slate-600">{c.duration ? `${c.duration}s` : "—"}</td>
                    <td className="px-4 py-2 text-slate-500">{fmt(c.createdAt)}</td>
                    <td className="px-4 py-2 text-right"><Link href={`/admin/voice/calls/${c.id}`} className="text-xs font-semibold" style={{ color: "#2E78F5" }}>Review →</Link></td>
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
