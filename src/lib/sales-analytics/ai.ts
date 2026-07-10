// AI Sales Analyst — read-only narrative commentary on a Sales Hub metric. Cache-to-
// table (sales_analytics_insights), guardrailed: language denylist + whitelisted
// action keys. Heuristic fallback when Claude isn't configured. Never mutates data.
import crypto from "crypto";
import { z } from "zod";
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";
import { claudeComplete, CLAUDE_HAIKU, isClaudeConfigured } from "@/lib/claude";
import { loadSalesMetric, type SalesMetric } from "./metrics";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return serviceRoleClientUntyped(); }

const ACTION_WHITELIST = new Set(["open_opportunities", "open_pipeline", "open_forecast", "open_tasks", "open_contacts"]);
const DENYLIST = [/guarantee/i, /guaranteed/i, /will close/i, /certain to/i, /promised/i];

export interface SalesInsight {
  metric_key: string; narrative: string; model: string | null;
  drivers: Array<{ label: string; value: string }>;
  suggested_actions: Array<{ text: string; action_key: string }>;
  cached: boolean;
}

const schema = z.object({
  narrative: z.string().min(1).max(1200),
  drivers: z.array(z.object({ label: z.string().max(80), value: z.string().max(80) })).max(6).default([]),
  suggested_actions: z.array(z.object({ text: z.string().max(120), action_key: z.string().max(40) })).max(4).default([]),
});

const SYSTEM = `You are the AI Sales analyst for iCapOS, commenting on internal sales-pipeline operating metrics (pipeline value, win rate, sales cycle, stalled deals, activity).
Rules you must never break:
- Comment only on internal sales activity. These are current metrics and trends, never guarantees. Never say "guaranteed", "will close", or "promised".
- You never mutate data. Suggested actions are navigation links only, chosen ONLY from: open_opportunities, open_pipeline, open_forecast, open_tasks, open_contacts.
Return STRICT JSON: {"narrative": string, "drivers": [{"label","value"}], "suggested_actions": [{"text","action_key"}]}. No prose outside JSON.`;

function stripFences(s: string): string { return s.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim(); }

function heuristic(metric: SalesMetric): SalesInsight {
  const trend = metric.series.length >= 2 ? metric.series[metric.series.length - 1] - metric.series[0] : 0;
  const dir = trend > 0 ? "trending up" : trend < 0 ? "trending down" : "flat";
  return {
    metric_key: metric.key,
    narrative: `${metric.label} is ${metric.value} (${metric.delta}), ${dir} over recent periods.${metric.note ? " " + metric.note : ""}`,
    model: null, drivers: metric.drivers, suggested_actions: [], cached: false,
  };
}

export async function getSalesAnalyticsInsight(metricKey: string, opts: { force?: boolean; createdBy?: string } = {}): Promise<SalesInsight> {
  const metric = await loadSalesMetric(metricKey);
  if (!metric) throw new Error("Unknown metric.");
  const facts = { label: metric.label, value: metric.value, delta: metric.delta, drivers: metric.drivers, series: metric.series, note: metric.note ?? null };
  const inputHash = crypto.createHash("sha256").update(JSON.stringify({ metricKey, facts })).digest("hex");

  if (!opts.force) {
    const { data } = await db().from("sales_analytics_insights")
      .select("narrative, model, drivers, suggested_actions, input_hash")
      .eq("metric_key", metricKey).eq("input_hash", inputHash)
      .order("generated_at", { ascending: false }).limit(1).maybeSingle();
    if (data) return { metric_key: metricKey, narrative: data.narrative, model: data.model, drivers: data.drivers ?? [], suggested_actions: data.suggested_actions ?? [], cached: true };
  }

  if (!isClaudeConfigured()) return heuristic(metric);

  let parsed: z.infer<typeof schema>;
  try {
    const raw = await claudeComplete(
      [{ role: "user", content: `Facts (JSON): ${JSON.stringify(facts)}\n\nWrite the insight for "${metric.label}".` }],
      { system: SYSTEM, model: CLAUDE_HAIKU, maxTokens: 450, temperature: 0.3 },
    );
    parsed = schema.parse(JSON.parse(stripFences(raw)));
  } catch {
    return heuristic(metric);
  }

  if (DENYLIST.some((re) => re.test(parsed.narrative))) return heuristic(metric);
  const actions = parsed.suggested_actions.filter((a) => ACTION_WHITELIST.has(a.action_key));

  await db().from("sales_analytics_insights").insert({
    metric_key: metricKey, input_hash: inputHash, model: CLAUDE_HAIKU,
    narrative: parsed.narrative, drivers: parsed.drivers, suggested_actions: actions, created_by: opts.createdBy ?? null,
  });

  return { metric_key: metricKey, narrative: parsed.narrative, model: CLAUDE_HAIKU, drivers: parsed.drivers, suggested_actions: actions, cached: false };
}
