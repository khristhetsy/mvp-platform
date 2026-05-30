import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveSocialDraftComplianceStatus } from "@/lib/founder-crm/social-draft-compliance";
import type {
  SocialDraftComplianceStatus,
  SocialDraftPlatform,
  SocialDraftStatus,
  SocialDraftType,
  SocialOutreachDraftRecord,
} from "@/lib/founder-crm/types";
import type { Database } from "@/lib/supabase/types";

export async function listSocialOutreachDrafts(
  supabase: SupabaseClient<Database>,
  founderId: string,
  companyId: string,
) {
  const { data, error } = await supabase
    .from("social_outreach_drafts")
    .select("*")
    .eq("founder_id", founderId)
    .eq("company_id", companyId)
    .neq("status", "archived")
    .order("updated_at", { ascending: false });

  if (error) {
    return { error };
  }

  return { data: (data ?? []) as SocialOutreachDraftRecord[] };
}

export async function createSocialOutreachDraft(
  supabase: SupabaseClient<Database>,
  input: {
    founderId: string;
    companyId: string;
    campaignId?: string | null;
    draftType: SocialDraftType;
    platform: SocialDraftPlatform;
    title: string;
    body: string;
    complianceStatus?: SocialDraftComplianceStatus;
  },
) {
  const compliance_status =
    input.complianceStatus ?? resolveSocialDraftComplianceStatus(input.body);
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("social_outreach_drafts")
    .insert({
      founder_id: input.founderId,
      company_id: input.companyId,
      campaign_id: input.campaignId ?? null,
      draft_type: input.draftType,
      platform: input.platform,
      title: input.title.trim(),
      body: input.body.trim(),
      status: "draft",
      compliance_status,
      updated_at: now,
    })
    .select("*")
    .single();

  if (error) {
    return { error };
  }

  return { data: data as SocialOutreachDraftRecord };
}

export async function updateSocialOutreachDraft(
  supabase: SupabaseClient<Database>,
  input: {
    draftId: string;
    founderId: string;
    patch: Partial<{
      title: string;
      body: string;
      status: SocialDraftStatus;
      compliance_status: SocialDraftComplianceStatus;
      copied_at: string | null;
    }>;
  },
) {
  const patch = { ...input.patch, updated_at: new Date().toISOString() };

  if (input.patch.body !== undefined && input.patch.compliance_status === undefined) {
    patch.compliance_status = resolveSocialDraftComplianceStatus(input.patch.body);
  }

  const { data, error } = await supabase
    .from("social_outreach_drafts")
    .update(patch)
    .eq("id", input.draftId)
    .eq("founder_id", input.founderId)
    .select("*")
    .single();

  if (error) {
    return { error };
  }

  return { data: data as SocialOutreachDraftRecord };
}

export async function archiveSocialOutreachDraft(
  supabase: SupabaseClient<Database>,
  founderId: string,
  draftId: string,
) {
  return updateSocialOutreachDraft(supabase, {
    draftId,
    founderId,
    patch: { status: "archived" },
  });
}
