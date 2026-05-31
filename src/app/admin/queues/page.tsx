import { AppShell } from "@/components/AppShell";
import { AdminQueuesPanel } from "@/components/admin/AdminQueuesPanel";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { getAllAdminQueuesSnapshot } from "@/lib/queues/admin-queues";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ queue?: string }>;
};

export default async function AdminQueuesPage({ searchParams }: PageProps) {
  const profile = await requireRole(["admin", "analyst"]);
  const params = await searchParams;
  const admin = createServiceRoleClient();

  let snapshot: Awaited<ReturnType<typeof getAllAdminQueuesSnapshot>> = {
    summary: [],
    itemsByQueue: {
      company_reviews: [],
      investor_approvals: [],
      compliance_escalations: [],
      spv_blockers: [],
      investor_documents: [],
      founder_remediation: [],
      imports_exports: [],
    },
  };

  try {
    snapshot = await getAllAdminQueuesSnapshot(admin);
  } catch {
    // Page renders with empty queues if tables are unavailable.
  }

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle={profile.role}
    >
      <WorkspacePageContainer>
        <PageHeader
          eyebrow="Admin Workspace"
          title="Operations Queues"
          description="Actionable admin queues across company reviews, investor approvals, compliance, SPV readiness, remediation, and imports."
        />
        <AdminQueuesPanel snapshot={snapshot} initialQueue={params.queue} />
      </WorkspacePageContainer>
    </AppShell>
  );
}
