import { listFounderInvestorContacts } from "@/lib/founder-crm/contacts";
import { evaluateFounderOutreachReadiness } from "@/lib/founder-crm/outreach-readiness";
import {
  listFollowUpDueContacts,
  listOutreachCampaigns,
  listOutreachTargets,
} from "@/lib/founder-crm/outreach";
import { loadFounderPlatformInvestorMatches } from "@/lib/founder-crm/platform-matches";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Company } from "@/lib/supabase/types";

export async function loadFounderInvestorHub(company: Company, founderId: string) {
  const supabase = await createServerSupabaseClient();

  const [contacts, targets, campaigns, readiness, platformMatches, followUps] = await Promise.all([
    listFounderInvestorContacts(supabase, founderId, company.id),
    listOutreachTargets(supabase, founderId, company.id),
    listOutreachCampaigns(supabase, founderId, company.id),
    evaluateFounderOutreachReadiness(company, founderId),
    loadFounderPlatformInvestorMatches(company, 6),
    listFollowUpDueContacts(supabase, founderId, company.id),
  ]);

  return {
    contacts: contacts.data ?? [],
    targets: targets.data ?? [],
    campaigns: campaigns.data ?? [],
    readiness,
    platformMatches,
    followUpCount: followUps.data?.length ?? 0,
  };
}
