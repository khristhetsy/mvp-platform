import { computeFounderOnboardingProgress } from "@/lib/onboarding/progress";
import { getFounderFeatureAccess } from "@/lib/subscriptions/founder-access";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Company } from "@/lib/supabase/types";

export type SocialOutreachReadinessResult = {
  allowed: boolean;
  requirements: Array<{ key: string; label: string; met: boolean; href?: string }>;
};

export async function evaluateSocialOutreachReadiness(company: Company): Promise<SocialOutreachReadinessResult> {
  const access = await getFounderFeatureAccess("investor_access");
  const supabase = await createServerSupabaseClient();

  const onboarding = computeFounderOnboardingProgress({
    company,
    documents: [],
    diligenceReportExists: false,
    storedStepState: company.onboarding_step_state,
  });

  const nameOk = company.company_name.trim().length > 0;
  const descriptionOk = (company.business_description?.trim().length ?? 0) >= 20;
  const profileOk = Boolean(company.industry?.trim() || company.revenue_stage?.trim());

  const requirements = [
    {
      key: "subscription",
      label: "Founder Professional plan or active trial",
      met: access.allowed,
      href: "/billing",
    },
    {
      key: "company_name",
      label: "Company name on profile",
      met: nameOk,
      href: "/founder/settings",
    },
    {
      key: "description",
      label: "Public company description (20+ characters)",
      met: descriptionOk,
      href: "/founder/settings",
    },
    {
      key: "profile",
      label: "Industry or revenue stage set",
      met: profileOk,
      href: "/founder/settings",
    },
    {
      key: "onboarding_started",
      label: "Onboarding started",
      met: onboarding.percent > 0,
      href: "/founder/onboarding",
    },
  ];

  return {
    allowed: access.allowed && requirements.every((row) => row.met),
    requirements,
  };
}
