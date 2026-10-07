import { AppShell } from "@/components/AppShell";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { listSupportQueue, supportChannel } from "@/lib/support/support";
import { getSupportSettings } from "@/lib/support/settings";
import {
  SupportQueueClient,
  type QueueRow,
  type StaffOption,
  type SupportKpis,
} from "@/components/admin/support/SupportQueueClient";
import type { SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const DAY = 24 * 60 * 60 * 1000;

type QueueItem = Awaited<ReturnType<typeof listSupportQueue>>[number];

/** Desk numbers for the header strip, last 90 days. */
function deskKpis(queue: QueueItem[], now: number = Date.now()): SupportKpis {
  const recent = queue.filter((q) => now - new Date(q.created_at).getTime() <= 90 * DAY);
  const answered = recent.filter((q) => q.first_staff_reply_at);
  const onTime = answered.filter((q) => !q.due_at || new Date(q.first_staff_reply_at as string) <= new Date(q.due_at));
  const rated = recent.filter((q) => typeof q.rating === "number");
  const oldest = queue
    .filter((q) => q.status === "open")
    .reduce<number | null>((min, q) => {
      const t = new Date(q.created_at).getTime();
      return min === null || t < min ? t : min;
    }, null);
  return {
    oldestWaitMs: oldest === null ? null : now - oldest,
    onTimePct: answered.length ? Math.round((onTime.length / answered.length) * 100) : null,
    answeredCount: answered.length,
    avgRating: rated.length ? Math.round((rated.reduce((sum, q) => sum + (q.rating ?? 0), 0) / rated.length) * 10) / 10 : null,
    ratedCount: rated.length,
  };
}

export default async function AdminSupportPage() {
  const profile = await requireRole(["admin", "analyst"]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createServiceRoleClient() as unknown as SupabaseClient<any>;

  // Open and resolved together, so every view (Open, Mine, Resolved...) counts and filters on the client.
  const queue = await listSupportQueue(admin as unknown as Parameters<typeof listSupportQueue>[0], { includeResolved: true });

  const ids = queue.map((q) => q.id);
  const companyIds = [...new Set(queue.map((q) => q.company_id))];
  const personIds = [...new Set([...queue.map((q) => q.founder_id), ...(queue.map((q) => q.assigned_to).filter(Boolean) as string[])])];

  const [{ data: companies }, { data: people }, { data: staff }, { data: lastMsgs }] = await Promise.all([
    companyIds.length ? admin.from("companies").select("id, company_name").in("id", companyIds) : Promise.resolve({ data: [] }),
    personIds.length ? admin.from("profiles").select("id, full_name, email").in("id", personIds) : Promise.resolve({ data: [] }),
    admin.from("profiles").select("id, full_name, email").in("role", ["admin", "analyst"]).limit(50),
    ids.length
      ? admin
          .from("support_messages")
          .select("request_id, author_role, body, created_at")
          .in("request_id", ids)
          .eq("is_internal", false)
          .order("created_at", { ascending: false })
          .limit(3000)
      : Promise.resolve({ data: [] }),
  ]);

  const companyName = new Map((companies ?? []).map((c: { id: string; company_name: string | null }) => [c.id, c.company_name]));
  const personName = new Map(
    (people ?? []).map((p: { id: string; full_name: string | null; email: string | null }) => [p.id, p.full_name ?? p.email ?? "Unknown"]),
  );
  // Newest message per request: the card snippet and who spoke last.
  const latest = new Map<string, { author_role: string; body: string }>();
  for (const m of (lastMsgs ?? []) as Array<{ request_id: string; author_role: string; body: string }>) {
    if (!latest.has(m.request_id)) latest.set(m.request_id, m);
  }

  const rows: QueueRow[] = queue.map((q) => ({
    id: q.id,
    subject: q.subject,
    status: q.status,
    source: q.source,
    channel: supportChannel(q),
    priority: q.priority,
    contextStage: q.context_stage,
    contextItem: q.context_item,
    companyId: q.company_id,
    companyName: companyName.get(q.company_id) ?? "Company",
    founderName: personName.get(q.founder_id) ?? "Founder",
    assignedTo: q.assigned_to,
    assigneeName: q.assigned_to ? personName.get(q.assigned_to) ?? "Staff" : null,
    csat: q.csat,
    createdAt: q.created_at,
    updatedAt: q.updated_at,
    resolvedAt: q.resolved_at,
    refNo: q.ref_no ?? null,
    dueAt: q.due_at ?? null,
    aiTriage: q.ai_triage ?? null,
    rating: q.rating ?? null,
    reopenedCount: q.reopened_count ?? 0,
    snippet: (latest.get(q.id)?.body ?? "").replace(/\s+/g, " ").slice(0, 140),
    lastFrom: (latest.get(q.id)?.author_role as "founder" | "staff" | undefined) ?? null,
  }));

  const kpis = deskKpis(queue);

  const settings = await getSupportSettings();

  const staffOptions: StaffOption[] = (staff ?? []).map((s: { id: string; full_name: string | null; email: string | null }) => ({
    id: s.id,
    name: s.full_name ?? s.email ?? "Staff",
  }));

  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle={profile.role}>
      <WorkspacePageContainer>
        <PageHeader
          eyebrow="Support"
          title="Support queue"
          description="Founder requests, emails and assistant handoffs in one help desk. Assign, reply and resolve."
          metadata={`${rows.filter((r) => r.status !== "resolved").length} open`}
        />
        <SupportQueueClient
          rows={rows}
          staff={staffOptions}
          currentStaffId={profile.id}
          settings={settings}
          canEditSettings={profile.role === "admin"}
          kpis={kpis}
        />
      </WorkspacePageContainer>
    </AppShell>
  );
}
