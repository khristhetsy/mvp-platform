import {
  notifyFounderSpvInvestorAggregateChanged,
  notifyInvestorSpvRequirementReviewed,
  notifyInvestorSpvRequirementsRequested,
  notifyStaffSpvRequirementUploaded,
} from "@/lib/spv/notify";
import {
  computeParticipationReadinessPct,
  areRequiredParticipationRequirementsComplete,
} from "@/lib/spv/participation-display";
import type {
  SpvParticipationRequirementRecord,
  SpvParticipationRequirementStatus,
  SpvParticipationRequirementCategory,
} from "@/lib/spv/types";
import { createDocumentRecord } from "@/lib/data/documents";
import {
  buildSpvRequirementStoragePath,
  SPV_INVESTOR_DOCUMENTS_BUCKET,
  SPV_REQUIREMENT_DOCUMENT_TYPE,
  spvRequirementMaxUploadBytes,
  spvRequirementUploadMimeTypes,
} from "@/lib/spv/spv-documents";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export const DEFAULT_SPV_PARTICIPATION_REQUIREMENTS: ReadonlyArray<{
  requirement_key: string;
  title: string;
  description: string;
  category: SpvParticipationRequirementCategory;
  required: boolean;
}> = [
  {
    requirement_key: "subscription_agreement",
    title: "Subscription agreement",
    description: "Subscription document intake tracking (no auto-generation).",
    category: "subscription_docs",
    required: true,
  },
  {
    requirement_key: "accredited_investor_confirmation",
    title: "Accredited investor confirmation",
    description: "Accreditation confirmation intake for operational review.",
    category: "accreditation",
    required: true,
  },
  {
    requirement_key: "kyc_aml_information",
    title: "KYC/AML information",
    description: "KYC/AML information intake (no vendor integration in this phase).",
    category: "kyc_aml",
    required: true,
  },
  {
    requirement_key: "tax_form",
    title: "Tax form",
    description: "Tax documentation intake tracking (no tax form generation).",
    category: "tax",
    required: true,
  },
  {
    requirement_key: "banking_wire_confirmation",
    title: "Banking/wire confirmation",
    description: "Banking and wire confirmation intake (no wire processing).",
    category: "banking",
    required: true,
  },
  {
    requirement_key: "final_admin_review",
    title: "Final admin review",
    description: "Final staff review of investor document intake.",
    category: "admin_review",
    required: true,
  },
];

export {
  areRequiredParticipationRequirementsComplete,
  computeParticipationReadinessPct,
  formatParticipationRequirementCategory,
} from "@/lib/spv/participation-display";

export async function seedSpvParticipationRequirements(
  admin: SupabaseClient<Database>,
  input: {
    spvParticipationId: string;
    spvOpportunityId: string;
    investorId: string;
    spvName: string;
    notifyInvestor?: boolean;
    actorId?: string | null;
  },
) {
  const { count } = await admin
    .from("spv_participation_requirements")
    .select("id", { count: "exact", head: true })
    .eq("spv_participation_id", input.spvParticipationId);

  if ((count ?? 0) > 0) {
    return { ok: true as const, seeded: false };
  }

  const now = new Date().toISOString();
  const rows = DEFAULT_SPV_PARTICIPATION_REQUIREMENTS.map((item) => ({
    spv_participation_id: input.spvParticipationId,
    spv_opportunity_id: input.spvOpportunityId,
    investor_id: input.investorId,
    requirement_key: item.requirement_key,
    title: item.title,
    description: item.description,
    category: item.category,
    status: "pending" as const,
    required: item.required,
    updated_at: now,
  }));

  const { error } = await admin.from("spv_participation_requirements").insert(rows);
  if (error) {
    return { error };
  }

  if (input.notifyInvestor !== false) {
    void notifyInvestorSpvRequirementsRequested({
      investorId: input.investorId,
      spvOpportunityId: input.spvOpportunityId,
      spvName: input.spvName,
      actorId: input.actorId,
    });
  }

  await syncParticipationDocumentReadiness(admin, input.spvParticipationId, {
    actorId: input.actorId ?? null,
  });

  return { ok: true as const, seeded: true };
}

export async function listParticipationRequirements(
  client: SupabaseClient<Database>,
  spvParticipationId: string,
) {
  const { data, error } = await client
    .from("spv_participation_requirements")
    .select("*")
    .eq("spv_participation_id", spvParticipationId)
    .order("created_at", { ascending: true });

  if (error) {
    return { error };
  }

  return { data: (data ?? []) as SpvParticipationRequirementRecord[] };
}

export async function listInvestorParticipationRequirements(
  client: SupabaseClient<Database>,
  investorId: string,
) {
  const { data, error } = await client
    .from("spv_participation_requirements")
    .select("*, spv_opportunities(name, status), documents:uploaded_document_id(id, file_name, mime_type, size_bytes, created_at)")
    .eq("investor_id", investorId)
    .order("updated_at", { ascending: false });

  if (error) {
    return { error };
  }

  return { data: (data ?? []) as SpvParticipationRequirementRecord[] };
}

export async function listAdminRequirementsGrouped(
  admin: SupabaseClient<Database>,
  spvOpportunityIds: string[],
) {
  if (spvOpportunityIds.length === 0) {
    return { data: {} as Record<string, SpvParticipationRequirementRecord[]> };
  }

  const { data, error } = await admin
    .from("spv_participation_requirements")
    .select(
      "*, profiles:investor_id(full_name, email), documents:uploaded_document_id(id, file_name, mime_type, size_bytes, created_at)",
    )
    .in("spv_opportunity_id", spvOpportunityIds)
    .order("created_at", { ascending: true });

  if (error) {
    return { error };
  }

  const grouped: Record<string, SpvParticipationRequirementRecord[]> = {};
  for (const row of (data ?? []) as SpvParticipationRequirementRecord[]) {
    const list = grouped[row.spv_participation_id] ?? [];
    list.push(row);
    grouped[row.spv_participation_id] = list;
  }

  return { data: grouped };
}

export async function syncParticipationDocumentReadiness(
  admin: SupabaseClient<Database>,
  spvParticipationId: string,
  input: { actorId: string | null },
) {
  const { data: items, error: itemsError } = await listParticipationRequirements(admin, spvParticipationId);
  if (itemsError) {
    return { error: itemsError };
  }

  const requirements = items ?? [];
  const pct = computeParticipationReadinessPct(requirements);
  const now = new Date().toISOString();

  const { data: participation, error: partError } = await admin
    .from("spv_participations")
    .select("id, spv_opportunity_id, investor_id, document_readiness_pct, document_ready_at")
    .eq("id", spvParticipationId)
    .single();

  if (partError || !participation) {
    return { error: partError ?? new Error("Participation not found.") };
  }

  const previousReadyAt = participation.document_ready_at;
  const documentReadyAt = pct >= 100 ? (previousReadyAt ?? now) : null;

  await admin
    .from("spv_participations")
    .update({
      document_readiness_pct: pct,
      document_ready_at: documentReadyAt,
      updated_at: now,
    })
    .eq("id", spvParticipationId);

  await syncSpvInvestorDocumentAggregate(admin, participation.spv_opportunity_id, {
    actorId: input.actorId,
  });

  return { readinessPct: pct, documentReadyAt };
}

export async function syncSpvInvestorDocumentAggregate(
  admin: SupabaseClient<Database>,
  spvOpportunityId: string,
  input: { actorId: string | null },
) {
  const { data: spv, error: spvError } = await admin
    .from("spv_opportunities")
    .select(
      "id, company_id, name, investors_document_ready_count, investor_pending_requirements_count, companies(company_name)",
    )
    .eq("id", spvOpportunityId)
    .single();

  if (spvError || !spv) {
    return { error: spvError ?? new Error("SPV not found.") };
  }

  const { data: participations } = await admin
    .from("spv_participations")
    .select("id, document_ready_at, document_readiness_pct, status")
    .eq("spv_opportunity_id", spvOpportunityId);

  const active = (participations ?? []).filter(
    (row) => !["declined", "canceled"].includes(row.status),
  );
  const investorsReady = active.filter(
    (row) => row.document_ready_at != null || (row.document_readiness_pct ?? 0) >= 100,
  ).length;

  const { data: pendingRows } = await admin
    .from("spv_participation_requirements")
    .select("id, status, required")
    .eq("spv_opportunity_id", spvOpportunityId)
    .eq("required", true)
    .in("status", ["pending", "uploaded", "under_review", "rejected"]);

  const pendingCount = pendingRows?.length ?? 0;
  const prevReady = spv.investors_document_ready_count ?? 0;
  const prevPending = spv.investor_pending_requirements_count ?? 0;

  await admin
    .from("spv_opportunities")
    .update({
      investors_document_ready_count: investorsReady,
      investor_pending_requirements_count: pendingCount,
      updated_at: new Date().toISOString(),
    })
    .eq("id", spvOpportunityId);

  if (investorsReady !== prevReady || pendingCount !== prevPending) {
    const companyName =
      (Array.isArray(spv.companies) ? spv.companies[0] : spv.companies)?.company_name ?? "Company";
    void notifyFounderSpvInvestorAggregateChanged({
      companyId: spv.company_id,
      spvOpportunityId,
      spvName: spv.name,
      companyName,
      investorsReady,
      pendingRequirements: pendingCount,
      actorId: input.actorId,
    });
  }

  const { refreshSpvOperationalReadiness } = await import("@/lib/spv/sync-readiness");
  await refreshSpvOperationalReadiness(admin, spvOpportunityId, { actorId: input.actorId });

  return { investorsReady, pendingRequirements: pendingCount };
}

export async function uploadInvestorSpvRequirementDocument(
  investorClient: SupabaseClient<Database>,
  admin: SupabaseClient<Database>,
  input: {
    investorId: string;
    requirementId: string;
    file: File;
  },
) {
  const { data: requirement, error: loadError } = await investorClient
    .from("spv_participation_requirements")
    .select("*, spv_opportunities(name), spv_participations(company_id)")
    .eq("id", input.requirementId)
    .eq("investor_id", input.investorId)
    .single();

  if (loadError || !requirement) {
    return { error: loadError ?? new Error("Requirement not found.") };
  }

  const uploadableStatuses = ["pending", "rejected"];
  if (!uploadableStatuses.includes(requirement.status)) {
    return { error: new Error("This requirement is not open for upload.") };
  }

  if (input.file.size > spvRequirementMaxUploadBytes) {
    return { error: new Error("File exceeds the 25MB upload limit.") };
  }

  if (!spvRequirementUploadMimeTypes.has(input.file.type)) {
    return { error: new Error("Unsupported file type.") };
  }

  const filePath = buildSpvRequirementStoragePath(
    input.investorId,
    input.requirementId,
    input.file.name,
  );

  const { error: uploadError } = await investorClient.storage
    .from(SPV_INVESTOR_DOCUMENTS_BUCKET)
    .upload(filePath, input.file, { contentType: input.file.type, upsert: false });

  if (uploadError) {
    return { error: new Error(uploadError.message) };
  }

  const participation = Array.isArray(requirement.spv_participations)
    ? requirement.spv_participations[0]
    : requirement.spv_participations;
  const companyId = participation?.company_id;

  if (!companyId) {
    return { error: new Error("Participation company not found.") };
  }

  const { data: document, error: documentError } = await createDocumentRecord(investorClient, {
    company_id: companyId,
    uploaded_by: input.investorId,
    document_type: SPV_REQUIREMENT_DOCUMENT_TYPE,
    file_name: input.file.name,
    file_path: filePath,
    file_url: null,
    mime_type: input.file.type,
    size_bytes: input.file.size,
    status: "uploaded",
  });

  if (documentError || !document) {
    return { error: documentError ?? new Error("Unable to save document record.") };
  }

  const now = new Date().toISOString();
  const { data: updated, error: updateError } = await admin
    .from("spv_participation_requirements")
    .update({
      uploaded_document_id: document.id,
      status: "uploaded",
      review_notes: null,
      reviewed_by: null,
      reviewed_at: null,
      updated_at: now,
    })
    .eq("id", input.requirementId)
    .select("*")
    .single();

  if (updateError || !updated) {
    return { error: updateError ?? new Error("Unable to update requirement.") };
  }

  const spvName =
    (Array.isArray(requirement.spv_opportunities)
      ? requirement.spv_opportunities[0]
      : requirement.spv_opportunities)?.name ?? "SPV";

  void notifyStaffSpvRequirementUploaded({
    investorId: input.investorId,
    spvOpportunityId: requirement.spv_opportunity_id,
    spvName,
    requirementTitle: requirement.title,
    actorId: input.investorId,
  });

  await syncParticipationDocumentReadiness(admin, requirement.spv_participation_id, {
    actorId: input.investorId,
  });

  const { refreshSpvOperationalReadiness } = await import("@/lib/spv/sync-readiness");
  await refreshSpvOperationalReadiness(admin, requirement.spv_opportunity_id, {
    actorId: input.investorId,
  });

  return { data: updated as SpvParticipationRequirementRecord, document };
}

export async function updateParticipationRequirement(
  admin: SupabaseClient<Database>,
  input: {
    requirementId: string;
    status: SpvParticipationRequirementStatus;
    actorId: string;
    reviewNotes?: string | null;
  },
) {
  const { data: existing, error: loadError } = await admin
    .from("spv_participation_requirements")
    .select("*, spv_opportunities(name)")
    .eq("id", input.requirementId)
    .single();

  if (loadError || !existing) {
    return { error: loadError ?? new Error("Requirement not found.") };
  }

  const now = new Date().toISOString();
  const reviewedStatuses: SpvParticipationRequirementStatus[] = [
    "approved",
    "rejected",
    "waived",
    "under_review",
  ];

  const patch: Database["public"]["Tables"]["spv_participation_requirements"]["Update"] = {
    status: input.status,
    updated_at: now,
    reviewed_by: reviewedStatuses.includes(input.status) ? input.actorId : null,
    reviewed_at: reviewedStatuses.includes(input.status) ? now : null,
    review_notes:
      input.status === "rejected"
        ? (input.reviewNotes?.trim() ?? null)
        : input.status === "approved" || input.status === "waived"
          ? null
          : undefined,
  };

  const { data, error } = await admin
    .from("spv_participation_requirements")
    .update(patch)
    .eq("id", input.requirementId)
    .select("*")
    .single();

  if (error || !data) {
    return { error: error ?? new Error("Unable to update requirement.") };
  }

  const record = data as SpvParticipationRequirementRecord;
  const spvName =
    (Array.isArray(existing.spv_opportunities)
      ? existing.spv_opportunities[0]
      : existing.spv_opportunities)?.name ?? "SPV";

  if (["approved", "rejected", "waived"].includes(input.status)) {
    void notifyInvestorSpvRequirementReviewed({
      investorId: existing.investor_id,
      spvOpportunityId: existing.spv_opportunity_id,
      spvName,
      requirementTitle: existing.title,
      status: input.status,
      reviewNotes: input.status === "rejected" ? input.reviewNotes : null,
      actorId: input.actorId,
    });
  }

  await syncParticipationDocumentReadiness(admin, existing.spv_participation_id, {
    actorId: input.actorId,
  });

  const { refreshSpvOperationalReadiness } = await import("@/lib/spv/sync-readiness");
  await refreshSpvOperationalReadiness(admin, existing.spv_opportunity_id, {
    actorId: input.actorId,
  });

  return { data: record };
}

export async function assertParticipationCanComplete(
  admin: SupabaseClient<Database>,
  spvParticipationId: string,
) {
  const { data: items, error } = await listParticipationRequirements(admin, spvParticipationId);
  if (error) {
    return { error };
  }

  if ((items ?? []).length === 0) {
    return {
      error: new Error(
        "Investor document requirements are not initialized. Seed or create participation requirements first.",
      ),
    };
  }

  if (!areRequiredParticipationRequirementsComplete(items ?? [])) {
    return {
      error: new Error(
        "Cannot mark participation completed until all required investor requirements are approved or waived.",
      ),
    };
  }

  return { ok: true as const };
}

export async function updateSpvParticipationStatus(
  admin: SupabaseClient<Database>,
  input: {
    spvParticipationId: string;
    status: string;
    actorId: string;
  },
) {
  if (input.status === "completed") {
    const check = await assertParticipationCanComplete(admin, input.spvParticipationId);
    if (check.error) {
      return { error: check.error };
    }
  }

  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("spv_participations")
    .update({ status: input.status, updated_at: now })
    .eq("id", input.spvParticipationId)
    .select("*, spv_opportunities(name)")
    .single();

  if (error || !data) {
    return { error: error ?? new Error("Unable to update participation.") };
  }

  return { data };
}
