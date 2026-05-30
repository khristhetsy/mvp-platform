import { ensureMessageThread } from "@/lib/messaging/threads";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Company, Database } from "@/lib/supabase/types";

export async function assertApprovedPlatformInvestor(platformInvestorId: string) {
  const admin = createServiceRoleClient();
  const { data, error } = await admin
    .from("investor_profiles")
    .select("profile_id")
    .eq("profile_id", platformInvestorId)
    .eq("approval_status", "approved")
    .maybeSingle();

  if (error) {
    return { error };
  }

  if (!data) {
    return { error: new Error("Platform investor is not available for intro requests.") };
  }

  return { ok: true as const };
}

export async function requestFounderPlatformIntro(
  _supabase: SupabaseClient<Database>,
  input: {
    company: Company;
    founderId: string;
    platformInvestorId: string;
    message?: string | null;
  },
) {
  const approved = await assertApprovedPlatformInvestor(input.platformInvestorId);
  if (approved.error) {
    return { error: approved.error };
  }

  const serviceSupabase = createServiceRoleClient();
  const body =
    input.message?.trim() ||
    `I'd like to request an introduction regarding ${input.company.company_name}.`;

  return ensureMessageThread(serviceSupabase, {
    companyId: input.company.id,
    founderId: input.founderId,
    investorId: input.platformInvestorId,
    createdBy: input.founderId,
    introRequestId: null,
    initialMessageType: "intro_request",
    initialBody: body,
  });
}
