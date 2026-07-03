import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { getCallAttempt } from "@/lib/voice/performance";

export const dynamic = "force-dynamic";

function fmt(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export default async function VoiceCallDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireRole(["admin", "analyst"]);
  const call = await getCallAttempt(id).catch(() => null);
  if (!call) notFound();

  const facts: [string, string][] = [
    ["Contact", call.contactName ? `${call.contactName} (${call.contactId})` : call.contactId],
    ["Disposition", call.disposition ?? "—"],
    ["Booked", call.booked ? "Yes" : "No"],
    ["Duration", call.duration ? `${call.duration}s` : "—"],
    ["Transferred to", call.transferredTo ?? "—"],
    ["AI disclosed at", fmt(call.aiDisclosedAt)],
    ["Call time", fmt(call.createdAt)],
  ];

  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle={profile.role} profileEmail={profile.email ?? undefined}>
      <div className="mx-auto max-w-3xl px-4 py-6">
        <Link href="/admin/voice/calls" className="mb-4 inline-block text-sm text-slate-500 hover:text-slate-800">← Call review</Link>
        <h1 className="text-2xl font-semibold" style={{ color: "#0A1A40" }}>Call audit</h1>

        <section className="mt-5 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Outcome</h2>
          <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
            {facts.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 border-b border-slate-50 pb-1.5">
                <dt className="text-xs text-slate-400">{k}</dt>
                <dd className="text-right text-xs font-medium text-slate-700">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-3 flex gap-3">
            {call.recordingUrl && <a href={call.recordingUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold" style={{ color: "#2E78F5" }}>Recording ↗</a>}
            {call.transcriptUrl && <a href={call.transcriptUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold" style={{ color: "#2E78F5" }}>Transcript ↗</a>}
          </div>
        </section>

        <section className="mt-4 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Compliance trail</h2>
          {call.consentTrail.length === 0 ? (
            <p className="text-sm text-rose-600">No consent record found for this contact — this call should not have been placed.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="px-2 py-1.5 font-semibold">Channel</th>
                  <th className="px-2 py-1.5 font-semibold">Type</th>
                  <th className="px-2 py-1.5 font-semibold">Jurisdiction</th>
                  <th className="px-2 py-1.5 font-semibold">Captured</th>
                  <th className="px-2 py-1.5 font-semibold">Status</th>
                  <th className="px-2 py-1.5 font-semibold">Evidence</th>
                </tr>
              </thead>
              <tbody>
                {call.consentTrail.map((c, i) => (
                  <tr key={i} className="border-b border-slate-50 last:border-0">
                    <td className="px-2 py-1.5 capitalize text-slate-600">{c.channel}</td>
                    <td className="px-2 py-1.5 text-slate-600">{c.consentType.replace("_", " ")}</td>
                    <td className="px-2 py-1.5 text-slate-600">{c.jurisdiction ?? "—"}</td>
                    <td className="px-2 py-1.5 text-slate-500">{fmt(c.capturedAt)}</td>
                    <td className="px-2 py-1.5">{c.status}</td>
                    <td className="px-2 py-1.5">{c.evidenceUrl ? <a href={c.evidenceUrl} target="_blank" rel="noreferrer" style={{ color: "#2E78F5" }}>View ↗</a> : "—"}</td>
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
