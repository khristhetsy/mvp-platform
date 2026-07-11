// Weekly Meeting System — meeting-integrity core (spec §4).
// start_meeting: flips the session live and FREEZES a KPI snapshot per department into
// JSONB, so the record shows what was true when discussed. close_meeting: ends the
// session, marks un-presented required sections deferred, and logs the readiness misses.
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";
import { loadRollup } from "./kpi";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return serviceRoleClientUntyped(); }

export interface MeetingKpiSnapshot { id: string; source: string; department_id: string | null; department_name: string | null; payload: unknown; captured_at: string }

/** Start the meeting: set live + freeze weekly KPI rollup per department into snapshots. */
export async function startMeeting(sessionId: string): Promise<{ started_at: string; snapshots: number }> {
  const { data: session } = await db().from("ceo_meeting_sessions").select("id, started_at").eq("id", sessionId).maybeSingle();
  if (!session) throw new Error("Session not found.");

  const now = new Date().toISOString();
  if (!session.started_at) {
    await db().from("ceo_meeting_sessions").update({ started_at: now, status: "live", updated_at: now }).eq("id", sessionId);
  }

  // Freeze a weekly KPI rollup per department that has KPI definitions.
  const { data: defs } = await db().from("ceo_kpi_meeting_definitions").select("department_id").eq("is_active", true);
  const deptIds = [...new Set(((defs ?? []) as Array<{ department_id: string }>).map((d) => d.department_id).filter(Boolean))];

  let snapshots = 0;
  for (const deptId of deptIds) {
    // Idempotent: skip if a snapshot for this dept already exists for this session.
    const { data: existing } = await db().from("ceo_meeting_kpi_snapshots")
      .select("id").eq("session_id", sessionId).eq("source", "kpi_weekly").eq("department_id", deptId).limit(1).maybeSingle();
    if (existing) continue;
    const rollup = await loadRollup("weekly", deptId);
    await db().from("ceo_meeting_kpi_snapshots").insert({ session_id: sessionId, source: "kpi_weekly", department_id: deptId, payload: rollup });
    snapshots++;
  }
  return { started_at: session.started_at ?? now, snapshots };
}

/** Close the meeting: end it, defer un-ready required sections, log readiness misses. */
export async function closeMeeting(sessionId: string): Promise<{ ended_at: string; deferred: number }> {
  const { data: session } = await db().from("ceo_meeting_sessions").select("id, meeting_key").eq("id", sessionId).maybeSingle();
  if (!session) throw new Error("Session not found.");
  const now = new Date().toISOString();

  const [{ data: sections }, { data: entries }] = await Promise.all([
    db().from("ceo_meeting_sections").select("id, department_id, is_required").eq("meeting_key", session.meeting_key),
    db().from("ceo_meeting_section_entries").select("id, section_id, status").eq("session_id", sessionId),
  ]);
  const entryBySection = new Map<string, { id: string; status: string }>();
  for (const e of (entries ?? []) as Array<{ id: string; section_id: string; status: string }>) entryBySection.set(e.section_id, { id: e.id, status: e.status });

  let deferred = 0;
  const logs: Array<Record<string, unknown>> = [];
  for (const s of (sections ?? []) as Array<{ id: string; department_id: string | null; is_required: boolean }>) {
    if (!s.is_required) continue;
    const entry = entryBySection.get(s.id);
    const status = entry?.status ?? "not_started";
    if (status !== "ready" && status !== "presented") {
      if (entry) await db().from("ceo_meeting_section_entries").update({ status: "deferred", updated_at: now }).eq("id", entry.id);
      logs.push({ session_id: sessionId, section_id: s.id, department_id: s.department_id, status });
      deferred++;
    }
  }
  if (logs.length) await db().from("ceo_meeting_readiness_log").insert(logs);

  await db().from("ceo_meeting_sessions").update({ ended_at: now, status: "closed", updated_at: now }).eq("id", sessionId);
  return { ended_at: now, deferred };
}

/** Frozen KPI snapshots captured at meeting start (for the meeting record view). */
export async function listSnapshots(sessionId: string): Promise<MeetingKpiSnapshot[]> {
  const { data } = await db().from("ceo_meeting_kpi_snapshots")
    .select("id, source, department_id, payload, captured_at").eq("session_id", sessionId).order("captured_at");
  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const deptIds = [...new Set(rows.map((r) => r.department_id).filter((x): x is string => Boolean(x)))];
  const deptNames = new Map<string, string>();
  if (deptIds.length) {
    const { data: depts } = await db().from("departments").select("id, name").in("id", deptIds);
    for (const d of (depts ?? []) as Array<{ id: string; name: string }>) deptNames.set(d.id, d.name);
  }
  return rows.map((r) => ({
    id: String(r.id), source: String(r.source),
    department_id: (r.department_id as string) ?? null,
    department_name: r.department_id ? deptNames.get(String(r.department_id)) ?? null : null,
    payload: r.payload, captured_at: String(r.captured_at),
  }));
}
