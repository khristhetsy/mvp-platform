// Weekly Meeting System — conference registrations via the platform's OWN event system
// (iCFO Events: public.events + public.registrations). A meeting-system conference links
// to an iCFO event (ceo_conferences.event_id); this reads that event's registered/attended
// counts zero-copy. No Eventbrite. Manual registrant rows remain a fallback for conferences
// not tied to an iCFO event.
import { serviceRoleClientUntyped, createServiceRoleClient } from "@/lib/supabase/admin";
import { listAllEvents } from "@/lib/icfo-events/queries";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return serviceRoleClientUntyped(); }

export interface LinkedEvent { id: string; title: string; slug: string }
export interface LinkedEventStats { registered: number; attended: number; no_show: number; attend_pct: number | null }
export interface Registration { id: string; source: string; name: string | null; email: string | null; registrant_type: string | null; attended: boolean | null }

export interface ConferenceRegistrations {
  linked: boolean;
  event: LinkedEvent | null;
  stats: LinkedEventStats | null;      // real iCFO event registrations (when linked)
  manual: Registration[];              // fallback manual rows (when not linked)
  registered: number; attended: number; attend_pct: number | null;
}

/** Registrations for a conference: from its linked iCFO event, else manual fallback rows. */
export async function getConferenceRegistrations(conferenceId: string): Promise<ConferenceRegistrations> {
  const { data: conf } = await db().from("ceo_conferences").select("event_id").eq("id", conferenceId).maybeSingle();
  const eventId = conf?.event_id as string | null | undefined;

  if (eventId) {
    const [{ data: evt }, { data: regs }] = await Promise.all([
      db().from("events").select("id, title, slug").eq("id", eventId).maybeSingle(),
      db().from("registrations").select("status, checked_in_at").eq("event_id", eventId),
    ]);
    const rows = (regs ?? []) as Array<{ status: string; checked_in_at: string | null }>;
    const registered = rows.length;
    const attended = rows.filter((r) => r.status === "attended" || r.checked_in_at).length;
    const no_show = rows.filter((r) => r.status === "no_show").length;
    const attend_pct = registered > 0 ? Math.round((attended / registered) * 1000) / 10 : null;
    return {
      linked: true,
      event: evt ? { id: String(evt.id), title: String(evt.title), slug: String(evt.slug) } : null,
      stats: { registered, attended, no_show, attend_pct },
      manual: [], registered, attended, attend_pct,
    };
  }

  // Not linked: manual fallback rows.
  const { data } = await db().from("ceo_event_registrations")
    .select("id, source, name, email, registrant_type, attended")
    .eq("conference_id", conferenceId).order("registered_at", { ascending: false });
  const manual = (data ?? []) as Registration[];
  const attended = manual.filter((r) => r.attended === true).length;
  return {
    linked: false, event: null, stats: null, manual,
    registered: manual.length, attended,
    attend_pct: manual.length > 0 ? Math.round((attended / manual.length) * 1000) / 10 : null,
  };
}

/** iCFO events available to link to a conference. */
export async function listLinkableEvents(): Promise<LinkedEvent[]> {
  const events = await listAllEvents(createServiceRoleClient());
  return events.map((e) => ({ id: e.id, title: e.title, slug: e.slug })).slice(0, 100);
}

// ---- Manual fallback (conferences not tied to an iCFO event) ----
export interface AddRegistrationInput { name?: string | null; email?: string | null; registrant_type?: string | null }
export async function addRegistration(conferenceId: string, input: AddRegistrationInput): Promise<void> {
  const { error } = await db().from("ceo_event_registrations").insert({
    conference_id: conferenceId, source: "manual",
    name: input.name ?? null, email: input.email ?? null, registrant_type: input.registrant_type ?? null,
  });
  if (error) throw new Error(error.message);
}
export async function setAttended(registrationId: string, attended: boolean): Promise<void> {
  const { error } = await db().from("ceo_event_registrations").update({ attended }).eq("id", registrationId);
  if (error) throw new Error(error.message);
}
