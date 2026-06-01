import type { SupabaseClient } from "@supabase/supabase-js";
import type { WorkflowDependency } from "@/lib/automation/types";
import { listRemediationTasksForCompany } from "@/lib/remediation/tasks";
import type { Database, Profile } from "@/lib/supabase/types";

const READINESS_PUBLISH_THRESHOLD = 70;

export async function resolveCompanyDependencies(
  supabase: SupabaseClient<Database>,
  companyId: string,
): Promise<WorkflowDependency[]> {
  const deps: WorkflowDependency[] = [];
  const admin = supabase;

  const { data: company } = await admin
    .from("companies")
    .select("id, company_name, review_status, is_published, founder_id")
    .eq("id", companyId)
    .maybeSingle();

  if (!company) return deps;

  const [tasks, docs, compliance, diligence] = await Promise.all([
    listRemediationTasksForCompany(companyId),
    admin.from("documents").select("id, document_type").eq("company_id", companyId).limit(50),
    admin
      .from("compliance_events")
      .select("id, status, severity")
      .eq("company_id", companyId)
      .in("status", ["open", "escalated"])
      .limit(10),
    admin
      .from("diligence_reports")
      .select("id, readiness_score")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const openRemediation = (tasks ?? []).filter((t) => t.status === "open" || t.status === "in_progress");
  if (openRemediation.length > 0) {
    deps.push({
      id: `company-remediation-${companyId}`,
      blocker: "Remediation incomplete",
      dependency: `${openRemediation.length} open remediation task(s)`,
      severity: "high",
      nextRequiredStep: "Complete readiness remediation tasks",
      entityType: "company",
      entityId: companyId,
      resolved: false,
      href: `/admin/companies/${companyId}`,
    });
  }

  const hasPitchDeck = (docs.data ?? []).some(
    (d) => String(d.document_type).toLowerCase().includes("pitch") || d.document_type === "pitch_deck",
  );
  if (!hasPitchDeck) {
    deps.push({
      id: `company-pitch-${companyId}`,
      blocker: "Missing pitch deck",
      dependency: "Pitch deck not uploaded",
      severity: "medium",
      nextRequiredStep: "Founder uploads pitch deck in Documents",
      entityType: "company",
      entityId: companyId,
      resolved: false,
      href: `/founder/documents`,
    });
  }

  for (const evt of compliance.data ?? []) {
    deps.push({
      id: `company-compliance-${evt.id}`,
      blocker: "Compliance escalation",
      dependency: `Open compliance event (${evt.severity ?? "review"})`,
      severity: evt.severity === "critical" ? "critical" : "high",
      nextRequiredStep: "Resolve compliance event in admin compliance queue",
      entityType: "company",
      entityId: companyId,
      resolved: false,
      href: `/admin/compliance`,
    });
  }

  const score = diligence.data?.readiness_score ?? 0;
  if (!company.is_published && score < READINESS_PUBLISH_THRESHOLD) {
    deps.push({
      id: `company-readiness-${companyId}`,
      blocker: "Readiness threshold",
      dependency: `Readiness score ${score}% below ${READINESS_PUBLISH_THRESHOLD}% publish threshold`,
      severity: "medium",
      nextRequiredStep: "Improve readiness score and complete remediation",
      entityType: "company",
      entityId: companyId,
      resolved: false,
      href: `/admin/companies/${companyId}`,
    });
  }

  if (company.review_status === "pending") {
    deps.push({
      id: `company-review-${companyId}`,
      blocker: "Admin review pending",
      dependency: "Company awaiting institutional review",
      severity: "medium",
      nextRequiredStep: "Admin completes company review",
      entityType: "company",
      entityId: companyId,
      resolved: false,
      href: `/admin/companies/${companyId}`,
    });
  }

  return deps;
}

export async function resolveInvestorDependencies(
  supabase: SupabaseClient<Database>,
  investorProfileId: string,
): Promise<WorkflowDependency[]> {
  const deps: WorkflowDependency[] = [];

  const { data: investor } = await supabase
    .from("investor_profiles")
    .select("id, profile_id, approval_status, accredited_status, firm_name")
    .eq("id", investorProfileId)
    .maybeSingle();

  if (!investor) return deps;

  if (investor.approval_status === "pending") {
    deps.push({
      id: `investor-approval-${investor.id}`,
      blocker: "Investor approval pending",
      dependency: "Profile submitted, awaiting admin approval",
      severity: "medium",
      nextRequiredStep: "Admin reviews investor onboarding",
      entityType: "investor",
      entityId: investor.id,
      resolved: false,
      href: `/admin/investors`,
    });
  }

  if (!investor.accredited_status) {
    deps.push({
      id: `investor-accreditation-${investor.id}`,
      blocker: "Accreditation incomplete",
      dependency: "Investor accreditation not confirmed",
      severity: "high",
      nextRequiredStep: "Investor completes accreditation in onboarding",
      entityType: "investor",
      entityId: investor.id,
      resolved: false,
      href: `/investor/onboarding`,
    });
  }

  return deps;
}

export async function resolveSpvDependencies(
  supabase: SupabaseClient<Database>,
  spvId: string,
): Promise<WorkflowDependency[]> {
  const deps: WorkflowDependency[] = [];

  const { data: spv } = await supabase
    .from("spv_opportunities")
    .select("id, name, status, checklist_readiness_pct, package_readiness_pct, investor_pending_requirements_count")
    .eq("id", spvId)
    .maybeSingle();

  if (!spv) return deps;

  if (Number(spv.investor_pending_requirements_count ?? 0) > 0) {
    deps.push({
      id: `spv-req-${spvId}`,
      blocker: "Investor requirements incomplete",
      dependency: `${spv.investor_pending_requirements_count} pending investor requirement(s)`,
      severity: "high",
      nextRequiredStep: "Investors upload SPV participation requirements",
      entityType: "spv",
      entityId: spvId,
      resolved: false,
      href: `/admin/spvs`,
    });
  }

  if (Number(spv.package_readiness_pct ?? 0) < 100) {
    deps.push({
      id: `spv-package-${spvId}`,
      blocker: "Package readiness incomplete",
      dependency: `Document packages at ${spv.package_readiness_pct ?? 0}% readiness`,
      severity: "medium",
      nextRequiredStep: "Complete SPV document packages and reviews",
      entityType: "spv",
      entityId: spvId,
      resolved: false,
      href: `/admin/spvs`,
    });
  }

  if (Number(spv.checklist_readiness_pct ?? 0) < 100) {
    deps.push({
      id: `spv-checklist-${spvId}`,
      blocker: "SPV checklist incomplete",
      dependency: `Checklist at ${spv.checklist_readiness_pct ?? 0}%`,
      severity: "medium",
      nextRequiredStep: "Complete SPV operational checklist items",
      entityType: "spv",
      entityId: spvId,
      resolved: false,
      href: `/admin/spvs`,
    });
  }

  return deps;
}

export async function resolveEntityDependencies(
  supabase: SupabaseClient<Database>,
  entityType: string,
  entityId: string,
): Promise<WorkflowDependency[]> {
  if (entityType === "company") return resolveCompanyDependencies(supabase, entityId);
  if (entityType === "investor") return resolveInvestorDependencies(supabase, entityId);
  if (entityType === "spv") return resolveSpvDependencies(supabase, entityId);
  return [];
}

export function countUnresolvedDependencies(deps: WorkflowDependency[]): number {
  return deps.filter((d) => !d.resolved).length;
}

export async function loadWorkflowDependenciesForProfile(
  supabase: SupabaseClient<Database>,
  profile: Profile,
  filters?: { companyId?: string; investorId?: string; spvId?: string },
): Promise<WorkflowDependency[]> {
  if (filters?.spvId) return resolveSpvDependencies(supabase, filters.spvId);
  if (filters?.companyId) return resolveCompanyDependencies(supabase, filters.companyId);
  if (filters?.investorId) return resolveInvestorDependencies(supabase, filters.investorId);

  if (profile.role === "founder") {
    const { data: company } = await supabase
      .from("companies")
      .select("id")
      .eq("founder_id", profile.id)
      .maybeSingle();
    if (company) return resolveCompanyDependencies(supabase, company.id);
  }

  if (profile.role === "investor") {
    const { data: investor } = await supabase
      .from("investor_profiles")
      .select("id")
      .eq("profile_id", profile.id)
      .maybeSingle();
    if (investor) return resolveInvestorDependencies(supabase, investor.id);
  }

  return [];
}
