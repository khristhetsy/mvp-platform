// Weekly Meeting System — Step 5 AI layer.
// Two capabilities, both read-only against the business data:
//  1. generateMeetingBrief — a cached synthesis of the session (section journals +
//     carryover + attendance) into a narrative + focus points + risks.
//  2. generateTaskSuggestions — proposes action items into ceo_meeting_task_suggestions
//     as PENDING rows. AI never writes a real task: a human confirms a suggestion, which
//     is what creates the ceo_meeting_tasks row (confirmSuggestion).
// Heuristic/no-op fallbacks when Claude isn't configured. Guardrailed by a language
// denylist; suggestions are length-capped and de-duped against existing pending titles.
import crypto from "crypto";
import { z } from "zod";
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";
import { claudeComplete, CLAUDE_HAIKU, isClaudeConfigured } from "@/lib/claude";
import { createMeetingTask, type MeetingTask, type TaskPriority } from "./tasks";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return serviceRoleClientUntyped(); }

const DENYLIST = [/guarantee/i, /\bwill\s+(close|win|hit|lose)\b/i, /promised?\b/i, /\bcertain to\b/i];
const clean = (s: string) => !DENYLIST.some((re) => re.test(s));

// ---------------------------------------------------------------------------
// Facts gathering (read-only)
// ---------------------------------------------------------------------------
interface SessionFacts {
  meeting_name: string; session_date: string; readiness: string;
  sections: Array<{ title: string; status: string; notes: string }>;
  carryover_count: number; attendee_count: number;
}

async function buildSessionFacts(sessionId: string): Promise<SessionFacts | null> {
  const { data: sess } = await db().from("ceo_meeting_sessions")
    .select("id, meeting_key, session_date, meeting:ceo_meetings(name)").eq("id", sessionId).maybeSingle();
  if (!sess) return null;

  const [{ data: sectionRows }, { data: entryRows }, { data: attRows }, { data: carry }] = await Promise.all([
    db().from("ceo_meeting_sections").select("id, title, position").eq("meeting_key", sess.meeting_key).order("position"),
    db().from("ceo_meeting_section_entries").select("section_id, content, status").eq("session_id", sessionId),
    db().from("ceo_meeting_attendees").select("user_id").eq("session_id", sessionId),
    db().from("ceo_meeting_tasks").select("id", { count: "exact", head: true }).in("status", ["not_started", "in_progress"]),
  ]);

  const entryBySection = new Map<string, { content: string; status: string }>();
  for (const e of (entryRows ?? []) as Array<{ section_id: string; content: string | null; status: string }>) {
    entryBySection.set(e.section_id, { content: e.content ?? "", status: e.status });
  }
  const sections = ((sectionRows ?? []) as Array<{ id: string; title: string }>).map((s) => {
    const e = entryBySection.get(s.id);
    return { title: s.title, status: e?.status ?? "not_started", notes: (e?.content ?? "").slice(0, 800) };
  });
  const ready = sections.filter((s) => s.status === "ready" || s.status === "presented").length;

  return {
    meeting_name: (sess.meeting as { name?: string } | null)?.name ?? "Meeting",
    session_date: String(sess.session_date),
    readiness: `${ready}/${sections.length} sections ready`,
    sections,
    carryover_count: (carry as unknown as number) ?? 0,
    attendee_count: ((attRows ?? []) as unknown[]).length,
  };
}

// ---------------------------------------------------------------------------
// Meeting brief (cached)
// ---------------------------------------------------------------------------
export interface MeetingBrief {
  narrative: string; focus_points: string[]; risks: string[]; model: string | null; cached: boolean;
}

const briefSchema = z.object({
  narrative: z.string().min(1).max(1400),
  focus_points: z.array(z.string().max(180)).max(6).default([]),
  risks: z.array(z.string().max(180)).max(5).default([]),
});

const BRIEF_SYSTEM = `You are the Chief-of-Staff AI preparing an internal weekly team meeting for iCapOS.
You are given the meeting agenda sections and each presenter's prep notes. Write a concise pre-read.
Rules you must never break:
- Summarize only what the notes actually say. Do not invent numbers, names, or commitments.
- These are internal operating notes and trends, never guarantees. Never say "guaranteed", "will close/win", or "promised".
- No investment or financial advice. No pricing.
Return STRICT JSON: {"narrative": string (2-4 sentences), "focus_points": string[] (what the CEO should push on), "risks": string[] (gaps or blockers)}. No prose outside JSON.`;

function stripFences(s: string): string { return s.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim(); }

function heuristicBrief(facts: SessionFacts): MeetingBrief {
  const withNotes = facts.sections.filter((s) => s.notes.trim().length > 0);
  const notReady = facts.sections.filter((s) => s.status !== "ready" && s.status !== "presented").map((s) => s.title);
  return {
    narrative: `${facts.meeting_name} on ${facts.session_date}: ${facts.readiness}, ${withNotes.length} sections have prep notes, ${facts.carryover_count} open carryover items.`,
    focus_points: withNotes.slice(0, 4).map((s) => `Review ${s.title}`),
    risks: notReady.length ? [`Not yet ready: ${notReady.slice(0, 5).join(", ")}`] : [],
    model: null, cached: false,
  };
}

export async function getCachedBrief(sessionId: string): Promise<MeetingBrief | null> {
  const { data } = await db().from("ceo_meeting_ai_briefs")
    .select("narrative, focus_points, risks, model").eq("session_id", sessionId)
    .order("generated_at", { ascending: false }).limit(1).maybeSingle();
  if (!data) return null;
  return { narrative: data.narrative, focus_points: data.focus_points ?? [], risks: data.risks ?? [], model: data.model, cached: true };
}

export async function generateMeetingBrief(sessionId: string, opts: { force?: boolean; createdBy?: string } = {}): Promise<MeetingBrief> {
  const facts = await buildSessionFacts(sessionId);
  if (!facts) throw new Error("Session not found.");
  const inputHash = crypto.createHash("sha256").update(JSON.stringify(facts)).digest("hex");

  if (!opts.force) {
    const { data } = await db().from("ceo_meeting_ai_briefs")
      .select("narrative, focus_points, risks, model, input_hash").eq("session_id", sessionId)
      .eq("input_hash", inputHash).order("generated_at", { ascending: false }).limit(1).maybeSingle();
    if (data) return { narrative: data.narrative, focus_points: data.focus_points ?? [], risks: data.risks ?? [], model: data.model, cached: true };
  }

  if (!isClaudeConfigured()) return heuristicBrief(facts);

  let parsed: z.infer<typeof briefSchema>;
  try {
    const raw = await claudeComplete(
      [{ role: "user", content: `Meeting facts (JSON):\n${JSON.stringify(facts)}\n\nWrite the pre-read.` }],
      { system: BRIEF_SYSTEM, model: CLAUDE_HAIKU, maxTokens: 600, temperature: 0.3, locale: "en" },
    );
    parsed = briefSchema.parse(JSON.parse(stripFences(raw)));
  } catch {
    return heuristicBrief(facts);
  }
  if (!clean(parsed.narrative) || parsed.focus_points.some((p) => !clean(p)) || parsed.risks.some((r) => !clean(r))) {
    return heuristicBrief(facts);
  }

  await db().from("ceo_meeting_ai_briefs").insert({
    session_id: sessionId, input_hash: inputHash, model: CLAUDE_HAIKU,
    narrative: parsed.narrative, focus_points: parsed.focus_points, risks: parsed.risks, created_by: opts.createdBy ?? null,
  });
  return { narrative: parsed.narrative, focus_points: parsed.focus_points, risks: parsed.risks, model: CLAUDE_HAIKU, cached: false };
}

// ---------------------------------------------------------------------------
// Task suggestions (pending until confirmed by a human)
// ---------------------------------------------------------------------------
export interface Suggestion {
  id: string; title: string; rationale: string | null;
  suggested_department_id: string | null; department_name: string | null;
  suggested_due: string | null; status: string;
}

const suggestSchema = z.object({
  suggestions: z.array(z.object({
    title: z.string().min(3).max(140),
    rationale: z.string().max(240).optional().default(""),
  })).max(8).default([]),
});

const SUGGEST_SYSTEM = `You are the Chief-of-Staff AI reviewing weekly management-meeting prep notes for iCapOS.
Propose concrete follow-up ACTION ITEMS implied by the notes (owner-agnostic; a human will assign and confirm).
Rules you must never break:
- Only propose actions grounded in the notes. Do not invent tasks unrelated to what is written.
- Never propose anything that guarantees an outcome. No pricing. No investment/financial advice.
- Each title is an imperative action (e.g. "Follow up with 3 stalled investor threads"), <= 140 chars.
Return STRICT JSON: {"suggestions": [{"title": string, "rationale": string}]}. No prose outside JSON. If nothing actionable, return {"suggestions": []}.`;

export async function generateTaskSuggestions(sessionId: string): Promise<{ created: number; suggestions: Suggestion[] }> {
  const facts = await buildSessionFacts(sessionId);
  if (!facts) throw new Error("Session not found.");
  if (!isClaudeConfigured()) return { created: 0, suggestions: await listSuggestions(sessionId) };

  let parsed: z.infer<typeof suggestSchema>;
  try {
    const raw = await claudeComplete(
      [{ role: "user", content: `Prep notes (JSON):\n${JSON.stringify(facts.sections)}\n\nPropose the action items.` }],
      { system: SUGGEST_SYSTEM, model: CLAUDE_HAIKU, maxTokens: 700, temperature: 0.4, locale: "en" },
    );
    parsed = suggestSchema.parse(JSON.parse(stripFences(raw)));
  } catch {
    return { created: 0, suggestions: await listSuggestions(sessionId) };
  }

  // De-dupe against existing pending suggestions for this session.
  const { data: existing } = await db().from("ceo_meeting_task_suggestions")
    .select("title").eq("session_id", sessionId).eq("status", "pending");
  const have = new Set(((existing ?? []) as Array<{ title: string }>).map((r) => r.title.trim().toLowerCase()));

  const rows = parsed.suggestions
    .filter((s) => clean(s.title) && clean(s.rationale ?? "") && !have.has(s.title.trim().toLowerCase()))
    .map((s) => ({ session_id: sessionId, title: s.title.trim(), rationale: s.rationale?.trim() || null, status: "pending" }));

  if (rows.length) await db().from("ceo_meeting_task_suggestions").insert(rows);
  return { created: rows.length, suggestions: await listSuggestions(sessionId) };
}

export async function listSuggestions(sessionId: string): Promise<Suggestion[]> {
  const { data } = await db().from("ceo_meeting_task_suggestions")
    .select("id, title, rationale, suggested_department_id, suggested_due, status")
    .eq("session_id", sessionId).eq("status", "pending").order("created_at", { ascending: false });
  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const deptIds = [...new Set(rows.map((r) => r.suggested_department_id).filter((x): x is string => Boolean(x)))];
  const deptNames = new Map<string, string>();
  if (deptIds.length) {
    const { data: depts } = await db().from("departments").select("id, name").in("id", deptIds);
    for (const d of (depts ?? []) as Array<{ id: string; name: string }>) deptNames.set(d.id, d.name);
  }
  return rows.map((r) => ({
    id: String(r.id), title: String(r.title), rationale: (r.rationale as string) ?? null,
    suggested_department_id: (r.suggested_department_id as string) ?? null,
    department_name: r.suggested_department_id ? deptNames.get(String(r.suggested_department_id)) ?? null : null,
    suggested_due: (r.suggested_due as string) ?? null, status: String(r.status),
  }));
}

/** Confirm a suggestion → creates a real meeting task and links it back. Human-initiated only. */
export async function confirmSuggestion(id: string, createdBy: string): Promise<MeetingTask> {
  const { data: sug } = await db().from("ceo_meeting_task_suggestions")
    .select("id, session_id, title, suggested_department_id, suggested_assignee_id, suggested_due, status").eq("id", id).maybeSingle();
  if (!sug) throw new Error("Suggestion not found.");
  if (sug.status !== "pending") throw new Error("Suggestion already resolved.");

  const task = await createMeetingTask({
    title: String(sug.title),
    department_id: (sug.suggested_department_id as string) ?? null,
    assignee_id: (sug.suggested_assignee_id as string) ?? null,
    due_date: (sug.suggested_due as string) ?? null,
    priority: "high" as TaskPriority,
    session_id: (sug.session_id as string) ?? null,
    source: "ai_suggestion",
  }, createdBy);

  await db().from("ceo_meeting_task_suggestions").update({ status: "confirmed", confirmed_task_id: task.id }).eq("id", id);
  return task;
}

export async function dismissSuggestion(id: string): Promise<void> {
  const { error } = await db().from("ceo_meeting_task_suggestions").update({ status: "dismissed" }).eq("id", id);
  if (error) throw new Error(error.message);
}
