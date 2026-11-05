// Sales > Task report. Target: src/app/admin/sales/task-report/page.tsx
// Super admins see the Dashboard and every task. Everyone else sees only their own tasks.
import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { getSalesScope } from "@/lib/sales/scope";
import { loadPlanItemStats, loadReportTasks, taskHref } from "@/lib/task-report/queries";
import { SOURCE_LABEL, summarize } from "@/lib/task-report/metrics";
import { SalesHubHeader } from "../SalesHubHeader";
import { MyTaskSummary, TaskReportDashboard, TaskReportNav, type View } from "./TaskReportViews";
import { TaskReportTable, type Row } from "./TaskReportTable";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined): string => (Array.isArray(v) ? v[0] ?? "" : v ?? "");

export default async function TaskReportPage({ searchParams }: { searchParams: Promise<SP> }) {
  const profile = await requireRole(["admin", "analyst"]);
  const scope = await getSalesScope(profile);
  const isSuper = scope.isSuperAdmin;
  const sp = await searchParams;

  const asked = one(sp.view) as View;
  let view: View = asked === "tasks" || asked === "mine" || asked === "dashboard" ? asked : isSuper ? "dashboard" : "mine";
  if (!isSuper && view === "dashboard") view = "mine"; // the Dashboard is super admin only

  const today = new Date().toISOString().slice(0, 10);
  const all = await loadReportTasks();
  const mine = all.filter((t) => t.assigneeId === profile.id);
  const visibleTasks = isSuper ? all : mine; // enforced here, on the server
  const name = profile.full_name ?? profile.email ?? "Me";

  let body: React.ReactNode;
  if (view === "dashboard") {
    body = <TaskReportDashboard s={summarize(all, today, await loadPlanItemStats())} today={today} />;
  } else if (view === "mine") {
    body = <MyTaskSummary name={name} s={summarize(mine, today)} />;
  } else {
    const rows: Row[] = visibleTasks.map((t) => ({
      id: t.id, source: t.source, sourceLabel: SOURCE_LABEL[t.source], title: t.title, type: t.type, due: t.due, status: t.status,
      assigneeId: t.assigneeId, assigneeName: t.assigneeName, createdByName: t.createdByName, createdAt: t.createdAt,
      contactName: t.contactName, href: taskHref(t),
    }));
    const filter = one(sp.filter);
    const quick = filter === "overdue" || filter === "open" || filter === "done" || filter === "unassigned" ? filter : "none";
    const person = one(sp.person);
    const scopeParam = one(sp.scope);
    const initialScope = !isSuper ? "my" : scopeParam === "my" ? "my" : scopeParam === "all" || quick !== "none" || person ? "all" : "my";
    body = (
      <>
        <h2 style={{ fontSize: 20, margin: "0 0 12px", fontWeight: 600 }}>{isSuper ? "Tasks, everyone" : "My tasks"}</h2>
        <TaskReportTable key={`${quick}|${person}|${initialScope}`} rows={rows} isSuper={isSuper} meId={profile.id} today={today} initialQuick={quick} initialPerson={person} initialScope={initialScope} />
      </>
    );
  }

  return (
    <AppShell role="ADMIN" workspace="admin" profileName={name} profileSubtitle={profile.role} profileEmail={profile.email ?? undefined}>
      <SalesHubHeader />
      <TaskReportNav view={view} isSuper={isSuper} />
      {body}
    </AppShell>
  );
}
