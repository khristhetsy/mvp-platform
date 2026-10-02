/**
 * /fit A/B test: which flow a funnel session sees.
 *
 * "v1" is the current five-question flow, kept byte-for-byte as the control arm.
 * "v2" is the Match Review flow (four questions, gated top 5, inline booking).
 *
 * Bucketing is deterministic on the fs_session id, so a visitor never flips
 * between flows on reload. The same rule can be reproduced in SQL for analysis:
 *   ('x' || substr(replace(id::text, '-', ''), 1, 8))::bit(32)::bigint % 100 < pct
 * The assignment is also written to funnel_events ("fit_variant") at session
 * creation, so the split survives a later change to the rollout percentage.
 */

export type FitVariant = "v1" | "v2";

/** platform_settings key holding `{ pct }` (0–100) for the v2 share. */
export const FIT_V2_ROLLOUT_KEY = "fit_v2_rollout";

/** Share of new sessions bucketed into v2 when no setting row exists. */
export const FIT_V2_DEFAULT_PCT = 50;

/** 0–99 bucket from the first 32 bits of a uuid. Null for a malformed id. */
export function bucketOf(sessionId: string): number | null {
  const hex = sessionId.replace(/-/g, "").slice(0, 8);
  if (!/^[0-9a-f]{8}$/i.test(hex)) return null;
  return parseInt(hex, 16) % 100;
}

/** Variant for a session given the rollout share. A malformed id stays on v1. */
export function variantFor(sessionId: string, pct: number): FitVariant {
  const b = bucketOf(sessionId);
  if (b === null) return "v1";
  return b < Math.max(0, Math.min(100, pct)) ? "v2" : "v1";
}

/** `?v=1` / `?v=2` forces a flow (previews and QA). Anything else is ignored. */
export function forcedVariant(value: unknown): FitVariant | null {
  if (value === "1" || value === "v1") return "v1";
  if (value === "2" || value === "v2") return "v2";
  return null;
}
