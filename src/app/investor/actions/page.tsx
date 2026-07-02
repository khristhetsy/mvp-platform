import { AppShell } from "@/components/AppShell";
import { ActionCenterPage } from "@/components/actions/ActionCenterPage";
import { getTranslations } from "next-intl/server";
import { requireInvestorWorkspaceSession } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function InvestorActionsPage() {
  const { profile } = await requireInvestorWorkspaceSession();
  const t = await getTranslations("appPages");

  return (
    <AppShell
      role="INVESTOR"
      workspace="investor"
      profileName={profile.full_name ?? profile.email ?? "Investor"}
      profileSubtitle={t("investor_account")}
    >
      <ActionCenterPage
        role="investor"
        title={t("investor_action_center")}
        description={t("profile_approvals_spv_requirements_intros_meet")}
      />
    </AppShell>
  );
}
