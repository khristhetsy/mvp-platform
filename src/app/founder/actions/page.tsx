import { FounderAppShell } from "@/components/FounderAppShell";
import { ActionCenterPage } from "@/components/actions/ActionCenterPage";
import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function FounderActionsPage() {
  const profile = await requireRole(["founder"]);
  const t = await getTranslations("appPages");

  return (
    <FounderAppShell profileName={profile.full_name ?? profile.email ?? "Founder"}>
      <ActionCenterPage
        role="founder"
        title={t("founder_action_center")}
        description={t("onboarding_readiness_documents_investor_engage")}
      />
    </FounderAppShell>
  );
}
