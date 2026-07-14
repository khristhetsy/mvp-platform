// Personal ("my activity") dashboard data — everything scoped to a single member so
// their home dashboard shows only their own work. Read-only, service-role. Used by the
// per-member dashboard that replaces the org-wide admin dashboard for non-super-admins.
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";
import { listOpportunities, getDefaultPipeline, type Opportunity } from "@/lib/sales/opportunities";
import { listTasks, type SalesTask } from "@/lib/sales/tasks";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return serviceRoleClientUntyped(); }

export type PersonalActivity = { id: string; kind: string; summary: string; created_at: string };
export type PersonalPipelineStage = { key: string; label: string; count: number };

export type PersonalDashboard = {
  contactsCount: number;
  openOppsCount: number;
  pipelineCents: number;
  tasksDueToday: number;
  pipelineStages: PersonalPipelineStage[];
  tasks: SalesTask[];
  activity: PersonalActivity[];
};

// Count contacts the member owns or is assigned to.
async function myContactsCount(userId: string): Promise<number> {
  const { count } = await db()
    .from("crm_contacts")
    .select("id", { count: "exact", head: true })
    .or(`owner_id.eq.${userId},assignee_ids.cs.{${userId}}`);
  return count ?? 0;
}

async function myActivity(userId: string): Promise<PersonalActivity[]> {
  const { data } = await db()
    .from("sales_activity_log")
    .select("id, kind, summary, created_at")
    .eq("actor_id", userId)
    .order("created_at", { ascending: false })
    .limit(8);
  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    id: String(r.id), kind: String(r.kind ?? "note"), summary: String(r.summary ?? ""), created_at: String(r.created_at),
  }));
}

export async function getPersonalDashboard(userId: string): Promise<PersonalDashboard> {
  const [contactsCount, myOpps, allMyTasks, activity, pipeline] = await Promise.all([
    myContactsCount(userId),
    listOpportunities(false, userId).catch(() => [] as Opportunity[]),
    listTasks({ scope: "my", assigneeId: userId }).catch(() => [] as SalesTask[]),
    myActivity(userId).catch(() => [] as PersonalActivity[]),
    getDefaultPipeline().catch(() => null),
  ]);

  const openOpps = myOpps.filter((o) => o.status === "open");
  const pipelineCents = openOpps.reduce((a, o) => a + (o.value_cents ?? 0), 0);

  const pipelineStages: PersonalPipelineStage[] = (pipeline?.stages ?? [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((s) => ({ key: s.id, label: s.name, count: openOpps.filter((o) => o.stage_id === s.id).length }));

  const today = new Date().toISOString().slice(0, 10);
  const openTasks = allMyTasks.filter((t) => t.status === "open");
  const tasksDueToday = openTasks.filter((t) => t.due_date != null && t.due_date.slice(0, 10) <= today).length;

  return {
    contactsCount,
    openOppsCount: openOpps.length,
    pipelineCents,
    tasksDueToday,
    pipelineStages,
    tasks: openTasks.slice(0, 6),
    activity,
  };
}
