import Link from "next/link";
import { AdminBetaFeedbackActions } from "@/components/admin/beta/AdminBetaFeedbackActions";
import { AdminBetaSupportActions } from "@/components/admin/beta/AdminBetaSupportActions";
import { MetricCard } from "@/components/MetricCard";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { getAppUrl } from "@/lib/env";
import type { BetaOperationsSnapshot } from "@/lib/operations/beta-operations-snapshot";

function MilestoneDots({ completed, total }: { completed: number; total: number }) {
  return (
    <span className="text-xs text-slate-500">
      {completed}/{total} milestones
    </span>
  );
}

function ReliabilityRow({ label, ok, detail }: { label: string; ok: boolean; detail?: string }) {
  return (
    <li className="flex flex-wrap justify-between gap-2 rounded-lg border border-slate-200/80 px-3 py-2 text-sm">
      <span className="font-medium text-slate-800">{label}</span>
      <span className={ok ? "text-emerald-700" : "text-amber-800"}>{ok ? "OK" : "Check"}</span>
      {detail ? <span className="w-full text-xs text-slate-500">{detail}</span> : null}
    </li>
  );
}

export function AdminBetaOperationsDashboard({ snapshot }: { snapshot: BetaOperationsSnapshot }) {
  const appBase = getAppUrl() ?? "http://localhost:3000";
  const loginLink = `${appBase}/auth/sign-in`;
  const { summary, reliability, operations, founders, investors, inactivityFlags, usage, recentEvents, feedbackQueue } =
    snapshot;

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Active founders (7d)" value={String(summary.activeFounders)} detail="Recent activity" accent="indigo" href="/admin/companies" />
        <MetricCard label="Active investors (7d)" value={String(summary.activeInvestors)} detail="Recent activity" accent="violet" href="/admin/investors" />
        <MetricCard
          label="Founder onboarding avg"
          value={`${summary.founderOnboardingCompletionPercent}%`}
          detail={`${summary.pendingFounderOnboarding} pending companies`}
          accent="blue"
          href="/admin/companies"
        />
        <MetricCard
          label="Investor approvals queue"
          value={String(summary.pendingInvestorApprovals)}
          detail={`${summary.openBetaFeedback} open feedback`}
          accent="slate"
          href="/admin/investors"
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <WorkspacePanel title="Reliability indicators" subtitle="Launch + integration status">
          <ul className="space-y-2">
            <ReliabilityRow label="Migrations verified" ok={reliability.migrationsVerified} />
            <ReliabilityRow label="Private beta mode" ok={reliability.privateBetaMode} detail={reliability.privateBetaMode ? "ON" : "OFF"} />
            <ReliabilityRow label="Claude AI" ok={reliability.claudeConfigured} detail={reliability.claudeConfigured ? "Configured" : "Unconfigured"} />
            <ReliabilityRow label="Stripe" ok={reliability.stripeConfigured} detail={reliability.stripeConfigured ? "Enabled" : "Disabled"} />
            <ReliabilityRow label="Google OAuth" ok={reliability.googleOAuthConfigured} />
            <ReliabilityRow label="Cron / orchestration" ok={reliability.cronOperational} />
            <ReliabilityRow
              label="Launch readiness"
              ok={snapshot.launchReadiness.readyForPrivateBeta}
              detail={snapshot.launchReadiness.readyForPrivateBeta ? "Green" : snapshot.launchReadiness.blockers.join("; ")}
            />
          </ul>
          <Link href="/admin/system-health" className="mt-3 inline-block text-xs font-semibold text-indigo-700 hover:underline">
            System health details
          </Link>
        </WorkspacePanel>

        <WorkspacePanel title="Operations queue" subtitle="Failures and unresolved items">
          <ul className="space-y-2 text-sm text-slate-700">
            <li>Unresolved deal room questions: {operations.unresolvedDealRoomQuestions}</li>
            <li>Unresolved doc requests: {operations.unresolvedDealRoomDocRequests}</li>
            <li>Failed automations: {operations.failedAutomationRuns}</li>
            <li>Failed orchestration: {operations.failedOrchestrationRuns}</li>
            <li>Failed notifications (30d): {operations.failedNotifications}</li>
            <li>Failed uploads (30d): {operations.failedUploads}</li>
            <li>Deal room activity (7d): {operations.dealRoomActivityLast7d}</li>
            <li>Inactive founders: {summary.inactiveFounders} · Inactive investors: {summary.inactiveInvestors}</li>
            <li>Avg founder activation: {summary.averageFounderActivationDays ?? "—"} days</li>
            <li>Avg investor activation: {summary.averageInvestorActivationDays ?? "—"} days</li>
          </ul>
        </WorkspacePanel>
      </div>

      <WorkspacePanel title="Usage analytics (30d / 7d)" subtitle="Deterministic module engagement">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">Founder modules</p>
            <ul className="mt-2 space-y-1 text-sm text-slate-700">
              {usage.founderModules.length === 0 ? (
                <li>No operational events yet</li>
              ) : (
                usage.founderModules.map((row) => (
                  <li key={row.module}>
                    {row.module}: {row.count}
                  </li>
                ))
              )}
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">Investor modules</p>
            <ul className="mt-2 space-y-1 text-sm text-slate-700">
              {usage.investorModules.length === 0 ? (
                <li>No operational events yet</li>
              ) : (
                usage.investorModules.map((row) => (
                  <li key={row.module}>
                    {row.module}: {row.count}
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Learning: {usage.learningEngagement.lessonsCompletedLast7d} lessons completed ·{" "}
          {usage.learningEngagement.activeFoundersLast7d} active founders · Deal rooms: {usage.dealRoomEngagement.activeRooms}{" "}
          active · {usage.dealRoomEngagement.questionsLast7d} questions (7d)
        </p>
      </WorkspacePanel>

      <WorkspacePanel title="Inactivity & stall flags" subtitle={`${inactivityFlags.length} flagged`}>
        {inactivityFlags.length === 0 ? (
          <p className="text-sm text-slate-600">No inactivity flags.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {inactivityFlags.slice(0, 20).map((flag) => (
              <div key={`${flag.profileId}-${flag.flag}`} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <div>
                  <p className="font-medium text-slate-900">
                    {flag.name} · {flag.role}
                  </p>
                  <p className="text-xs text-slate-500">
                    {flag.detail} · {flag.severity}
                  </p>
                </div>
                <Link href={flag.deepLink} className="text-xs font-semibold text-indigo-700 hover:underline">
                  Open
                </Link>
              </div>
            ))}
          </div>
        )}
      </WorkspacePanel>

      <WorkspacePanel title="Operational event stream" subtitle="Recent critical + admin events">
        {recentEvents.length === 0 ? (
          <p className="text-sm text-slate-600">No recent events.</p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {recentEvents.map((event) => (
              <li key={event.id} className="py-2">
                <p className="font-medium text-slate-900">
                  {event.title} · <span className="text-xs uppercase text-slate-500">{event.severity}</span>
                </p>
                <p className="text-xs text-slate-500">
                  {event.event_category} · {new Date(event.created_at).toLocaleString("en-US")}
                  {event.company_name ? ` · ${event.company_name}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </WorkspacePanel>

      <WorkspacePanel title="Beta feedback queue" subtitle={`${feedbackQueue.length} open`}>
        {feedbackQueue.length === 0 ? (
          <p className="text-sm text-slate-600">No open feedback.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {feedbackQueue.map((item) => (
              <div key={item.id} className="py-3 text-sm">
                <p className="font-medium text-slate-900">
                  [{item.severity}] {item.category} · {item.submitterName ?? item.profileId}
                </p>
                <p className="mt-1 text-slate-600">{item.message}</p>
                <p className="mt-1 text-xs text-slate-500">{new Date(item.createdAt).toLocaleString("en-US")} · {item.status}</p>
                <AdminBetaFeedbackActions feedbackId={item.id} status={item.status} />
              </div>
            ))}
          </div>
        )}
      </WorkspacePanel>

      <WorkspacePanel title="Founder activation" subtitle="Recent founders">
        <div className="divide-y divide-slate-100">
          {founders.map((founder) => (
            <div key={founder.profileId} className="py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{founder.name}</p>
                  <p className="text-xs text-slate-500">
                    Onboarding {founder.onboardingPercent}% · <MilestoneDots completed={founder.completedCount} total={founder.totalMilestones} />
                  </p>
                </div>
                <AdminBetaSupportActions
                  profileId={founder.profileId}
                  role="founder"
                  companyId={founder.companyId}
                  loginLink={loginLink}
                  signupLink={`${appBase}/auth/sign-up?role=founder`}
                />
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {founder.milestones.map((m) => (
                  <span
                    key={m.key}
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${m.achieved ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"}`}
                  >
                    {m.label}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </WorkspacePanel>

      <WorkspacePanel title="Investor activation" subtitle="Recent investors">
        <div className="divide-y divide-slate-100">
          {investors.map((investor) => (
            <div key={investor.profileId} className="py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{investor.name}</p>
                  <p className="text-xs text-slate-500">
                    {investor.approvalStatus} · <MilestoneDots completed={investor.completedCount} total={investor.totalMilestones} />
                  </p>
                </div>
                <AdminBetaSupportActions
                  profileId={investor.profileId}
                  role="investor"
                  investorProfileId={investor.investorProfileId}
                  loginLink={loginLink}
                  signupLink={`${appBase}/auth/sign-up?role=investor`}
                />
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {investor.milestones.map((m) => (
                  <span
                    key={m.key}
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${m.achieved ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"}`}
                  >
                    {m.label}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </WorkspacePanel>
    </div>
  );
}
