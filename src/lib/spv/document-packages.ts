import {
  notifyFounderSpvPackagesApproved,
  notifyInvestorSpvSubscriptionPackageIssued,
  notifyStaffSpvPackagesSeeded,
} from "@/lib/spv/notify";
import {
  computeInvestorPackagePublicStatus,
  computePackageReadinessPct,
  summarizeFounderPackageProgress,
} from "@/lib/spv/document-package-display";
import type {
  SpvDocumentPackageRecord,
  SpvDocumentPackageStatus,
  SpvDocumentPackageType,
} from "@/lib/spv/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export {
  computeInvestorPackagePublicStatus,
  computePackageReadinessPct,
  formatPackageTypeLabel,
  summarizeFounderPackageProgress,
} from "@/lib/spv/document-package-display";

export const DEFAULT_SPV_DOCUMENT_PACKAGES: ReadonlyArray<{
  package_type: SpvDocumentPackageType;
  title: string;
}> = [
  { package_type: "formation_package", title: "Formation package" },
  { package_type: "subscription_package", title: "Subscription package" },
  { package_type: "investor_intake_package", title: "Investor intake package" },
  { package_type: "banking_package", title: "Banking package" },
  { package_type: "tax_package", title: "Tax package" },
  { package_type: "reporting_package", title: "Reporting package" },
  { package_type: "final_closing_package", title: "Final closing package" },
];

const COMPLETE_PACKAGE_STATUSES: SpvDocumentPackageStatus[] = ["approved", "issued", "archived"];

export async function listSpvDocumentPackages(
  client: SupabaseClient<Database>,
  spvOpportunityId: string,
) {
  const { data, error } = await client
    .from("spv_document_packages")
    .select("*")
    .eq("spv_opportunity_id", spvOpportunityId)
    .order("created_at", { ascending: true });

  if (error) {
    return { error };
  }

  return { data: (data ?? []) as SpvDocumentPackageRecord[] };
}

export async function listAdminPackagesGrouped(
  admin: SupabaseClient<Database>,
  spvOpportunityIds: string[],
) {
  if (spvOpportunityIds.length === 0) {
    return { data: {} as Record<string, SpvDocumentPackageRecord[]> };
  }

  const { data, error } = await admin
    .from("spv_document_packages")
    .select("*")
    .in("spv_opportunity_id", spvOpportunityIds)
    .order("created_at", { ascending: true });

  if (error) {
    return { error };
  }

  const grouped: Record<string, SpvDocumentPackageRecord[]> = {};
  for (const row of (data ?? []) as SpvDocumentPackageRecord[]) {
    const list = grouped[row.spv_opportunity_id] ?? [];
    list.push(row);
    grouped[row.spv_opportunity_id] = list;
  }

  return { data: grouped };
}

export async function listFounderPackageSummaries(
  supabase: SupabaseClient<Database>,
  spvOpportunityIds: string[],
) {
  if (spvOpportunityIds.length === 0) {
    return { data: {} as Record<string, ReturnType<typeof summarizeFounderPackageProgress>> };
  }

  const { data, error } = await supabase
    .from("spv_document_packages")
    .select("spv_opportunity_id, package_type, status")
    .in("spv_opportunity_id", spvOpportunityIds);

  if (error) {
    return { error };
  }

  const grouped: Record<string, SpvDocumentPackageRecord[]> = {};
  for (const row of data ?? []) {
    const list = grouped[row.spv_opportunity_id] ?? [];
    list.push(row as SpvDocumentPackageRecord);
    grouped[row.spv_opportunity_id] = list;
  }

  const summaries: Record<string, ReturnType<typeof summarizeFounderPackageProgress>> = {};
  for (const [spvId, rows] of Object.entries(grouped)) {
    summaries[spvId] = summarizeFounderPackageProgress(rows);
  }

  return { data: summaries };
}

export async function seedSpvDocumentPackages(
  admin: SupabaseClient<Database>,
  input: {
    spvOpportunityId: string;
    companyId: string;
    spvName: string;
    companyName: string;
    actorId: string | null;
  },
) {
  const { count } = await admin
    .from("spv_document_packages")
    .select("id", { count: "exact", head: true })
    .eq("spv_opportunity_id", input.spvOpportunityId);

  if ((count ?? 0) > 0) {
    return { seeded: false as const };
  }

  const now = new Date().toISOString();
  const rows = DEFAULT_SPV_DOCUMENT_PACKAGES.map((pkg) => ({
    spv_opportunity_id: input.spvOpportunityId,
    company_id: input.companyId,
    package_type: pkg.package_type,
    status: "not_started" as const,
    updated_at: now,
  }));

  const { error } = await admin.from("spv_document_packages").insert(rows);
  if (error) {
    return { error };
  }

  void notifyStaffSpvPackagesSeeded({
    spvOpportunityId: input.spvOpportunityId,
    spvName: input.spvName,
    companyName: input.companyName,
    actorId: input.actorId,
  });

  await syncSpvPackageReadiness(admin, input.spvOpportunityId, { actorId: input.actorId });

  return { seeded: true as const };
}

export async function syncSpvPackageReadiness(
  admin: SupabaseClient<Database>,
  spvOpportunityId: string,
  input: { actorId: string | null },
) {
  const { data: packages, error } = await listSpvDocumentPackages(admin, spvOpportunityId);
  if (error) {
    return { error };
  }

  const rows = packages ?? [];
  const pct = computePackageReadinessPct(rows);
  const investorStatus = computeInvestorPackagePublicStatus(rows, null);

  const { data: spv } = await admin
    .from("spv_opportunities")
    .select("id, company_id, name, packages_fully_approved_notified, companies(company_name)")
    .eq("id", spvOpportunityId)
    .single();

  if (!spv) {
    return { error: new Error("SPV not found.") };
  }

  const allComplete =
    rows.length > 0 &&
    rows.every((row) => COMPLETE_PACKAGE_STATUSES.includes(row.status as SpvDocumentPackageStatus));
  const notifyFounder = allComplete && !spv.packages_fully_approved_notified;

  await admin
    .from("spv_opportunities")
    .update({
      package_readiness_pct: pct,
      investor_package_status: investorStatus,
      packages_fully_approved_notified: notifyFounder ? true : spv.packages_fully_approved_notified,
      updated_at: new Date().toISOString(),
    })
    .eq("id", spvOpportunityId);

  if (notifyFounder) {
    const companyName =
      (Array.isArray(spv.companies) ? spv.companies[0] : spv.companies)?.company_name ?? "Company";
    void notifyFounderSpvPackagesApproved({
      companyId: spv.company_id,
      spvOpportunityId,
      spvName: spv.name,
      actorId: input.actorId,
    });
  }

  return { packageReadinessPct: pct, investorPackageStatus: investorStatus };
}

export async function updateSpvDocumentPackage(
  admin: SupabaseClient<Database>,
  input: {
    packageId: string;
    status: SpvDocumentPackageStatus;
    notes?: string | null;
    actorId: string;
  },
) {
  const { data: existing, error: loadError } = await admin
    .from("spv_document_packages")
    .select("*, spv_opportunities(name)")
    .eq("id", input.packageId)
    .single();

  if (loadError || !existing) {
    return { error: loadError ?? new Error("Package not found.") };
  }

  const now = new Date().toISOString();
  const patch: Database["public"]["Tables"]["spv_document_packages"]["Update"] = {
    status: input.status,
    notes: input.notes !== undefined ? (input.notes?.trim() ?? null) : undefined,
    updated_at: now,
  };

  if (input.status === "preparing") {
    patch.prepared_by = input.actorId;
    patch.prepared_at = now;
  }
  if (input.status === "under_review") {
    patch.reviewed_by = input.actorId;
    patch.reviewed_at = now;
  }
  if (["approved", "issued", "archived"].includes(input.status)) {
    patch.approved_by = input.actorId;
    patch.approved_at = now;
  }

  const { data, error } = await admin
    .from("spv_document_packages")
    .update(patch)
    .eq("id", input.packageId)
    .select("*")
    .single();

  if (error || !data) {
    return { error: error ?? new Error("Unable to update package.") };
  }

  const record = data as SpvDocumentPackageRecord;
  const spvName =
    (Array.isArray(existing.spv_opportunities)
      ? existing.spv_opportunities[0]
      : existing.spv_opportunities)?.name ?? "SPV";

  if (
    existing.package_type === "subscription_package" &&
    input.status === "issued" &&
    existing.status !== "issued"
  ) {
    const { data: participations } = await admin
      .from("spv_participations")
      .select("investor_id, status")
      .eq("spv_opportunity_id", existing.spv_opportunity_id);

    for (const row of (participations ?? []).filter(
      (part) => !["declined", "canceled"].includes(part.status),
    )) {
      void notifyInvestorSpvSubscriptionPackageIssued({
        investorId: row.investor_id,
        spvOpportunityId: existing.spv_opportunity_id,
        spvName,
        actorId: input.actorId,
      });
    }
  }

  await syncSpvPackageReadiness(admin, existing.spv_opportunity_id, { actorId: input.actorId });

  return { data: record };
}
