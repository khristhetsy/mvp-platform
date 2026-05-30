import type { SocialDraftPlatform, SocialDraftType } from "@/lib/founder-crm/types";
import type { Company } from "@/lib/supabase/types";

export type SocialDraftContext = {
  company: Company;
  readinessScore: number | null;
  onboardingPercent: number;
  isPublished: boolean;
  remediationOpenCount: number;
  campaignName?: string | null;
  platform: SocialDraftPlatform;
};

function formatRaise(company: Company) {
  if (company.funding_amount == null) {
    return "our current capital raise";
  }
  return `$${Number(company.funding_amount).toLocaleString("en-US")}`;
}

function platformHint(platform: SocialDraftPlatform) {
  if (platform === "x_twitter") {
    return "Keep concise for X — review length before posting.";
  }
  if (platform === "linkedin") {
    return "Formatted for LinkedIn visibility — review before posting.";
  }
  return "Review before posting on your chosen channel.";
}

export function generateSocialOutreachDraft(input: {
  draftType: SocialDraftType;
  context: SocialDraftContext;
}) {
  const { company, readinessScore, onboardingPercent, isPublished, remediationOpenCount, campaignName } =
    input.context;
  const name = company.company_name;
  const industry = company.industry ?? "our industry";
  const stage = company.revenue_stage ?? "growth stage";
  const raise = formatRaise(company);
  const readinessLine =
    readinessScore != null ? `Institutional readiness score: ${readinessScore}/100.` : "";
  const onboardingLine = `Onboarding progress: ${onboardingPercent}%.`;
  const publishedLine = isPublished
    ? `${name} is published on CapitalOS for qualified investor discovery.`
    : `${name} is preparing for qualified investor visibility on CapitalOS.`;
  const remediationLine =
    remediationOpenCount > 0
      ? `We are actively addressing ${remediationOpenCount} readiness item(s).`
      : "Readiness remediation items are on track.";
  const campaignLine = campaignName ? `Campaign context: ${campaignName}.` : "";
  const hint = platformHint(input.context.platform);

  switch (input.draftType) {
    case "linkedin_campaign_announcement":
      return {
        title: `${name} — investor visibility update`,
        body: `We're sharing a disciplined update on ${name} (${industry}, ${stage}).

${publishedLine}
${onboardingLine}
${readinessLine ? `${readinessLine}\n` : ""}${remediationLine}
${campaignLine}

We welcome thoughtful conversations with aligned investors. ${hint}

#founders #venture #capitalraising`,
      };
    case "investor_update":
      return {
        title: `Investor update — ${name}`,
        body: `Investor update for ${name}:

• Sector: ${industry}
• Stage: ${stage}
• Raise focus: ${raise}
${readinessLine ? `• ${readinessLine}` : ""}
• ${remediationLine}

This update uses approved public information only. ${hint}`,
      };
    case "readiness_milestone":
      return {
        title: `Readiness milestone — ${name}`,
        body: `${name} reached a readiness milestone on CapitalOS.

${onboardingLine}
${readinessLine ? `${readinessLine}\n` : ""}${remediationLine}

We continue strengthening materials for institutional conversations. ${hint}`,
      };
    case "traction_update":
      return {
        title: `Traction update — ${name}`,
        body: `Traction update from ${name} (${industry}):

We're advancing product, customer, and operational milestones while maintaining fundraising discipline (${raise}).

${publishedLine}
${hint}`,
      };
    case "fundraising_update":
      return {
        title: `Fundraising update — ${name}`,
        body: `Fundraising update — ${name} is engaging aligned investors for ${raise} at ${stage}.

${readinessLine ? `${readinessLine}\n` : ""}${onboardingLine}
${campaignLine}

We share only public, non-confidential information. ${hint}`,
      };
    case "thought_leadership":
      return {
        title: `Perspective — building ${name}`,
        body: `Perspective from building ${name} in ${industry}:

Institutional fundraising is a readiness exercise—not a volume game. We're focused on ${stage} fit, clear narrative, and ${raise} alignment.

${readinessLine ? `${readinessLine}\n` : ""}${hint}`,
      };
    case "follow_up_post":
      return {
        title: `Follow-up — ${name}`,
        body: `Following up on ${name}'s investor outreach narrative.

${campaignLine || `We remain focused on ${raise} and thoughtful investor conversations.`}
${remediationLine}

Thank you to everyone engaging with our public updates. ${hint}`,
      };
  }
}
