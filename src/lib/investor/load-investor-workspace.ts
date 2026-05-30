import { getInvestorProfileByProfileId } from "@/lib/investor/profile";
import type { Profile } from "@/lib/supabase/types";

export async function loadInvestorWorkspaceContext(profile: Profile) {
  const investorProfile = await getInvestorProfileByProfileId(profile.id);

  return {
    investorProfile,
    isApproved: investorProfile?.approval_status === "approved",
  };
}
