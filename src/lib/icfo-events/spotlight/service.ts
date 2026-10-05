// Founder Spotlight data layer. Server only: every function takes the
// service role client and the caller checks permission first.
//
// Reuses the existing pieces: speaker_applications (kind founder_showcase) is
// the application, event_presenters is the approved lineup (position orders
// the playlist), sponsors (is_founder_booth) is the founder's booth, and the
// private event-session-videos bucket holds the uploaded master file.

import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { EVENT_SESSION_VIDEO_BUCKET } from "@/lib/icfo-events/video/storage";
import type { SpotlightReview } from "./review";

type Row = Record<string, unknown>;

export function db(): SupabaseClient {
  return createServiceRoleClient() as unknown as SupabaseClient;
}

export type SpotlightCompany = {
  name: string | null;
  industry: string | null;
  fundingStage: string | null;
  website: string | null;
};

export type SpotlightApplication = {
  id: string;
  eventId: string;
  applicantId: string;
  applicantName: string | null;
  applicantEmail: string | null;
  topic: string;
  sectorSlug: string | null;
  companySummary: string | null;
  status: "submitted" | "under_review" | "approved" | "declined";
  decisionNote: string | null;
  videoPath: string | null;
  videoType: string | null;
  videoBytes: number | null;
  videoSeconds: number | null;
  videoWidth: number | null;
  videoHeight: number | null;
  youtubeVideoId: string | null;
  transcript: string | null;
  aiReview: SpotlightReview | null;
  aiReviewedAt: string | null;
  aiIntro: string | null;
  wantsBooth: boolean;
  boothSponsorId: string | null;
  createdAt: string;
  company: SpotlightCompany | null;
  /** Lineup entry once approved. */
  presenterId: string | null;
  sessionId: string | null;
  position: number | null;
};

const APP_COLUMNS =
  "id, event_id, applicant_id, topic, sector_slug, company_summary, status, decision_note, video_path, video_type, video_bytes, video_seconds, video_width, video_height, youtube_video_id, transcript, ai_review, ai_reviewed_at, ai_intro, wants_booth, booth_sponsor_id, created_at, profiles:applicant_id(full_name,email)";

function mapApp(r: Row): Omit<SpotlightApplication, "company" | "presenterId" | "sessionId" | "position"> {
  const p = r.profiles as { full_name?: string | null; email?: string | null } | null;
  const n = (v: unknown) => (v == null ? null : Number(v));
  return {
    id: String(r.id),
    eventId: String(r.event_id),
    applicantId: String(r.applicant_id),
    applicantName: p?.full_name ?? null,
    applicantEmail: p?.email ?? null,
    topic: String(r.topic),
    sectorSlug: (r.sector_slug as string | null) ?? null,
    companySummary: (r.company_summary as string | null) ?? null,
    status: r.status as SpotlightApplication["status"],
    decisionNote: (r.decision_note as string | null) ?? null,
    videoPath: (r.video_path as string | null) ?? null,
    videoType: (r.video_type as string | null) ?? null,
    videoBytes: n(r.video_bytes),
    videoSeconds: n(r.video_seconds),
    videoWidth: n(r.video_width),
    videoHeight: n(r.video_height),
    youtubeVideoId: (r.youtube_video_id as string | null) ?? null,
    transcript: (r.transcript as string | null) ?? null,
    aiReview: (r.ai_review as SpotlightReview | null) ?? null,
    aiReviewedAt: (r.ai_reviewed_at as string | null) ?? null,
    aiIntro: (r.ai_intro as string | null) ?? null,
    wantsBooth: Boolean(r.wants_booth),
    boothSponsorId: (r.booth_sponsor_id as string | null) ?? null,
    createdAt: String(r.created_at),
  };
}

/** The founder's most recent company, for the intro, booth and studio card. */
export async function companiesForFounders(founderIds: string[]): Promise<Map<string, SpotlightCompany>> {
  const out = new Map<string, SpotlightCompany>();
  if (founderIds.length === 0) return out;
  const { data } = await db()
    .from("companies")
    .select("founder_id, company_name, industry, funding_stage, website, created_at")
    .in("founder_id", founderIds)
    .order("created_at", { ascending: false });
  for (const r of (data ?? []) as Row[]) {
    const id = String(r.founder_id);
    if (out.has(id)) continue;
    out.set(id, {
      name: (r.company_name as string | null) ?? null,
      industry: (r.industry as string | null) ?? null,
      fundingStage: (r.funding_stage as string | null) ?? null,
      website: (r.website as string | null) ?? null,
    });
  }
  return out;
}

/** Every Spotlight application for an event, with company and lineup joined. */
export async function listSpotlightApplications(eventId: string): Promise<SpotlightApplication[]> {
  const client = db();
  const { data, error } = await client
    .from("speaker_applications")
    .select(APP_COLUMNS)
    .eq("event_id", eventId)
    .eq("kind", "founder_showcase")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  const apps = ((data ?? []) as Row[]).map(mapApp);
  const [companies, presenters] = await Promise.all([
    companiesForFounders([...new Set(apps.map((a) => a.applicantId))]),
    client
      .from("event_presenters")
      .select("id, application_id, session_id, position")
      .eq("event_id", eventId)
      .in("application_id", apps.length ? apps.map((a) => a.id) : ["00000000-0000-0000-0000-000000000000"]),
  ]);
  const byApp = new Map<string, Row>();
  for (const p of ((presenters.data ?? []) as Row[])) byApp.set(String(p.application_id), p);
  return apps.map((a) => {
    const p = byApp.get(a.id);
    return {
      ...a,
      company: companies.get(a.applicantId) ?? null,
      presenterId: p ? String(p.id) : null,
      sessionId: p ? ((p.session_id as string | null) ?? null) : null,
      position: p ? Number(p.position ?? 0) : null,
    };
  });
}

export async function getSpotlightApplication(id: string): Promise<SpotlightApplication | null> {
  const { data } = await db().from("speaker_applications").select(APP_COLUMNS).eq("id", id).eq("kind", "founder_showcase").maybeSingle();
  if (!data) return null;
  const a = mapApp(data as Row);
  const companies = await companiesForFounders([a.applicantId]);
  const { data: p } = await db()
    .from("event_presenters")
    .select("id, session_id, position")
    .eq("application_id", a.id)
    .maybeSingle();
  const pr = p as Row | null;
  return {
    ...a,
    company: companies.get(a.applicantId) ?? null,
    presenterId: pr ? String(pr.id) : null,
    sessionId: pr ? ((pr.session_id as string | null) ?? null) : null,
    position: pr ? Number(pr.position ?? 0) : null,
  };
}

/** Field updates staff make in the studio before a decision. */
export async function patchSpotlightApplication(
  id: string,
  patch: Partial<{
    youtube_video_id: string | null;
    transcript: string | null;
    ai_review: SpotlightReview | null;
    ai_reviewed_at: string | null;
    ai_intro: string | null;
    status: SpotlightApplication["status"];
    decision_note: string | null;
    reviewer_id: string;
    decided_at: string | null;
  }>,
): Promise<void> {
  const { error } = await db().from("speaker_applications").update(patch).eq("id", id).eq("kind", "founder_showcase");
  if (error) throw new Error(error.message);
}

/** Short lived link so staff can watch the uploaded master file. */
export async function spotlightVideoUrl(path: string | null, expiresIn = 3600): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await db().storage.from(EVENT_SESSION_VIDEO_BUCKET).createSignedUrl(path, expiresIn);
  return error ? null : (data?.signedUrl ?? null);
}

/** Uploads go to spotlight/<eventId>/<founderId>/<timestamp>-<name>. */
export function buildSpotlightVideoPath(eventId: string, founderId: string, fileName: string): string {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
  return `spotlight/${eventId}/${founderId}/${Date.now()}-${safe}`;
}

/** A path is only accepted back from the browser when it sits in the
 *  founder's own folder for that event. */
export function isOwnSpotlightPath(path: string, eventId: string, founderId: string): boolean {
  return path.startsWith(`spotlight/${eventId}/${founderId}/`) && !path.includes("..");
}

export async function createSpotlightUploadUrl(path: string): Promise<{ path: string; token: string } | null> {
  const { data, error } = await db().storage.from(EVENT_SESSION_VIDEO_BUCKET).createSignedUploadUrl(path);
  if (error || !data) return null;
  return { path: data.path, token: data.token };
}

/** Deletes the master file once YouTube holds the approved version, so storage
 *  does not grow. Best effort. */
export async function removeSpotlightVideo(path: string | null): Promise<void> {
  if (!path) return;
  await db().storage.from(EVENT_SESSION_VIDEO_BUCKET).remove([path]).then(
    () => undefined,
    () => undefined,
  );
}

/** Next free position at the end of a session's lineup. */
export async function nextLineupPosition(eventId: string, sessionId: string | null): Promise<number> {
  let q = db().from("event_presenters").select("position").eq("event_id", eventId).order("position", { ascending: false }).limit(1);
  q = sessionId ? q.eq("session_id", sessionId) : q.is("session_id", null);
  const { data } = await q;
  const top = ((data ?? []) as Row[])[0];
  return top ? Number(top.position ?? 0) + 1 : 0;
}

/** Create (or reuse) the founder's booth and place it at the event. */
export async function ensureFounderBooth(input: {
  applicationId: string;
  eventId: string;
  ownerId: string;
  name: string;
  blurb: string | null;
  website: string | null;
  sectorSlug: string | null;
  youtubeVideoId: string | null;
}): Promise<string> {
  const client = db();
  const { data: existing } = await client
    .from("speaker_applications")
    .select("booth_sponsor_id")
    .eq("id", input.applicationId)
    .maybeSingle();
  let sponsorId = ((existing as Row | null)?.booth_sponsor_id as string | null) ?? null;

  if (!sponsorId) {
    const { data, error } = await client
      .from("sponsors")
      .insert({
        name: input.name.slice(0, 160),
        blurb: input.blurb ? input.blurb.slice(0, 1000) : null,
        website: input.website,
        tier: "community",
        category: "other",
        sector_slug: input.sectorSlug,
        category_exclusive: false,
        owner_id: input.ownerId,
        is_founder_booth: true,
        allow_contact_request: true,
        video_provider: input.youtubeVideoId ? "external" : null,
        video_ref: input.youtubeVideoId ? `https://www.youtube.com/watch?v=${input.youtubeVideoId}` : null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    sponsorId = String((data as Row).id);
  } else if (input.youtubeVideoId) {
    await client
      .from("sponsors")
      .update({ video_provider: "external", video_ref: `https://www.youtube.com/watch?v=${input.youtubeVideoId}` })
      .eq("id", sponsorId);
  }

  const { error: linkError } = await client
    .from("event_sponsors")
    .upsert({ event_id: input.eventId, sponsor_id: sponsorId, placement: "track" }, { onConflict: "event_id,sponsor_id" });
  if (linkError) throw new Error(linkError.message);
  return sponsorId;
}

/** Rewrite lineup positions for one session, in the order given. */
export async function reorderLineup(eventId: string, presenterIds: string[]): Promise<void> {
  const client = db();
  await Promise.all(
    presenterIds.map((id, i) => client.from("event_presenters").update({ position: i }).eq("id", id).eq("event_id", eventId)),
  );
}

export type SpotlightPlaylistItem = {
  presenterId: string;
  youtubeVideoId: string;
  displayName: string;
  companyName: string | null;
  sectorSlug: string | null;
  intro: string | null;
  headline: string | null;
  boothSponsorId: string | null;
  meetingUrl: string | null;
  sessionId: string | null;
};

/** The public playlist: approved Spotlight presenters with a YouTube video, in
 *  lineup order. Reads only public columns. */
export async function loadSpotlightPlaylist(eventId: string): Promise<SpotlightPlaylistItem[]> {
  const client = db();
  const { data } = await client
    .from("event_presenters")
    .select(
      "id, display_name, headline, company_summary, youtube_video_id, ai_intro, booth_sponsor_id, meeting_url, session_id, position, speaker_applications:application_id(kind, sector_slug, applicant_id)",
    )
    .eq("event_id", eventId)
    .not("youtube_video_id", "is", null)
    .order("position", { ascending: true });
  const rows = ((data ?? []) as Row[]).filter((r) => {
    const a = r.speaker_applications as { kind?: string } | null;
    return a?.kind === "founder_showcase";
  });
  const companies = await companiesForFounders(
    rows.map((r) => String((r.speaker_applications as { applicant_id?: string }).applicant_id ?? "")).filter(Boolean),
  );
  return rows.map((r) => {
    const a = r.speaker_applications as { sector_slug?: string | null; applicant_id?: string };
    return {
      presenterId: String(r.id),
      youtubeVideoId: String(r.youtube_video_id),
      displayName: String(r.display_name),
      companyName: companies.get(String(a.applicant_id ?? ""))?.name ?? null,
      sectorSlug: a.sector_slug ?? null,
      intro: (r.ai_intro as string | null) ?? null,
      headline: (r.headline as string | null) ?? (r.company_summary as string | null) ?? null,
      boothSponsorId: (r.booth_sponsor_id as string | null) ?? null,
      meetingUrl: (r.meeting_url as string | null) ?? null,
      sessionId: (r.session_id as string | null) ?? null,
    };
  });
}
