// Speaker applications + approved presenters.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { SpeakerApplicationInput } from "./schemas";
import type {
  EventPresenter,
  SpeakerApplication,
  SpeakerApplicationStatus,
} from "./types";

function raw(supabase: SupabaseClient<Database>): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

type Row = Record<string, unknown>;

function mapApplication(r: Row): SpeakerApplication {
  const profile = r.profiles as { full_name?: string | null; email?: string | null } | null | undefined;
  const event = r.events as { title?: string | null } | null | undefined;
  return {
    id: String(r.id),
    eventId: String(r.event_id),
    applicantId: String(r.applicant_id),
    applicantRole: String(r.applicant_role),
    kind: r.kind as SpeakerApplication["kind"],
    topic: String(r.topic),
    bio: (r.bio as string | null) ?? null,
    sectorSlug: (r.sector_slug as string | null) ?? null,
    links: Array.isArray(r.links) ? (r.links as string[]) : [],
    status: r.status as SpeakerApplicationStatus,
    rubricScores: (r.rubric_scores as Record<string, number>) ?? {},
    reviewerId: (r.reviewer_id as string | null) ?? null,
    decisionNote: (r.decision_note as string | null) ?? null,
    decidedAt: (r.decided_at as string | null) ?? null,
    createdAt: String(r.created_at),
    applicantName: profile?.full_name ?? profile?.email ?? null,
    eventTitle: event?.title ?? null,
  };
}

function mapPresenter(r: Row): EventPresenter {
  return {
    id: String(r.id),
    eventId: String(r.event_id),
    sessionId: (r.session_id as string | null) ?? null,
    applicationId: (r.application_id as string | null) ?? null,
    profileId: (r.profile_id as string | null) ?? null,
    displayName: String(r.display_name),
    roleLabel: (r.role_label as string | null) ?? null,
    headshotPath: (r.headshot_path as string | null) ?? null,
    headline: (r.headline as string | null) ?? null,
    bio: (r.bio as string | null) ?? null,
    links: Array.isArray(r.links) ? (r.links as string[]) : [],
    position: Number(r.position ?? 0),
  };
}

// ── applications ────────────────────────────────────────────────────────────

export async function createApplication(
  supabase: SupabaseClient<Database>,
  applicantId: string,
  applicantRole: string,
  input: SpeakerApplicationInput,
): Promise<SpeakerApplication> {
  const { data, error } = await raw(supabase)
    .from("speaker_applications")
    .insert({
      event_id: input.eventId,
      applicant_id: applicantId,
      applicant_role: applicantRole,
      kind: input.kind,
      topic: input.topic,
      bio: input.bio ?? null,
      sector_slug: input.sectorSlug ?? null,
      links: input.links,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapApplication(data as Row);
}

/** Staff queue — every application, newest first, with applicant + event joined. */
export async function listApplications(
  supabase: SupabaseClient<Database>,
  filter?: { status?: SpeakerApplicationStatus; eventId?: string },
): Promise<SpeakerApplication[]> {
  let q = raw(supabase)
    .from("speaker_applications")
    .select("*, profiles:applicant_id(full_name,email), events:event_id(title)")
    .order("created_at", { ascending: false });
  if (filter?.status) q = q.eq("status", filter.status);
  if (filter?.eventId) q = q.eq("event_id", filter.eventId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapApplication);
}

export async function getApplicationById(
  supabase: SupabaseClient<Database>,
  id: string,
): Promise<SpeakerApplication | null> {
  const { data, error } = await raw(supabase)
    .from("speaker_applications")
    .select("*, profiles:applicant_id(full_name,email), events:event_id(title)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapApplication(data as Row) : null;
}

export async function setApplicationDecision(
  supabase: SupabaseClient<Database>,
  id: string,
  reviewerId: string,
  status: SpeakerApplicationStatus,
  opts: { note?: string | null; rubricScores?: Record<string, number> },
): Promise<SpeakerApplication> {
  const patch: Record<string, unknown> = {
    status,
    reviewer_id: reviewerId,
    decision_note: opts.note ?? null,
  };
  if (opts.rubricScores) patch.rubric_scores = opts.rubricScores;
  if (status === "approved" || status === "declined") patch.decided_at = new Date().toISOString();
  const { data, error } = await raw(supabase)
    .from("speaker_applications")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapApplication(data as Row);
}

// ── presenters ──────────────────────────────────────────────────────────────

export async function createPresenter(
  supabase: SupabaseClient<Database>,
  input: {
    eventId: string;
    applicationId?: string | null;
    profileId?: string | null;
    sessionId?: string | null;
    displayName: string;
    roleLabel?: string | null;
    headline?: string | null;
    bio?: string | null;
    links?: string[];
  },
): Promise<EventPresenter> {
  const { data, error } = await raw(supabase)
    .from("event_presenters")
    .insert({
      event_id: input.eventId,
      application_id: input.applicationId ?? null,
      profile_id: input.profileId ?? null,
      session_id: input.sessionId ?? null,
      display_name: input.displayName,
      role_label: input.roleLabel ?? null,
      headline: input.headline ?? null,
      bio: input.bio ?? null,
      links: input.links ?? [],
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapPresenter(data as Row);
}

export async function listEventPresenters(
  supabase: SupabaseClient<Database>,
  eventId: string,
): Promise<EventPresenter[]> {
  const { data, error } = await raw(supabase)
    .from("event_presenters")
    .select("*")
    .eq("event_id", eventId)
    .order("position", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapPresenter);
}
