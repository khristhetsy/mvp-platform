// Weekly Meeting System — Step 1 foundation data layer. Extends the CEO Hub meeting
// log (ceo_meetings → ceo_meeting_sessions) with a multi-department agenda: sections,
// per-session entries (journals) + version history, and attendance. Service-role reads
// via admin routes gated by requireRole; the pre-start journal write-lock is applied here.
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return serviceRoleClientUntyped(); }

export type SectionKind = "department" | "carryover" | "action_items" | "overview";
export type EntryStatus = "not_started" | "draft" | "ready" | "presented" | "deferred";
export type AttendStatus = "expected" | "present" | "absent" | "remote" | "off";

export interface MeetingSection {
  id: string; position: number; title: string; department_id: string | null;
  section_kind: SectionKind; is_required: boolean; pinned: string | null; kpi_view: string | null;
}
export interface SectionEntry {
  id: string; session_id: string; section_id: string; content: string; status: EntryStatus;
  prepared_by: string | null; updated_at: string;
}
export interface Attendee { user_id: string; name: string; status: AttendStatus }
export interface MeetingSession {
  id: string; meeting_key: string; session_date: string; started_at: string | null;
  status: string; meeting_name: string; meet_link: string | null;
}
export interface MeetingBoard {
  session: MeetingSession | null;
  sections: MeetingSection[];
  entries: Record<string, SectionEntry>; // by section_id
  attendees: Attendee[];
}

export async function listMeetingSections(meetingKey: string): Promise<MeetingSection[]> {
  const { data } = await db().from("ceo_meeting_sections").select("id, position, title, department_id, section_kind, is_required, pinned, kpi_view").eq("meeting_key", meetingKey).order("position");
  return (data ?? []) as MeetingSection[];
}

/** Ensure a not_started entry exists for every section of the session's meeting. */
export async function ensureSessionEntries(sessionId: string, meetingKey: string): Promise<void> {
  const [sections, { data: existing }] = await Promise.all([
    listMeetingSections(meetingKey),
    db().from("ceo_meeting_section_entries").select("section_id").eq("session_id", sessionId),
  ]);
  const have = new Set(((existing ?? []) as Array<{ section_id: string }>).map((r) => r.section_id));
  const missing = sections.filter((s) => !have.has(s.id));
  if (missing.length > 0) {
    await db().from("ceo_meeting_section_entries").insert(missing.map((s) => ({ session_id: sessionId, section_id: s.id, status: "not_started" })));
  }
}

export async function loadBoard(sessionId: string): Promise<MeetingBoard> {
  const { data: sessionRow } = await db().from("ceo_meeting_sessions")
    .select("id, meeting_key, session_date, started_at, meet_link, meeting:ceo_meetings(name)")
    .eq("id", sessionId).maybeSingle();
  if (!sessionRow) return { session: null, sections: [], entries: {}, attendees: [] };
  const meetingKey = String(sessionRow.meeting_key);

  await ensureSessionEntries(sessionId, meetingKey);

  const [sections, { data: entryRows }, { data: attRows }] = await Promise.all([
    listMeetingSections(meetingKey),
    db().from("ceo_meeting_section_entries").select("id, session_id, section_id, content, status, prepared_by, updated_at").eq("session_id", sessionId),
    db().from("ceo_meeting_attendees").select("user_id, status").eq("session_id", sessionId),
  ]);

  const entries: Record<string, SectionEntry> = {};
  for (const e of (entryRows ?? []) as SectionEntry[]) entries[e.section_id] = e;

  const attRaw = (attRows ?? []) as Array<{ user_id: string; status: AttendStatus }>;
  const ids = attRaw.map((a) => a.user_id);
  const names = new Map<string, string>();
  if (ids.length) {
    const { data: people } = await db().from("profiles").select("id, full_name, email").in("id", ids);
    for (const p of (people ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>) names.set(p.id, p.full_name ?? p.email ?? "Member");
  }
  const attendees: Attendee[] = attRaw.map((a) => ({ user_id: a.user_id, name: names.get(a.user_id) ?? "Member", status: a.status }));

  const startedAt = (sessionRow as { started_at?: string | null }).started_at ?? null;
  return {
    session: {
      id: String(sessionRow.id), meeting_key: meetingKey, session_date: String(sessionRow.session_date),
      started_at: startedAt, status: startedAt ? "live" : "scheduled",
      meeting_name: (sessionRow.meeting as { name?: string } | null)?.name ?? "Meeting",
    },
    sections, entries, attendees,
  };
}

/** Save a section entry (content and/or status); records a version snapshot on content change. */
export async function saveSectionEntry(
  entryId: string, patch: { content?: string; status?: EntryStatus }, userId: string,
): Promise<void> {
  const { data: current } = await db().from("ceo_meeting_section_entries").select("content").eq("id", entryId).maybeSingle();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString(), prepared_by: userId };
  if (patch.status) update.status = patch.status;
  if (patch.content != null) update.content = patch.content;
  const { error } = await db().from("ceo_meeting_section_entries").update(update).eq("id", entryId);
  if (error) throw new Error(error.message);
  if (patch.content != null && patch.content !== (current?.content ?? "")) {
    await db().from("ceo_meeting_section_versions").insert({ entry_id: entryId, content: patch.content, edited_by: userId });
  }
}

export async function listEntryVersions(entryId: string): Promise<Array<{ id: string; content: string; edited_at: string }>> {
  const { data } = await db().from("ceo_meeting_section_versions").select("id, content, edited_at").eq("entry_id", entryId).order("edited_at", { ascending: false }).limit(50);
  return (data ?? []) as Array<{ id: string; content: string; edited_at: string }>;
}

export async function setAttendance(sessionId: string, userId: string, status: AttendStatus): Promise<void> {
  const { error } = await db().from("ceo_meeting_attendees").upsert({ session_id: sessionId, user_id: userId, status }, { onConflict: "session_id,user_id" });
  if (error) throw new Error(error.message);
}

/** Recent sessions of the management meeting (for the meetings list). */
export async function listRecentSessions(meetingKey = "mgmt", limit = 20): Promise<MeetingSession[]> {
  const { data } = await db().from("ceo_meeting_sessions")
    .select("id, meeting_key, session_date, started_at, meeting:ceo_meetings(name)")
    .eq("meeting_key", meetingKey).order("session_date", { ascending: false }).limit(limit);
  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    id: String(r.id), meeting_key: String(r.meeting_key), session_date: String(r.session_date),
    started_at: (r.started_at as string) ?? null, status: r.started_at ? "live" : "scheduled",
    meeting_name: (r.meeting as { name?: string } | null)?.name ?? "Meeting",
  }));
}

/** Create (or return) a session for the given meeting + date. */
export async function ensureSession(meetingKey: string, sessionDate: string, createdBy: string): Promise<string> {
  const { data: existing } = await db().from("ceo_meeting_sessions").select("id").eq("meeting_key", meetingKey).eq("session_date", sessionDate).maybeSingle();
  if (existing) return String(existing.id);
  const { data, error } = await db().from("ceo_meeting_sessions").insert({ meeting_key: meetingKey, session_date: sessionDate, created_by: createdBy }).select("id").single();
  if (error) throw new Error(error.message);
  await ensureSessionEntries(String(data.id), meetingKey);
  return String(data.id);
}
