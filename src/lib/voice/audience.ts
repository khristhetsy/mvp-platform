// Resolve a voice campaign's audience config into crm_contacts.external_id[] —
// the dial keys the queue + gate use. Marketing Hub lists and CRM contacts live
// in separate tables joinable only by email, so list resolution happens once at
// SAVE time (snapshot into contactIds) rather than per dial. dialRestriction()
// is the cheap per-dial read.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { segmentContactIds } from "@/lib/voice/segments";
import type { AudienceConfig } from "@/lib/voice/types";

function raw(c: SupabaseClient<Database>): SupabaseClient {
  return c as unknown as SupabaseClient;
}

/** Marketing list members → crm_contacts.external_id[] (matched by email). */
async function listExternalIds(listId: string): Promise<string[]> {
  const supabase = raw(createServiceRoleClient());
  const { data: members } = await supabase
    .from("marketing_list_contacts")
    .select("marketing_contacts(email)")
    .eq("list_id", listId);
  const emails = new Set(
    ((members ?? []) as { marketing_contacts?: { email?: string | null } | null }[])
      .map((m) => m.marketing_contacts?.email?.trim().toLowerCase())
      .filter((e): e is string => Boolean(e)),
  );
  if (emails.size === 0) return [];

  // Page odoo contacts and intersect by lowercased email (column isn't lowercased).
  // De-dupe to ONE dial key per email: a marketing contact can map to several
  // crm_contacts rows sharing an email (duplicates), and dialing each would call
  // the same person more than once. Keep the first external_id seen per email.
  const byEmail = new Map<string, string>();
  const PAGE = 1000;
  for (let from = 0; from < 40000; from += PAGE) {
    const { data, error } = await supabase
      .from("crm_contacts")
      .select("external_id, email")
      .eq("source", "odoo")
      .not("email", "is", null)
      .range(from, from + PAGE - 1);
    if (error || !data || data.length === 0) break;
    for (const r of data as { external_id: string; email: string | null }[]) {
      const key = r.email?.trim().toLowerCase();
      if (key && emails.has(key) && !byEmail.has(key)) byEmail.set(key, r.external_id);
    }
    if (data.length < PAGE) break;
  }
  return [...byEmail.values()];
}

/**
 * Resolve an audience config to a concrete external_id[] snapshot. Used when the
 * campaign audience is saved. Returns null for "all" (no restriction).
 */
export async function resolveAudienceToIds(config: AudienceConfig | null | undefined): Promise<string[] | null> {
  if (!config || config.source === "all") return null;
  if (config.source === "contacts") return [...new Set((config.contactIds ?? []).filter(Boolean))];
  if (config.source === "segment" && config.segmentKind && config.segmentValue) {
    return segmentContactIds(config.segmentKind, config.segmentValue);
  }
  if (config.source === "list" && config.listId) {
    return listExternalIds(config.listId);
  }
  return [];
}

/**
 * Per-dial restriction: the external_ids a campaign is scoped to, or null for the
 * whole eligible pool. Cheap — reads the snapshot stored on the config.
 */
export function dialRestriction(config: AudienceConfig | null | undefined): string[] | null {
  if (!config || config.source === "all") return null;
  return [...new Set((config.contactIds ?? []).filter(Boolean))];
}

/** Normalize + resolve an audience input into the stored config (with a contactIds snapshot). */
export async function buildAudienceConfig(input: AudienceConfig | null | undefined): Promise<AudienceConfig> {
  if (!input || input.source === "all") return { source: "all" };
  const ids = await resolveAudienceToIds(input);
  return {
    source: input.source,
    listId: input.listId ?? null,
    listName: input.listName ?? null,
    segmentKind: input.segmentKind ?? null,
    segmentValue: input.segmentValue ?? null,
    contactIds: ids ?? [],
  };
}
