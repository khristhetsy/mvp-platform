import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { loadCommandCenter } from "@/lib/voice/command-center";
import { LiveCallsPanel } from "@/components/voice/LiveCallsPanel";
import { MetricCard } from "@/components/MetricCard";

export const dynamic = "force-dynamic";

const money = (n: number) => `$${n.toFixed(2)}`;

export default async function VoiceCommandCenterPage() {
  const profile = await requireRole(["admin", "analyst"]);
  const data = await loadCommandCenter().catch(() => null);

  const s = data?.status;
  const k = data?.kpis;
  const f = data?.funnel;

  const dialingOn = Boolean(s?.killSwitchOn && s?.vapiConfigured && s?.agentSecretSet);

  const strip: { label: string; ok: boolean; note: string }[] = [
    { label: "Pre-dial gate", ok: Boolean(s?.gateActive), note: s?.gateActive ? "active" : "—" },
    { label: "AI disclosure", ok: true, note: "enforced" },
    { label: "EU / GDPR", ok: Boolean(s?.euBlocked), note: "blocked" },
    { label: "Dialing", ok: dialingOn, note: dialingOn ? "live" : "off · kill-switch" },
  ];

  // Shared metric tile: ring for scale, unit for the denominator, flag for the
  // one fact worth acting on. Rates are already 0-100 so the ring is literal;
  // counts have no ceiling, so they get a presence ring instead of a fake arc.
  const calls = k?.callsPlaced ?? 0;
  const connect = k?.connectRate ?? 0;
  const demos = k?.demosBooked ?? 0;
  const optOut = k?.optOutRate ?? 0;

  const tiles = [
    {
      label: "Calls placed",
      value: calls.toLocaleString(),
      detail: "Dialled today",
      accent: "blue" as const,
      ring: { percent: null, center: calls.toLocaleString(), pending: calls === 0, color: calls > 0 ? "#0C60D8" : undefined },
      flag: calls === 0 ? { text: "Nothing dialled today.", tone: "warn" as const } : null,
    },
    {
      label: "Connect rate",
      value: `${connect}%`,
      detail: `of ${calls.toLocaleString()} calls placed`,
      accent: "slate" as const,
      ring: { percent: connect, center: `${connect}%`, pending: calls === 0 },
      flag: calls > 0 && connect < 20 ? { text: "Below the 20% healthy floor.", tone: "warn" as const } : null,
    },
    {
      label: "Demos booked",
      value: demos.toLocaleString(),
      detail: calls > 0 ? `from ${calls.toLocaleString()} calls` : "no calls placed today",
      accent: "violet" as const,
      ring: {
        percent: calls > 0 ? Math.round((demos / calls) * 100) : null,
        center: demos.toLocaleString(),
        pending: demos === 0,
        color: "#059669",
      },
      flag: demos > 0 ? { text: `${Math.round((demos / Math.max(calls, 1)) * 100)}% of calls converted.`, tone: "good" as const } : null,
    },
    {
      label: "Opt-out rate",
      value: `${optOut}%`,
      detail: "Canary metric — watched for compliance",
      accent: "slate" as const,
      ring: { percent: optOut, center: `${optOut}%`, pending: calls === 0, color: optOut > 3 ? "#DC2626" : "#D97706" },
      // 3% is the escalation threshold this canary exists to catch.
      flag: optOut > 3 ? { text: "Above the 3% canary threshold — pause and review.", tone: "bad" as const } : null,
    },
    {
      label: "Cost / call",
      value: money(k?.costPerCall ?? 0),
      detail: calls > 0 ? `across ${calls.toLocaleString()} calls` : "no calls placed today",
      accent: "slate" as const,
      ring: { percent: null, center: money(k?.costPerCall ?? 0), pending: calls === 0 },
      flag: null,
    },
  ];

  const funnelRows = f
    ? [
        { key: "Eligible now", val: f.eligibleNow, color: "#0F6E56" },
        { key: "Live consent", val: f.liveConsent, color: "#1A6CE4" },
        { key: "Re-consent sent", val: f.reConsentPending, color: "#BA7517", pending: f.reConsentPending === null },
        { key: "DNC / opted out", val: f.dncOptedOut, color: "#993C1D" },
      ]
    : [];
  const funnelMax = Math.max(1, ...funnelRows.map((r) => (typeof r.val === "number" ? r.val : 0)));

  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle={profile.role} profileEmail={profile.email ?? undefined}>
      <div className="mx-auto max-w-6xl px-4 py-6">
        {/* header */}
        <div className="overflow-hidden rounded-2xl">
          <div className="flex items-center gap-3 px-5 py-4 text-white" style={{ background: "linear-gradient(112deg,#00183C,#0A1A40 45%,#0C60D8)" }}>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15"><i className="ti ti-phone-outgoing" aria-hidden="true" /></span>
            <div>
              <div className="text-base font-semibold">Voice Hub · Command Center</div>
              <div className="text-[11px] text-white/70">AI outbound calling · consent-gated</div>
            </div>
            <span className={`ml-auto flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${dialingOn ? "border-emerald-300/40 bg-emerald-400/15 text-emerald-100" : "border-amber-300/40 bg-amber-400/15 text-amber-100"}`}>
              <span className={`h-2 w-2 rounded-full ${dialingOn ? "bg-emerald-300" : "bg-amber-300"}`} />
              {dialingOn ? "Dialing live" : "Dialing off"}
            </span>
          </div>
          {/* compliance strip — live state */}
          <div className="flex flex-wrap text-[11.5px] font-medium text-emerald-50" style={{ background: "#06231A" }}>
            {strip.map((seg) => (
              <div key={seg.label} className="flex flex-1 items-center gap-2 border-r border-white/[0.07] px-4 py-2.5 last:border-r-0">
                <span className={seg.ok ? "font-bold text-emerald-300" : "font-bold text-amber-300"}>{seg.ok ? "✓" : "⛔"}</span>
                {seg.label} <b className="font-semibold">{seg.note}</b>
              </div>
            ))}
          </div>
        </div>

        {!dialingOn && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Dialing is dormant by design. It stays off until <code>VOICE_OUTBOUND_ENABLED</code>, Vapi keys, and the agent secret are all set — and per policy, until the consent architecture clears a TCPA attorney.
          </div>
        )}

        {/* KPIs */}
        <p className="mt-6 mb-2 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-slate-400">Today</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5 [&>*]:h-full">
          {tiles.map((t) => (
            <MetricCard
              key={t.label}
              label={t.label}
              value={t.value}
              detail={t.detail}
              accent={t.accent}
              ring={t.ring}
              flag={t.flag}
            />
          ))}
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {/* Campaigns */}
          <section className="rounded-2xl border border-slate-200 p-4">
            <div className="mb-3 flex items-center"><span className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-slate-400">Campaigns</span><Link href="/admin/voice/campaigns" className="ml-auto text-xs font-semibold text-[#0C60D8]">Manage →</Link></div>
            {!data?.campaigns.length ? (
              <p className="py-6 text-center text-sm text-slate-400">No campaigns yet.</p>
            ) : data.campaigns.slice(0, 4).map((c) => (
              <div key={c.id} className="flex items-center gap-3 border-b border-slate-50 py-2.5 last:border-0">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold text-slate-800">{c.name}</div>
                  <div className="text-[11px] text-slate-500">{c.variantCount} variant{c.variantCount === 1 ? "" : "s"}</div>
                </div>
                <span className="rounded px-2 py-0.5 text-[9.5px] font-bold" style={{ background: c.audience === "investor" ? "#F0EBFB" : "#EAF0FB", color: c.audience === "investor" ? "#6C4AD8" : "#0C60D8" }}>{c.audience.toUpperCase()}</span>
                <span className={`rounded px-2 py-0.5 text-[9.5px] font-bold ${c.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{c.status === "active" ? "● LIVE" : c.status.toUpperCase()}</span>
              </div>
            ))}
          </section>

          {/* Live now — real-time monitor (polls in-progress calls) */}
          <LiveCallsPanel canControl={profile.role === "admin"} />

          {/* Consent funnel */}
          <section className="rounded-2xl border border-slate-200 p-4">
            <div className="mb-3 flex items-center"><span className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-slate-400">Consent funnel · {(f?.totalLeads ?? 0).toLocaleString()} leads</span><Link href="/admin/voice/consent-ledger" className="ml-auto text-xs font-semibold text-[#0C60D8]">Ledger →</Link></div>
            {funnelRows.map((r) => (
              <div key={r.key} className="mb-2 flex items-center gap-3">
                <div className="w-28 text-[11.5px] font-semibold text-slate-700">{r.key}</div>
                <div className="h-6 flex-1 overflow-hidden rounded-md bg-slate-50">
                  {typeof r.val === "number" && <div className="h-full rounded-md" style={{ width: `${Math.max(2, (r.val / funnelMax) * 100)}%`, background: r.color }} />}
                </div>
                <div className="w-14 text-right text-[12px] font-bold" style={{ color: r.color }}>{r.pending ? "—" : (r.val as number).toLocaleString()}</div>
              </div>
            ))}
            <div className="mt-3 rounded-lg border border-slate-200 border-l-[3px] border-l-emerald-500 bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-500">
              <b>Only eligible leads reach the dialer.</b> Every attempt clears <code>pre_dial_gate()</code> — consent live, not on DNC, inside calling hours, jurisdiction cleared.{f?.reConsentPending === null && <> <span className="text-amber-700">Re-consent tracking activates once its migration is applied.</span></>}
            </div>
          </section>

          {/* A/B */}
          <section className="rounded-2xl border border-slate-200 p-4">
            <div className="mb-3 flex items-center"><span className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-slate-400">A/B — booked-demo rate</span><Link href="/admin/voice/performance" className="ml-auto text-xs font-semibold text-[#0C60D8]">Performance →</Link></div>
            {!data?.variants.length ? (
              <p className="py-6 text-center text-sm text-slate-400">No variant data yet.</p>
            ) : data.variants.slice(0, 4).map((v) => (
              <div key={v.variantId ?? "none"} className="flex items-center gap-3 py-1.5 text-[12px]">
                <span className="flex-1 truncate font-medium text-slate-700">{v.label}</span>
                <span className="h-1.5 w-20 overflow-hidden rounded bg-slate-100"><span className="block h-full rounded" style={{ width: `${Math.min(100, v.bookedRate)}%`, background: v.isSignificantLeader ? "#12B981" : "#F5A524" }} /></span>
                <span className="w-10 text-right font-bold text-slate-800">{v.bookedRate}%</span>
                {v.isSignificantLeader && <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">{v.confidence}% ✓</span>}
              </div>
            ))}
          </section>
        </div>
      </div>
    </AppShell>
  );
}
