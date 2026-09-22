import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { upsertOptin } from "@/lib/icfo-events/networking";
import { normalizeSectors } from "@/lib/icfo-events/sectors";
import { notifyStaff } from "@/lib/notifications/notifications";

function raw(c: SupabaseClient<Database>): SupabaseClient {
  return c as unknown as SupabaseClient;
}

export const ATTENDEE_TYPES = ["investor", "founder", "service", "sponsor"] as const;
export type AttendeeType = (typeof ATTENDEE_TYPES)[number];

export type RegistrationAnswers = Record<string, unknown>;

function asStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x)).filter(Boolean);
  if (typeof v === "string" && v.trim()) return [v.trim()];
  return [];
}

/**
 * Store sectors as slugs, whatever the form rendered.
 *
 * The field-set questions offer labels — `resolvedOptionsFor` keeps the label
 * and drops the slug — so without this the answers say "FinTech" while the
 * interest chips on the same page say "fintech". Storing the key means a
 * later rename changes what people read without orphaning what they answered.
 *
 * `sectors` stays a list and `sector` stays a single value: the shape the
 * form uses is the registrant's, not ours to change underneath them.
 */
function withCanonicalSectors(answers: RegistrationAnswers): RegistrationAnswers {
  const out = { ...answers };

  if ("sectors" in out) {
    const slugs = normalizeSectors(asStringArray(out.sectors));
    out.sectors = Array.isArray(out.sectors) ? slugs : slugs[0] ?? "";
  }
  if ("sector" in out) {
    const slugs = normalizeSectors(asStringArray(out.sector));
    out.sector = Array.isArray(out.sector) ? slugs : slugs[0] ?? "";
  }
  return out;
}

/**
 * Apply the typed registration: persist the answers on the registration, then
 * route the data — matchmaking opt-in for investors/founders, lead pipeline for
 * sponsors/service providers. Per the agreed design this never writes to core
 * profiles. Routing is best-effort and never blocks the registration itself.
 */
export async function applyRegistrationIntake(input: {
  supabase: SupabaseClient<Database>;
  eventId: string;
  eventTitle: string;
  profileId: string;
  attendeeType: AttendeeType;
  answers: RegistrationAnswers;
}): Promise<void> {
  const { supabase, eventId, eventTitle, profileId, attendeeType } = input;
  const answers = withCanonicalSectors(input.answers);

  // 1) Persist the type + answers on the attendee's own registration row.
  await raw(supabase)
    .from("registrations")
    .update({ attendee_type: attendeeType, answers })
    .eq("event_id", eventId)
    .eq("attendee_id", profileId);

  // 2) Route the data.
  try {
    if (attendeeType === "investor" || attendeeType === "founder") {
      // Sector interests power the event's networking matchmaking — scoped to
      // the event, not the core profile. Already slugs, so the opt-in store and
      // the answers agree instead of holding two spellings of one sector.
      const interests = normalizeSectors([
        ...asStringArray(answers.sectors),
        ...asStringArray(answers.sector),
      ]);
      if (interests.length > 0) {
        await upsertOptin(supabase, eventId, profileId, true, interests);
      }
    } else {
      // Sponsor / service provider → lead pipeline + notify the partnerships team.
      const company = typeof answers.company === "string" ? answers.company : null;
      await raw(supabase).from("event_leads").insert({
        event_id: eventId,
        profile_id: profileId,
        lead_type: attendeeType,
        company,
        answers,
      });
      await notifyStaff({
        type: "event_lead_received",
        title: attendeeType === "sponsor" ? "New sponsor lead" : "New service-provider lead",
        message: `${company ?? "A company"} registered as a ${attendeeType} for "${eventTitle}".`,
        entityType: "event",
        entityId: eventId,
        deepLink: `/admin/events/${eventId}`,
      });
    }
  } catch {
    // Routing is best-effort — the registration itself already succeeded.
  }
}
