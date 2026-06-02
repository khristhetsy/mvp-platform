import { createServiceRoleClient } from "@/lib/supabase/admin";
import { isPaymentsEnabled } from "@/lib/billing/pricing-guard";
import { getEnvironmentStatusSummary } from "@/lib/env";
import { isPrivateBetaMode } from "@/lib/env/private-beta";
import { isGoogleOAuthConfigured } from "@/lib/integrations/google-env";
import { verifyMigrationsApplied } from "@/lib/operations/migration-verification";
import { runSecurityVerification } from "@/lib/operations/security-verification";
import { buildOperationalSnapshot, type OperationalSystemSnapshot } from "@/lib/operations/system-snapshot";

export type LaunchReadinessSnapshot = {
  generatedAt: string;
  operational: OperationalSystemSnapshot;
  environment: ReturnType<typeof getEnvironmentStatusSummary> & {
    stripeConfigured: boolean;
    privateBetaMode: boolean;
  };
  migrations: Awaited<ReturnType<typeof verifyMigrationsApplied>>;
  security: Awaited<ReturnType<typeof runSecurityVerification>>;
  operations: {
    pendingCompanyReviews: number;
    pendingInvestorApprovals: number;
    unresolvedDealRoomQuestions: number;
    unresolvedDealRoomDocRequests: number;
    failedAutomationRuns: number;
    failedOrchestrationRuns: number;
  };
  betaOnboarding: {
    foundersTotal: number;
    foundersWithCompany: number;
    investorsTotal: number;
    investorsApproved: number;
    investorsPendingReview: number;
  };
  readyForPrivateBeta: boolean;
  blockers: string[];
};

export async function buildLaunchReadinessSnapshot(): Promise<LaunchReadinessSnapshot> {
  const admin = createServiceRoleClient();
  const [operational, migrations, security, env] = await Promise.all([
    buildOperationalSnapshot(),
    verifyMigrationsApplied(),
    runSecurityVerification(),
    Promise.resolve(getEnvironmentStatusSummary()),
  ]);

  function countFrom(result: { count: number | null; error: unknown }) {
    if (result.error) return 0;
    return result.count ?? 0;
  }

  const [
    pendingCompaniesRes,
    pendingInvestorsRes,
    unresolvedQuestionsRes,
    unresolvedDocsRes,
    failedAutomationRes,
    failedOrchestrationRes,
    founderProfilesRes,
    founderCompaniesRes,
    investorProfilesRes,
    investorsApprovedRes,
    investorsPendingRes,
  ] = await Promise.all([
    admin.from("companies").select("id", { count: "exact", head: true }).eq("review_status", "pending"),
    admin
      .from("investor_profiles")
      .select("id", { count: "exact", head: true })
      .in("approval_status", ["submitted", "changes_requested"]),
    admin
      .from("deal_room_questions")
      .select("id", { count: "exact", head: true })
      .neq("status", "resolved"),
    admin
      .from("deal_room_document_requests")
      .select("id", { count: "exact", head: true })
      .neq("status", "fulfilled")
      .neq("status", "cancelled"),
    admin.from("automation_runs").select("id", { count: "exact", head: true }).eq("status", "failed"),
    admin.from("orchestration_runs").select("id", { count: "exact", head: true }).eq("status", "failed"),
    admin.from("profiles").select("id", { count: "exact", head: true }).eq("role", "founder"),
    admin.from("companies").select("id", { count: "exact", head: true }),
    admin.from("investor_profiles").select("id", { count: "exact", head: true }),
    admin
      .from("investor_profiles")
      .select("id", { count: "exact", head: true })
      .eq("approval_status", "approved"),
    admin
      .from("investor_profiles")
      .select("id", { count: "exact", head: true })
      .in("approval_status", ["submitted", "changes_requested", "draft"]),
  ]);

  const blockers: string[] = [];
  if (!migrations.ok) blockers.push(migrations.detail);
  if (!security.ok) blockers.push("One or more security verification checks failed");
  if (!env.envValidationOk) blockers.push("Required environment variables are missing");
  if (!env.serviceRoleConfigured) blockers.push("SUPABASE_SERVICE_ROLE_KEY is not configured");

  const environment = {
    ...env,
    stripeConfigured: isPaymentsEnabled(),
    privateBetaMode: isPrivateBetaMode(),
  };

  const readyForPrivateBeta =
    blockers.length === 0 && migrations.ok && security.ok && env.serviceRoleConfigured;

  return {
    generatedAt: new Date().toISOString(),
    operational,
    environment,
    migrations,
    security,
    operations: {
      pendingCompanyReviews: countFrom(pendingCompaniesRes),
      pendingInvestorApprovals: countFrom(pendingInvestorsRes),
      unresolvedDealRoomQuestions: countFrom(unresolvedQuestionsRes),
      unresolvedDealRoomDocRequests: countFrom(unresolvedDocsRes),
      failedAutomationRuns: countFrom(failedAutomationRes),
      failedOrchestrationRuns: countFrom(failedOrchestrationRes),
    },
    betaOnboarding: {
      foundersTotal: countFrom(founderProfilesRes),
      foundersWithCompany: countFrom(founderCompaniesRes),
      investorsTotal: countFrom(investorProfilesRes),
      investorsApproved: countFrom(investorsApprovedRes),
      investorsPendingReview: countFrom(investorsPendingRes),
    },
    readyForPrivateBeta,
    blockers,
  };
}
