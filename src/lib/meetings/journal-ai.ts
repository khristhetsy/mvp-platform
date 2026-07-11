// Weekly Meeting System — Step 5 journal AI assists (spec §5).
// Three helpers that feed the JournalEditor's AI assist bar. All return TEXT only into a
// draft buffer (the section textarea) — they never write business rows. Context is read
// zero-copy from the dept's KPI rollup, open tasks, carryover, and last week's entry.
// Heuristic fallbacks when Claude isn't configured. Compliance rails embedded in prompts.
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";
import { claudeComplete, CLAUDE_HAIKU, isClaudeConfigured } from "@/lib/claude";
import { loadRollup } from "./kpi";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return serviceRoleClientUntyped(); }

const DENYLIST = [/guarantee/i, /\bwill\s+(close|win|raise|fund)\b/i, /promised?\b/i, /pricing/i, /\$\d/];
const clean = (s: string) => !DENYLIST.some((re) => re.test(s));

const RAILS = `Rules you must never break: advisory only; NEVER mention pricing or dollar figures; use "engagement traction" phrasing; never assert funding or close probability; never say "guaranteed", "will close/win/raise", or "promised". Internal operating notes only.`;

interface JournalContext {
  sectionTitle: string; departmentId: string | null;
  kpis: Array<{ label: string; actual: number; goal: number; pct: number | null }>;
  openTasks: string[];
  lastWeek: string | null;
}

async function buildContext(sessionId: string, sectionId: string): Promise<JournalContext | null> {
  const { data: section } = await db().from("ceo_meeting_sections").select("title, department_id, meeting_key").eq("id", sectionId).maybeSingle();
  if (!section) return null;
  const deptId = section.department_id as string | null;

  const { data: sess } = await db().from("ceo_meeting_sessions").select("meeting_key, session_date").eq("id", sessionId).maybeSingle();

  const [kpiRollup, tasksRes, lastWeek] = await Promise.all([
    deptId ? loadRollup("weekly", deptId) : Promise.resolve([]),
    deptId
      ? db().from("ceo_meeting_tasks").select("title").eq("department_id", deptId).in("status", ["not_started", "in_progress"]).limit(12)
      : Promise.resolve({ data: [] }),
    (async () => {
      if (!sess) return null;
      const { data: prior } = await db().from("ceo_meeting_sessions")
        .select("id").eq("meeting_key", sess.meeting_key).lt("session_date", sess.session_date)
        .order("session_date", { ascending: false }).limit(1).maybeSingle();
      if (!prior) return null;
      const { data: entry } = await db().from("ceo_meeting_section_entries")
        .select("content").eq("session_id", prior.id).eq("section_id", sectionId).maybeSingle();
      return (entry?.content as string) || null;
    })(),
  ]);

  return {
    sectionTitle: String(section.title), departmentId: deptId,
    kpis: (kpiRollup as Array<{ label: string; actual: number; goal: number; pct: number | null }>).map((k) => ({ label: k.label, actual: k.actual, goal: k.goal, pct: k.pct })),
    openTasks: ((tasksRes.data ?? []) as Array<{ title: string }>).map((t) => t.title),
    lastWeek: lastWeek as string | null,
  };
}

function stripFences(s: string): string { return s.replace(/^```(?:\w+)?/i, "").replace(/```$/i, "").trim(); }

function heuristicDraft(ctx: JournalContext): string {
  const lines: string[] = [`## ${ctx.sectionTitle}`];
  if (ctx.kpis.length) {
    lines.push("", "KPIs this week:");
    for (const k of ctx.kpis.slice(0, 6)) lines.push(`- ${k.label}: ${k.actual} / ${k.goal}${k.pct != null ? ` (${k.pct}%)` : ""}`);
  }
  if (ctx.openTasks.length) {
    lines.push("", "Open items:");
    for (const t of ctx.openTasks.slice(0, 6)) lines.push(`- ${t}`);
  }
  lines.push("", "Asks: ");
  return lines.join("\n");
}

export async function journalDraft(sessionId: string, sectionId: string): Promise<string> {
  const ctx = await buildContext(sessionId, sectionId);
  if (!ctx) throw new Error("Section not found.");
  if (!isClaudeConfigured()) return heuristicDraft(ctx);
  try {
    const raw = await claudeComplete(
      [{ role: "user", content: `Write a concise weekly meeting journal entry for the "${ctx.sectionTitle}" section from these facts (JSON):\n${JSON.stringify(ctx)}\n\nUse a Deals / KPIs / Asks structure. Plain text, no preamble.` }],
      { system: `You are the meeting Chief-of-Staff drafting an internal department journal entry. ${RAILS}`, model: CLAUDE_HAIKU, maxTokens: 500, temperature: 0.4, locale: "en" },
    );
    const text = stripFences(raw);
    return clean(text) ? text : heuristicDraft(ctx);
  } catch { return heuristicDraft(ctx); }
}

export async function journalPolish(rawText: string): Promise<string> {
  const input = rawText.trim();
  if (!input) return "";
  if (!isClaudeConfigured()) return input;
  try {
    const raw = await claudeComplete(
      [{ role: "user", content: `Polish these shorthand meeting notes into clear, professional prose. Keep all facts; do not invent. Plain text.\n\n${input}` }],
      { system: `You polish internal meeting notes. ${RAILS}`, model: CLAUDE_HAIKU, maxTokens: 500, temperature: 0.3, locale: "en" },
    );
    const text = stripFences(raw);
    return clean(text) ? text : input;
  } catch { return input; }
}

export async function journalPoints(sessionId: string, sectionId: string): Promise<string[]> {
  const ctx = await buildContext(sessionId, sectionId);
  if (!ctx) throw new Error("Section not found.");
  const fallback = () => {
    const pts: string[] = [];
    const behind = ctx.kpis.filter((k) => k.pct != null && k.pct < 100).slice(0, 2);
    for (const k of behind) pts.push(`${k.label} at ${k.pct}% of goal — discuss the gap`);
    if (ctx.openTasks.length) pts.push(`${ctx.openTasks.length} open item${ctx.openTasks.length === 1 ? "" : "s"} to review`);
    return pts.slice(0, 3);
  };
  if (!isClaudeConfigured()) return fallback();
  try {
    const raw = await claudeComplete(
      [{ role: "user", content: `From these facts (JSON), give exactly 3 short talking-point bullets for the meeting. One per line, no numbering.\n${JSON.stringify({ kpis: ctx.kpis, openTasks: ctx.openTasks })}` }],
      { system: `You surface meeting talking points. ${RAILS}`, model: CLAUDE_HAIKU, maxTokens: 200, temperature: 0.4, locale: "en" },
    );
    const pts = stripFences(raw).split("\n").map((l) => l.replace(/^[-*\d.)\s]+/, "").trim()).filter((l) => l && clean(l)).slice(0, 3);
    return pts.length ? pts : fallback();
  } catch { return fallback(); }
}
