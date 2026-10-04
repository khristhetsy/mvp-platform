import { AppShell } from "@/components/AppShell";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireRole } from "@/lib/supabase/auth";
import { loadSupportLog } from "@/lib/support/log-data";
import { SupportLogClient } from "@/components/admin/support/SupportLogClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Support log" };

export default async function AdminSupportLogPage({ searchParams }: { searchParams: Promise<{ request?: string }> }) {
  const sp = await searchParams;
  const profile = await requireRole(["admin", "analyst"]);
  const data = await loadSupportLog(sp.request ?? null);

  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle={profile.role}>
      <WorkspacePageContainer>
        <PageHeader
          eyebrow="Support"
          title="Support log"
          description="Every step on every request: founder, AI, staff and system."
          metadata={`${data.requests.length} requests`}
        />
        <SupportLogClient data={data} />
      </WorkspacePageContainer>
    </AppShell>
  );
}
