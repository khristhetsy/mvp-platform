import { FounderAppShell } from "@/components/FounderAppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { getTranslations } from "next-intl/server";
import { InvestorTasksPageClient } from "@/components/investor/InvestorTasksPageClient";
import { requireRole } from "@/lib/supabase/auth";
import { getGoogleConnectionStatus } from "@/lib/integrations/connected-accounts";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { listInternalUsers } from "@/lib/tasks/db";

export const dynamic = "force-dynamic";

export default async function FounderTasksPage() {
  const profile = await requireRole(["founder"]);
  const t = await getTranslations("appPages");

  const admin = createServiceRoleClient();
  const [googleStatus, internalUsers] = await Promise.all([
    getGoogleConnectionStatus(admin, profile.id),
    listInternalUsers(),
  ]);

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle={t("founder_account")}
    >
      <PageHeader
        eyebrow={t("founder_workspace_2")}
        title={t("my_tasks")}
        description={t("track_action_items_investor_follow_ups_and_cap")}
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
