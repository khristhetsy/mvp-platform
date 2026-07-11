// Weekly Meeting System — Step 5 recap + recommendations (spec §5).
// meeting-summary: per-section summary + decision tags from the session's entries,
// attendance, and tasks created — returned as a DRAFT; a CEO/Admin approves to publish
// (writes into ceo_meeting_sessions.note/decisions + status='summarized'). recommendations:
// cross-department advisory cards with optional one-click create-task actions. AI never
// writes business rows — publish and create-task are explicit human clicks.
import { z } from "zod";
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";
import { claudeComplete, CLAUDE_HAIKU, isClaudeConfigured } from "@/lib/claude";
import { loadRollup } from "./kpi";
import { listCarryover } from "./tasks";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return serviceRoleClientUntyped(); }

const DENYLIST = [/guarantee/i, /\bwill\s+(close|win|raise|fund)\b/i, /promised?\b/i, /pricing/i, /\$\d/];
const clean = (s: string) => !DENYLIST.some((re) => re.test(s));
const RAILS = `Advisory only. NEVER mention pricing or dollar figures. Use "engagement traction" phrasing. Never assert funding/close probability or say "guaranteed"/"will close"/"promised". Internal operating notes only.`;
function stripFences(s: string): string { return s.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim(); }

// ---------------------------------------------------------------------------
// Meeting summary (draft → publish)
// ---------------------------------------------------------------------------
export interface MeetingSummary { sections: Array<{ title: string; summary: string }>; decisions: string[]; model: string | null }

const summarySchema = z.object({
  sections: z.array(z.object({ title: z.string().max(120), summary: z.string().max(600) })).max(12).default([]),
  decisions: z.array(z.string().max(160)).max(8).default([]),
});

async function summaryFacts(sessionId: string) {
  const { data: sess } = await db().from("ceo_meeting_sessions").select("meeting_key").eq("id", sessionId).maybeSingle();
  if (!sess) return null;
  const [{ data: sections }, { data: entries }, { data: attendees }, { data: tasks }] = await Promise.all([
    db().from("ceo_meeting_sections").select("id, title").eq("meeting_key", sess.meeting_key).order("position"),
    db().from("ceo_meeting_section_entries").select("section_id, content, status").eq("session_id", sessionId),
    db().from("ceo_meeting_attendees").select("status").eq("session_id", sessionId),
    db().from("ceo_meeting_tasks").select("title").eq("session_id", sessionId).limit(30),
  ]);
  const byId = new Map<string, { content: string; status: string }>();
  for (const e of (entries ?? []) as Array<{ section_id: string; content: string | null; status: string }>) byId.set(e.section_id, { content: e.content ?? "", status: e.status });
  return {
    sections: ((sections ?? []) as Array<{ id: string; title: string }>).map((s) => ({ title: s.title, notes: (byId.get(s.id)?.content ?? "").slice(0, 700) })),
    present: ((attendees ?? []) as Array<{ status: string }>).filter((a) => a.status === "present" || a.status === "remote").length,
    tasksCreated: ((tasks ?? []) as Array<{ title: string }>).map((t) => t.title),
  };
}

export async function generateMeetingSummary(sessionId: string): Promise<MeetingSummary> {
  const facts = await summaryFacts(sessionId);
  if (!facts) throw new Error("Session not found.");
  const heuristic = (): MeetingSummary => ({
    sections: facts.sections.filter((s) => s.notes.trim()).map((s) => ({ title: s.title, summary: s.notes.slice(0, 240) })),
    decisions: [], model: null,
  });
  if (!isClaudeConfigured()) return heuristic();
  try {
    const raw = await claudeComplete(
      [{ role: "user", content: `Summarize this weekly meeting from its section notes (JSON). One tight summary per section that has content, plus a list of decision tags.\n${JSON.stringify(facts)}\n\nReturn STRICT JSON: {"sections":[{"title","summary"}],"decisions":[string]}.` }],
      { system: `You write internal meeting minutes. ${RAILS}`, model: CLAUDE_HAIKU, maxTokens: 900, temperature: 0.3, locale: "en" },
    );
    const parsed = summarySchema.parse(JSON.parse(stripFences(raw)));
    const okSections = parsed.sections.filter((s) => clean(s.summary));
    const okDecisions = parsed.decisions.filter(clean);
    return { sections: okSections, decisions: okDecisions, model: CLAUDE_HAIKU };
  } catch { return heuristic(); }
}

/** Publish an approved summary onto the session record. CEO/Admin only (enforced in route). */
export async function publishMeetingSummary(sessionId: string, note: string, decisions: string[]): Promise<void> {
  const { error } = await db().from("ceo_meeting_sessions")
    .update({ note, decisions, status: "summarized", updated_at: new Date().toISOString() })
    .eq("id", sessionId);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Cross-department recommendations (advisory only)
// ---------------------------------------------------------------------------
export interface Recommendation { title: string; detail: string; department_id: string | null; priority: "high" | "med" | "low" }

const recSchema = z.object({
  recommendations: z.array(z.object({
    title: z.string().max(140), detail: z.string().max(320),
    priority: z.enum(["high", "med", "low"]).default("med"),
  })).max(6).default([]),
});

export async function generateRecommendations(sessionId: string): Promise<Recommendation[]> {
  const [carryover, sales, marketing, ir] = await Promise.all([
    listCarryover(sessionId).catch(() => []),
    loadRollup("weekly").catch(() => []),
    Promise.resolve([]),
    Promise.resolve([]),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const overdue = carryover.filter((t) => t.due_date && t.due_date < today).length;
  const behind = (sales as Array<{ label: string; pct: number | null }>).filter((k) => k.pct != null && k.pct < 80);

  const heuristic = (): Recommendation[] => {
    const out: Recommendation[] = [];
    if (overdue > 0) out.push({ title: `${overdue} overdue carryover task${overdue === 1 ? "" : "s"}`, detail: "Reassign or reschedule overdue items before they compound across meetings.", department_id: null, priority: overdue > 3 ? "high" : "med" });
    for (const k of behind.slice(0, 2)) out.push({ title: `${k.label} at ${k.pct}% of goal`, detail: "Below the weekly pace — discuss the driver and a corrective action.", department_id: null, priority: "med" });
    return out.slice(0, 5);
  };
  if (!isClaudeConfigured()) return heuristic();
  try {
    const raw = await claudeComplete(
      [{ role: "user", content: `Cross-department operating signals (JSON): ${JSON.stringify({ overdueCarryover: overdue, kpisBehind: behind, marketing, ir })}\n\nGive up to 5 advisory recommendation cards. Return STRICT JSON: {"recommendations":[{"title","detail","priority"}]}.` }],
      { system: `You are the CEO's Chief-of-Staff surfacing cross-department advisories. ${RAILS}`, model: CLAUDE_HAIKU, maxTokens: 600, temperature: 0.4, locale: "en" },
    );
    const parsed = recSchema.parse(JSON.parse(stripFences(raw)));
    const cards = parsed.recommendations.filter((r) => clean(r.title) && clean(r.detail)).map((r) => ({ ...r, department_id: null }));
    return cards.length ? cards : heuristic();
  } catch { return heuristic(); }
}
