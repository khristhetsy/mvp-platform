import { FounderAppShell } from "@/components/FounderAppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { InvestorTasksPageClient } from "@/components/investor/InvestorTasksPageClient";
import { requireRole } from "@/lib/supabase/auth";
import { getGoogleConnectionStatus } from "@/lib/integrations/connected-accounts";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { listInternalUsers } from "@/lib/tasks/db";

export const dynamic = "force-dynamic";

export default async function FounderTasksPage() {
  const profile = await requireRole(["founder"]);

  const admin = createServiceRoleClient();
  const [googleStatus, internalUsers] = await Promise.all([
    getGoogleConnectionStatus(admin, profile.id),
    listInternalUsers(),
  ]);

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle="Founder account"
    >
      <PageHeader
        eyebrow="Founder workspace"
        title="My Tasks"
        description="Track action items, investor follow-ups, and capital-raise to-dos."
      />
      <InvestorTasksPageClient
        googleConnected={googleStatus.connected}
        googleStatus={googleStatus}
        calendarReturnPath="/founder/tasks"
        internalUsers={internalUsers}
        currentUserId={profile.id}
        showTaskTypeFilter
      />
    </FounderAppShell>
  );
}
