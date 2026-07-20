"use server";

import { requireApiProfile } from "@/lib/api/auth";
import { applyMatchTransition, resolveInvestorProfileId, type TransitionResult } from "@/lib/matching/apply-transition";
import { notifyFounderOfInterest } from "@/lib/matching/notify";

async function investorAuthorize(): Promise<{ investorProfileId: string } | { error: string }> {
  const auth = await requireApiProfile(["investor"]);
  if ("error" in auth) return { error: "Sign in as an investor to continue." };
  const investorProfileId = await resolveInvestorProfileId(auth.profile.id);
  if (!investorProfileId) return { error: "No investor profile found." };
  return { investorProfileId };
}

/** Investor expresses interest: investor_notified → investor_interested. */
export async function investorExpressInterest(matchId: string): Promise<TransitionResult> {
  const a = await investorAuthorize();
  if ("error" in a) return { ok: false, error: a.error };
  const res = await applyMatchTransition({
    matchId,
    to: "investor_interested",
    by: "investor",
    authorize: (m) => m.investor_profile_id === a.investorProfileId,
  });
  if (res.ok) await notifyFounderOfInterest(matchId);
  return res;
}

/** Investor declines: investor_notified → declined_by_investor (terminal). */
export async function investorDeclineMatch(matchId: string): Promise<TransitionResult> {
  const a = await investorAuthorize();
  if ("error" in a) return { ok: false, error: a.error };
  return applyMatchTransition({
    matchId,
    to: "declined_by_investor",
    by: "investor",
    authorize: (m) => m.investor_profile_id === a.investorProfileId,
  });
}
