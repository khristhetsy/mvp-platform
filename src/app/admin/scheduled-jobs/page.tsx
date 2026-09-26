import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { requirePermissionPage } from "@/lib/api/permissions";
import { listCronJobs } from "@/lib/cron/jobs";
import { loadLatestCronRuns, loadPausedCrons } from "@/lib/cron/gate";
import { DISPLAY_TZ, describeSchedule, formatWhen, nextRun } from "@/lib/cron/schedule";
import { ScheduledJobsClient, type JobRow } from "@/components/admin/ScheduledJobsClient";

export const dynamic = "force-dynamic";

/** A run still "running" past the longest function limit (300s) was killed. */
const KILLED_AFTER_MS = 6 * 60_000;

export default async function AdminScheduledJobsPage() {
  const { profile } = await requirePermissionPage("manage_integrations");
  const jobs = listCronJobs();
  const [paused, runs] = await Promise.all([loadPausedCrons(), loadLatestCronRuns(jobs.map((j) => j.path))]);
  const now = new Date();

  const rows: JobRow[] = jobs.map((j) => {
    const next = nextRun(j.schedules, now);
    const run = runs.get(j.path) ?? null;
    let last: JobRow["last"] = null;
    if (run) {
      const when = formatWhen(new Date(run.started_at), now);
      const age = now.getTime() - new Date(run.started_at).getTime();
      if (run.status === "running") last = age > KILLED_AFTER_MS ? { tone: "error", text: `Timed out · ${when}` } : { tone: "neutral", text: `Running since ${when}` };
      else if (run.status === "skipped") last = { tone: "warning", text: `Skipped · paused · ${when}` };
      else if (run.status === "ok") last = { tone: "success", text: `OK · ${when}` };
      else last = { tone: "error", text: `Failed · ${when}${run.http_status ? ` (${run.http_status})` : ""}`, detail: run.detail };
    }
    const p = paused[j.path];
    return {
      path: j.path,
      name: j.name,
      group: j.group,
      description: j.description ?? null,
      schedule: describeSchedule(j.schedules, now),
      next: next ? formatWhen(next, now) : null,
      last,
      paused: p ? { byName: p.byName, when: formatWhen(new Date(p.at), now) } : null,
    };
  });

  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle="Scheduled jobs">
      <WorkspacePageContainer>
        <PageHeader
          eyebrow="System"
          title="Scheduled jobs"
          description={`Every job that runs on its own, with its schedule, next run and last result. Times are in ${DISPLAY_TZ.replace("_", " ")}. A paused job still wakes up on schedule, then skips its work.`}
        />
        <div className="mt-6">
          <ScheduledJobsClient rows={rows} />
        </div>
      </WorkspacePageContainer>
    </AppShell>
  );
}
