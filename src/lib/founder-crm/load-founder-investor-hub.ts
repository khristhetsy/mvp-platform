import { listFounderInvestorContacts } from "@/lib/founder-crm/contacts";
import { evaluateFounderOutreachReadiness } from "@/lib/founder-crm/outreach-readiness";
import {
  listFollowUpDueContacts,
  listOutreachCampaigns,
  listOutreachTargetsEnriched,
} from "@/lib/founder-crm/outreach";
import { loadFounderPlatformInvestorMatches } from "@/lib/founder-crm/platform-matches";
import { evaluateSocialOutreachReadiness } from "@/lib/founder-crm/social-outreach-readiness";
import { listSocialOutreachDrafts } from "@/lib/founder-crm/social-outreach-drafts";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Company } from "@/lib/supabase/types";

export async function loadFounderInvestorHub(company: Company, founderId: string) {
  const supabase = await createServerSupabaseClient();

  const [contacts, campaigns, readiness, platformMatches, followUps, socialDrafts, socialReadiness] =
    await Promise.all([
      listFounderInvestorContacts(supabase, founderId, company.id),
      listOutreachCampaigns(supabase, founderId, company.id),
      evaluateFounderOutreachReadiness(company, founderId),
      loadFounderPlatformInvestorMatches(company, 12),
      listFollowUpDueContacts(supabase, founderId, company.id),
      listSocialOutreachDrafts(supabase, founderId, company.id),
      evaluateSocialOutreachReadiness(company),
    ]);

  const platformLabels = new Map(
    (platformMatches ?? []).map((row) => [
      row.platformInvestorId,
      { label: row.label, matchScore: row.matchScore },
    ]),
  );

  const targets = await listOutreachTargetsEnriched(
    supabase,
    founderId,
    company.id,
    platformLabels,
  );

  return {
    contacts: contacts.data ?? [],
    targets: targets.data ?? [],
    campaigns: campaigns.data ?? [],
    readiness,
    platformMatches,
    followUpCount: followUps.data?.length ?? 0,
    socialDrafts: socialDrafts.data ?? [],
    socialReadiness,
  };
}
