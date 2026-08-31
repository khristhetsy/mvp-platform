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

/** Stored weights, or the code defaults when unset. */
export async function getStoredWeights(admin: SupabaseClient<any>): Promise<PillarWeights> {
  const { data } = await admin.from("partner_score_weights").select("weights").eq("id", "default").maybeSingle();
  const raw = (data as { weights?: unknown } | null)?.weights;
  return raw ? normalizeWeights(raw) : { ...PILLAR_WEIGHTS };
}

export async function saveStoredWeights(admin: SupabaseClient<any>, weights: PillarWeights, userId: string | null): Promise<void> {
  await admin.from("partner_score_weights").upsert(
    { id: "default", weights, updated_by: userId, updated_at: new Date().toISOString() },
    { onConflict: "id" },
  );
}
