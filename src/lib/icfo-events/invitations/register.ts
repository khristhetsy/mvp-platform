/**
 * Register one person for several events in one go, from an invitation link or
 * while signed in. Each chosen event gets its own registration row, through the
 * same functions the single-event registration uses.
 */
import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { registerForEvent } from "@/lib/icfo-events/registrations";
import { registerGuest } from "@/lib/icfo-events/registration-matches-server";
import { upsertOptin } from "@/lib/icfo-events/networking";
import { applyRegistrationIntake, type AttendeeType } from "@/lib/icfo-events/registration-intake";
import { awardPoints } from "@/lib/icfo-events/gamification";
import { createNotification, notifyStaff } from "@/lib/notifications/notifications";
import { track } from "@/lib/analytics/posthog";
import { applyRegistrationEdits, registeredEventIds } from "@/lib/icfo-events/invitations/person";
import { sendAttendeeEmail, type EventInfo } from "@/lib/icfo-events/invitations/runner";
import type { InvitationRecord } from "@/lib/icfo-events/invitations/store";
import type { FieldChange } from "@/lib/icfo-events/invitations/contact-sync";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return createServiceRoleClient(); }

const escLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export type MultiRegisterResult = {
  registered: Array<{ eventId: string; title: string }>;
  already: string[];
  changes: FieldChange[];
};

async function findRegistrationId(eventId: string, profileId: string | null, email: string): Promise<string | null> {
  let q = db().from("registrations").select("id").eq("event_id", eventId);
  q = profileId ? q.eq("attendee_id", profileId) : q.is("attendee_id", null).ilike("answers->>email", escLike(email));
  const { data } = await q.order("created_at", { ascending: false }).limit(1).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

export async function registerForEvents(input: {
  events: EventInfo[];
  chosenIds: string[];
  profile: { id: string; email: string | null } | null;
  attendeeType: AttendeeType;
  answers: Record<string, unknown>;
  interests: string[];
  invitation: InvitationRecord | null;
}): Promise<MultiRegisterResult> {
  const { profile, attendeeType, answers, interests, invitation } = input;
  const email = String(answers.email ?? "").trim().toLowerCase();
  const allowed = input.events.filter((e) => input.chosenIds.includes(e.id) && Date.parse(e.startsAt) > Date.now());
  const knownEmail = profile?.email ?? invitation?.email ?? null;
  const already = await registeredEventIds(allowed.map((e) => e.id), { email: knownEmail ?? email, profileId: profile?.id ?? null });

  const out: MultiRegisterResult = { registered: [], already, changes: [] };
  const regIds: string[] = [];

  for (const event of allowed) {
    if (already.includes(event.id)) continue;
    let created = false;
    if (profile) {
      const supabase = await createServerSupabaseClient();
      const res = await registerForEvent(supabase, event.id, profile.id);
      created = res.created;
      await upsertOptin(supabase, event.id, profile.id, true, interests).catch(() => null);
      await applyRegistrationIntake({ supabase, eventId: event.id, eventTitle: event.title, profileId: profile.id, attendeeType, answers });
      if (created) {
        await createNotification({
          recipientUserId: profile.id,
          type: "event_registration_confirmed",
          title: "You're registered",
          message: `You're confirmed for "${event.title}". We'll share the agenda and joining details here.`,
          entityType: "event",
          entityId: event.id,
          deepLink: `/events/${event.slug}`,
        }).catch(() => null);
        await awardPoints(event.id, profile.id, "register").catch(() => null);
      }
    } else {
      created = (await registerGuest(event.id, attendeeType, { ...answers, email, name: String(answers.name ?? "").trim() })).created;
    }
    const regId = await findRegistrationId(event.id, profile?.id ?? null, email);
    if (regId && invitation) {
      await db().from("registrations").update({ invitation_id: invitation.id, source: "invite" }).eq("id", regId);
      regIds.push(regId);
    }
    if (created) track("event_registered", { eventId: event.id, guest: !profile, via: invitation ? "invite" : "multi" });
    out.registered.push({ eventId: event.id, title: event.title });
  }

  if (invitation && out.registered.length) {
    const { data: inv } = await db().from("event_invitations").select("registered_event_ids").eq("id", invitation.id).maybeSingle();
    const ids = [...new Set([...(inv?.registered_event_ids ?? []), ...out.registered.map((r) => r.eventId)])];
    await db().from("event_invitations").update({ registered_event_ids: ids }).eq("id", invitation.id);
  }

  // Edits flow back only for an identified person (invite link or session).
  if (knownEmail) {
    const title = out.registered.map((r) => r.title)[0] ?? input.events[0]?.title ?? "event";
    out.changes = (await applyRegistrationEdits({ knownEmail, profileId: profile?.id ?? null, answers, eventTitle: title })).changes;
  }

  if (attendeeType === "investor" && answers.talkShowPanelist === true && out.registered.length) {
    await notifyStaff({
      type: "event_panelist_request",
      title: "Talk show panelist request",
      message: `${String(answers.name ?? "An investor")} (${String(answers.company ?? "")}) asked to join the talk show panel for ${out.registered.map((r) => r.title).join(", ")}.`,
      entityType: "event",
      entityId: out.registered[0].eventId,
      deepLink: `/admin/events/${out.registered[0].eventId}`,
    }).catch(() => null);
  }

  for (const id of regIds) await sendAttendeeEmail(id, "confirm").catch(() => false);
  return out;
}
