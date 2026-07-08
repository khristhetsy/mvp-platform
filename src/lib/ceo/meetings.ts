// CEO Hub meetings — workflow config (ceo_meetings) + session journals
// (ceo_meeting_sessions). Journal tasks write through to admin_tasks tagged with the
// session id, so they surface on the admin task board. Read/write via service role.

import { serviceRoleClientUntyped } from "@/lib/supabase/admin";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return serviceRoleClientUntyped(); }

export interface AgendaBlock { title: string; minutes: number }
export interface MeetingWorkflow { before: string[]; after: string[]; rules: string }
export type MeetingCadence = "weekly" | "biweekly" | "monthly";
export interface CeoMeeting {
  key: string; name: string; dept: string; cadence: MeetingCadence; dayOfWeek: number; timeLocal: string; timezone: string;
  durationMin: number; attendees: Array<{ name?: string; email?: string }>; agenda: AgendaBlock[];
  workflow: MeetingWorkflow; gcalEventId: string | null; active: boolean;
}
export interface CeoSession {
  id: string; meetingKey: string; sessionDate: string; attendance: string | null; note: string | null;
  decisions: string[]; createdAt: string;
}
export interface CeoOccurrence {
  id: string; meetingKey: string; occursOn: string; timeLocal: string | null; durationMin: number | null; note: string | null; gcalEventId: string | null;
}

function normalizeCadence(v: unknown): MeetingCadence {
  return v === "biweekly" || v === "monthly" ? v : "weekly";
}
function mapMeeting(r: Record<string, unknown>): CeoMeeting {
  return {
    key: String(r.key), name: String(r.name), dept: String(r.dept), cadence: normalizeCadence(r.cadence), dayOfWeek: Number(r.day_of_week),
    timeLocal: String(r.time_local), timezone: String(r.timezone), durationMin: Number(r.duration_min),
    attendees: Array.isArray(r.attendees) ? (r.attendees as Array<{ name?: string; email?: string }>) : [],
    agenda: Array.isArray(r.agenda) ? (r.agenda as AgendaBlock[]) : [],
    workflow: (r.workflow as MeetingWorkflow) ?? { before: [], after: [], rules: "" },
    gcalEventId: (r.gcal_event_id as string) ?? null, active: r.active !== false,
  };
}
function mapOccurrence(r: Record<string, unknown>): CeoOccurrence {
  return {
    id: String(r.id), meetingKey: String(r.meeting_key), occursOn: String(r.occurs_on),
    timeLocal: (r.time_local as string) ?? null, durationMin: r.duration_min != null ? Number(r.duration_min) : null,
    note: (r.note as string) ?? null, gcalEventId: (r.gcal_event_id as string) ?? null,
  };
}
function mapSession(r: Record<string, unknown>): CeoSession {
  return {
    id: String(r.id), meetingKey: String(r.meeting_key), sessionDate: String(r.session_date),
    attendance: (r.attendance as string) ?? null, note: (r.note as string) ?? null,
    decisions: Array.isArray(r.decisions) ? (r.decisions as string[]) : [], createdAt: String(r.created_at),
  };
}

export async function loadMeetings(): Promise<{ meetings: CeoMeeting[]; sessions: CeoSession[]; occurrences: CeoOccurrence[] }> {
  const [{ data: m }, { data: s }, { data: o }] = await Promise.all([
    db().from("ceo_meetings").select("*").eq("active", true).order("day_of_week"),
    db().from("ceo_meeting_sessions").select("*").order("session_date", { ascending: false }).limit(200),
    db().from("ceo_meeting_occurrences").select("*").order("occurs_on", { ascending: true }),
  ]);
  return {
    meetings: ((m ?? []) as Array<Record<string, unknown>>).map(mapMeeting),
    sessions: ((s ?? []) as Array<Record<string, unknown>>).map(mapSession),
    occurrences: ((o ?? []) as Array<Record<string, unknown>>).map(mapOccurrence),
  };
}

export interface NewOccurrenceInput { occursOn: string; timeLocal?: string | null; durationMin?: number | null; note?: string | null }

export async function createOccurrence(meetingKey: string, input: NewOccurrenceInput, adminId: string): Promise<{ id: string }> {
  const { data, error } = await db().from("ceo_meeting_occurrences").upsert({
    meeting_key: meetingKey, occurs_on: input.occursOn, time_local: input.timeLocal ?? null,
    duration_min: input.durationMin ?? null, note: input.note ?? null, created_by: adminId,
  }, { onConflict: "meeting_key,occurs_on" }).select("id").single();
  if (error) throw new Error(error.message);
  return { id: String(data.id) };
}

export async function deleteOccurrence(id: string): Promise<void> {
  const { error } = await db().from("ceo_meeting_occurrences").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export interface NewSessionInput { sessionDate: string; attendance?: string | null; note?: string | null; decisions?: string[]; tasks?: string[] }

export async function createSession(meetingKey: string, input: NewSessionInput, adminId: string): Promise<{ id: string }> {
  const { data, error } = await db().from("ceo_meeting_sessions").upsert({
    meeting_key: meetingKey, session_date: input.sessionDate, attendance: input.attendance ?? null,
    note: input.note ?? null, decisions: input.decisions ?? [], created_by: adminId, updated_at: new Date().toISOString(),
  }, { onConflict: "meeting_key,session_date" }).select("id").single();
  if (error) throw new Error(error.message);
  const sessionId = String(data.id);

  // Write journal tasks through to the Admin Tasks board, tagged with this session.
  const tasks = (input.tasks ?? []).map((t) => t.trim()).filter(Boolean);
  if (tasks.length > 0) {
    const rows = tasks.map((title) => ({
      title: title.slice(0, 200), status: "todo", priority: "medium", visibility: "admin_only",
      owner_label: "CEO meeting", created_by: adminId, source_meeting_session_id: sessionId,
    }));
    await db().from("admin_tasks").insert(rows);
  }
  return { id: sessionId };
}

export async function updateSession(id: string, patch: { attendance?: string | null; note?: string | null; decisions?: string[] }): Promise<void> {
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.attendance !== undefined) update.attendance = patch.attendance;
  if (patch.note !== undefined) update.note = patch.note;
  if (patch.decisions !== undefined) update.decisions = patch.decisions;
  const { error } = await db().from("ceo_meeting_sessions").update(update).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteSession(id: string): Promise<void> {
  const { error } = await db().from("ceo_meeting_sessions").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function setMeetingEvent(meetingKey: string, gcalEventId: string): Promise<void> {
  await db().from("ceo_meetings").update({ gcal_event_id: gcalEventId }).eq("key", meetingKey);
}

export interface MeetingSchedulePatch { cadence?: MeetingCadence; dayOfWeek?: number; timeLocal?: string; durationMin?: number; timezone?: string; attendees?: Array<{ name?: string; email?: string }> }

export async function updateMeeting(key: string, patch: MeetingSchedulePatch): Promise<CeoMeeting> {
  const u: Record<string, unknown> = {};
  if (patch.cadence !== undefined) u.cadence = patch.cadence;
  if (patch.dayOfWeek !== undefined) u.day_of_week = patch.dayOfWeek;
  if (patch.timeLocal !== undefined) u.time_local = patch.timeLocal;
  if (patch.durationMin !== undefined) u.duration_min = patch.durationMin;
  if (patch.timezone !== undefined) u.timezone = patch.timezone;
  if (patch.attendees !== undefined) u.attendees = patch.attendees;
  const { data, error } = await db().from("ceo_meetings").update(u).eq("key", key).select("*").single();
  if (error) throw new Error(error.message);
  return mapMeeting(data as Record<string, unknown>);
}
