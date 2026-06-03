import { createServiceRoleClient } from "@/lib/supabase/admin";
import { isPaymentsEnabled } from "@/lib/billing/pricing-guard";
import { getEnvironmentStatusSummary } from "@/lib/env";
import { isPrivateBetaMode } from "@/lib/env/private-beta";
import { isGoogleOAuthConfigured } from "@/lib/integrations/google-env";
import {
  MIGRATION_VERIFICATION_UNAVAILABLE,
  REQUIRED_MIGRATION_FLOOR,
  verifyMigrationsApplied,
  type MigrationVerificationResult,
} from "@/lib/operations/migration-verification";
import {
  runSecurityVerification,
  type SecurityVerificationSummary,
} from "@/lib/operations/security-verification";
import { buildOperationalSnapshot, type OperationalSystemSnapshot } from "@/lib/operations/system-snapshot";

export type LaunchReadinessSnapshot = {
  generatedAt: string;
  operational: OperationalSystemSnapshot;
  environment: ReturnType<typeof getEnvironmentStatusSummary> & {
    stripeConfigured: boolean;
    privateBetaMode: boolean;
  };
  migrations: MigrationVerificationResult;
  security: SecurityVerificationSummary;
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

function countFrom(result: { count: number | null; error: unknown }) {
  if (result.error) return 0;
  return result.count ?? 0;
}

function isMigrationVerificationSkipped(migrations: MigrationVerificationResult) {
  return (
    migrations.verificationUnavailable ||
    migrations.detail.startsWith(MIGRATION_VERIFICATION_UNAVAILABLE)
  );
}

function fallbackMigrations(): MigrationVerificationResult {
  return {
    floor: REQUIRED_MIGRATION_FLOOR,
    repoLatest: null,
    repoTotal: 0,
    appliedLatest: null,
    appliedTotal: null,
    floorApplied: false,
    ok: true,
    databaseQueryable: false,
    verificationUnavailable: true,
    detail: `${MIGRATION_VERIFICATION_UNAVAILABLE} — Migration query failed`,
  };
}

function fallbackSecurity(): SecurityVerificationSummary {
  return {
    ok: false,
    checks: [
      {
        id: "database",
        label: "Database verification",
        ok: false,
        detail: `${MIGRATION_VERIFICATION_UNAVAILABLE} — Cannot verify security policies without database access`,
      },
    ],
    databaseQueryable: false,
    verificationUnavailable: true,
  };
}

async function loadOperationalSnapshotSafe(): Promise<OperationalSystemSnapshot> {
  try {
    return await buildOperationalSnapshot();
  } catch {
    return {
      generatedAt: new Date().toISOString(),
      environment: {
        appEnv: "local",
        nodeEnv: process.env.NODE_ENV ?? null,
        vercelEnv: null,
        appUrl: null,
        supabasePublicConfigured: false,
        supabaseProjectHost: null,
        serviceRoleConfigured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()),
        databaseUrlConfigured: Boolean(process.env.DATABASE_URL?.trim()),
        googleOAuthConfigured: isGoogleOAuthConfigured(),
        openAiConfigured: Boolean(process.env.OPENAI_API_KEY?.trim()),
        siteUrl: null,
        googleRedirectHost: null,
      },
      migrations: { latest: null, total: 0, files: [] },
      storage: { buckets: [], requiredBucketsPresent: {} as never },
      integrations: { googleOAuthConfigured: false, googleConnectedAccounts: 0 },
      automation: { lastAutomationRun: null, lastOrchestrationRun: null },
      counts: {
        profiles: null,
        companies: null,
        documents: null,
        notifications: null,
        spvOpportunities: null,
      },
      backup: { lastEvents: [], verificationRecommended: true },
    };
  }
}

async function loadSupabaseCounts() {
  try {
    const admin = createServiceRoleClient();
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

    return {
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
    };
  } catch {
    return {
      operations: {
        pendingCompanyReviews: 0,
        pendingInvestorApprovals: 0,
        unresolvedDealRoomQuestions: 0,
        unresolvedDealRoomDocRequests: 0,
        failedAutomationRuns: 0,
        failedOrchestrationRuns: 0,
      },
      betaOnboarding: {
        foundersTotal: 0,
        foundersWithCompany: 0,
        investorsTotal: 0,
        investorsApproved: 0,
        investorsPendingReview: 0,
      },
    };
  }
}

export async function buildLaunchReadinessSnapshot(): Promise<LaunchReadinessSnapshot> {
  try {
    const env = getEnvironmentStatusSummary();
    const [operational, migrations, security, counts] = await Promise.all([
      loadOperationalSnapshotSafe(),
      verifyMigrationsApplied().catch(() => fallbackMigrations()),
      runSecurityVerification().catch(() => fallbackSecurity()),
      loadSupabaseCounts(),
    ]);

    const blockers: string[] = [];
    
    // Only skip migration blockers if verification was unavailable (non-blocking)
    if (!migrations.verificationUnavailable && !migrations.ok) {
      blockers.push(migrations.detail);
    }
    
    // SECURITY-CRITICAL: Security checks MUST block deployment
    // Unlike migrations (which can degrade), security RLS policies are non-negotiable
    if (!security.ok) {
      blockers.push(
        security.verificationUnavailable
          ? "Security verification unavailable — cannot verify RLS policies and triggers"
          : "One or more security verification checks failed"
      );
    }
    
    if (!env.envValidationOk) blockers.push("Required environment variables are missing");
    if (!env.serviceRoleConfigured) blockers.push("SUPABASE_SERVICE_ROLE_KEY is not configured");

    const environment = {
      ...env,
      stripeConfigured: isPaymentsEnabled(),
      privateBetaMode: isPrivateBetaMode(),
    };

    // SECURITY-CRITICAL: Deployment is blocked if:
    // - Migrations can't be verified OR migrations failed (but unavailable is OK)
    // - Security checks CANNOT be verified or FAILED (unavailable is NOT OK)
    // - Environment validation failed
    // - Service role not configured
    const readyForPrivateBeta =
      blockers.length === 0 &&
      (migrations.ok || isMigrationVerificationSkipped(migrations)) &&
      security.ok &&  // NO exception for security.verificationUnavailable
      env.serviceRoleConfigured;

    return {
      generatedAt: new Date().toISOString(),
      operational,
      environment,
      migrations,
      security,
      operations: counts.operations,
      betaOnboarding: counts.betaOnboarding,
      readyForPrivateBeta,
      blockers,
    };
  } catch {
    const env = getEnvironmentStatusSummary();
    return {
      generatedAt: new Date().toISOString(),
      operational: await loadOperationalSnapshotSafe(),
      environment: {
        ...env,
        stripeConfigured: isPaymentsEnabled(),
        privateBetaMode: isPrivateBetaMode(),
      },
      migrations: fallbackMigrations(),
      security: fallbackSecurity(),
      operations: {
        pendingCompanyReviews: 0,
        pendingInvestorApprovals: 0,
        unresolvedDealRoomQuestions: 0,
        unresolvedDealRoomDocRequests: 0,
        failedAutomationRuns: 0,
        failedOrchestrationRuns: 0,
      },
      betaOnboarding: {
        foundersTotal: 0,
        foundersWithCompany: 0,
        investorsTotal: 0,
        investorsApproved: 0,
        investorsPendingReview: 0,
      },
      readyForPrivateBeta: false,
      blockers: ["Snapshot generation failed — cannot assess deployment readiness"],
    };
  }
}
