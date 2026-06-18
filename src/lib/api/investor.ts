import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { canInvestorPerformSensitiveActions } from "@/lib/investor/access";
import { getInvestorProfileByProfileId } from "@/lib/investor/profile";
import type { Profile, UserRole } from "@/lib/supabase/types";
import { normalizeUserRole } from "@/lib/api/admin";

export async function requireInvestorApi(options?: { requireApproved?: boolean }) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: NextResponse.json({ error: "Sign in as an investor to perform this action." }, { status: 401 }) };
  }

  const { data: profileRaw, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, is_active, is_super_admin")
    .eq("id", user.id)
    .single();

  if (profileError || !profileRaw) {
    return { error: NextResponse.json({ error: "Profile not found." }, { status: 403 }) };
  }

  const role = normalizeUserRole(String(profileRaw.role));
  const profile = { ...profileRaw, role: role ?? (profileRaw.role as UserRole) } as Profile;

  if (role !== "investor") {
    return {
      error: NextResponse.json(
        { error: "Only investor accounts can perform this action. Founders cannot express interest on marketplace listings." },
        { status: 403 },
      ),
    };
  }

  const investorProfile = await getInvestorProfileByProfileId(profile.id);

  if (options?.requireApproved && !canInvestorPerformSensitiveActions(investorProfile?.approval_status)) {
    return {
      error: NextResponse.json(
        {
          error:
            "Your investor account is pending admin approval. Complete onboarding and wait for approval before performing this action.",
          code: "investor_pending_approval",
          approvalStatus: investorProfile?.approval_status ?? "draft",
        },
        { status: 403 },
      ),
    };
  }

  return {
    supabase,
    serviceSupabase: createServiceRoleClient(),
    profile,
    investorId: user.id,
    investorProfile,
  };
}

export async function requireInvestorApprovedApi() {
  return requireInvestorApi({ requireApproved: true });
}
