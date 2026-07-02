import { AppShell } from "@/components/AppShell";
import { getTranslations } from "next-intl/server";
import { requirePermissionPage } from "@/lib/api/permissions";
import { loadActivationFunnels } from "@/lib/analytics/activation-funnels";
import { ActivationFunnelView } from "@/components/admin/ActivationFunnelView";

export const dynamic = "force-dynamic";

export default async function AdminFunnelsPage() {
  const t = await getTranslations("adminPages");
  const { profile } = await requirePermissionPage("view_analytics");
  const { founder, investor, generatedAt } = await loadActivationFunnels();

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle={t("activationFunnels")}
    >
      <ActivationFunnelView founder={founder} investor={investor} generatedAt={generatedAt} />
    </AppShell>
  );
}
