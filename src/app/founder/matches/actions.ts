"use server";

import { requireApiProfile } from "@/lib/api/auth";
import { applyMatchTransition, resolveFounderCompanyIds, type TransitionResult } from "@/lib/matching/apply-transition";
import { notifyInvestorIntroduced } from "@/lib/matching/notify";

async function founderAuthorize(): Promise<{ companyIds: string[] } | { error: string }> {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return { error: "Sign in as a founder to continue." };
  const companyIds = await resolveFounderCompanyIds(auth.profile.id);
  if (companyIds.length === 0) return { error: "No company profile found." };
  return { companyIds };
}

/**
 * Founder approves the interested investor. Two-step: investor_interested →
 * founder_approved (by founder), then founder_approved → introduced (by system),
 * which unlocks the investor's read access to the company (RLS on 'introduced').
 */
export async function founderApproveMatch(matchId: string): Promise<TransitionResult> {
  const a = await founderAuthorize();
  if ("error" in a) return { ok: false, error: a.error };
  const authorize = (m: { company_id: string }) => a.companyIds.includes(m.company_id);

  const approved = await applyMatchTransition({ matchId, to: "founder_approved", by: "founder", authorize });
  if (!approved.ok) return approved;

  // Create the introduction immediately (server-driven system transition).
  const introduced = await applyMatchTransition({ matchId, to: "introduced", by: "system", authorize });
  if (introduced.ok) await notifyInvestorIntroduced(matchId);
  return introduced;
}

/** Founder declines: investor_interested → declined_by_founder (terminal). */
export async function founderDeclineMatch(matchId: string): Promise<TransitionResult> {
  const a = await founderAuthorize();
  if ("error" in a) return { ok: false, error: a.error };
  return applyMatchTransition({
    matchId,
    to: "declined_by_founder",
    by: "founder",
    authorize: (m) => a.companyIds.includes(m.company_id),
  });
}
