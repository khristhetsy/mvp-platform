import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { isTemplateAllowedForRole } from "@/lib/email/templates";
import type { EmailDraftRequest, EmailTemplateType } from "@/lib/email/types";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { Profile, UserRole } from "@/lib/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export type DraftEntityContext = {
  companyName: string | null;
  companyId: string | null;
  investorLabel: string | null;
  spvLabel: string | null;
  actionTitle: string | null;
  contactName: string | null;
};

export async function assertCanGenerateDraft(
  profile: Profile,
  request: EmailDraftRequest,
): Promise<
  | { ok: true; ctx: DraftEntityContext; entityType: string | null; entityId: string | null }
  | { ok: false; error: string }
> {
  const role = profile.role as UserRole;
  if (!isTemplateAllowedForRole(request.templateType, role)) {
    return { ok: false, error: "This template is not available for your role." };
  }

  const admin = createServiceRoleClient();
  const ctx: DraftEntityContext = {
    companyName: null,
    companyId: null,
    investorLabel: null,
    spvLabel: null,
    actionTitle: null,
    contactName: typeof request.context?.contactName === "string" ? request.context.contactName : null,
  };

  let entityType = request.entityType ?? null;
  let entityId = request.entityId ?? null;

  if (request.sourceActionId) {
    const { data: action } = await admin
      .from("next_best_actions")
      .select("title, user_id, role, company_id, entity_type, entity_id")
      .eq("id", request.sourceActionId)
      .maybeSingle();
    if (action) {
      if (role === "founder" && action.user_id && action.user_id !== profile.id) {
        return { ok: false, error: "Action is not in your workspace." };
      }
      ctx.actionTitle = action.title;
      if (action.company_id) ctx.companyId = action.company_id;
      if (!entityType && action.entity_type) entityType = action.entity_type;
      if (!entityId && action.entity_id) entityId = action.entity_id;
    }
  }

  if (role === "founder") {
    const company = await ensureFounderCompanyForUser(profile);
    if (!company) return { ok: false, error: "Link your company before drafting emails." };
    ctx.companyId = company.id;
    ctx.companyName = company.company_name ?? "Your company";

    if (entityType === "company" && entityId && entityId !== company.id) {
      return { ok: false, error: "You can only draft emails for your own company." };
    }
    entityId = entityId ?? company.id;
    entityType = entityType ?? "company";
  }

  if (role === "investor") {
    const investorId = profile.id;
    if (request.templateType === "investor_spv_requirement_reminder") {
      if (entityId) {
        const { data: part } = await admin
          .from("spv_participations")
          .select("id, investor_id")
          .eq("id", entityId)
          .maybeSingle();
        if (part && part.investor_id !== investorId) {
          return { ok: false, error: "SPV participation not in your workspace." };
        }
      }
    }
  }

  if (role === "admin" || role === "analyst") {
    await enrichAdminContext(admin, { entityType, entityId }, ctx);
  }

  if (entityType === "company" && entityId) {
    const { data: co } = await admin.from("companies").select("company_name").eq("id", entityId).maybeSingle();
    if (co) ctx.companyName = co.company_name;
    ctx.companyId = entityId;
  }

  return { ok: true, ctx, entityType, entityId };
}

async function enrichAdminContext(
  admin: SupabaseClient<Database>,
  request: { entityType: string | null; entityId: string | null },
  ctx: DraftEntityContext,
) {
  if (request.entityType === "investor" || request.entityType === "investor_profile") {
    const id = request.entityId;
    if (!id) return;
    const { data: inv } = await admin.from("investor_profiles").select("id").eq("id", id).maybeSingle();
    if (inv) ctx.investorLabel = "Investor profile";
  }
  if (request.entityType === "spv" || request.entityType === "spv_opportunity") {
    const id = request.entityId;
    if (!id) return;
    const { data: spv } = await admin.from("spv_opportunities").select("name").eq("id", id).maybeSingle();
    if (spv) ctx.spvLabel = spv.name;
  }
}
