import { AppShell } from "@/components/AppShell";
import { getTranslations } from "next-intl/server";
import { AdminQueuesPanel } from "@/components/admin/AdminQueuesPanel";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageErrorAlert } from "@/components/ui/PageErrorAlert";
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
  const t = await getTranslations("adminPages");
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

  let loadFailed = false;
  try {
    snapshot = await getAllAdminQueuesSnapshot(admin);
  } catch {
    loadFailed = true;
  }

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle={profile.role}
          profileEmail={profile.email ?? undefined}
    >
      <WorkspacePageContainer>
        <PageHeader
          eyebrow={t("adminWorkspace")}
          title={t("operationsQueues")}
          description={t("actionableAdminQueuesAcross")}
        />
        {loadFailed ? <PageErrorAlert message="Couldn't load the operations queues." /> : null}
        <AdminQueuesPanel snapshot={snapshot} initialQueue={params.queue} />
      </WorkspacePageContainer>
    </AppShell>
  );
}
