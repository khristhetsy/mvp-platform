// Read-only performance + call-review data. Booked-demo rate is primary;
// opt-out rate is the compliance canary. Everything is zero/empty until real
// calls land (dialing is dormant), which is the honest current state.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { createServiceRoleClient } from "@/lib/supabase/admin";

function raw(c: SupabaseClient<Database>): SupabaseClient {
  return c as unknown as SupabaseClient;
}

export interface PerformanceSummary {
  totalCalls: number;
  booked: number;
  bookedRate: number;   // %
  optOuts: number;
  optOutRate: number;   // % — compliance canary
  transfers: number;
  avgDuration: number;  // seconds
}

export interface VariantPerformance {
  variantId: string | null;
  label: string;
  calls: number;
  booked: number;
  bookedRate: number;
}

export async function loadPerformance(): Promise<{ summary: PerformanceSummary; variants: VariantPerformance[] }> {
  const supabase = raw(createServiceRoleClient());
  const [{ data: attempts }, { data: variantRows }] = await Promise.all([
    supabase.from("call_attempts").select("disposition, booked, duration, transferred_to, variant_id").limit(5000),
    supabase.from("campaign_variants").select("id, label"),
  ]);

  const rows = (attempts ?? []) as { disposition: string | null; booked: boolean | null; duration: number | null; transferred_to: string | null; variant_id: string | null }[];
  const labelById = new Map<string, string>();
  for (const v of (variantRows ?? []) as { id: string; label: string }[]) labelById.set(v.id, v.label);

  const total = rows.length;
  const booked = rows.filter((r) => r.booked).length;
  const optOuts = rows.filter((r) => (r.disposition ?? "").toLowerCase().includes("opt_out")).length;
  const transfers = rows.filter((r) => Boolean(r.transferred_to)).length;
  const durations = rows.map((r) => r.duration ?? 0).filter((d) => d > 0);
  const avgDuration = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
  const pct = (n: number) => (total ? Math.round((n / total) * 1000) / 10 : 0);

  const byVariant = new Map<string, { calls: number; booked: number }>();
  for (const r of rows) {
    const key = r.variant_id ?? "none";
    const agg = byVariant.get(key) ?? { calls: 0, booked: 0 };
    agg.calls += 1;
    if (r.booked) agg.booked += 1;
    byVariant.set(key, agg);
  }
  const variants: VariantPerformance[] = [...byVariant.entries()].map(([key, agg]) => ({
    variantId: key === "none" ? null : key,
    label: key === "none" ? "Unassigned" : (labelById.get(key) ?? key.slice(0, 8)),
    calls: agg.calls,
    booked: agg.booked,
    bookedRate: agg.calls ? Math.round((agg.booked / agg.calls) * 1000) / 10 : 0,
  }));

  return {
    summary: { totalCalls: total, booked, bookedRate: pct(booked), optOuts, optOutRate: pct(optOuts), transfers, avgDuration },
    variants,
  };
}

export interface CallRow {
  id: string;
  contactId: string;
  disposition: string | null;
  booked: boolean;
  duration: number | null;
  transferredTo: string | null;
  transcriptUrl: string | null;
  recordingUrl: string | null;
  aiDisclosedAt: string | null;
  createdAt: string;
}

function mapCall(r: Record<string, unknown>): CallRow {
  return {
    id: String(r.id),
    contactId: String(r.contact_id),
    disposition: (r.disposition as string) ?? null,
    booked: Boolean(r.booked),
    duration: (r.duration as number) ?? null,
    transferredTo: (r.transferred_to as string) ?? null,
    transcriptUrl: (r.transcript_url as string) ?? null,
    recordingUrl: (r.recording_url as string) ?? null,
    aiDisclosedAt: (r.ai_disclosed_at as string) ?? null,
    createdAt: String(r.created_at),
  };
}

export async function listCallAttempts(limit = 100): Promise<CallRow[]> {
  const supabase = raw(createServiceRoleClient());
  const { data } = await supabase.from("call_attempts").select("*").order("created_at", { ascending: false }).limit(limit);
  return ((data ?? []) as Record<string, unknown>[]).map(mapCall);
}

export interface CallDetail extends CallRow {
  contactName: string | null;
  consentTrail: { channel: string; consentType: string; jurisdiction: string | null; capturedAt: string; evidenceUrl: string | null; status: "Live" | "Revoked" | "Expired" }[];
}

export async function getCallAttempt(id: string): Promise<CallDetail | null> {
  const supabase = raw(createServiceRoleClient());
  const { data } = await supabase.from("call_attempts").select("*").eq("id", id).maybeSingle();
  if (!data) return null;
  const call = mapCall(data as Record<string, unknown>);

  const [{ data: contact }, { data: consents }] = await Promise.all([
    supabase.from("crm_contacts").select("name").eq("source", "odoo").eq("external_id", call.contactId).maybeSingle(),
    supabase.from("consent_records").select("channel, consent_type, jurisdiction, captured_at, expires_at, evidence_url, revoked_at").eq("contact_id", call.contactId).order("captured_at", { ascending: false }),
  ]);

  const now = Date.now();
  const consentTrail = ((consents ?? []) as Record<string, unknown>[]).map((c) => {
    const status: "Live" | "Revoked" | "Expired" = c.revoked_at ? "Revoked" : c.expires_at && new Date(c.expires_at as string).getTime() <= now ? "Expired" : "Live";
    return {
      channel: String(c.channel),
      consentType: String(c.consent_type),
      jurisdiction: (c.jurisdiction as string) ?? null,
      capturedAt: String(c.captured_at),
      evidenceUrl: (c.evidence_url as string) ?? null,
      status,
    };
  });

  return { ...call, contactName: (contact as { name: string | null } | null)?.name ?? null, consentTrail };
}
