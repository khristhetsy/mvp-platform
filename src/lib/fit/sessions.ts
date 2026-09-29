/**
 * /fit funnel session store. Service-role only. A session is created on landing
 * (before any answer), updated per answer with the last_step + criteria, stamped
 * with the match snapshot, and optionally an email on capture. No PII gate — these
 * are anonymous funnel diagnostics until an email is left.
 */

import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { MatchResult } from "@/lib/fit/match-investors";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return createServiceRoleClient(); }

const TABLE = "fit_sessions";

/** Create a session on landing. Attribution tag captured once, here. */
export async function createSession(sourceTag: string | null): Promise<string | null> {
  const { data, error } = await db()
    .from(TABLE)
    .insert({ source_tag: sourceTag || "direct", last_step: 0 })
    .select("id")
    .single();
  if (error || !data) return null;
  return String(data.id);
}

type StepPatch = {
  last_step?: number;
  stage?: string;
  raise?: string;
  industry?: string;
  revenue?: string;
};

/** Update the session as the founder answers. No-op without a valid id. */
export async function updateSession(id: string, patch: StepPatch): Promise<void> {
  if (!id) return;
  await db().from(TABLE).update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
}

/** Stamp the exact match list the founder was shown (acceptance §11.8). */
export async function setSnapshot(id: string, matchedCount: number, snapshot: MatchResult[]): Promise<void> {
  if (!id) return;
  await db().from(TABLE).update({
    last_step: 5,
    matched_count: matchedCount,
    match_snapshot: snapshot,
    updated_at: new Date().toISOString(),
  }).eq("id", id);
}

/** Attach an email on capture (nurture list keyed to the four criteria). */
export async function captureEmail(id: string, email: string): Promise<void> {
  if (!id || !email.trim()) return;
  await db().from(TABLE).update({ email: email.trim().toLowerCase(), updated_at: new Date().toISOString() }).eq("id", id);
}
