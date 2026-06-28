import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

/** App-layer check mirroring RLS: approved investor with explicit company relationship. */
export async function investorHasCompanyDocumentAccess(
  supabase: SupabaseClient<Database>,
  userId: string,
  companyId: string,
): Promise<boolean> {
  const { data: investorProfile } = await supabase
    .from("investor_profiles")
    .select("id, approval_status, kyc_status")
    .eq("profile_id", userId)
    .maybeSingle();

  // Full data-room access requires both an approved profile and verified KYC.
  if (investorProfile?.approval_status !== "approved" || investorProfile?.kyc_status !== "verified") {
    return false;
  }

  const { data: company } = await supabase
    .from("companies")
    .select("review_status")
    .eq("id", companyId)
    .maybeSingle();

  if (company?.review_status !== "approved") {
    return false;
  }

  const relationshipChecks = await Promise.all([
    supabase.from("saved_deals").select("id").eq("investor_id", userId).eq("company_id", companyId).limit(1).maybeSingle(),
    supabase.from("intro_requests").select("id").eq("investor_id", userId).eq("company_id", companyId).limit(1).maybeSingle(),
    supabase.from("investor_interests").select("id").eq("investor_id", userId).eq("company_id", companyId).limit(1).maybeSingle(),
    supabase.from("deal_rooms").select("id").eq("investor_user_id", userId).eq("company_id", companyId).limit(1).maybeSingle(),
    supabase.from("spv_participations").select("id").eq("investor_id", userId).eq("company_id", companyId).limit(1).maybeSingle(),
  ]);

  return relationshipChecks.some((result) => Boolean(result.data));
}
