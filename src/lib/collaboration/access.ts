import type { CollaborationEntityType, CollaborationThreadContext } from "@/lib/collaboration/types";
import { isStaffRole } from "@/lib/collaboration/visibility";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Profile } from "@/lib/supabase/types";

export async function resolveEntityAccess(
  supabase: SupabaseClient<Database>,
  profile: Profile,
  entityType: CollaborationEntityType,
  entityId: string,
): Promise<{ allowed: boolean; context: CollaborationThreadContext }> {
  const context: CollaborationThreadContext = {};

  if (isStaffRole(profile.role)) {
    await enrichContextFromEntity(supabase, entityType, entityId, context);
    return { allowed: true, context };
  }

  if (entityType === "company") {
    const { data: company } = await supabase
      .from("companies")
      .select("id, founder_id")
      .eq("id", entityId)
      .maybeSingle();
    if (profile.role === "founder" && company?.founder_id === profile.id) {
      context.companyId = company.id;
      return { allowed: true, context };
    }
    return { allowed: false, context };
  }

  if (entityType === "investor") {
    const { data: investor } = await supabase
      .from("investor_profiles")
      .select("id, profile_id")
      .eq("id", entityId)
      .maybeSingle();
    if (profile.role === "investor" && investor?.profile_id === profile.id) {
      context.investorProfileId = investor.id;
      return { allowed: true, context };
    }
    return { allowed: false, context };
  }

  if (entityType === "spv") {
    if (profile.role === "investor") {
      const { data: investor } = await supabase
        .from("investor_profiles")
        .select("id")
        .eq("profile_id", profile.id)
        .maybeSingle();
      if (!investor) return { allowed: false, context };
      const { data: participation } = await supabase
        .from("spv_participations")
        .select("id")
        .eq("spv_opportunity_id", entityId)
        .eq("investor_id", investor.id)
        .limit(1)
        .maybeSingle();
      if (participation) {
        context.spvId = entityId;
        context.investorProfileId = investor.id;
        return { allowed: true, context };
      }
    }
    if (profile.role === "founder") {
      const { data: spv } = await supabase
        .from("spv_opportunities")
        .select("id, company_id")
        .eq("id", entityId)
        .maybeSingle();
      if (!spv?.company_id) return { allowed: false, context };
      const { data: company } = await supabase
        .from("companies")
        .select("founder_id")
        .eq("id", spv.company_id)
        .maybeSingle();
      if (company?.founder_id === profile.id) {
        context.spvId = spv.id;
        context.companyId = spv.company_id;
        return { allowed: true, context };
      }
    }
    return { allowed: false, context };
  }

  if (entityType === "action") {
    const { data: action } = await supabase
      .from("next_best_actions")
      .select("id, user_id, company_id, investor_id, spv_id")
      .eq("id", entityId)
      .maybeSingle();
    if (!action) return { allowed: false, context };
    context.companyId = action.company_id;
    context.spvId = action.spv_id;
    if (action.user_id === profile.id) return { allowed: true, context };
    if (profile.role === "founder" && action.company_id) {
      const { data: company } = await supabase
        .from("companies")
        .select("founder_id")
        .eq("id", action.company_id)
        .maybeSingle();
      if (company?.founder_id === profile.id) {
        return { allowed: true, context };
      }
    }
    if (profile.role === "investor") {
      const { data: investor } = await supabase
        .from("investor_profiles")
        .select("id, profile_id")
        .eq("profile_id", profile.id)
        .maybeSingle();
      if (
        investor &&
        (action.investor_id === investor.id || action.investor_id === investor.profile_id)
      ) {
        context.investorProfileId = investor.id;
        return { allowed: true, context };
      }
    }
    return { allowed: false, context };
  }

  if (entityType === "queue") {
    return { allowed: false, context };
  }

  return { allowed: false, context };
}

async function enrichContextFromEntity(
  supabase: SupabaseClient<Database>,
  entityType: CollaborationEntityType,
  entityId: string,
  context: CollaborationThreadContext,
) {
  if (entityType === "company") {
    context.companyId = entityId;
    return;
  }
  if (entityType === "investor") {
    context.investorProfileId = entityId;
    return;
  }
  if (entityType === "spv") {
    context.spvId = entityId;
    const { data: spv } = await supabase
      .from("spv_opportunities")
      .select("company_id")
      .eq("id", entityId)
      .maybeSingle();
    context.companyId = spv?.company_id ?? null;
    return;
  }
  if (entityType === "action") {
    const { data: action } = await supabase
      .from("next_best_actions")
      .select("company_id, investor_id, spv_id")
      .eq("id", entityId)
      .maybeSingle();
    context.companyId = action?.company_id ?? null;
    context.investorProfileId = action?.investor_id ?? null;
    context.spvId = action?.spv_id ?? null;
    return;
  }
  if (entityType === "queue") {
    return;
  }
}
