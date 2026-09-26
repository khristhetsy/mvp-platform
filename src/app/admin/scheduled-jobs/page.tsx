import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { requirePermissionPage } from "@/lib/api/permissions";
import { listCronJobs } from "@/lib/cron/jobs";
import { loadLatestCronRuns, loadPausedCrons } from "@/lib/cron/gate";
import { DISPLAY_TZ, describeSchedule, formatWhen, nextRun } from "@/lib/cron/schedule";
import { KILLED_AFTER_MS, loadCodeUpdates } from "@/lib/cron/run-history";
import { ScheduledJobsClient, type JobRow } from "@/components/admin/ScheduledJobsClient";
import { CodeUpdatesClient, type CodeUpdateRow } from "@/components/admin/CodeUpdatesClient";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function Tab({ href, active, label, count }: { href: string; active: boolean; label: string; count?: number }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      style={{
        padding: "8px 2px",
        fontSize: 14,
        fontWeight: active ? 600 : 500,
        color: active ? "var(--foreground)" : "var(--muted-foreground)",
        borderBottom: active ? "2px solid var(--navy, #0C2340)" : "2px solid transparent",
        textDecoration: "none",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      {label}
      {count ? <span style={{ fontSize: 11, fontWeight: 600, color: "#633806", background: "#FAEEDA", borderRadius: 6, padding: "1px 6px" }}>{count}</span> : null}
    </Link>
  );
}

export default async function AdminScheduledJobsPage({ searchParams }: PageProps) {
  const { profile } = await requirePermissionPage("manage_integrations");
  const sp = await searchParams;
  const tab = sp.tab === "code" ? "code" : "jobs";
  const now = new Date();

  const jobs = listCronJobs();
  const [paused, runs, updates] = await Promise.all([
    loadPausedCrons(),
    loadLatestCronRuns(jobs.map((j) => j.path)),
    loadCodeUpdates(),
  ]);

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

  const attention = rows.filter((r) => r.last?.tone === "error");

  const updateRows: CodeUpdateRow[] = updates.map((u) => ({
    id: u.id,
    title: u.title,
    status: u.status === "applied" ? "Live" : u.status === "pending" ? "Waiting" : u.status === "failed" ? "Failed" : u.status,
    queued: formatWhen(new Date(u.created_at), now),
    applied: u.applied_at ? formatWhen(new Date(u.applied_at), now) : null,
    sha: u.applied_sha ? u.applied_sha.slice(0, 8) : null,
    note: u.result,
  }));
  const waiting = updateRows.filter((u) => u.status === "Waiting").length;

  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle="Scheduled jobs">
      <WorkspacePageContainer>
        <PageHeader
          eyebrow="System"
          title="Scheduled jobs"
          description={`Every job that runs on its own, with its schedule, next run and last result. Times are in ${DISPLAY_TZ.replace("_", " ")}. A paused job still wakes up on schedule, then skips its work.`}
        />

        <nav aria-label="Scheduled jobs sections" style={{ display: "flex", gap: 20, marginTop: 20, borderBottom: "0.5px solid #e2e6ed" }}>
          <Tab href="/admin/scheduled-jobs" active={tab === "jobs"} label="Jobs" />
          <Tab href="/admin/scheduled-jobs?tab=code" active={tab === "code"} label="Code updates" count={waiting} />
        </nav>

        {tab === "jobs" && attention.length > 0 && (
          <div role="status" style={{ marginTop: 16, border: "0.5px solid #F09595", background: "#FCEBEB", borderRadius: 12, padding: "10px 14px" }}>
            <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 600, color: "#791F1F", display: "flex", alignItems: "center", gap: 6 }}>
              <i className="ti ti-alert-triangle" aria-hidden="true" /> Needs attention · {attention.length}
            </p>
            {attention.map((r) => (
              <p key={r.path} style={{ margin: "2px 0 0", fontSize: 13, color: "#791F1F" }}>
                {r.name}: {r.last?.text}
                {r.last?.detail ? ` · ${r.last.detail}` : ""}
              </p>
            ))}
          </div>
        )}

        <div className="mt-6">
          {tab === "jobs" ? <ScheduledJobsClient rows={rows} /> : <CodeUpdatesClient rows={updateRows} />}
        </div>
      </WorkspacePageContainer>
    </AppShell>
  );
}
