import type { SupabaseClient } from "@supabase/supabase-js";
import { actionCenterBasePath } from "@/lib/actions/filters";
import { INACTIVITY_SCAN_LIMIT, RECENT_ACTIVITY_WINDOW_DAYS, SLA_RULES_MS } from "@/lib/notifications/orchestration/rules";
import type { OrchestrationFinding } from "@/lib/notifications/orchestration/types";
import { listStaffProfileIds } from "@/lib/notifications/notifications";
import type { Database } from "@/lib/supabase/types";

const ACTIVE_COMPANY_STATUSES = ["draft", "pending", "in_review"] as const;

function sinceIso(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

export async function detectWorkflowInactivity(
  supabase: SupabaseClient<Database>,
): Promise<OrchestrationFinding[]> {
  const findings: OrchestrationFinding[] = [];
  const recentSince = sinceIso(RECENT_ACTIVITY_WINDOW_DAYS);
  const staffIds = await listStaffProfileIds();

  const { data: stalledCompanies } = await supabase
    .from("companies")
    .select("id, founder_id, company_name, review_status, updated_at, onboarding_step_state")
    .in("review_status", [...ACTIVE_COMPANY_STATUSES])
    .lt("updated_at", sinceIso(SLA_RULES_MS.onboardingInactivity / (24 * 60 * 60 * 1000)))
    .order("updated_at", { ascending: true })
    .limit(INACTIVITY_SCAN_LIMIT);

  for (const company of stalledCompanies ?? []) {
    if (!company.founder_id) continue;
    findings.push({
      trigger: "workflow_inactivity",
      orchestrationType: "inactivity",
      severity: "medium",
      title: "Onboarding inactivity",
      message: `${company.company_name ?? "Company"} has had no onboarding progress recently.`,
      recipientUserId: company.founder_id,
      role: "founder",
      entityType: "company",
      entityId: company.id,
      companyId: company.id,
      deepLink: "/founder/onboarding",
      dedupeKey: `orch:inactivity:onboarding:${company.id}`,
      inactivityReason: "No company profile movement within the onboarding inactivity window.",
      suggestedAction: "Complete onboarding steps and upload required documents.",
    });

    for (const staffId of staffIds.slice(0, 5)) {
      findings.push({
        trigger: "workflow_inactivity",
        orchestrationType: "admin_attention",
        severity: "low",
        title: "Stalled founder onboarding",
        message: `Company review pipeline inactive for ${company.company_name ?? "a company"}.`,
        recipientUserId: staffId,
        role: "admin",
        entityType: "company",
        entityId: company.id,
        companyId: company.id,
        deepLink: `/admin/companies/${company.id}`,
        dedupeKey: `orch:inactivity:admin:onboarding:${company.id}:${staffId}`,
        escalationTarget: "admin",
        inactivityReason: "Founder onboarding stalled beyond SLA window.",
      });
    }
  }

  const { data: pendingInvestors } = await supabase
    .from("investor_profiles")
    .select("id, profile_id, approval_status, updated_at")
    .eq("approval_status", "pending")
    .lt("updated_at", sinceIso(7))
    .limit(INACTIVITY_SCAN_LIMIT);

  for (const investor of pendingInvestors ?? []) {
    if (!investor.profile_id) continue;
    for (const staffId of staffIds.slice(0, 5)) {
      findings.push({
        trigger: "investor_approval_stalled",
        orchestrationType: "admin_attention",
        severity: "medium",
        title: "Investor approval stalled",
        message: "An investor profile has been pending approval without recent movement.",
        recipientUserId: staffId,
        role: "admin",
        entityType: "investor",
        entityId: investor.id,
        investorId: investor.id,
        deepLink: "/admin/investors",
        dedupeKey: `orch:inactivity:investor_approval:${investor.id}:${staffId}`,
        inactivityReason: "Investor approval queue inactive.",
        suggestedAction: "Review investor onboarding in admin workspace.",
      });
    }
  }

  const spvInactiveSince = sinceIso(SLA_RULES_MS.spvInactivity / (24 * 60 * 60 * 1000));
  const { data: stalledSpvs } = await supabase
    .from("spv_opportunities")
    .select("id, name, status, updated_at")
    .neq("status", "closed")
    .lt("updated_at", spvInactiveSince)
    .limit(INACTIVITY_SCAN_LIMIT);

  for (const spv of stalledSpvs ?? []) {
    for (const staffId of staffIds.slice(0, 5)) {
      findings.push({
        trigger: "workflow_inactivity",
        orchestrationType: "inactivity",
        severity: "medium",
        title: "SPV progression stalled",
        message: `${spv.name ?? "SPV"} has had no operational movement recently.`,
        recipientUserId: staffId,
        role: "admin",
        entityType: "spv",
        entityId: spv.id,
        spvId: spv.id,
        deepLink: "/admin/spvs",
        dedupeKey: `orch:inactivity:spv:${spv.id}:${staffId}`,
        inactivityReason: "SPV workflow inactive beyond SLA window.",
        escalationTarget: "spv_ops",
        suggestedAction: "Review SPV readiness and blockers.",
      });
    }
  }

  const { data: recentImports } = await supabase
    .from("operational_activity_events")
    .select("id, entity_id, created_at")
    .eq("event_type", "import_failed")
    .gte("created_at", recentSince)
    .order("created_at", { ascending: false })
    .limit(10);

  for (const evt of recentImports ?? []) {
    for (const staffId of staffIds.slice(0, 3)) {
      findings.push({
        trigger: "failed_import",
        orchestrationType: "workflow_blocked",
        severity: "high",
        title: "Failed import requires review",
        message: "A recent data import failed and needs operational follow-up.",
        recipientUserId: staffId,
        role: "admin",
        entityType: "import",
        entityId: evt.entity_id,
        deepLink: "/admin/imports",
        dedupeKey: `orch:failed_import:${evt.entity_id ?? evt.id}:${staffId}`,
        escalationTarget: "admin",
      });
    }
  }

  void recentSince;
  return findings;
}

export async function detectDormantOpportunities(
  supabase: SupabaseClient<Database>,
): Promise<OrchestrationFinding[]> {
  const findings: OrchestrationFinding[] = [];
  const dormantSince = sinceIso(21);

  const { data: interests } = await supabase
    .from("investor_interests")
    .select("id, investor_id, company_id, status, updated_at")
    .in("status", ["interested", "reviewing"])
    .lt("updated_at", dormantSince)
    .limit(INACTIVITY_SCAN_LIMIT);

  for (const row of interests ?? []) {
    if (!row.investor_id) continue;
    const { data: profile } = await supabase
      .from("investor_profiles")
      .select("profile_id")
      .eq("id", row.investor_id)
      .maybeSingle();

    if (!profile?.profile_id) continue;

    findings.push({
      trigger: "workflow_inactivity",
      orchestrationType: "inactivity",
      severity: "low",
      title: "Opportunity follow-up dormant",
      message: "A saved opportunity has had no recent investor activity.",
      recipientUserId: profile.profile_id,
      role: "investor",
      entityType: "company",
      entityId: row.company_id,
      companyId: row.company_id,
      investorId: row.investor_id,
      deepLink: actionCenterBasePath("investor"),
      dedupeKey: `orch:dormant:opportunity:${row.id}`,
      inactivityReason: "No investor response on opportunity pipeline.",
      suggestedAction: "Review opportunity in Action Center or interest pipeline.",
    });
  }

  return findings;
}
