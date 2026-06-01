import type { SupabaseClient } from "@supabase/supabase-js";
import type { AutomationPlannedAction, AutomationTriggerContext } from "@/lib/automation/types";
import { planCriticalComplianceEscalation, planRepeatedOverdueEscalation } from "@/lib/automation/escalation-rules";
import {
  resolveCompanyDependencies,
  resolveEntityDependencies,
  resolveSpvDependencies,
} from "@/lib/automation/dependencies";
import { listStaffProfileIds } from "@/lib/notifications/notifications";
import type { NextBestActionRecord } from "@/lib/next-best-actions/types";
import type { Database } from "@/lib/supabase/types";

async function staffTargetId(): Promise<string | null> {
  const ids = await listStaffProfileIds();
  return ids[0] ?? null;
}

export async function planFounderWorkflows(
  supabase: SupabaseClient<Database>,
  ctx: AutomationTriggerContext,
): Promise<AutomationPlannedAction[]> {
  const planned: AutomationPlannedAction[] = [];
  const companyId = ctx.companyId ?? (ctx.entityType === "company" ? ctx.entityId : null);
  if (!companyId) return planned;

  const { data: company } = await supabase
    .from("companies")
    .select("founder_id, review_status")
    .eq("id", companyId)
    .maybeSingle();

  const founderId = company?.founder_id;
  if (!founderId) return planned;

  if (ctx.triggerType === "onboarding_progress" || ctx.eventType === "founder_onboarding_completed") {
    planned.push({
      ruleId: "founder_onboarding_readiness_review",
      actionType: "create_nba",
      title: "Readiness review after onboarding",
      reason: "Onboarding milestone reached — readiness review recommended.",
      dedupeKey: `auto:founder:onboarding_review:${companyId}`,
      targetUserId: founderId,
      nba: {
        id: `founder_readiness_review_${companyId}`,
        role: "founder",
        title: "Review readiness checklist",
        description: "Complete readiness review after onboarding progress.",
        priority: "high",
        category: "readiness",
        entityType: "company",
        entityId: companyId,
        companyId,
        href: `/founder/readiness`,
        sourceModule: "workflow_automation",
        reason: "Automated follow-up after onboarding progress.",
        blockers: [],
        createdFrom: "workflow_automation",
        metadata: { automation_rule: "founder_onboarding_readiness_review" },
      },
    });
  }

  if (ctx.eventType?.includes("document") || ctx.metadata?.documentType === "pitch_deck") {
    planned.push({
      ruleId: "founder_pitch_deck_readiness",
      actionType: "readiness_recompute",
      title: "Recompute readiness after pitch deck",
      reason: "Document upload triggers readiness recalculation.",
      dedupeKey: `auto:founder:pitch_recompute:${companyId}`,
      targetUserId: founderId,
      operationalEvent: {
        eventType: "workflow_automation_completed",
        title: "Readiness recompute scheduled",
      },
      metadata: { companyId },
    });
  }

  const deps = await resolveCompanyDependencies(supabase, companyId);
  const openRemediation = deps.find((d) => d.blocker === "Remediation incomplete");
  if (!openRemediation && ctx.triggerType === "remediation_update") {
    planned.push({
      ruleId: "founder_remediation_resolved",
      actionType: "update_nba_status",
      title: "Close remediation follow-up",
      reason: "Remediation tasks resolved.",
      dedupeKey: `auto:founder:remediation_close:${companyId}`,
      targetUserId: founderId,
      metadata: { companyId, desiredStatus: "completed", actionTypeKey: "founder_remediation" },
    });
  }

  const readinessDep = deps.find((d) => d.blocker === "Readiness threshold");
  if (!readinessDep && company?.review_status === "approved") {
    planned.push({
      ruleId: "founder_investor_visibility",
      actionType: "follow_up_task",
      title: "Investor visibility recommendation",
      reason: "Readiness threshold met — consider marketplace visibility.",
      dedupeKey: `auto:founder:visibility:${companyId}`,
      targetUserId: founderId,
      nba: {
        id: `founder_marketplace_visibility_${companyId}`,
        role: "founder",
        title: "Review marketplace visibility",
        description: "Readiness supports investor visibility review.",
        priority: "medium",
        category: "investor_engagement",
        entityType: "company",
        entityId: companyId,
        companyId,
        href: `/founder/settings`,
        sourceModule: "workflow_automation",
        reason: "Automated recommendation when readiness threshold reached.",
        blockers: [],
        createdFrom: "workflow_automation",
        metadata: {},
      },
    });
  }

  return planned;
}

export async function planInvestorWorkflows(
  supabase: SupabaseClient<Database>,
  ctx: AutomationTriggerContext,
): Promise<AutomationPlannedAction[]> {
  const planned: AutomationPlannedAction[] = [];
  const investorId = ctx.investorId ?? (ctx.entityType === "investor" ? ctx.entityId : null);
  if (!investorId) return planned;

  const { data: investor } = await supabase
    .from("investor_profiles")
    .select("id, profile_id, approval_status")
    .eq("id", investorId)
    .maybeSingle();

  const profileId = investor?.profile_id;
  if (!profileId) return planned;

  const staffId = await staffTargetId();

  if (ctx.triggerType === "investor_approval" && investor?.approval_status === "pending" && staffId) {
    planned.push({
      ruleId: "investor_approval_admin_review",
      actionType: "create_nba",
      title: "Admin investor approval review",
      reason: "Investor submitted profile for approval.",
      dedupeKey: `auto:investor:approval:${investorId}`,
      targetUserId: staffId,
      nba: {
        id: `admin_investor_approval_${investorId}`,
        role: "admin",
        title: "Review investor approval",
        description: "Investor onboarding submitted for approval.",
        priority: "high",
        category: "admin_review",
        entityType: "investor",
        entityId: investorId,
        investorId,
        href: `/admin/investors`,
        sourceModule: "workflow_automation",
        reason: "Automated admin review action.",
        blockers: [],
        createdFrom: "workflow_automation",
        metadata: {},
      },
    });
  }

  if (investor?.approval_status === "approved") {
    planned.push({
      ruleId: "investor_unlock_workflows",
      actionType: "follow_up_task",
      title: "Unlock investor workflows",
      reason: "Investor approved — SPV and opportunity workflows available.",
      dedupeKey: `auto:investor:unlock:${investorId}`,
      targetUserId: profileId,
      nba: {
        id: `investor_explore_spv_${investorId}`,
        role: "investor",
        title: "Explore SPV opportunities",
        description: "Your profile is approved. Review SPV participations.",
        priority: "medium",
        category: "spv",
        entityType: "investor",
        entityId: investorId,
        investorId,
        href: `/investor/spvs`,
        sourceModule: "workflow_automation",
        reason: "Post-approval workflow unlock.",
        blockers: [],
        createdFrom: "workflow_automation",
        metadata: {},
      },
    });
  }

  return planned;
}

export async function planAdminWorkflows(
  supabase: SupabaseClient<Database>,
  ctx: AutomationTriggerContext,
  activeRows: NextBestActionRecord[],
): Promise<AutomationPlannedAction[]> {
  const planned: AutomationPlannedAction[] = [];
  const staffId = await staffTargetId();
  if (!staffId) return planned;

  planned.push(...planRepeatedOverdueEscalation(activeRows, staffId));

  if (ctx.triggerType === "import_failure") {
    planned.push({
      ruleId: "admin_failed_import",
      actionType: "create_nba",
      title: "Failed import remediation",
      reason: "Import failure requires admin operational follow-up.",
      dedupeKey: `auto:admin:import:${ctx.sourceEventId ?? "scan"}`,
      targetUserId: staffId,
      nba: {
        id: `admin_import_failed_${Date.now()}`,
        role: "admin",
        title: "Review failed import",
        description: "A data import failed and needs operational review.",
        priority: "high",
        category: "system",
        entityType: "import",
        href: `/admin/imports`,
        sourceModule: "imports",
        reason: "Automated remediation action for failed import.",
        blockers: [],
        createdFrom: "workflow_automation",
        metadata: {},
      },
    });
  }

  if (ctx.companyId) {
    const deps = await resolveCompanyDependencies(supabase, ctx.companyId);
    if (deps.some((d) => d.blocker === "Compliance escalation")) {
      planned.push(planCriticalComplianceEscalation(ctx.companyId, staffId));
    }
    if (deps.some((d) => d.blocker === "Admin review pending")) {
      planned.push({
        ruleId: "admin_stale_review",
        actionType: "create_nba",
        title: "Stale company review",
        reason: "Company review pending without resolution.",
        dedupeKey: `auto:admin:stale_review:${ctx.companyId}`,
        targetUserId: staffId,
        nba: {
          id: `admin_company_review_${ctx.companyId}`,
          role: "admin",
          title: "Complete company review",
          description: "Company awaiting admin review.",
          priority: "medium",
          category: "admin_review",
          entityType: "company",
          entityId: ctx.companyId,
          companyId: ctx.companyId,
          href: `/admin/companies/${ctx.companyId}`,
          sourceModule: "workflow_automation",
          reason: "Stale review automation.",
          blockers: [],
          createdFrom: "workflow_automation",
          metadata: {},
        },
      });
    }
  }

  return planned;
}

export async function planSpvWorkflows(
  supabase: SupabaseClient<Database>,
  ctx: AutomationTriggerContext,
): Promise<AutomationPlannedAction[]> {
  const planned: AutomationPlannedAction[] = [];
  const spvId = ctx.spvId ?? (ctx.entityType === "spv" ? ctx.entityId : null);
  if (!spvId) return planned;

  const staffId = await staffTargetId();
  const deps = await resolveSpvDependencies(supabase, spvId);

  if (ctx.eventType === "spv_checklist_complete" || ctx.triggerType === "package_readiness") {
    planned.push({
      ruleId: "spv_readiness_recalc",
      actionType: "readiness_recompute",
      title: "SPV readiness recalculation",
      reason: "Checklist or package progress triggers readiness update.",
      dedupeKey: `auto:spv:readiness:${spvId}`,
      metadata: { spvId },
      operationalEvent: {
        eventType: "workflow_automation_completed",
        title: "SPV readiness recalculated",
      },
    });
  }

  const unresolvedCompliance = deps.length === 0;
  if (unresolvedCompliance && ctx.triggerType === "compliance_resolution" && staffId) {
    planned.push({
      ruleId: "spv_compliance_unblock",
      actionType: "operational_event",
      title: "SPV workflow unblocked",
      reason: "Compliance resolved — SPV progression may continue.",
      dedupeKey: `auto:spv:unblock:${spvId}`,
      operationalEvent: {
        eventType: "workflow_dependency_resolved",
        title: "SPV dependency resolved",
      },
      metadata: { spvId },
    });
  }

  return planned;
}

export async function evaluateWorkflowRules(
  supabase: SupabaseClient<Database>,
  ctx: AutomationTriggerContext,
  activeRows: NextBestActionRecord[],
): Promise<AutomationPlannedAction[]> {
  const [founder, investor, admin, spv] = await Promise.all([
    planFounderWorkflows(supabase, ctx),
    planInvestorWorkflows(supabase, ctx),
    planAdminWorkflows(supabase, ctx, activeRows),
    planSpvWorkflows(supabase, ctx),
  ]);

  return [...founder, ...investor, ...admin, ...spv];
}

export async function scanScheduledAutomationTriggers(
  supabase: SupabaseClient<Database>,
): Promise<AutomationTriggerContext[]> {
  const triggers: AutomationTriggerContext[] = [{ triggerType: "scheduled_scan" }];
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: events } = await supabase
    .from("operational_activity_events")
    .select("id, event_type, entity_type, entity_id, company_id, investor_id, spv_id")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(20);

  for (const evt of events ?? []) {
    triggers.push({
      triggerType: "operational_event",
      eventType: evt.event_type,
      sourceEventId: evt.id,
      entityType: evt.entity_type,
      entityId: evt.entity_id,
      companyId: evt.company_id,
      investorId: evt.investor_id,
      spvId: evt.spv_id,
    });
  }

  const { data: imports } = await supabase
    .from("operational_activity_events")
    .select("id")
    .eq("event_type", "import_failed")
    .gte("created_at", since)
    .limit(5);

  if ((imports ?? []).length > 0) {
    triggers.push({ triggerType: "import_failure", sourceEventId: imports![0].id });
  }

  return triggers;
}
