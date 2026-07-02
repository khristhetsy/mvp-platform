import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { getTranslations } from "next-intl/server";
import { InvestorTasksPageClient } from "@/components/investor/InvestorTasksPageClient";
import { requireInvestorWorkspaceSession } from "@/lib/supabase/auth";
import { getGoogleConnectionStatus } from "@/lib/integrations/connected-accounts";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { listInternalUsers } from "@/lib/tasks/db";

export const dynamic = "force-dynamic";

export default async function InvestorTasksPage() {
  const { profile } = await requireInvestorWorkspaceSession();
  const t = await getTranslations("appPages");

  const admin = createServiceRoleClient();
  const [googleStatus, internalUsers] = await Promise.all([
    getGoogleConnectionStatus(admin, profile.id),
    listInternalUsers(),
  ]);

  return (
    <AppShell
      role="INVESTOR"
      workspace="investor"
      profileName={profile.full_name ?? profile.email ?? "Investor"}
      profileSubtitle={t("investor_account")}
    >
      <PageHeader
        eyebrow={t("investor_workspace_2")}
        title={t("my_tasks")}
        description={t("track_follow_ups_due_diligence_and_deal_pipeli")}
      />
      <InvestorTasksPageClient
        googleConnected={googleStatus.connected}
        googleStatus={googleStatus}
        calendarReturnPath="/investor/tasks"
        internalUsers={internalUsers}
        currentUserId={profile.id}
      />
    </AppShell>
  );
}
