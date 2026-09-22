/**
 * Who is attending — names and badges, for the public page and the email.
 *
 * Registration is the qualifier: anyone registered as an investor or a founder
 * is named. No opt-in, and no account needed — a guest who registered without
 * one is listed like anyone else.
 *
 * Read with the service role rather than opened up through RLS, because the
 * page renders on the server and there is no row policy that would let a
 * visitor read `registrations` safely.
 */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";

function raw(): SupabaseClient {
  return createServiceRoleClient() as unknown as SupabaseClient;
}

export type Attendee = { name: string; badge: "Investor" | "Founder" };

export type EventAttendees = {
  investors: Attendee[];
  founders: Attendee[];
  /** Registered as an investor or founder but with no name to show. */
  unnamed: number;
  /** Everyone registered, whatever they registered as. */
  total: number;
};

const EMPTY: EventAttendees = { investors: [], founders: [], unnamed: 0, total: 0 };

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

/** The attendee list for one event, alphabetical within each badge. */
export async function listEventAttendees(eventId: string): Promise<EventAttendees> {
  try {
    const { data, error } = await raw()
      .from("registrations")
      .select("attendee_type, answers, profiles:attendee_id(full_name)")
      .eq("event_id", eventId);
    if (error) return EMPTY;

    const out: EventAttendees = { investors: [], founders: [], unnamed: 0, total: 0 };
    for (const r of (data ?? []) as Row[]) {
      out.total += 1;
      const badge = BADGE[String(r.attendee_type ?? "").toLowerCase()];
      if (!badge) continue;

      const name = nameOf(r);
      // A blank chip is worse than a count: someone with no name at all is
      // tallied rather than rendered as an empty pill.
      if (!name) {
        out.unnamed += 1;
        continue;
      }
      (badge === "Investor" ? out.investors : out.founders).push({ name, badge });
    }

    // Alphabetical, so the order implies no ranking.
    const byName = (a: Attendee, b: Attendee) => a.name.localeCompare(b.name);
    out.investors.sort(byName);
    out.founders.sort(byName);
    return out;
  } catch {
    return EMPTY;
  }
}
