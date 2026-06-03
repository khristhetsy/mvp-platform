import Link from "next/link";
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
  const { environment, migrations, security, operations, betaOnboarding } = snapshot;

  return (
    <div className="space-y-6">
      <WorkspacePanel
        title="Private beta launch readiness"
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
            label="Pending company reviews"
            value={String(operations.pendingCompanyReviews)}
            detail="review_status=pending"
            accent="slate"
          />
          <MetricCard
            label="Investor approvals queue"
            value={String(operations.pendingInvestorApprovals)}
            detail="submitted / changes_requested"
            accent="violet"
          />
          <MetricCard
            label="Deal room questions"
            value={String(operations.unresolvedDealRoomQuestions)}
            detail="unresolved"
            accent="blue"
          />
          <MetricCard
            label="Deal room doc requests"
            value={String(operations.unresolvedDealRoomDocRequests)}
            detail="not fulfilled"
            accent="slate"
          />
        </section>
      </WorkspacePanel>

      <div className="grid gap-6 xl:grid-cols-2">
        <WorkspacePanel title="Migrations" subtitle="Database floor verification">
          <ul className="space-y-2">
            <StatusRow
              label="Required floor applied"
              ok={migrations.verificationUnavailable ? true : migrations.ok}
              detail={migrations.detail}
            />
            <StatusRow
              label="Repo latest migration"
              ok={Boolean(migrations.repoLatest)}
              detail={`${migrations.repoLatest ?? "—"} (${migrations.repoTotal} files)`}
            />
            <StatusRow
              label="Applied latest migration"
              ok={migrations.verificationUnavailable ? true : migrations.floorApplied}
              detail={
                migrations.verificationUnavailable
                  ? migrations.detail
                  : migrations.databaseQueryable
                    ? `${migrations.appliedLatest ?? "none"} (${migrations.appliedTotal ?? 0} applied)`
                    : migrations.detail
              }
            />
          </ul>
        </WorkspacePanel>

        <WorkspacePanel title="Environment & integrations" subtitle="No secret values shown">
          <ul className="space-y-2">
            <StatusRow label="Env validation" ok={environment.envValidationOk} />
            <StatusRow label="Service role configured" ok={environment.serviceRoleConfigured} />
            <StatusRow label="Cron secret (orchestration)" ok={environment.cronConfigured} />
            <StatusRow label="OpenAI configured" ok={environment.openAiConfigured} />
            <StatusRow
              label="Stripe payments"
              ok={environment.stripeConfigured}
              detail={environment.stripeConfigured ? "Enabled" : "Disabled (expected for private beta)"}
            />
            <StatusRow label="Google OAuth configured" ok={environment.googleOAuthConfigured} />
            <StatusRow label="Private beta mode" ok={environment.privateBetaMode} detail={environment.privateBetaMode ? "ON" : "OFF"} />
          </ul>
        </WorkspacePanel>
      </div>

      <WorkspacePanel title="Security verification" subtitle="Admin-only structural checks">
        <ul className="space-y-2">
          {security.checks.map((check) => (
            <StatusRow key={check.id} label={check.label} ok={check.ok} detail={check.detail} />
          ))}
        </ul>
        {security.verificationUnavailable ? (
          <p className="mt-3 text-xs text-slate-500">
            Optional: set <code className="rounded bg-slate-100 px-1">DATABASE_URL</code> on the deployment to verify
            triggers and RLS policies. The app does not require it for normal operation.
          </p>
        ) : null}
      </WorkspacePanel>

      <WorkspacePanel title="Beta onboarding visibility" subtitle="Curated cohort status">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Founders" value={String(betaOnboarding.foundersTotal)} detail="profiles" accent="indigo" />
          <MetricCard
            label="Companies"
            value={String(betaOnboarding.foundersWithCompany)}
            detail="founder companies"
            accent="violet"
          />
          <MetricCard label="Investors" value={String(betaOnboarding.investorsTotal)} detail="profiles" accent="blue" />
          <MetricCard
            label="Approved investors"
            value={String(betaOnboarding.investorsApproved)}
            detail={`${betaOnboarding.investorsPendingReview} pending onboarding/approval`}
            accent="slate"
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

      <WorkspacePanel title="Automation health" subtitle="Recent operational runs">
        <ul className="space-y-2">
          <StatusRow
            label="Failed automation runs"
            ok={operations.failedAutomationRuns === 0}
            detail={`${operations.failedAutomationRuns} failed`}
          />
          <StatusRow
            label="Failed orchestration runs"
            ok={operations.failedOrchestrationRuns === 0}
            detail={`${operations.failedOrchestrationRuns} failed`}
          />
          <StatusRow
            label="Last automation run"
            ok={snapshot.operational.automation.lastAutomationRun?.status !== "failed"}
            detail={
              snapshot.operational.automation.lastAutomationRun
                ? `${snapshot.operational.automation.lastAutomationRun.status ?? "unknown"} · ${snapshot.operational.automation.lastAutomationRun.startedAt ?? ""}`
                : "No runs recorded"
            }
          />
          <StatusRow
            label="Last orchestration run"
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
