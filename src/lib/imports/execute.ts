import type { SupabaseClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";
import { findExistingMatch, resolveFounderCompanyIds, type ImportContextIndex } from "@/lib/imports/dedupe";
import type { ImportType, ValidatedImportRow } from "@/lib/imports/types";
import { parseListField, parseNumeric } from "@/lib/imports/validators";
import { ensureProfileForUser } from "@/lib/onboarding/ensure-founder-setup";
import { ensureInvestorProfileForUser } from "@/lib/investor/profile";
import { parseCommaList } from "@/lib/investor/profile";

export type DuplicateBehavior = "skip" | "update";

export type ImportExecutionResult = {
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  rowResults: Array<{
    rowNumber: number;
    status: "created" | "updated" | "skipped" | "failed";
    entityType?: string;
    entityId?: string;
    error?: string;
  }>;
};

function appendImportNotes(base: string | null | undefined, notes: string | undefined, tags: string | undefined) {
  const parts = [base?.trim() ?? ""];
  if (notes?.trim()) parts.push(`[Import note] ${notes.trim()}`);
  if (tags?.trim()) parts.push(`[Import tags] ${tags.trim()}`);
  const merged = parts.filter(Boolean).join("\n\n");
  return merged || null;
}

async function resolveEntityForSocialOrCrm(
  supabase: SupabaseClient,
  mapped: Record<string, string>,
  context: ImportContextIndex,
): Promise<{ entityType: string; entityId: string; table: string } | null> {
  const entityType = mapped.entity_type?.trim().toLowerCase();
  const identifier = mapped.entity_email_or_name?.trim().toLowerCase();
  if (!entityType || !identifier) return null;

  if (entityType === "company") {
    const founderId = context.founderEmails.get(identifier);
    if (founderId) {
      const companyId = [...context.companyByNameFounder.entries()].find(([key]) =>
        key.endsWith(`::${founderId}`),
      )?.[1];
      if (companyId) return { entityType: "company", entityId: companyId, table: "companies" };
    }
    const companyEntry = [...context.companyByNameFounder.entries()].find(([key]) =>
      key.startsWith(`${identifier}::`),
    );
    if (companyEntry) {
      return { entityType: "company", entityId: companyEntry[1], table: "companies" };
    }
  }

  if (entityType === "investor") {
    const byEmail = context.investorByEmail.get(identifier);
    if (byEmail) {
      return { entityType: "investor_profile", entityId: byEmail.investorProfileId, table: "investor_profiles" };
    }
  }

  if (entityType === "founder_contact") {
    for (const [key, id] of context.founderContactKeys.entries()) {
      if (key.endsWith(`::${identifier}`) || key.includes(`::${identifier}`)) {
        return { entityType: "founder_investor_contact", entityId: id, table: "founder_investor_contacts" };
      }
    }
  }

  return null;
}

async function importCompanyRow(
  supabase: SupabaseClient,
  mapped: Record<string, string>,
  context: ImportContextIndex,
  duplicateBehavior: DuplicateBehavior,
) {
  const founderEmail = mapped.founder_email.trim().toLowerCase();
  const founderId = context.founderEmails.get(founderEmail);
  if (!founderId) throw new Error("Founder not found");

  const existing = findExistingMatch("companies", mapped, context);
  const payload = {
    founder_id: founderId,
    company_name: mapped.company_name.trim(),
    website: mapped.website?.trim() || null,
    industry: mapped.industry?.trim() || null,
    country: mapped.country?.trim() || null,
    state: mapped.state?.trim() || null,
    funding_amount: parseNumeric(mapped.funding_amount ?? ""),
    revenue_stage: mapped.revenue_stage?.trim() || null,
    business_description: appendImportNotes(mapped.business_description, mapped.notes, mapped.tags),
    review_status: "pending",
    is_published: false,
    marketplace_visible: false,
    status: "draft",
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    if (duplicateBehavior === "skip") {
      return { action: "skipped" as const, entityType: "company", entityId: existing.entityId };
    }
    const { review_status: _rs, is_published: _ip, marketplace_visible: _mv, status: _st, ...updateFields } = payload;
    const { data, error } = await supabase
      .from("companies")
      .update(updateFields)
      .eq("id", existing.entityId)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { action: "updated" as const, entityType: "company", entityId: data.id };
  }

  const { data, error } = await supabase.from("companies").insert(payload).select("id").single();
  if (error) throw new Error(error.message);

  await supabase.from("admin_reviews").insert({
    company_id: data.id,
    founder_id: founderId,
    status: "pending",
  });

  return { action: "created" as const, entityType: "company", entityId: data.id };
}

async function importInvestorRow(
  supabase: SupabaseClient,
  mapped: Record<string, string>,
  context: ImportContextIndex,
  duplicateBehavior: DuplicateBehavior,
) {
  const email = mapped.email.trim().toLowerCase();
  let profileId = context.investorByEmail.get(email)?.profileId;

  if (!profileId) {
    const tempPassword = randomBytes(24).toString("hex");
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: mapped.full_name.trim(), role: "investor" },
    });
    if (authError || !authData.user) {
      throw new Error(authError?.message ?? "Unable to create investor user");
    }
    const profile = await ensureProfileForUser({
      userId: authData.user.id,
      email,
      fullName: mapped.full_name.trim(),
      role: "investor",
    });
    profileId = profile.id;
  } else {
    await supabase.from("profiles").update({ full_name: mapped.full_name.trim() }).eq("id", profileId);
  }

  await ensureInvestorProfileForUser(profileId);
  const existing = findExistingMatch("investors", mapped, context);

  const investorPayload = {
    investor_type: mapped.investor_type?.trim() || null,
    firm_name: mapped.firm_name?.trim() || null,
    check_size_min: parseNumeric(mapped.check_size_min ?? ""),
    check_size_max: parseNumeric(mapped.check_size_max ?? ""),
    preferred_sectors: parseCommaList(mapped.preferred_sectors ?? ""),
    preferred_stages: parseCommaList(mapped.preferred_stages ?? ""),
    preferred_geographies: parseCommaList(mapped.preferred_geographies ?? ""),
    accredited_status: ["yes", "true", "accredited"].includes(
      (mapped.accredited_status ?? "").trim().toLowerCase(),
    ),
    investment_thesis: mapped.investment_thesis?.trim() || null,
    contact_preference: mapped.contact_preference?.trim() || null,
    approval_status: "submitted",
    submitted_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (existing && duplicateBehavior === "skip") {
    return { action: "skipped" as const, entityType: "investor_profile", entityId: existing.entityId };
  }

  const { approval_status: _as, submitted_at: _sa, ...safeUpdateFields } = investorPayload;
  const updatePayload = existing
    ? safeUpdateFields
    : investorPayload;

  const { data, error } = await supabase
    .from("investor_profiles")
    .update(updatePayload)
    .eq("profile_id", profileId)
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return {
    action: existing ? ("updated" as const) : ("created" as const),
    entityType: "investor_profile",
    entityId: data.id,
  };
}

async function importFounderContactRow(
  supabase: SupabaseClient,
  mapped: Record<string, string>,
  context: ImportContextIndex,
  duplicateBehavior: DuplicateBehavior,
) {
  const ids = resolveFounderCompanyIds(mapped, context);
  if (!ids) throw new Error("Founder/company not found");

  const existing = findExistingMatch("founder_contacts", mapped, context);
  const payload = {
    founder_id: ids.founderId,
    company_id: ids.companyId,
    investor_name: mapped.investor_name.trim(),
    firm_name: mapped.firm_name?.trim() || null,
    email: mapped.email?.trim().toLowerCase() || null,
    phone: mapped.phone?.trim() || null,
    website: mapped.website?.trim() || null,
    investor_type: mapped.investor_type?.trim() || null,
    preferred_sectors: mapped.preferred_sectors?.trim() || null,
    preferred_stages: mapped.preferred_stages?.trim() || null,
    check_size_min: parseNumeric(mapped.check_size_min ?? ""),
    check_size_max: parseNumeric(mapped.check_size_max ?? ""),
    geography: mapped.geography?.trim() || null,
    source: mapped.source?.trim() || "admin_import",
    tags: parseListField(mapped.tags ?? ""),
    notes: mapped.notes?.trim() || null,
    linkedin_url: mapped.linkedin_url?.trim() || null,
    twitter_url: mapped.twitter_url?.trim() || null,
    crunchbase_url: mapped.crunchbase_url?.trim() || null,
    personal_website_url: mapped.personal_website_url?.trim() || null,
    other_social_url: mapped.other_social_url?.trim() || null,
    status: "new",
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    if (duplicateBehavior === "skip") {
      return { action: "skipped" as const, entityType: "founder_investor_contact", entityId: existing.entityId };
    }
    const { data, error } = await supabase
      .from("founder_investor_contacts")
      .update(payload)
      .eq("id", existing.entityId)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { action: "updated" as const, entityType: "founder_investor_contact", entityId: data.id };
  }

  const { data, error } = await supabase.from("founder_investor_contacts").insert(payload).select("id").single();
  if (error) throw new Error(error.message);
  return { action: "created" as const, entityType: "founder_investor_contact", entityId: data.id };
}

async function importSocialLinksRow(
  supabase: SupabaseClient,
  mapped: Record<string, string>,
  context: ImportContextIndex,
) {
  const entity = await resolveEntityForSocialOrCrm(supabase, mapped, context);
  if (!entity) throw new Error("Entity not found");

  if (entity.table === "companies") {
    const { data: existing } = await supabase
      .from("companies")
      .select("onboarding_step_state")
      .eq("id", entity.entityId)
      .single();
    const state = (existing?.onboarding_step_state as Record<string, unknown> | null) ?? {};
    const socialLinks = {
      linkedin_url: mapped.linkedin_url?.trim() || null,
      twitter_url: mapped.twitter_url?.trim() || null,
      crunchbase_url: mapped.crunchbase_url?.trim() || null,
      website: mapped.website?.trim() || null,
      personal_website_url: mapped.personal_website_url?.trim() || null,
      other_social_url: mapped.other_social_url?.trim() || null,
    };
    const { error } = await supabase
      .from("companies")
      .update({
        website: mapped.website?.trim() || undefined,
        onboarding_step_state: { ...state, import_social_links: socialLinks },
        updated_at: new Date().toISOString(),
      })
      .eq("id", entity.entityId);
    if (error) throw new Error(error.message);
    return { action: "updated" as const, entityType: entity.entityType, entityId: entity.entityId };
  }

  if (entity.table === "founder_investor_contacts") {
    const { error } = await supabase
      .from("founder_investor_contacts")
      .update({
        linkedin_url: mapped.linkedin_url?.trim() || null,
        twitter_url: mapped.twitter_url?.trim() || null,
        crunchbase_url: mapped.crunchbase_url?.trim() || null,
        website: mapped.website?.trim() || null,
        personal_website_url: mapped.personal_website_url?.trim() || null,
        other_social_url: mapped.other_social_url?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", entity.entityId);
    if (error) throw new Error(error.message);
    return { action: "updated" as const, entityType: entity.entityType, entityId: entity.entityId };
  }

  return { action: "skipped" as const, entityType: entity.entityType, entityId: entity.entityId };
}

async function importCrmNotesRow(
  supabase: SupabaseClient,
  mapped: Record<string, string>,
  context: ImportContextIndex,
  batchId: string,
) {
  const entity = await resolveEntityForSocialOrCrm(supabase, mapped, context);
  if (!entity) throw new Error("Entity not found");

  const { data, error } = await supabase
    .from("compliance_events")
    .insert({
      event_type: "admin_crm_import",
      severity: "low",
      source: mapped.source?.trim() || "admin_import",
      title: mapped.note?.trim().slice(0, 120) || "CRM import note",
      description: mapped.note?.trim() || "Imported CRM note",
      status: mapped.status?.trim() || "open",
      company_id: entity.entityType === "company" ? entity.entityId : null,
      investor_id: entity.entityType === "investor_profile" ? entity.entityId : null,
      metadata: {
        tags: parseListField(mapped.tags ?? ""),
        import_batch_id: batchId,
        entity_type: entity.entityType,
        entity_id: entity.entityId,
      },
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return { action: "created" as const, entityType: "compliance_event", entityId: data.id };
}

async function importOutreachContactRow(
  supabase: SupabaseClient,
  mapped: Record<string, string>,
  context: ImportContextIndex,
  duplicateBehavior: DuplicateBehavior,
) {
  const contactResult = await importFounderContactRow(supabase, mapped, context, duplicateBehavior);
  const ids = resolveFounderCompanyIds(mapped, context);
  if (!ids) throw new Error("Founder/company not found");

  const { data: existingTarget } = await supabase
    .from("founder_outreach_targets")
    .select("id")
    .eq("founder_id", ids.founderId)
    .eq("company_id", ids.companyId)
    .eq("contact_id", contactResult.entityId)
    .maybeSingle();

  if (existingTarget) {
    return contactResult.action === "skipped"
      ? { action: "skipped" as const, entityType: "founder_outreach_target", entityId: existingTarget.id }
      : { action: "updated" as const, entityType: "founder_outreach_target", entityId: existingTarget.id };
  }

  const { data, error } = await supabase
    .from("founder_outreach_targets")
    .insert({
      founder_id: ids.founderId,
      company_id: ids.companyId,
      contact_id: contactResult.entityId,
      status: "selected",
      source: mapped.source?.trim() || "admin_import",
      notes: mapped.notes?.trim() || null,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return { action: "created" as const, entityType: "founder_outreach_target", entityId: data.id };
}

export async function executeImportRows(input: {
  supabase: SupabaseClient;
  importType: ImportType;
  rows: ValidatedImportRow[];
  context: ImportContextIndex;
  duplicateBehavior: DuplicateBehavior;
  batchId: string;
}): Promise<ImportExecutionResult> {
  const result: ImportExecutionResult = {
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    rowResults: [],
  };

  for (const row of input.rows) {
    if (row.status === "error") {
      result.skipped += 1;
      result.rowResults.push({ rowNumber: row.rowNumber, status: "skipped" });
      continue;
    }

    try {
      let outcome:
        | { action: "created" | "updated" | "skipped"; entityType: string; entityId: string };

      switch (input.importType) {
        case "companies":
          outcome = await importCompanyRow(input.supabase, row.mapped, input.context, input.duplicateBehavior);
          break;
        case "investors":
          outcome = await importInvestorRow(input.supabase, row.mapped, input.context, input.duplicateBehavior);
          break;
        case "founder_contacts":
          outcome = await importFounderContactRow(
            input.supabase,
            row.mapped,
            input.context,
            input.duplicateBehavior,
          );
          break;
        case "social_links":
          outcome = await importSocialLinksRow(input.supabase, row.mapped, input.context);
          break;
        case "crm_notes_tags":
          outcome = await importCrmNotesRow(input.supabase, row.mapped, input.context, input.batchId);
          break;
        case "outreach_contacts":
          outcome = await importOutreachContactRow(
            input.supabase,
            row.mapped,
            input.context,
            input.duplicateBehavior,
          );
          break;
        default:
          throw new Error("Unsupported import type");
      }

      if (outcome.action === "created") result.created += 1;
      else if (outcome.action === "updated") result.updated += 1;
      else result.skipped += 1;

      result.rowResults.push({
        rowNumber: row.rowNumber,
        status: outcome.action,
        entityType: outcome.entityType,
        entityId: outcome.entityId,
      });
    } catch (error) {
      result.failed += 1;
      result.rowResults.push({
        rowNumber: row.rowNumber,
        status: "failed",
        error: error instanceof Error ? error.message : "Import failed",
      });
    }
  }

  return result;
}
