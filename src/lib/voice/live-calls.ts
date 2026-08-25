// In-progress call state for the Live-now monitor. The runtime posts status
// updates (ringing → talking → transferring); we upsert them here and clear the
// row when the call ends. The monitor polls listLiveCalls(). Service-role only;
// the table degrades gracefully if the migration hasn't been applied yet.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { createServiceRoleClient } from "@/lib/supabase/admin";

function raw(c: SupabaseClient<Database>): SupabaseClient {
  return c as unknown as SupabaseClient;
}

export type LiveStatus = "ringing" | "talking" | "transferring" | "ending";

export interface LiveCall {
  callId: string;
  contactId: string | null;
  campaignId: string | null;
  variantId: string | null;
  contactName: string | null;
  company: string | null;
  variantLabel: string | null;
  status: LiveStatus;
  aiDisclosed: boolean;
  startedAt: string;
}

export interface LiveCallUpsert {
  callId: string;
  status: LiveStatus;
  contactId?: string | null;
  campaignId?: string | null;
  variantId?: string | null;
  contactName?: string | null;
  company?: string | null;
  variantLabel?: string | null;
  aiDisclosed?: boolean;
}

function mapRow(r: Record<string, unknown>): LiveCall {
  return {
    callId: String(r.call_id),
    contactId: (r.contact_id as string) ?? null,
    campaignId: (r.campaign_id as string) ?? null,
    variantId: (r.variant_id as string) ?? null,
    contactName: (r.contact_name as string) ?? null,
    company: (r.company as string) ?? null,
    variantLabel: (r.variant_label as string) ?? null,
    status: (r.status as LiveStatus) ?? "ringing",
    aiDisclosed: Boolean(r.ai_disclosed),
    startedAt: String(r.started_at),
  };
}

/** Upsert a live call's status. Only touches provided fields on update. */
export async function upsertLiveCall(input: LiveCallUpsert): Promise<void> {
  const supabase = raw(createServiceRoleClient());
  const row: Record<string, unknown> = { call_id: input.callId, status: input.status, updated_at: new Date().toISOString() };
  if (input.contactId !== undefined) row.contact_id = input.contactId;
  if (input.campaignId !== undefined) row.campaign_id = input.campaignId;
  if (input.variantId !== undefined) row.variant_id = input.variantId;
  if (input.contactName !== undefined) row.contact_name = input.contactName;
  if (input.company !== undefined) row.company = input.company;
  if (input.variantLabel !== undefined) row.variant_label = input.variantLabel;
  if (input.aiDisclosed !== undefined) row.ai_disclosed = input.aiDisclosed;
  await supabase.from("voice_live_calls").upsert(row, { onConflict: "call_id" });
}

/** Remove a live call when it ends (the durable record is call_attempts). */
export async function finalizeLiveCall(callId: string): Promise<void> {
  if (!callId) return;
  const supabase = raw(createServiceRoleClient());
  await supabase.from("voice_live_calls").delete().eq("call_id", callId).then(() => undefined, () => undefined);
}

/** Active calls for the monitor, newest first. Empty if the table is absent. */
export async function listLiveCalls(): Promise<LiveCall[]> {
  const supabase = raw(createServiceRoleClient());
  const { data, error } = await supabase.from("voice_live_calls").select("*").order("started_at", { ascending: false }).limit(50);
  if (error) return []; // table not migrated yet, or transient — monitor shows empty
  return ((data ?? []) as Record<string, unknown>[]).map(mapRow);
}
