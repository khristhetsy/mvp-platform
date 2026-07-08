// CEO Hub — AI analysis of the meeting log. Reads recent session journals
// (narratives + decisions) and asks Claude, acting as Chief of Staff, to surface
// patterns, risks, and concrete advice for the CEO. Read-only; ephemeral (not stored).

import { z } from "zod";
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";
import { claudeComplete, CLAUDE_SONNET, isClaudeConfigured } from "@/lib/claude";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return serviceRoleClientUntyped(); }

const schema = z.object({
  headline: z.string().max(300),
  themes: z.array(z.string().max(240)).max(6),
  risks: z.array(z.string().max(240)).max(6),
  suggestions: z.array(z.string().max(300)).max(6),
});
export type MeetingAnalysis = z.infer<typeof schema>;
export interface AnalyzeResult { analysis: MeetingAnalysis | null; sessions: number; skippedReason?: string }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseJson(raw: string): any {
  try { const f = raw.match(/```(?:json)?\s*([\s\S]*?)```/); return JSON.parse((f ? f[1] : raw).trim()); } catch { return null; }
}

export async function analyzeMeetingLog(filterKey?: string): Promise<AnalyzeResult> {
  let q = db().from("ceo_meeting_sessions").select("meeting_key, session_date, note, decisions").order("session_date", { ascending: false }).limit(40);
  if (filterKey && filterKey !== "all") {
    if (filterKey === "operations") q = q.in("meeting_key", ["mgmt", "staff"]);
    else q = q.eq("meeting_key", filterKey);
  }
  const { data } = await q;
  const rows = ((data ?? []) as Array<{ meeting_key: string; session_date: string; note: string | null; decisions: unknown }>).map((r) => ({
    meeting: r.meeting_key, date: r.session_date, note: r.note ?? "", decisions: Array.isArray(r.decisions) ? r.decisions : [],
  }));

  if (rows.length === 0) return { analysis: null, sessions: 0, skippedReason: "no_sessions" };
  if (!isClaudeConfigured()) return { analysis: null, sessions: rows.length, skippedReason: "claude_not_configured" };

  try {
    const out = await claudeComplete(
      [{ role: "user", content: `Meeting-log entries (most recent first, JSON):\n${JSON.stringify(rows)}\n\nYou are the CEO's Chief of Staff reviewing the meeting log. Identify: recurring themes across meetings, emerging risks or unresolved items, and concrete advice for the CEO to raise or decide next. Reference dates/meetings when useful. Do NOT invent facts beyond these notes. Output STRICT JSON {"headline": string, "themes": string[], "risks": string[], "suggestions": string[]} — each array 2–5 short items.` }],
      { system: "You are the AI Chief of Staff for iCapOS, analyzing the CEO's meeting log. Concise, specific, second person. Internal-only, not legal/financial advice. Respond with JSON only.", model: CLAUDE_SONNET, maxTokens: 1400, temperature: 0.4 },
    );
    const parsed = schema.safeParse(parseJson(out));
    if (!parsed.success) return { analysis: null, sessions: rows.length, skippedReason: "invalid_response" };
    return { analysis: parsed.data, sessions: rows.length };
  } catch (e) {
    return { analysis: null, sessions: rows.length, skippedReason: e instanceof Error ? e.message : "analysis_failed" };
  }
}
