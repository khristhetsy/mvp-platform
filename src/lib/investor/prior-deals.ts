import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { InvestorPriorDealRecord } from "@/lib/investor/types";

export async function listPriorDeals(investorProfileId: string): Promise<InvestorPriorDealRecord[]> {
  const admin = createServiceRoleClient();
  const { data, error } = await admin
    .from("investor_prior_deals")
    .select("*")
    .eq("investor_profile_id", investorProfileId)
    .order("year", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Failed to list prior deals: ${error.message}`);
  return (data ?? []) as InvestorPriorDealRecord[];
}

export async function addPriorDeal(input: {
  investorProfileId: string;
  companyName: string;
  stage: string | null;
  year: number | null;
  amount: number | null;
}): Promise<InvestorPriorDealRecord> {
  const admin = createServiceRoleClient();
  const { data, error } = await admin
    .from("investor_prior_deals")
    .insert({
      investor_profile_id: input.investorProfileId,
      company_name: input.companyName.trim(),
      stage: input.stage?.trim() || null,
      year: input.year,
      amount: input.amount,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to add deal.");
  return data as InvestorPriorDealRecord;
}

/** Delete a deal — only if it belongs to this investor (defense in depth). */
export async function deletePriorDeal(investorProfileId: string, dealId: string): Promise<void> {
  const admin = createServiceRoleClient();
  const { error } = await admin
    .from("investor_prior_deals")
    .delete()
    .eq("id", dealId)
    .eq("investor_profile_id", investorProfileId);
  if (error) throw new Error(error.message);
}

/** Attach an uploaded proof document to a deal (resets verification — proof changed). */
export async function attachDealProof(
  investorProfileId: string,
  dealId: string,
  proofDocumentId: string,
): Promise<void> {
  const admin = createServiceRoleClient();
  const { error } = await admin
    .from("investor_prior_deals")
    .update({ proof_document_id: proofDocumentId, verified: false, verified_at: null, verified_by: null })
    .eq("id", dealId)
    .eq("investor_profile_id", investorProfileId);
  if (error) throw new Error(error.message);
}

/** Admin marks a single deal verified / unverified. */
export async function setPriorDealVerified(
  dealId: string,
  verified: boolean,
  adminId: string,
): Promise<InvestorPriorDealRecord> {
  const admin = createServiceRoleClient();
  const { data, error } = await admin
    .from("investor_prior_deals")
    .update({
      verified,
      verified_at: verified ? new Date().toISOString() : null,
      verified_by: verified ? adminId : null,
    })
    .eq("id", dealId)
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to update deal verification.");
  return data as InvestorPriorDealRecord;
}

/** Count of verified prior deals — feeds the Partner Score track record. */
export async function countVerifiedPriorDeals(investorProfileId: string): Promise<number> {
  const admin = createServiceRoleClient();
  const { count, error } = await admin
    .from("investor_prior_deals")
    .select("id", { count: "exact", head: true })
    .eq("investor_profile_id", investorProfileId)
    .eq("verified", true);
  if (error) throw new Error(error.message);
  return count ?? 0;
}
