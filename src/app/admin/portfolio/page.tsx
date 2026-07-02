import { AppShell } from "@/components/AppShell";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { AdminPortfolioPageClient } from "@/components/admin/AdminPortfolioPageClient";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function AdminPortfolioPage() {
  const profile = await requireRole(["admin", "analyst"]);

  const t = await getTranslations("adminPages");
  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle={t("adminWorkspace2")}
    >
      <PageHeader
        eyebrow={t("adminPortfolioOversight")}
        title={t("allInvestorPortfolios")}
        description={t("platformWideViewOf")}
      />
      <AdminPortfolioPageClient />
    </AppShell>
  );
}
