// Voice Command Center aggregator — one read for the hub landing page. Pulls
// live system status, today's KPIs, the campaign snapshot, the consent funnel,
// and the A/B booked-rate. Reuses the existing performance + ledger libs so
// there's a single source of truth. Read-only; service-role.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { voiceOutboundEnabled } from "@/lib/voice/gate";
import { vapiConfigured } from "@/lib/voice/vapi";
import { loadPerformance, type VariantPerformance } from "@/lib/voice/performance";
import { loadConsentLedger } from "@/lib/voice/ledger";
import { listCampaigns } from "@/lib/voice/campaigns";

function raw(c: SupabaseClient<Database>): SupabaseClient {
  return c as unknown as SupabaseClient;
}

export interface CommandCenterStatus {
  killSwitchOn: boolean;       // dialing enabled?
  vapiConfigured: boolean;
  agentSecretSet: boolean;
  gateActive: boolean;         // pre_dial_gate present (always true — it's a DB RPC)
  euBlocked: boolean;          // EU/FR hard-blocked in v_call_queue
}

export interface CommandCenterKpis {
  callsPlaced: number;
  connectRate: number;   // %
  demosBooked: number;
  optOutRate: number;    // % — compliance canary (all-time, stable)
  costPerCall: number;   // $
}

export interface CampaignSnapshot {
  id: string;
  name: string;
  audience: string;
  status: string;
  variantCount: number;
}

export interface ConsentFunnel {
  totalLeads: number;
  eligibleNow: number;   // dialable
  liveConsent: number;
  reConsentPending: number | null; // null until the re-consent column exists
  dncOptedOut: number;
}

export interface CommandCenterData {
  status: CommandCenterStatus;
  kpis: CommandCenterKpis;
  campaigns: CampaignSnapshot[];
  funnel: ConsentFunnel;
  variants: VariantPerformance[];
}

// Dispositions that mean no live conversation happened.
const NOT_CONNECTED = new Set(["no_answer", "voicemail", "failed", "busy", "no-answer"]);

function todayStartIso(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

/** Optional re-consent count — only if a `reconsent_status` column exists; else null. */
async function reConsentPending(supabase: SupabaseClient): Promise<number | null> {
  const { count, error } = await supabase
    .from("consent_records")
    .select("id", { count: "exact", head: true })
    .eq("reconsent_status", "sent");
  if (error) return null; // column not present yet (migration pending)
  return count ?? 0;
}

export async function loadCommandCenter(): Promise<CommandCenterData> {
  const supabase = raw(createServiceRoleClient());

  const [{ data: today }, perf, ledger, campaigns, reconsent] = await Promise.all([
    supabase.from("call_attempts").select("disposition, booked, cost").gte("created_at", todayStartIso()).limit(5000),
    loadPerformance(),
    loadConsentLedger(),
    listCampaigns().catch(() => []),
    reConsentPending(supabase),
  ]);

  const rows = (today ?? []) as { disposition: string | null; booked: boolean | null; cost: number | null }[];
  const callsPlaced = rows.length;
  const connected = rows.filter((r) => !NOT_CONNECTED.has((r.disposition ?? "").toLowerCase())).length;
  const demosBooked = rows.filter((r) => r.booked).length;
  const costRows = rows.filter((r) => typeof r.cost === "number");
  const costPerCall = costRows.length ? costRows.reduce((s, r) => s + (r.cost ?? 0), 0) / costRows.length : 0;
  const round1 = (n: number) => Math.round(n * 10) / 10;

  return {
    status: {
      killSwitchOn: voiceOutboundEnabled(),
      vapiConfigured: vapiConfigured(),
      agentSecretSet: Boolean(process.env.VOICE_AGENT_SECRET?.trim()),
      gateActive: true,
      euBlocked: true,
    },
    kpis: {
      callsPlaced,
      connectRate: callsPlaced ? round1((connected / callsPlaced) * 100) : 0,
      demosBooked,
      optOutRate: perf.summary.optOutRate,
      costPerCall: Math.round(costPerCall * 100) / 100,
    },
    campaigns: campaigns.map((c) => ({
      id: c.id,
      name: c.name,
      audience: c.audience,
      status: c.status,
      variantCount: c.variants?.length ?? 0,
    })),
    funnel: {
      totalLeads: ledger.summary.consentRecords,
      eligibleNow: ledger.summary.dialableNow,
      liveConsent: ledger.summary.liveConsents,
      reConsentPending: reconsent,
      dncOptedOut: ledger.summary.onDnc,
    },
    variants: perf.variants,
  };
}
