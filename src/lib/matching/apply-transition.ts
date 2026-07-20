import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { assertTransition, InvalidTransitionError, type Actor, type MatchStatus } from "./transitions";

type MatchRow = {
  id: string;
  status: MatchStatus;
  company_id: string;
  investor_profile_id: string;
};

export type TransitionResult = { ok: true } | { ok: false; error: string };

/**
 * Validate + apply a single match-status transition. Service-role only (RLS is
 * bypassed on purpose; the state machine is the guard). Ownership is enforced via
 * the caller-supplied `authorize` predicate. The UPDATE is a compare-and-swap on
 * the current status so concurrent transitions can't both win.
 */
export async function applyMatchTransition(params: {
  matchId: string;
  to: MatchStatus;
  by: Actor;
  // Required: ownership check so no caller can transition a match it doesn't own.
  authorize: (match: MatchRow) => boolean;
}): Promise<TransitionResult> {
  const db = createServiceRoleClient() as unknown as SupabaseClient;

  const { data } = await db
    .from("investor_founder_matches")
    .select("id, status, company_id, investor_profile_id")
    .eq("id", params.matchId)
    .maybeSingle();
  const match = data as MatchRow | null;
  if (!match) return { ok: false, error: "Match not found." };

  if (!params.authorize(match)) {
    return { ok: false, error: "You are not authorized to act on this match." };
  }

  try {
    assertTransition(match.status, params.to, params.by);
  } catch (e) {
    return { ok: false, error: e instanceof InvalidTransitionError ? e.message : "Invalid transition." };
  }

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status: params.to };
  if (params.to === "investor_interested" || params.to === "declined_by_investor") patch.investor_responded_at = now;
  if (params.to === "founder_approved" || params.to === "declined_by_founder") patch.founder_responded_at = now;
  if (params.to === "introduced") patch.introduced_at = now;

  const { data: updated, error } = await db
    .from("investor_founder_matches")
    .update(patch)
    .eq("id", params.matchId)
    .eq("status", match.status) // compare-and-swap
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!updated || updated.length === 0) {
    return { ok: false, error: "This match was just updated elsewhere. Refresh and try again." };
  }
  return { ok: true };
}

/** Resolve the investor_profiles.id for the current auth user (or null). */
export async function resolveInvestorProfileId(userId: string): Promise<string | null> {
  const db = createServiceRoleClient() as unknown as SupabaseClient;
  const { data } = await db.from("investor_profiles").select("id").eq("profile_id", userId).maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

/** Resolve the set of company ids owned by the current founder auth user. */
export async function resolveFounderCompanyIds(userId: string): Promise<string[]> {
  const db = createServiceRoleClient() as unknown as SupabaseClient;
  const { data } = await db.from("companies").select("id").eq("founder_id", userId);
  return ((data ?? []) as Array<{ id: string }>).map((r) => r.id);
}
