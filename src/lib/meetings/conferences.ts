// Weekly Meeting System — Step 7 Conference events.
// Conferences/summits/talk shows with an agenda of sessions. Read/write via admin routes
// gated by requireRole. Service-role client; sessions cascade on conference delete.
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return serviceRoleClientUntyped(); }

export type ConferenceKind = "conference" | "summit" | "talkshow" | "webinar";
export type ConferenceStatus = "draft" | "scheduled" | "live" | "done" | "cancelled";
const KINDS = new Set<ConferenceKind>(["conference", "summit", "talkshow", "webinar"]);
const STATUSES = new Set<ConferenceStatus>(["draft", "scheduled", "live", "done", "cancelled"]);

export interface ConferenceSession {
  id: string; conference_id: string; title: string; description: string | null;
  starts_at: string | null; ends_at: string | null; speaker: string | null; session_url: string | null; position: number;
}
export interface Conference {
  id: string; title: string; kind: ConferenceKind; description: string | null;
  start_date: string; end_date: string | null; timezone: string; location: string | null;
  event_url: string | null; department_id: string | null; department_name: string | null;
  host_id: string | null; host_name: string | null; status: ConferenceStatus; session_count: number;
}

const SELECT = "id, title, kind, description, start_date, end_date, timezone, location, event_url, department_id, host_id, status";

async function enrich(rows: Array<Record<string, unknown>>): Promise<Conference[]> {
  const deptIds = [...new Set(rows.map((r) => r.department_id).filter((x): x is string => Boolean(x)))];
  const hostIds = [...new Set(rows.map((r) => r.host_id).filter((x): x is string => Boolean(x)))];
  const confIds = rows.map((r) => String(r.id));
  const deptNames = new Map<string, string>();
  const hostNames = new Map<string, string>();
  const sessionCounts = new Map<string, number>();
  await Promise.all([
    (async () => {
      if (!deptIds.length) return;
      const { data } = await db().from("departments").select("id, name").in("id", deptIds);
      for (const d of (data ?? []) as Array<{ id: string; name: string }>) deptNames.set(d.id, d.name);
    })(),
    (async () => {
      if (!hostIds.length) return;
      const { data } = await db().from("profiles").select("id, full_name, email").in("id", hostIds);
      for (const p of (data ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>) hostNames.set(p.id, p.full_name ?? p.email ?? "Host");
    })(),
    (async () => {
      if (!confIds.length) return;
      const { data } = await db().from("ceo_conference_sessions").select("conference_id").in("conference_id", confIds);
      for (const s of (data ?? []) as Array<{ conference_id: string }>) sessionCounts.set(s.conference_id, (sessionCounts.get(s.conference_id) ?? 0) + 1);
    })(),
  ]);
  return rows.map((r) => ({
    id: String(r.id), title: String(r.title), kind: (r.kind as ConferenceKind) ?? "conference",
    description: (r.description as string) ?? null, start_date: String(r.start_date), end_date: (r.end_date as string) ?? null,
    timezone: (r.timezone as string) ?? "America/Los_Angeles", location: (r.location as string) ?? null,
    event_url: (r.event_url as string) ?? null,
    department_id: (r.department_id as string) ?? null, department_name: r.department_id ? deptNames.get(String(r.department_id)) ?? null : null,
    host_id: (r.host_id as string) ?? null, host_name: r.host_id ? hostNames.get(String(r.host_id)) ?? null : null,
    status: (r.status as ConferenceStatus) ?? "draft", session_count: sessionCounts.get(String(r.id)) ?? 0,
  }));
}

export async function listConferences(): Promise<Conference[]> {
  const { data } = await db().from("ceo_conferences").select(SELECT).order("start_date", { ascending: false }).limit(100);
  return enrich((data ?? []) as Array<Record<string, unknown>>);
}

export async function getConference(id: string): Promise<{ conference: Conference | null; sessions: ConferenceSession[] }> {
  const { data } = await db().from("ceo_conferences").select(SELECT).eq("id", id).maybeSingle();
  if (!data) return { conference: null, sessions: [] };
  const [conference] = await enrich([data as Record<string, unknown>]);
  const { data: sessRows } = await db().from("ceo_conference_sessions")
    .select("id, conference_id, title, description, starts_at, ends_at, speaker, session_url, position")
    .eq("conference_id", id).order("position").order("starts_at");
  const sessions = ((sessRows ?? []) as Array<Record<string, unknown>>).map((s) => ({
    id: String(s.id), conference_id: String(s.conference_id), title: String(s.title), description: (s.description as string) ?? null,
    starts_at: (s.starts_at as string) ?? null, ends_at: (s.ends_at as string) ?? null,
    speaker: (s.speaker as string) ?? null, session_url: (s.session_url as string) ?? null, position: Number(s.position ?? 0),
  }));
  return { conference, sessions };
}

export interface CreateConferenceInput {
  title: string; kind?: ConferenceKind; description?: string | null; start_date: string; end_date?: string | null;
  timezone?: string; location?: string | null; event_url?: string | null; department_id?: string | null; host_id?: string | null;
}
export async function createConference(input: CreateConferenceInput, createdBy: string): Promise<string> {
  const { data, error } = await db().from("ceo_conferences").insert({
    title: input.title, kind: input.kind && KINDS.has(input.kind) ? input.kind : "conference",
    description: input.description ?? null, start_date: input.start_date, end_date: input.end_date ?? null,
    timezone: input.timezone ?? "America/Los_Angeles", location: input.location ?? null, event_url: input.event_url ?? null,
    department_id: input.department_id ?? null, host_id: input.host_id ?? null, created_by: createdBy,
  }).select("id").single();
  if (error) throw new Error(error.message);
  return String(data.id);
}

export interface UpdateConferencePatch {
  title?: string; kind?: ConferenceKind; description?: string | null; start_date?: string; end_date?: string | null;
  timezone?: string; location?: string | null; event_url?: string | null; department_id?: string | null;
  host_id?: string | null; status?: ConferenceStatus;
}
export async function updateConference(id: string, patch: UpdateConferencePatch): Promise<void> {
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.title !== undefined) update.title = patch.title;
  if (patch.kind && KINDS.has(patch.kind)) update.kind = patch.kind;
  if (patch.description !== undefined) update.description = patch.description;
  if (patch.start_date !== undefined) update.start_date = patch.start_date;
  if (patch.end_date !== undefined) update.end_date = patch.end_date;
  if (patch.timezone !== undefined) update.timezone = patch.timezone;
  if (patch.location !== undefined) update.location = patch.location;
  if (patch.event_url !== undefined) update.event_url = patch.event_url;
  if (patch.department_id !== undefined) update.department_id = patch.department_id;
  if (patch.host_id !== undefined) update.host_id = patch.host_id;
  if (patch.status && STATUSES.has(patch.status)) update.status = patch.status;
  const { error } = await db().from("ceo_conferences").update(update).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function addSession(conferenceId: string, input: { title: string; starts_at?: string | null; ends_at?: string | null; speaker?: string | null; session_url?: string | null; description?: string | null }): Promise<void> {
  const { data: last } = await db().from("ceo_conference_sessions").select("position").eq("conference_id", conferenceId).order("position", { ascending: false }).limit(1);
  const nextPos = ((last ?? [])[0]?.position ?? -1) + 1;
  const { error } = await db().from("ceo_conference_sessions").insert({
    conference_id: conferenceId, title: input.title, description: input.description ?? null,
    starts_at: input.starts_at ?? null, ends_at: input.ends_at ?? null, speaker: input.speaker ?? null,
    session_url: input.session_url ?? null, position: nextPos,
  });
  if (error) throw new Error(error.message);
}

export async function updateSession(id: string, patch: { title?: string; starts_at?: string | null; ends_at?: string | null; speaker?: string | null; session_url?: string | null; description?: string | null; position?: number }): Promise<void> {
  const update: Record<string, unknown> = {};
  for (const k of ["title", "starts_at", "ends_at", "speaker", "session_url", "description", "position"] as const) {
    if (patch[k] !== undefined) update[k] = patch[k];
  }
  if (Object.keys(update).length === 0) return;
  const { error } = await db().from("ceo_conference_sessions").update(update).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function removeSession(id: string): Promise<void> {
  const { error } = await db().from("ceo_conference_sessions").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
