// CEO Hub — AI-suggested goals. Uses the current KPI registry + recent snapshots +
// department scores to propose concrete, measurable quarterly goals with targets.
// Read-only and ephemeral; the CEO chooses which to add via the Planning tab.

import { z } from "zod";
import { claudeComplete, CLAUDE_SONNET, isClaudeConfigured } from "@/lib/claude";
import { loadCeoPayload } from "./hub-data";
import { status as kpiStatus, deptScore } from "./kpi";

const schema = z.array(z.object({
  title: z.string().max(160),
  metric: z.string().max(80).nullable().optional(),
  target: z.number().nullable().optional(),
  period: z.string().max(40).nullable().optional(),
  rationale: z.string().max(300).nullable().optional(),
})).max(6);
export type SuggestedGoal = z.infer<typeof schema>[number];
export interface SuggestGoalsResult { goals: SuggestedGoal[]; skippedReason?: string }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseJson(raw: string): any {
  try { const f = raw.match(/```(?:json)?\s*([\s\S]*?)```/); return JSON.parse((f ? f[1] : raw).trim()); } catch { return null; }
}

export async function suggestGoals(): Promise<SuggestGoalsResult> {
  if (!isClaudeConfigured()) return { goals: [], skippedReason: "claude_not_configured" };
  const payload = await loadCeoPayload();

  const computable = payload.kpis.filter((k) => k.weeks.length > 0);
  const kpiCtx = computable.map((k) => {
    const cur = k.weeks[k.weeks.length - 1]?.value ?? null;
    return { key: k.key, dept: k.dept, label: k.label, current: cur, target: k.target, fmt: k.fmt, status: cur != null ? kpiStatus(cur, k) : "na", owner: k.owner };
  });
  const scores = (["sales", "marketing", "operations"] as const).map((d) => ({
    dept: d,
    score: deptScore(kpiCtx.filter((x) => x.dept === d && x.status !== "na").map((x) => ({ status: x.status as "g" | "y" | "r", weight: 1 }))),
  }));

  const ctx = {
    dept_scores: scores,
    kpis: kpiCtx,
    existing_goals: payload.goals.map((g) => ({ title: g.title, metric: g.metric, target: g.target, period: g.period })),
  };

  try {
    const out = await claudeComplete(
      [{ role: "user", content: `Company KPI context (JSON):\n${JSON.stringify(ctx)}\n\nYou are the CEO's Chief of Staff. Propose 3–5 concrete, measurable company goals for the coming quarter that move the weakest departments and build on strengths. Each goal must tie to a metric with a realistic numeric target (stretch but achievable vs current). Do NOT duplicate existing_goals. Output STRICT JSON array of {"title","metric","target","period","rationale"}. period like "Q3 2026". target is a number only.` }],
      { system: "You are the AI Chief of Staff for iCapOS proposing CEO goals. Specific, measurable, realistic. Internal-only, not financial advice. Respond with JSON only.", model: CLAUDE_SONNET, maxTokens: 1400, temperature: 0.5 },
    );
    const parsed = schema.safeParse(parseJson(out));
    if (!parsed.success) return { goals: [], skippedReason: "invalid_response" };
    return { goals: parsed.data };
  } catch (e) {
    return { goals: [], skippedReason: e instanceof Error ? e.message : "suggestion_failed" };
  }
}
