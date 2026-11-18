import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { makeToken, verifyToken } from "@/lib/signed-links/tokens";
import { isNetworkingOptOut, withNetworkingChoice } from "@/lib/icfo-events/networking-choice-core";

const ACTION = "networking-choice";

/** The emailed link's token. Bound to one registration and one action. */
export function networkingToken(registrationId: string): string {
  return makeToken({ kind: "event_invite", id: registrationId, action: ACTION });
}

export function registrationFromNetworkingToken(token: string): string | null {
  return verifyToken({ token, kind: "event_invite", action: ACTION });
}

const db = () => createServiceRoleClient() as unknown as SupabaseClient;

type RegRow = { id: string; event_id: string; attendee_id: string | null; answers: Record<string, unknown> | null };

async function load(registrationId: string): Promise<{ reg: RegRow; eventTitle: string } | null> {
  const { data } = await db()
    .from("registrations")
    .select("id, event_id, attendee_id, answers")
    .eq("id", registrationId)
    .maybeSingle();
  const reg = data as RegRow | null;
  if (!reg) return null;
  const { data: ev } = await db().from("events").select("title").eq("id", reg.event_id).maybeSingle();
  return { reg, eventTitle: String((ev as { title?: string } | null)?.title ?? "this event") };
}

/** Where this registration stands now: in the pool, or out. */
export async function networkingChoiceFor(registrationId: string): Promise<{ eventTitle: string; optedIn: boolean } | null> {
  const found = await load(registrationId);
  return found ? { eventTitle: found.eventTitle, optedIn: !isNetworkingOptOut(found.reg.answers) } : null;
}

/** Record a yes or a no. Matching reads the registration, so that write is the one that counts. */
export async function setNetworkingChoice(
  registrationId: string,
  optedIn: boolean,
): Promise<{ eventTitle: string } | null> {
  const found = await load(registrationId);
  if (!found) return null;
  const { reg, eventTitle } = found;

  const { error } = await db()
    .from("registrations")
    .update({ answers: withNetworkingChoice(reg.answers, optedIn) })
    .eq("id", reg.id);
  if (error) throw new Error(error.message);

  // A signed-in registrant also has an opt-in row, which the event page reads. Keep it in step.
  if (reg.attendee_id) {
    const { data: updated } = await db()
      .from("networking_optins")
      .update({ opted_in: optedIn })
      .eq("event_id", reg.event_id)
      .eq("profile_id", reg.attendee_id)
      .select("id");
    if (!(updated as unknown[] | null)?.length && !optedIn) {
      await db().from("networking_optins").insert({
        event_id: reg.event_id, profile_id: reg.attendee_id, opted_in: false, interests: [],
      });
    }
  }
  return { eventTitle };
}
