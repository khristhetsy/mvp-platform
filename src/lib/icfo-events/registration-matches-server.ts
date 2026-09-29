/**
 * The pool of registrations a newcomer can be matched with.
 */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { isMatchRole, type PoolEntry } from "@/lib/icfo-events/registration-matches";

type Row = { attendee_id: string | null; attendee_type: string | null; answers: Record<string, unknown> | null };

function db(): SupabaseClient {
  return createServiceRoleClient() as unknown as SupabaseClient;
}

/**
 * Founder and investor registrations for one event, minus the viewer.
 *
 * Signed in registrants count only while opted into networking. Guest
 * registrations (no account) count because registering puts everyone in
 * networking. Read with the service role so anonymous visitors can be matched;
 * only role, type and sectors ever leave this module's callers.
 */
export async function loadMatchPool(eventId: string, exclude: { profileId?: string | null; email?: string | null }): Promise<PoolEntry[]> {
  const { data } = await db()
    .from("registrations")
    .select("attendee_id, attendee_type, answers")
    .eq("event_id", eventId)
    .in("attendee_type", ["founder", "investor"])
    .limit(2000);
  const rows = (data ?? []) as Row[];

  const ids = rows.map((r) => r.attendee_id).filter((x): x is string => Boolean(x));
  const optedOut = new Set<string>();
  if (ids.length) {
    const { data: opts } = await db()
      .from("networking_optins")
      .select("profile_id, opted_in")
      .eq("event_id", eventId)
      .in("profile_id", ids);
    for (const o of (opts ?? []) as { profile_id: string; opted_in: boolean }[]) if (!o.opted_in) optedOut.add(o.profile_id);
  }

  const email = exclude.email?.trim().toLowerCase() || null;
  const out: PoolEntry[] = [];
  for (const r of rows) {
    if (!isMatchRole(r.attendee_type)) continue;
    if (r.attendee_id && (r.attendee_id === exclude.profileId || optedOut.has(r.attendee_id))) continue;
    const a = r.answers ?? {};
    if (email && typeof a.email === "string" && a.email.trim().toLowerCase() === email) continue;
    out.push({ role: r.attendee_type, answers: a });
  }
  return out;
}

/**
 * Register someone without an account. One row per email per event: a repeat
 * submission updates the guest row instead of adding another. Never links to an
 * existing account by email, since the email here is not verified.
 */
export async function registerGuest(eventId: string, attendeeType: string, answers: Record<string, unknown>): Promise<{ created: boolean }> {
  const email = String(answers.email ?? "").trim().toLowerCase();
  const { data: existing } = await db()
    .from("registrations")
    .select("id")
    .eq("event_id", eventId)
    .is("attendee_id", null)
    // Exact, case-insensitive: escape the pattern characters ilike would expand.
    .ilike("answers->>email", email.replace(/[\\%_]/g, (c) => `\\${c}`))
    .limit(1)
    .maybeSingle();
  const id = (existing as { id?: string } | null)?.id;
  if (id) {
    const { error } = await db().from("registrations").update({ attendee_type: attendeeType, answers }).eq("id", id);
    if (error) throw new Error(error.message);
    return { created: false };
  }
  const { error } = await db().from("registrations").insert({ event_id: eventId, attendee_id: null, attendee_type: attendeeType, answers });
  if (error) throw new Error(error.message);
  return { created: true };
}
