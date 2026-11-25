import { AppShell } from "@/components/AppShell";
import { SystemDashboardView } from "@/components/admin/SystemDashboardView";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageErrorAlert } from "@/components/ui/PageErrorAlert";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { requirePermissionPage } from "@/lib/api/permissions";
import { loadSystemDashboard } from "@/lib/dashboard/system-dashboard";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "System" };

export default async function AdminSystemPage() {
  const { profile, supabase } = await requirePermissionPage("manage_integrations");
  const d = await loadSystemDashboard(createServiceRoleClient(), supabase, profile.id).catch(() => null);

  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle="System">
      <WorkspacePageContainer>
        <PageHeader eyebrow="Admin Workspace" title="System" />
        {d ? <SystemDashboardView d={d} /> : <PageErrorAlert message="The figures could not be loaded. Reload the page to try again." />}
      </WorkspacePageContainer>
    </AppShell>
  );
}
