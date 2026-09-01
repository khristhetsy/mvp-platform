/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient } from "@supabase/supabase-js";
import { PILLAR_WEIGHTS, type PillarWeights } from "./types";

export type { PillarWeights };
const KEYS: (keyof PillarWeights)[] = ["followThrough", "responsiveness", "credibility", "portfolioReadiness", "trackRecord"];

/** Coerce arbitrary input into a valid weights object (fractions summing to ~1). */
export function normalizeWeights(input: unknown): PillarWeights {
  const o = (input ?? {}) as Record<string, unknown>;
  const out = {} as PillarWeights;
  for (const k of KEYS) {
    const v = Number(o[k]);
    out[k] = Number.isFinite(v) && v >= 0 ? v : PILLAR_WEIGHTS[k];
  }
  return out;
}

/** True when the five weights sum to 1.0 (within a cent). */
export function weightsSumToOne(w: PillarWeights): boolean {
  return Math.abs(KEYS.reduce((a, k) => a + w[k], 0) - 1) < 0.01;
}

// A provenance bonus (0–100 points) added to a SEC Form D investor's score, capped
// at 100. Form D existence + filings are SEC-verified public record, so they earn
// credit even without on-platform activity. Tunable on the Scoring weights tab.
export const DEFAULT_SEC_FORMD_BONUS = 20;

export type RatingConfig = { weights: PillarWeights; secFormDBonus: number };

function readBonus(raw: unknown): number {
  const b = Number((raw as { secFormDBonus?: unknown } | null)?.secFormDBonus);
  return Number.isFinite(b) && b >= 0 ? Math.min(b, 100) : DEFAULT_SEC_FORMD_BONUS;
}

/** Stored pillar weights, or the code defaults when unset. */
export async function getStoredWeights(admin: SupabaseClient<any>): Promise<PillarWeights> {
  const { data } = await admin.from("partner_score_weights").select("weights").eq("id", "default").maybeSingle();
  const raw = (data as { weights?: unknown } | null)?.weights;
  return raw ? normalizeWeights(raw) : { ...PILLAR_WEIGHTS };
}

/** Full rating config: pillar weights + the SEC Form D bonus. */
export async function getRatingConfig(admin: SupabaseClient<any>): Promise<RatingConfig> {
  const { data } = await admin.from("partner_score_weights").select("weights").eq("id", "default").maybeSingle();
  const raw = (data as { weights?: unknown } | null)?.weights;
  return { weights: raw ? normalizeWeights(raw) : { ...PILLAR_WEIGHTS }, secFormDBonus: readBonus(raw) };
}

export async function saveStoredWeights(admin: SupabaseClient<any>, weights: PillarWeights, secFormDBonus: number, userId: string | null): Promise<void> {
  await admin.from("partner_score_weights").upsert(
    { id: "default", weights: { ...weights, secFormDBonus: Math.min(Math.max(secFormDBonus, 0), 100) }, updated_by: userId, updated_at: new Date().toISOString() },
    { onConflict: "id" },
  );
}
