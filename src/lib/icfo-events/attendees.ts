/**
 * Who is attending — names and badges, for the public page and the email.
 *
 * Read with the service role and filtered here rather than opened up through
 * RLS: "everyone if you are registered, opted-in only if you are not" is a
 * rule about the viewer, and a row policy cannot see who is asking on a page
 * rendered on the server.
 *
 * Nobody is listed without the tick. Registrations predating that question
 * have no answer for it, which reads as private — correct, since they were
 * never asked.
 */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { LISTED_PUBLICLY_KEY } from "@/lib/icfo-events/registration-fields";

function raw(): SupabaseClient {
  return createServiceRoleClient() as unknown as SupabaseClient;
}

export type Attendee = { name: string; badge: "Investor" | "Founder" };

export type EventAttendees = {
  investors: Attendee[];
  founders: Attendee[];
  /** Coming, but not named — the count that keeps the list honest. */
  privateInvestors: number;
  privateFounders: number;
  /** Everyone registered, whatever they chose and whatever they registered as. */
  total: number;
};

const EMPTY: EventAttendees = {
  investors: [], founders: [], privateInvestors: 0, privateFounders: 0, total: 0,
};

type Row = Record<string, unknown>;

/** Service providers and sponsors register for other reasons and aren't listed. */
const BADGE: Record<string, Attendee["badge"]> = { investor: "Investor", founder: "Founder" };

function nameOf(r: Row): string | null {
  const answers = (r.answers as Record<string, unknown> | null) ?? {};
  const typed = typeof answers.name === "string" ? answers.name.trim() : "";
  if (typed) return typed;
  const p = r.profiles as { full_name?: string | null } | null | undefined;
  return p?.full_name?.trim() || null;
}

/**
 * The attendee list for one event.
 *
 * `viewerIsRegistered` unlocks the private names: someone already in the room
 * sees who else is, which is the reason they came. A signed-out visitor sees
 * only the people who agreed to be listed.
 */
export async function listEventAttendees(
  eventId: string,
  opts: { viewerIsRegistered?: boolean } = {},
): Promise<EventAttendees> {
  try {
    const { data, error } = await raw()
      .from("registrations")
      .select("attendee_type, answers, profiles:attendee_id(full_name)")
      .eq("event_id", eventId);
    if (error) return EMPTY;

    const out: EventAttendees = { ...EMPTY, investors: [], founders: [] };
    for (const r of (data ?? []) as Row[]) {
      out.total += 1;
      const badge = BADGE[String(r.attendee_type ?? "")];
      if (!badge) continue;

      const answers = (r.answers as Record<string, unknown> | null) ?? {};
      const listed = answers[LISTED_PUBLICLY_KEY] === true;
      const name = nameOf(r);

      // A row that can be shown but has no name to show is a private one: a
      // blank chip is worse than an honest count.
      if ((listed || opts.viewerIsRegistered) && name) {
        (badge === "Investor" ? out.investors : out.founders).push({ name, badge });
      } else if (badge === "Investor") {
        out.privateInvestors += 1;
      } else {
        out.privateFounders += 1;
      }
    }

    const byName = (a: Attendee, b: Attendee) => a.name.localeCompare(b.name);
    out.investors.sort(byName);
    out.founders.sort(byName);
    return out;
  } catch {
    return EMPTY;
  }
}

/** Has this profile registered for this event? Decides what they may see. */
export async function isRegisteredFor(eventId: string, profileId: string | null | undefined): Promise<boolean> {
  if (!profileId) return false;
  try {
    const { data } = await raw()
      .from("registrations")
      .select("id")
      .eq("event_id", eventId)
      .eq("attendee_id", profileId)
      .maybeSingle();
    return Boolean(data);
  } catch {
    return false;
  }
}
