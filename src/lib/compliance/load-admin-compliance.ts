import { getComplianceMetrics, listComplianceEvents } from "@/lib/compliance/events";
import { runComplianceScans } from "@/lib/compliance/scanners";
import { getFounderOutreachAdminSummary } from "@/lib/founder-crm/admin-outreach-summary";
import { listInvestorProfilesForAdmin } from "@/lib/investor/profile";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { ComplianceEventRecord } from "@/lib/compliance/types";

export type CompanyComplianceProfile = {
  companyId: string;
  companyName: string;
  founderId: string;
  reviewStatus: string | null;
  onboardingPercent: number;
  readinessScore: number | null;
  remediationOpen: number;
  outreachTargets: number;
  socialFlagged: number;
  openEvents: number;
};

export type InvestorComplianceProfile = {
  profileId: string;
  approvalStatus: string;
  onboardingComplete: boolean;
  openEvents: number;
};

export async function loadAdminComplianceCenter() {
  const admin = createServiceRoleClient();

  const scanResult = await runComplianceScans();

  const [metrics, queue, outreach, companies, investorProfiles, events, upgradePending, trialsExpired] =
    await Promise.all([
      getComplianceMetrics(admin),
      listComplianceEvents(admin, { status: "open", limit: 50 }),
      getFounderOutreachAdminSummary(),
      admin
        .from("companies")
        .select("id, founder_id, company_name, review_status, onboarding_progress_percent")
        .order("updated_at", { ascending: false })
        .limit(80),
      listInvestorProfilesForAdmin(),
      listComplianceEvents(admin, { limit: 200 }),
      admin.from("upgrade_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
      admin
        .from("subscriptions")
        .select("id", { count: "exact", head: true })
        .eq("plan_type", "founder_trial")
        .in("subscription_status", ["expired", "canceled"]),
    ]);

  const allEvents = events.data ?? [];
  const openQueue = queue.data ?? [];

  const companyProfiles: CompanyComplianceProfile[] = [];
  for (const company of companies.data ?? []) {
    const [{ count: remediation }, { data: report }, { count: targets }, { count: social }] = await Promise.all([
      admin
        .from("founder_remediation_tasks")
        .select("id", { count: "exact", head: true })
        .eq("company_id", company.id)
        .in("status", ["open", "in_progress"]),
      admin
        .from("diligence_reports")
        .select("readiness_score")
        .eq("company_id", company.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from("founder_outreach_targets")
        .select("id", { count: "exact", head: true })
        .eq("company_id", company.id)
        .neq("status", "archived"),
      admin
        .from("social_outreach_drafts")
        .select("id", { count: "exact", head: true })
        .eq("company_id", company.id)
        .eq("compliance_status", "flagged"),
    ]);

    const openEvents = allEvents.filter(
      (event) => event.company_id === company.id && ["open", "under_review"].includes(event.status),
    ).length;

    companyProfiles.push({
      companyId: company.id,
      companyName: company.company_name,
      founderId: company.founder_id,
      reviewStatus: company.review_status,
      onboardingPercent: company.onboarding_progress_percent ?? 0,
      readinessScore: report?.readiness_score ?? null,
      remediationOpen: remediation ?? 0,
      outreachTargets: targets ?? 0,
      socialFlagged: social ?? 0,
      openEvents,
    });
  }

  const investorCompliance: InvestorComplianceProfile[] = investorProfiles.map((row) => ({
    profileId: row.profile_id,
    approvalStatus: row.approval_status,
    onboardingComplete: row.submitted_at != null,
    openEvents: allEvents.filter(
      (event) => event.investor_id === row.profile_id && ["open", "under_review"].includes(event.status),
    ).length,
  }));

  const highRiskCompanies = companyProfiles
    .filter(
      (row) =>
        row.openEvents > 0 ||
        row.socialFlagged > 0 ||
        (row.readinessScore != null && row.readinessScore < 50) ||
        row.remediationOpen > 2,
    )
    .slice(0, 12);

  const founderReadinessRisk = companyProfiles
    .filter((row) => row.readinessScore != null && row.readinessScore < 60)
    .slice(0, 10);

  const investorApprovalReview = investorProfiles
    .filter((row) => row.approval_status === "submitted" || row.approval_status === "changes_requested")
    .slice(0, 10);

  const socialCompliance = allEvents.filter((event) => event.event_type === "social_draft_flagged").slice(0, 10);
  const messagingFlags = allEvents
    .filter((event) => event.event_type === "messaging_risky_phrase" || event.event_type === "repeated_flagged_messaging")
    .slice(0, 10);

  const outreachEvents = allEvents
    .filter((event) =>
      ["outreach_abuse", "excessive_queued_outreach", "risky_fundraising_language"].includes(event.event_type),
    )
    .slice(0, 10);

  return {
    scanCreated: scanResult.created,
    metrics: metrics,
    outreach,
    openQueue: openQueue as ComplianceEventRecord[],
    underReviewQueue: allEvents.filter((event) => event.status === "under_review").slice(0, 20),
    sections: {
      founderReadinessRisk,
      investorApprovalReview,
      outreachCompliance: {
        summary: outreach,
        events: outreachEvents,
      },
      socialCompliance,
      messagingFlags,
      platformAlerts: allEvents
        .filter((event) =>
          ["trial_abuse_pattern", "missing_onboarding_data", "failed_compliance_check", "high_risk_company"].includes(
            event.event_type,
          ),
        )
        .slice(0, 12),
      subscriptionRisk: {
        pendingUpgrades: upgradePending.count ?? 0,
        expiredTrials: trialsExpired.count ?? 0,
      },
      highRiskCompanies,
      companyProfiles: companyProfiles.slice(0, 20),
      investorCompliance: investorCompliance.slice(0, 20),
    },
  };
}
