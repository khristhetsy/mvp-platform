// Unified contact activity — reads the shared outreach_touches log (calls, SMS,
// WhatsApp, email, meetings, manual notes) for the timeline on the record page,
// and appends manual/email entries. Service-role only; admin-gated in the API.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { createServiceRoleClient } from "@/lib/supabase/admin";

function raw(c: SupabaseClient<Database>): SupabaseClient {
  return c as unknown as SupabaseClient;
}

export type ActivityChannel = "voice" | "sms" | "whatsapp" | "email" | "note" | "meeting";
export type ActivityDirection = "outbound" | "inbound";

export interface ActivityEntry {
  id: string;
  channel: ActivityChannel;
  direction: ActivityDirection;
  summary: string | null;
  occurredAt: string;
}

export async function listActivity(externalId: string, limit = 50): Promise<ActivityEntry[]> {
  const supabase = raw(createServiceRoleClient());
  const { data } = await supabase
    .from("outreach_touches")
    .select("id, channel, direction, summary, occurred_at")
    .eq("contact_id", externalId)
    .order("occurred_at", { ascending: false })
    .limit(limit);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    channel: r.channel as ActivityChannel,
    direction: (r.direction as ActivityDirection) ?? "outbound",
    summary: (r.summary as string) ?? null,
    occurredAt: String(r.occurred_at),
  }));
}

export async function logActivity(
  externalId: string,
  input: { channel: ActivityChannel; direction: ActivityDirection; summary: string; loggedBy?: string | null },
): Promise<void> {
  const supabase = raw(createServiceRoleClient());
  const { error } = await supabase.from("outreach_touches").insert({
    contact_id: externalId,
    channel: input.channel,
    direction: input.direction,
    summary: input.summary,
    logged_by: input.loggedBy ?? null,
  });
  if (error) throw new Error(error.message);
}
