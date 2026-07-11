// Weekly Meeting System — event registrations (spec §2.5/§6).
// Registrations for a conference from Eventbrite/iCapOS/manual, with a registered→attended
// funnel summary. Idempotent upsert on (source, external_id) for the webhook path.
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return serviceRoleClientUntyped(); }

export interface Registration {
  id: string; source: string; name: string | null; email: string | null;
  registrant_type: string | null; registered_at: string; attended: boolean | null;
}
export interface RegistrationSummary {
  registrations: Registration[];
  registered: number; attended: number; attend_pct: number | null;
  byType: Record<string, number>;
}

export async function listRegistrations(conferenceId: string): Promise<RegistrationSummary> {
  const { data } = await db().from("ceo_event_registrations")
    .select("id, source, name, email, registrant_type, registered_at, attended")
    .eq("conference_id", conferenceId).order("registered_at", { ascending: false });
  const registrations = (data ?? []) as Registration[];
  const attended = registrations.filter((r) => r.attended === true).length;
  const byType: Record<string, number> = {};
  for (const r of registrations) { const k = r.registrant_type ?? "guest"; byType[k] = (byType[k] ?? 0) + 1; }
  return {
    registrations, registered: registrations.length, attended,
    attend_pct: registrations.length > 0 ? Math.round((attended / registrations.length) * 1000) / 10 : null,
    byType,
  };
}

export interface AddRegistrationInput { name?: string | null; email?: string | null; registrant_type?: string | null; source?: string }
export async function addRegistration(conferenceId: string, input: AddRegistrationInput): Promise<void> {
  const { error } = await db().from("ceo_event_registrations").insert({
    conference_id: conferenceId, source: input.source === "eventbrite" || input.source === "icapos" ? input.source : "manual",
    name: input.name ?? null, email: input.email ?? null, registrant_type: input.registrant_type ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function setAttended(registrationId: string, attended: boolean): Promise<void> {
  const { error } = await db().from("ceo_event_registrations").update({ attended }).eq("id", registrationId);
  if (error) throw new Error(error.message);
}

/** Idempotent upsert for the Eventbrite webhook path (dedupe on source+external_id). */
export async function upsertProviderRegistration(conferenceId: string, r: {
  source: "eventbrite" | "icapos"; external_id: string; name?: string | null; email?: string | null; registrant_type?: string | null; attended?: boolean | null;
}): Promise<void> {
  const { error } = await db().from("ceo_event_registrations").upsert({
    conference_id: conferenceId, source: r.source, external_id: r.external_id,
    name: r.name ?? null, email: r.email ?? null, registrant_type: r.registrant_type ?? null, attended: r.attended ?? null,
  }, { onConflict: "source,external_id" });
  if (error) throw new Error(error.message);
}
