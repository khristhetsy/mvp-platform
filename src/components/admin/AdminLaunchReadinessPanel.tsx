import { useTranslations } from "next-intl";
import Link from "next/link";
import { MIGRATION_VERIFICATION_UNAVAILABLE } from "@/lib/operations/migration-verification";
import type { LaunchReadinessSnapshot } from "@/lib/operations/launch-readiness";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { MetricCard } from "@/components/MetricCard";

function StatusRow({
  label,
  ok,
  detail,
}: Readonly<{ label: string; ok: boolean; detail?: string }>) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-slate-200/80 bg-white px-3 py-2 text-sm">
      <span className="font-medium text-slate-800">{label}</span>
      <span className={ok ? "font-medium text-emerald-700" : "font-medium text-amber-800"}>
        {ok ? "OK" : "Action needed"}
      </span>
      {detail ? <span className="w-full text-xs text-slate-500">{detail}</span> : null}
    </li>
  );
}

export function AdminLaunchReadinessPanel({
  snapshot,
}: Readonly<{ snapshot: LaunchReadinessSnapshot }>) {
  const t = useTranslations("adminCmp");
  const { environment, migrations, security, operations, betaOnboarding } = snapshot;
  const migrationSkipped =
    migrations.verificationUnavailable || migrations.detail.startsWith(MIGRATION_VERIFICATION_UNAVAILABLE);
  const securitySkipped =
    security.verificationUnavailable ||
    security.checks.some((check) => check.detail.startsWith(MIGRATION_VERIFICATION_UNAVAILABLE));

  return (
    <div className="space-y-6">
      <WorkspacePanel
        title={t("private_beta_launch_readiness")}
        subtitle={`Generated ${new Date(snapshot.generatedAt).toLocaleString("en-US")}`}
        className={snapshot.readyForPrivateBeta ? "" : "ring-1 ring-amber-200"}
      >
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              snapshot.readyForPrivateBeta
                ? "bg-emerald-100 text-emerald-800"
                : "bg-amber-100 text-amber-900"
            }`}
          >
            {snapshot.readyForPrivateBeta ? "Ready for staff-supervised beta" : "Blockers present"}
          </span>
          {environment.privateBetaMode ? (
            <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-800">
              Private Beta Mode ON
            </span>
          ) : (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              Private Beta Mode off
            </span>
          )}
        </div>

        {snapshot.blockers.length > 0 ? (
          <ul className="mb-4 list-disc space-y-1 pl-5 text-sm text-amber-900">
            {snapshot.blockers.map((blocker) => (
              <li key={blocker}>{blocker}</li>
            ))}
          </ul>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label={t("pending_company_reviews")}
            value={String(operations.pendingCompanyReviews)}
            detail="review_status=pending"
            accent="slate"
            href="/admin/companies"
          />
          <MetricCard
            label={t("investor_approvals_queue")}
            value={String(operations.pendingInvestorApprovals)}
            detail="submitted / changes_requested"
            accent="violet"
            href="/admin/investors"
          />
          <MetricCard
            label={t("deal_room_questions")}
            value={String(operations.unresolvedDealRoomQuestions)}
            detail="unresolved"
            accent="blue"
            href="/admin/deal-rooms"
          />
          <MetricCard
            label={t("deal_room_doc_requests")}
            value={String(operations.unresolvedDealRoomDocRequests)}
            detail="not fulfilled"
            accent="slate"
            href="/admin/deal-rooms"
          />
        </section>
      </WorkspacePanel>

      <div className="grid gap-6 xl:grid-cols-2">
        <WorkspacePanel title={t("migrations")} subtitle={t("database_floor_verification")}>
          <ul className="space-y-2">
            <StatusRow
              label={t("required_floor_applied")}
              ok={migrations.verificationUnavailable ? true : migrations.ok}
              detail={migrations.detail}
            />
            <StatusRow
              label={t("repo_latest_migration")}
              ok={Boolean(migrations.repoLatest)}
              detail={`${migrations.repoLatest ?? "—"} (${migrations.repoTotal} files)`}
            />
            <StatusRow
              label={t("applied_latest_migration")}
              ok={migrationSkipped ? true : migrations.floorApplied}
              detail={
                migrationSkipped
                  ? migrations.detail
                  : `${migrations.appliedLatest ?? "none"} (${migrations.appliedTotal ?? 0} applied)`
              }
            />
          </ul>
        </WorkspacePanel>

        <WorkspacePanel title={t("environment_integrations")} subtitle={t("no_secret_values_shown")}>
          <ul className="space-y-2">
            <StatusRow label={t("env_validation")} ok={environment.envValidationOk} />
            <StatusRow label={t("service_role_configured")} ok={environment.serviceRoleConfigured} />
            <StatusRow label={t("cron_secret_orchestration")} ok={environment.cronConfigured} />
            <StatusRow label={t("claude_ai_configured")} ok={environment.claudeConfigured} />
            <StatusRow
              label={t("stripe_payments")}
              ok={environment.stripeConfigured}
              detail={environment.stripeConfigured ? "Enabled" : "Disabled (expected for private beta)"}
            />
            <StatusRow label={t("google_oauth_configured")} ok={environment.googleOAuthConfigured} />
            <StatusRow label={t("private_beta_mode")} ok={environment.privateBetaMode} detail={environment.privateBetaMode ? "ON" : "OFF"} />
          </ul>
        </WorkspacePanel>
      </div>

      <WorkspacePanel
        title={t("security_verification")}
        subtitle={securitySkipped ? "Optional — skipped when migration verification unavailable" : "Admin-only structural checks"}
      >
        <ul className="space-y-2">
          {security.checks.map((check) => (
            <StatusRow
              key={check.id}
              label={check.label}
              ok={securitySkipped ? true : check.ok}
              detail={check.detail}
            />
          ))}
        </ul>
        {securitySkipped ? (
          <p className="mt-3 text-xs text-slate-500">
            Optional: set <code className="rounded bg-slate-100 px-1">DATABASE_URL</code> on the deployment to verify
            triggers and RLS policies. The app does not require it for normal operation.
          </p>
        ) : null}
      </WorkspacePanel>

      <WorkspacePanel title={t("beta_onboarding_visibility")} subtitle={t("curated_cohort_status")}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label={t("founders")} value={String(betaOnboarding.foundersTotal)} detail="profiles" accent="indigo" href="/admin/companies" />
          <MetricCard
            label={t("companies")}
            value={String(betaOnboarding.foundersWithCompany)}
            detail="founder companies"
            accent="violet"
            href="/admin/companies"
          />
          <MetricCard label={t("investors")} value={String(betaOnboarding.investorsTotal)} detail="profiles" accent="blue" href="/admin/investors" />
          <MetricCard
            label={t("approved_investors")}
            value={String(betaOnboarding.investorsApproved)}
            detail={`${betaOnboarding.investorsPendingReview} pending onboarding/approval`}
            accent="slate"
            href="/admin/investors"
          />
        </div>
        <p className="mt-4 text-xs text-slate-500">
          <Link href="/admin/investors" className="font-semibold text-indigo-700 hover:underline">
            Review investors
          </Link>
          {" · "}
          <Link href="/admin/companies" className="font-semibold text-indigo-700 hover:underline">
            Review companies
          </Link>
          {" · "}
          <Link href="/admin/deal-rooms" className="font-semibold text-indigo-700 hover:underline">
            Deal rooms
          </Link>
        </p>
      </WorkspacePanel>

      <WorkspacePanel title={t("automation_health")} subtitle={t("recent_operational_runs")}>
        <ul className="space-y-2">
          <StatusRow
            label={t("failed_automation_runs")}
            ok={operations.failedAutomationRuns === 0}
            detail={`${operations.failedAutomationRuns} failed`}
          />
          <StatusRow
            label={t("failed_orchestration_runs")}
            ok={operations.failedOrchestrationRuns === 0}
            detail={`${operations.failedOrchestrationRuns} failed`}
          />
          <StatusRow
            label={t("last_automation_run")}
            ok={snapshot.operational.automation.lastAutomationRun?.status !== "failed"}
            detail={
              snapshot.operational.automation.lastAutomationRun
                ? `${snapshot.operational.automation.lastAutomationRun.status ?? "unknown"} · ${snapshot.operational.automation.lastAutomationRun.startedAt ?? ""}`
                : "No runs recorded"
            }
          />
          <StatusRow
            label={t("last_orchestration_run")}
            ok={snapshot.operational.automation.lastOrchestrationRun?.status !== "failed"}
            detail={
              snapshot.operational.automation.lastOrchestrationRun
                ? `${snapshot.operational.automation.lastOrchestrationRun.status ?? "unknown"} · ${snapshot.operational.automation.lastOrchestrationRun.startedAt ?? ""}`
                : "No runs recorded"
            }
          />
        </ul>
        <p className="mt-3 text-xs text-slate-500">
          <Link href="/admin/automation" className="font-semibold text-indigo-700 hover:underline">
            Automation center
          </Link>
          {" · "}
          <Link href="/admin/queues" className="font-semibold text-indigo-700 hover:underline">
            Queues
          </Link>
        </p>
      </WorkspacePanel>
    </div>
  );
}
