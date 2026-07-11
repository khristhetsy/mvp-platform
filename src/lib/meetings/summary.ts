// Weekly Meeting System — Step 8 analytics sync.
// A compact operating snapshot of the meeting system for the CEO cockpit: the next
// upcoming session + its readiness, open action items, at-risk plan objectives, and
// upcoming conferences. Read-only, service-role; each figure links into its surface.
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return serviceRoleClientUntyped(); }

export interface MeetingOpsSummary {
  nextMeeting: { id: string; name: string; date: string; ready: number; total: number } | null;
  openTasks: number;
  atRiskObjectives: number;
  upcomingConferences: number;
}

export async function getMeetingOpsSummary(): Promise<MeetingOpsSummary> {
  const today = new Date().toISOString().slice(0, 10);

  const [sessionRes, openTasksRes, atRiskRes, confRes] = await Promise.all([
    db().from("ceo_meeting_sessions")
      .select("id, meeting_key, session_date, meeting:ceo_meetings(name)")
      .gte("session_date", today).order("session_date", { ascending: true }).limit(1).maybeSingle(),
    db().from("ceo_meeting_tasks").select("id", { count: "exact", head: true }).in("status", ["not_started", "in_progress"]),
    db().from("ceo_plan_objectives").select("id", { count: "exact", head: true }).is("archived_at", null).in("status", ["at_risk", "off_track"]),
    db().from("ceo_conferences").select("id", { count: "exact", head: true }).gte("start_date", today).in("status", ["draft", "scheduled", "live"]),
  ]);

  let nextMeeting: MeetingOpsSummary["nextMeeting"] = null;
  const s = sessionRes.data as { id: string; meeting_key: string; session_date: string; meeting?: { name?: string } | null } | null;
  if (s) {
    const [{ data: sections }, { data: entries }] = await Promise.all([
      db().from("ceo_meeting_sections").select("id").eq("meeting_key", s.meeting_key),
      db().from("ceo_meeting_section_entries").select("status").eq("session_id", s.id),
    ]);
    const total = ((sections ?? []) as unknown[]).length;
    const ready = ((entries ?? []) as Array<{ status: string }>).filter((e) => e.status === "ready" || e.status === "presented").length;
    nextMeeting = { id: s.id, name: s.meeting?.name ?? "Meeting", date: s.session_date, ready, total };
  }

  return {
    nextMeeting,
    openTasks: (openTasksRes.count as number) ?? 0,
    atRiskObjectives: (atRiskRes.count as number) ?? 0,
    upcomingConferences: (confRes.count as number) ?? 0,
  };
}
