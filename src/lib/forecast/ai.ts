// AI Sales advisory — read-only narrative commentary on the Overview KPIs. Cache-to-
// table (immutable), guardrailed: language denylist + whitelisted action keys. Never
// mutates forecast data. Mirrors the CEO Hub "AI Chief of Staff" pattern.
import crypto from "crypto";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { claudeComplete, CLAUDE_HAIKU, isClaudeConfigured } from "@/lib/claude";
import { getLatestSnapshot, loadActualsAnchor, loadActualsSeries, getScenario } from "./store";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return createServiceRoleClient(); }

export type MetricKey = "mrr" | "arr" | "proj" | "variance";
const ACTION_WHITELIST = new Set(["open_pipeline", "edit_assumptions", "compute_forecast", "view_accounts", "create_task"]);
const DENYLIST = [/guarantee/i, /will close/i, /expected funding/i, /guaranteed/i, /certain to/i];

export interface SalesInsight {
  metric_key: MetricKey; narrative: string; model: string | null;
  drivers: Array<{ label: string; value: string }>;
  suggested_actions: Array<{ text: string; action_key: string }>;
  cached: boolean;
}

const insightSchema = z.object({
  narrative: z.string().min(1).max(1200),
  drivers: z.array(z.object({ label: z.string().max(80), value: z.string().max(80) })).max(6).default([]),
  suggested_actions: z.array(z.object({ text: z.string().max(120), action_key: z.string().max(40) })).max(4).default([]),
});

function money(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString()}`;
}

/** Compact, view-derived facts per metric — the only data the model ever sees. */
async function assembleFacts(metric: MetricKey, scenarioId: string) {
  const [snap, anchor, series] = await Promise.all([getLatestSnapshot(scenarioId), loadActualsAnchor(), loadActualsSeries()]);
  const currentMrr = anchor.endingMrrCents.founder + anchor.endingMrrCents.investor;
  const proj = snap?.output.totals.endingMrrByMonth ?? [];
  const recent = series.slice(-6).map((s) => ({ month: String(s.month).slice(0, 7), segment: s.segment, endingMrr: money(Number(s.ending_mrr_cents) || 0) }));
  return {
    metric,
    currentMrr: money(currentMrr),
    currentArr: money(currentMrr * 12),
    projectedArr: proj.length ? money(proj[proj.length - 1] * 12) : null,
    projectionMonths: proj.length,
    recentActuals: recent,
    hasSnapshot: Boolean(snap),
    snapshotId: snap?.meta.id ?? null,
  };
}

function fallbackInsight(metric: MetricKey, facts: Awaited<ReturnType<typeof assembleFacts>>): SalesInsight {
  const text: Record<MetricKey, string> = {
    mrr: `Current recurring revenue is ${facts.currentMrr}. This is a projection baseline; review the assumptions to refine the trajectory.`,
    arr: `Annualized recurring revenue stands at ${facts.currentArr} based on current MRR.`,
    proj: facts.projectedArr ? `The Base scenario projects ${facts.projectedArr} ARR at the end of the horizon — a scenario, not a commitment.` : `Compute a forecast to see the projected ARR scenario.`,
    variance: `Compare the latest snapshot against actuals in the Variance tab to see how the projection is tracking.`,
  };
  return { metric_key: metric, narrative: text[metric], model: null, drivers: [], suggested_actions: [{ text: "Edit assumptions", action_key: "edit_assumptions" }], cached: false };
}

const SYSTEM = `You are the AI Sales analyst for iCapOS, commenting on internal subscription-revenue projections.
Rules you must never break:
- These are PROJECTIONS and SCENARIOS, never guarantees. Never say "guaranteed", "will close", or "expected funding".
- Comment only on iCapOS subscription revenue — never portfolio-company funding outcomes.
- You never mutate data. Suggested actions are links only, chosen ONLY from: open_pipeline, edit_assumptions, compute_forecast, view_accounts, create_task.
Return STRICT JSON: {"narrative": string, "drivers": [{"label","value"}], "suggested_actions": [{"text","action_key"}]}. No prose outside JSON.`;

function stripFences(s: string): string {
  return s.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
}

/** Return a cached-or-generated insight for a metric. Immutable rows; regenerate only on hash change or force. */
export async function getSalesInsight(metric: MetricKey, scenarioId: string, opts: { force?: boolean; createdBy?: string } = {}): Promise<SalesInsight> {
  const scenario = await getScenario(scenarioId);
  if (!scenario) throw new Error("Scenario not found.");
  const facts = await assembleFacts(metric, scenarioId);
  const inputHash = crypto.createHash("sha256").update(JSON.stringify({ metric, scenarioId, facts })).digest("hex");

  if (!opts.force) {
    const { data } = await db().from("sales_ai_insights")
      .select("metric_key, narrative, model, drivers, suggested_actions, input_hash")
      .eq("metric_key", metric).eq("snapshot_id", facts.snapshotId).eq("input_hash", inputHash)
      .order("generated_at", { ascending: false }).limit(1).maybeSingle();
    if (data) return { metric_key: metric, narrative: data.narrative, model: data.model, drivers: data.drivers ?? [], suggested_actions: data.suggested_actions ?? [], cached: true };
  }

  if (!isClaudeConfigured()) return fallbackInsight(metric, facts);

  let parsed: z.infer<typeof insightSchema>;
  try {
    const raw = await claudeComplete(
      [{ role: "user", content: `Facts (JSON): ${JSON.stringify(facts)}\n\nWrite the insight for metric "${metric}".` }],
      { system: SYSTEM, model: CLAUDE_HAIKU, maxTokens: 500, temperature: 0.3 },
    );
    parsed = insightSchema.parse(JSON.parse(stripFences(raw)));
  } catch {
    return fallbackInsight(metric, facts);
  }

  // Guardrails: denylist on narrative + whitelist on actions.
  if (DENYLIST.some((re) => re.test(parsed.narrative))) return fallbackInsight(metric, facts);
  const actions = parsed.suggested_actions.filter((a) => ACTION_WHITELIST.has(a.action_key));

  await db().from("sales_ai_insights").insert({
    metric_key: metric, snapshot_id: facts.snapshotId, model: CLAUDE_HAIKU, input_hash: inputHash,
    narrative: parsed.narrative, drivers: parsed.drivers, suggested_actions: actions, created_by: opts.createdBy ?? null,
  });

  return { metric_key: metric, narrative: parsed.narrative, model: CLAUDE_HAIKU, drivers: parsed.drivers, suggested_actions: actions, cached: false };
}
