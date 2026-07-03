import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { loadConsentLedger } from "@/lib/voice/ledger";
import { voiceOutboundEnabled } from "@/lib/voice/gate";
import { vapiConfigured } from "@/lib/voice/vapi";
import { TestCallButton } from "@/components/voice/TestCallButton";
import type { ConsentRecord } from "@/lib/voice/types";

export const dynamic = "force-dynamic";

function consentStatus(c: ConsentRecord): { label: string; tone: string } {
  if (c.revokedAt) return { label: "Revoked", tone: "bg-rose-50 text-rose-700" };
  if (c.expiresAt && new Date(c.expiresAt) <= new Date()) return { label: "Expired", tone: "bg-amber-50 text-amber-700" };
  return { label: "Live", tone: "bg-emerald-50 text-emerald-700" };
}

function fmt(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default async function VoiceConsentLedgerPage() {
  const profile = await requireRole(["admin", "analyst"]);
  const { summary, consents, dnc } = await loadConsentLedger().catch(() => ({
    summary: { consentRecords: 0, liveConsents: 0, revoked: 0, onDnc: 0, dialableNow: 0 },
    consents: [] as ConsentRecord[],
    dnc: [] as { id: string; number: string; scope: string; reason: string | null; addedAt: string }[],
  }));
  const enabled = voiceOutboundEnabled();
  const canTestCall = profile.role === "admin" && enabled && vapiConfigured();

  const cards = [
    { label: "Consent records", value: summary.consentRecords },
    { label: "Live consent", value: summary.liveConsents },
    { label: "Revoked", value: summary.revoked },
    { label: "On do-not-call", value: summary.onDnc },
    { label: "Dialable now", value: summary.dialableNow },
  ];

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle={profile.role}
      profileEmail={profile.email ?? undefined}
    >
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: "#1A6CE4" }}>Govern · Voice</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-950">Consent ledger</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            The pre-dial gate rendered as UI. Every dial passes a single eligibility check: live consent, not on do-not-call,
            recipient-local calling hours, jurisdiction allowed, and under the two-call cap. Consent-closed by default — no live
            consent row means blocked.
          </p>
        </div>

        <div className={`mb-5 rounded-xl border px-4 py-3 text-sm ${enabled ? "border-amber-200 bg-amber-50 text-amber-800" : "border-slate-200 bg-slate-50 text-slate-600"}`}>
          {enabled ? (
            <><strong>Outbound is ENABLED.</strong> Dials are gated per contact by pre_dial_gate(). Confirm legal sign-off before any cold lead is dialed.</>
          ) : (
            <><strong>Dormant.</strong> Outbound calling is disabled (VOICE_OUTBOUND_ENABLED off) and no dialing is wired in. This is the compliance foundation only — safe to review before any vendor or legal step.</>
          )}
        </div>

        {canTestCall && <div className="mb-5"><TestCallButton /></div>}

        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {cards.map((c) => (
            <div key={c.label} className="rounded-xl bg-slate-50 p-4 text-center">
              <div className="text-2xl font-semibold text-slate-900">{c.value.toLocaleString()}</div>
              <div className="mt-0.5 text-[11px] text-slate-500">{c.label}</div>
            </div>
          ))}
        </div>

        <section className="mb-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-800">Consent records</div>
          {consents.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-400">No consent captured yet. The dial queue stays empty — nothing is eligible.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2 font-semibold">Contact</th>
                  <th className="px-4 py-2 font-semibold">Channel</th>
                  <th className="px-4 py-2 font-semibold">Type</th>
                  <th className="px-4 py-2 font-semibold">Jurisdiction</th>
                  <th className="px-4 py-2 font-semibold">Captured</th>
                  <th className="px-4 py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {consents.map((c) => {
                  const s = consentStatus(c);
                  return (
                    <tr key={c.id} className="border-b border-slate-50 last:border-0">
                      <td className="px-4 py-2 font-medium text-slate-800">{c.contactId}</td>
                      <td className="px-4 py-2 capitalize text-slate-600">{c.channel}</td>
                      <td className="px-4 py-2 text-slate-600">{c.consentType.replace("_", " ")}</td>
                      <td className="px-4 py-2 text-slate-600">{c.jurisdiction ?? "—"}</td>
                      <td className="px-4 py-2 text-slate-500">{fmt(c.capturedAt)}</td>
                      <td className="px-4 py-2"><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.tone}`}>{s.label}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-800">Do-not-call list</div>
          {dnc.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-400">No opt-outs recorded.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2 font-semibold">Number</th>
                  <th className="px-4 py-2 font-semibold">Scope</th>
                  <th className="px-4 py-2 font-semibold">Reason</th>
                  <th className="px-4 py-2 font-semibold">Added</th>
                </tr>
              </thead>
              <tbody>
                {dnc.map((d) => (
                  <tr key={d.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-4 py-2 font-medium text-slate-800">{d.number}</td>
                    <td className="px-4 py-2 capitalize text-slate-600">{d.scope}</td>
                    <td className="px-4 py-2 text-slate-600">{d.reason ?? "—"}</td>
                    <td className="px-4 py-2 text-slate-500">{fmt(d.addedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <p className="mt-4 text-[11px] leading-relaxed text-slate-400">
          Not legal advice. The consent architecture goes in front of a TCPA-literate attorney before a single cold lead is dialed.
          AI-generated voice is treated as artificial voice under the TCPA; EU/FR contacts are hard-blocked pending a dedicated flow.
        </p>
      </div>
    </AppShell>
  );
}
