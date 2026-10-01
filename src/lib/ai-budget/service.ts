// AI budget enforcement and spend logging. Server only; edge-safe (no Node APIs),
// so the edge public chat route can use it directly.
//
// Flow for every paid call:
//   1. assertAiBudget(category, reserveUsd) before the call. Blocks when month to
//      date spend plus this call's worst case would pass the category budget.
//   2. recordAiSpend(...) after the call with the actual cost.
// Alert emails are sent by the ai-budget-alerts cron (./alerts), kept out of this
// module so client components that reach it for a constant still bundle.
// Failures to read or write the budget tables never block a call: the meter is
// best-effort, the vendor-side spend limit is the backstop.
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { AI_BUDGET_CATEGORIES, CATEGORY_LABELS, type AiBudgetCategory } from "./config";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any;
// ai_* budget tables aren't in the generated types yet.
const db = (): Raw => createServiceRoleClient() as Raw;

export class AiBudgetExceededError extends Error {
  readonly category: AiBudgetCategory;
  readonly status = 429;
  constructor(category: AiBudgetCategory) {
    super(`The monthly AI budget for ${CATEGORY_LABELS[category]} is used up. It resets on the 1st of next month.`);
    this.name = "AiBudgetExceededError";
    this.category = category;
  }
}

export function isAiBudgetExceeded(e: unknown): e is AiBudgetExceededError {
  return e instanceof Error && e.name === "AiBudgetExceededError";
}

export function isAiBudgetCategory(v: unknown): v is AiBudgetCategory {
  return typeof v === "string" && (AI_BUDGET_CATEGORIES as readonly string[]).includes(v);
}

async function budgetFor(category: AiBudgetCategory): Promise<number | null> {
  const { data, error } = await db().from("ai_budgets").select("monthly_usd").eq("category", category).maybeSingle();
  if (error || !data) return null; // no row or table missing: unmetered, never block
  return Number(data.monthly_usd);
}

async function spentThisMonth(category: AiBudgetCategory): Promise<number | null> {
  const { data, error } = await db().rpc("ai_spend_month", { p_category: category });
  if (error) return null;
  return Number(data ?? 0);
}

/**
 * Throws AiBudgetExceededError when spend + reserveUsd would pass the budget.
 * reserveUsd is the call's worst case (max output tokens at list price), so two
 * calls landing together can overshoot by at most one call's reserve.
 */
export async function assertAiBudget(category: AiBudgetCategory, reserveUsd = 0): Promise<void> {
  try {
    const [budget, spent] = await Promise.all([budgetFor(category), spentThisMonth(category)]);
    if (budget == null || spent == null) return;
    if (spent + reserveUsd > budget) throw new AiBudgetExceededError(category);
  } catch (e) {
    if (isAiBudgetExceeded(e)) throw e;
    console.error("[ai-budget] budget check failed, allowing call:", e instanceof Error ? e.message : e);
  }
}

export async function recordAiSpend(row: {
  vendor: "anthropic" | "serper" | "vapi";
  category: AiBudgetCategory;
  feature: string;
  model?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  units?: number | null;
  costUsd: number;
  profileId?: string | null;
  path?: string | null;
}): Promise<void> {
  try {
    const { error } = await db().from("ai_spend_events").insert({
      vendor: row.vendor,
      category: row.category,
      feature: row.feature,
      model: row.model ?? null,
      input_tokens: row.inputTokens ?? null,
      output_tokens: row.outputTokens ?? null,
      units: row.units ?? null,
      cost_usd: Math.round(row.costUsd * 1_000_000) / 1_000_000,
      profile_id: row.profileId ?? null,
      path: row.path ?? null,
    });
    if (error) throw error;
  } catch (e) {
    console.error("[ai-budget] spend log failed:", e instanceof Error ? e.message : e);
  }
}

type StatusRow = { category: string; monthly_usd: number | string; spent_usd: number | string; calls: number | string };

export async function getAiBudgetStatus(): Promise<StatusRow[]> {
  const { data, error } = await db().rpc("ai_budget_status");
  if (error) throw new Error(error.message);
  return (data ?? []) as StatusRow[];
}
