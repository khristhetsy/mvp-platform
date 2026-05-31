import {
  notifyFounderSpvDocumentReady,
  notifyStaffSpvChecklistComplete,
} from "@/lib/spv/notify";
import {
  areRequiredChecklistItemsComplete,
  computeChecklistReadinessPct,
  summarizeChecklistByCategory,
} from "@/lib/spv/display";
import type {
  SpvChecklistCategory,
  SpvChecklistItemRecord,
  SpvChecklistItemStatus,
} from "@/lib/spv/types";

export {
  areRequiredChecklistItemsComplete,
  computeChecklistReadinessPct,
  formatChecklistCategory,
  investorPreparationLabel,
  summarizeChecklistByCategory,
} from "@/lib/spv/display";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export const DEFAULT_SPV_CHECKLIST_ITEMS: ReadonlyArray<{
  item_key: string;
  title: string;
  description: string;
  category: SpvChecklistCategory;
  required: boolean;
}> = [
  {
    item_key: "entity_formation",
    title: "SPV entity formation",
    description: "Confirm entity structure and formation steps are tracked internally.",
    category: "legal",
    required: true,
  },
  {
    item_key: "operating_agreement",
    title: "Operating agreement",
    description: "Operating agreement draft and review status (no auto-generation).",
    category: "legal",
    required: true,
  },
  {
    item_key: "subscription_agreement",
    title: "Subscription agreement",
    description: "Subscription document readiness for future investor workflows.",
    category: "investor_docs",
    required: true,
  },
  {
    item_key: "accreditation_review",
    title: "Investor accreditation review",
    description: "Operational checklist for accreditation review before subscriptions.",
    category: "compliance",
    required: true,
  },
  {
    item_key: "kyc_aml_review",
    title: "KYC/AML review",
    description: "Internal readiness for future KYC/AML vendor workflows.",
    category: "compliance",
    required: true,
  },
  {
    item_key: "wire_banking_instructions",
    title: "Wire/banking instructions",
    description: "Banking and wire instruction readiness (no wire processing in this phase).",
    category: "banking",
    required: true,
  },
  {
    item_key: "tax_form_collection",
    title: "Tax form collection",
    description: "Tax documentation collection readiness (no tax filing automation).",
    category: "tax",
    required: true,
  },
  {
    item_key: "investor_reporting_setup",
    title: "Investor reporting setup",
    description: "Reporting workflow readiness for future investor updates.",
    category: "reporting",
    required: true,
  },
  {
    item_key: "compliance_review",
    title: "Compliance review",
    description: "Internal compliance review before opening subscriptions.",
    category: "compliance",
    required: true,
  },
  {
    item_key: "final_admin_approval",
    title: "Final admin approval",
    description: "Final staff sign-off on document readiness checklist.",
    category: "admin",
    required: true,
  },
];

const DONE_STATUSES: SpvChecklistItemStatus[] = ["completed", "waived"];

export async function seedSpvChecklistItems(
  admin: SupabaseClient<Database>,
  spvOpportunityId: string,
) {
  const now = new Date().toISOString();
  const rows = DEFAULT_SPV_CHECKLIST_ITEMS.map((item) => ({
    spv_opportunity_id: spvOpportunityId,
    item_key: item.item_key,
    title: item.title,
    description: item.description,
    category: item.category,
    status: "pending" as const,
    required: item.required,
    updated_at: now,
  }));

  const { error } = await admin.from("spv_checklist_items").insert(rows);
  if (error) {
    return { error };
  }

  await syncSpvChecklistReadiness(admin, spvOpportunityId, { actorId: null });
  return { ok: true as const };
}

export async function listSpvChecklistItems(
  admin: SupabaseClient<Database>,
  spvOpportunityId: string,
) {
  const { data, error } = await admin
    .from("spv_checklist_items")
    .select("*")
    .eq("spv_opportunity_id", spvOpportunityId)
    .order("created_at", { ascending: true });

  if (error) {
    return { error };
  }

  return { data: (data ?? []) as SpvChecklistItemRecord[] };
}

export async function listAdminChecklistGrouped(
  admin: SupabaseClient<Database>,
  spvOpportunityIds: string[],
) {
  if (spvOpportunityIds.length === 0) {
    return { data: {} as Record<string, SpvChecklistItemRecord[]> };
  }

  const { data, error } = await admin
    .from("spv_checklist_items")
    .select("*")
    .in("spv_opportunity_id", spvOpportunityIds)
    .order("created_at", { ascending: true });

  if (error) {
    return { error };
  }

  const grouped: Record<string, SpvChecklistItemRecord[]> = {};
  for (const row of (data ?? []) as SpvChecklistItemRecord[]) {
    const list = grouped[row.spv_opportunity_id] ?? [];
    list.push(row);
    grouped[row.spv_opportunity_id] = list;
  }

  return { data: grouped };
}

export async function listFounderChecklistSummary(
  supabase: SupabaseClient<Database>,
  spvOpportunityIds: string[],
) {
  if (spvOpportunityIds.length === 0) {
    return { data: {} as Record<string, ReturnType<typeof summarizeChecklistByCategory>> };
  }

  const { data, error } = await supabase
    .from("spv_checklist_items")
    .select("spv_opportunity_id, category, status, required")
    .in("spv_opportunity_id", spvOpportunityIds);

  if (error) {
    return { error };
  }

  const grouped: Record<string, SpvChecklistItemRecord[]> = {};
  for (const row of data ?? []) {
    const list = grouped[row.spv_opportunity_id] ?? [];
    list.push(row as SpvChecklistItemRecord);
    grouped[row.spv_opportunity_id] = list;
  }

  const summaries: Record<string, ReturnType<typeof summarizeChecklistByCategory>> = {};
  for (const [spvId, items] of Object.entries(grouped)) {
    summaries[spvId] = summarizeChecklistByCategory(items);
  }

  return { data: summaries };
}

export async function syncSpvChecklistReadiness(
  admin: SupabaseClient<Database>,
  spvOpportunityId: string,
  input: { actorId: string | null },
) {
  const { data: items, error: itemsError } = await listSpvChecklistItems(admin, spvOpportunityId);
  if (itemsError || !items) {
    return { error: itemsError ?? new Error("Unable to load checklist.") };
  }

  const pct = computeChecklistReadinessPct(items);

  const { data: spv, error: spvError } = await admin
    .from("spv_opportunities")
    .select("id, company_id, name, checklist_readiness_pct, document_ready_at, companies(company_name)")
    .eq("id", spvOpportunityId)
    .single();

  if (spvError || !spv) {
    return { error: spvError ?? new Error("SPV not found.") };
  }

  const previousPct = spv.checklist_readiness_pct ?? 0;
  const previousReadyAt = spv.document_ready_at;
  const now = new Date().toISOString();
  const documentReadyAt = pct >= 100 ? (previousReadyAt ?? now) : null;

  const { error: updateError } = await admin
    .from("spv_opportunities")
    .update({
      checklist_readiness_pct: pct,
      document_ready_at: documentReadyAt,
      updated_at: now,
    })
    .eq("id", spvOpportunityId);

  if (updateError) {
    return { error: updateError };
  }

  const companyName =
    (Array.isArray(spv.companies) ? spv.companies[0] : spv.companies)?.company_name ?? "Company";

  if (pct >= 100 && previousPct < 100) {
    void notifyStaffSpvChecklistComplete({
      spvOpportunityId,
      spvName: spv.name,
      companyName,
      actorId: input.actorId,
    });
  }

  if (pct >= 100 && !previousReadyAt && documentReadyAt) {
    void notifyFounderSpvDocumentReady({
      companyId: spv.company_id,
      spvName: spv.name,
      spvOpportunityId,
      actorId: input.actorId,
    });
  }

  const { refreshSpvOperationalReadiness } = await import("@/lib/spv/sync-readiness");
  await refreshSpvOperationalReadiness(admin, spvOpportunityId, {
    actorId: input.actorId,
    checklist: items ?? [],
  });

  return { readinessPct: pct, documentReadyAt };
}

export async function updateSpvChecklistItem(
  admin: SupabaseClient<Database>,
  input: {
    itemId: string;
    status: SpvChecklistItemStatus;
    actorId: string;
  },
) {
  const { data: existing, error: loadError } = await admin
    .from("spv_checklist_items")
    .select("*")
    .eq("id", input.itemId)
    .single();

  if (loadError || !existing) {
    return { error: loadError ?? new Error("Checklist item not found.") };
  }

  const now = new Date().toISOString();
  const isDone = DONE_STATUSES.includes(input.status);

  const patch: Database["public"]["Tables"]["spv_checklist_items"]["Update"] = {
    status: input.status,
    updated_at: now,
    completed_by: isDone ? input.actorId : null,
    completed_at: isDone ? now : null,
  };

  const { data, error } = await admin
    .from("spv_checklist_items")
    .update(patch)
    .eq("id", input.itemId)
    .select("*")
    .single();

  if (error || !data) {
    return { error: error ?? new Error("Unable to update checklist item.") };
  }

  await syncSpvChecklistReadiness(admin, existing.spv_opportunity_id, { actorId: input.actorId });

  return { data: data as SpvChecklistItemRecord };
}

export async function assertSpvCanClose(
  admin: SupabaseClient<Database>,
  spvOpportunityId: string,
) {
  const { data: items, error } = await listSpvChecklistItems(admin, spvOpportunityId);
  if (error) {
    return { error };
  }

  if ((items ?? []).length === 0) {
    return {
      error: new Error("SPV checklist is not initialized. Complete document readiness items first."),
    };
  }

  if (!areRequiredChecklistItemsComplete(items ?? [])) {
    return {
      error: new Error(
        "Cannot close SPV until all required checklist items are completed or waived.",
      ),
    };
  }

  return { ok: true as const };
}
