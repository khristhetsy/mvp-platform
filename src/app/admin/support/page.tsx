import { AppShell } from "@/components/AppShell";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { listSupportQueue } from "@/lib/support/support";
import { SupportQueueClient, type QueueRow, type StaffOption } from "@/components/admin/support/SupportQueueClient";
import type { SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export default async function AdminSupportPage() {
  const profile = await requireRole(["admin", "analyst"]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createServiceRoleClient() as unknown as SupabaseClient<any>;

  const queue = await listSupportQueue(admin as unknown as Parameters<typeof listSupportQueue>[0]);

  const companyIds = [...new Set(queue.map((q) => q.company_id))];
  const personIds = [...new Set([...queue.map((q) => q.founder_id), ...queue.map((q) => q.assigned_to).filter(Boolean) as string[]])];

  const [{ data: companies }, { data: people }, { data: staff }] = await Promise.all([
    companyIds.length ? admin.from("companies").select("id, company_name").in("id", companyIds) : Promise.resolve({ data: [] }),
    personIds.length ? admin.from("profiles").select("id, full_name, email").in("id", personIds) : Promise.resolve({ data: [] }),
    admin.from("profiles").select("id, full_name, email").in("role", ["admin", "analyst"]).limit(50),
  ]);

  const companyName = new Map((companies ?? []).map((c: { id: string; company_name: string | null }) => [c.id, c.company_name]));
  const personName = new Map(
    (people ?? []).map((p: { id: string; full_name: string | null; email: string | null }) => [p.id, p.full_name ?? p.email ?? "—"]),
  );

  const rows: QueueRow[] = queue.map((q) => ({
    id: q.id,
    subject: q.subject,
    status: q.status,
    source: q.source,
    priority: q.priority,
    contextStage: q.context_stage,
    contextItem: q.context_item,
    companyId: q.company_id,
    companyName: companyName.get(q.company_id) ?? "Company",
    founderName: personName.get(q.founder_id) ?? "Founder",
    assignedTo: q.assigned_to,
    assigneeName: q.assigned_to ? personName.get(q.assigned_to) ?? "—" : null,
    createdAt: q.created_at,
  }));

  const staffOptions: StaffOption[] = (staff ?? []).map((s: { id: string; full_name: string | null; email: string | null }) => ({
    id: s.id,
    name: s.full_name ?? s.email ?? "—",
  }));

  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle={profile.role}>
      <WorkspacePageContainer>
        <PageHeader
          eyebrow="Support"
          title="Support queue"
          description="Founder help requests and questions — assign, reply, and resolve in one place."
          metadata={`${rows.length} open`}
        />
        <SupportQueueClient rows={rows} staff={staffOptions} currentStaffId={profile.id} />
      </WorkspacePageContainer>
    </AppShell>
  );
}
