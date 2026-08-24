// Event Email — audience segment resolver (build spec §4/§9). Registrant counts
// are computed server-side against the events registration table; only counts are
// returned to the client (raw lists never leave the server).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { createServiceRoleClient } from "@/lib/supabase/admin";

function raw(supabase: SupabaseClient<Database>): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}
type Row = Record<string, unknown>;

export type RegistrantStatus = "registered" | "attended" | "no_show";
export type RegistrantCounts = { registered: number; attended: number; no_show: number; total: number };

async function countBy(supabase: SupabaseClient<Database>, eventId: string, status?: RegistrantStatus): Promise<number> {
  let q = raw(supabase).from("registrations").select("id", { count: "exact", head: true }).eq("event_id", eventId);
  if (status) q = q.eq("status", status);
  const { count } = await q;
  return count ?? 0;
}

/** Registrant counts for an event, broken down by status. Counts only. */
export async function resolveRegistrantCounts(
  supabase: SupabaseClient<Database>,
  eventId: string,
): Promise<RegistrantCounts> {
  const [registered, attended, no_show, total] = await Promise.all([
    countBy(supabase, eventId, "registered"),
    countBy(supabase, eventId, "attended"),
    countBy(supabase, eventId, "no_show"),
    countBy(supabase, eventId),
  ]);
  return { registered, attended, no_show, total };
}

/**
 * Materialize an event's registrants into a marketing list so the existing send
 * pipeline can target them. Honors the single-source suppression list
 * (marketing_unsubscribes). Idempotent: reuses the per-event list and upserts
 * members. Returns the list id + member count. Server-side only.
 */
export async function materializeRegistrantList(
  eventId: string,
  eventTitle: string,
  statuses: RegistrantStatus[],
): Promise<{ listId: string; count: number }> {
  const admin = createServiceRoleClient() as unknown as SupabaseClient;

  // 1) registrants (email + name), status-filtered. Contact info lives in the
  // answers JSON for guests AND self-registrations; the linked profile (when the
  // registrant has an account) is only a fallback.
  let q = raw(admin as unknown as SupabaseClient<Database>)
    .from("registrations")
    .select("status, answers, profiles:attendee_id(email, full_name)")
    .eq("event_id", eventId);
  if (statuses.length) q = q.in("status", statuses);
  const { data } = await q;

  const people = ((data ?? []) as Row[])
    .map((r) => {
      const p = (Array.isArray(r.profiles) ? r.profiles[0] : r.profiles) as { email?: string | null; full_name?: string | null } | null;
      const ans = (r.answers ?? {}) as { email?: unknown; name?: unknown };
      const email = (typeof ans.email === "string" && ans.email.trim() ? ans.email : p?.email ?? "").trim().toLowerCase();
      const name = (typeof ans.name === "string" && ans.name.trim() ? ans.name : p?.full_name ?? "") as string;
      return { email, name };
    })
    .filter((x) => x.email);

  // dedupe by email
  const byEmail = new Map(people.map((p) => [p.email, p]));
  const emails = [...byEmail.keys()];
  if (emails.length === 0) {
    const listId = await ensureList(admin, eventTitle);
    return { listId, count: 0 };
  }

  // 2) drop suppressed emails (single source of truth)
  const { data: sup } = await admin.from("marketing_unsubscribes").select("email").in("email", emails);
  const suppressed = new Set(((sup ?? []) as Row[]).map((s) => String(s.email).toLowerCase()));
  const clean = [...byEmail.values()].filter((p) => !suppressed.has(p.email));

  // 3) upsert contacts
  const contactRows = clean.map((p) => ({
    email: p.email,
    first_name: p.name ? p.name.split(" ")[0] : null,
    last_name: p.name && p.name.split(" ").length > 1 ? p.name.split(" ").slice(1).join(" ") : null,
    source: "event",
  }));
  const { data: contacts } = await admin.from("marketing_contacts").upsert(contactRows, { onConflict: "email" }).select("id");
  const contactIds = ((contacts ?? []) as Row[]).map((c) => String(c.id));

  // 4) list + membership
  const listId = await ensureList(admin, eventTitle);
  if (contactIds.length) {
    await admin.from("marketing_list_contacts").upsert(
      contactIds.map((contact_id) => ({ list_id: listId, contact_id })),
      { onConflict: "list_id,contact_id" },
    );
  }
  return { listId, count: contactIds.length };
}

async function ensureList(admin: SupabaseClient, eventTitle: string): Promise<string> {
  const name = `Event: ${eventTitle} — registrants`;
  const existing = await admin.from("marketing_lists").select("id").eq("name", name).maybeSingle();
  if (existing.data) return String((existing.data as Row).id);
  const { data } = await admin
    .from("marketing_lists")
    .insert({ name, description: `Auto-generated from registrants of ${eventTitle}.` })
    .select("id")
    .single();
  return String((data as Row).id);
}
