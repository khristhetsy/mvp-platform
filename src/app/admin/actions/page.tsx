import { AppShell } from "@/components/AppShell";
import { getTranslations } from "next-intl/server";
import { ActionCenterPage } from "@/components/actions/ActionCenterPage";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function AdminActionsPage() {
  const profile = await requireRole(["admin", "analyst"]);
  const t = await getTranslations("adminPages");
  const adminRole = profile.role === "analyst" ? "analyst" : "admin";

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle={profile.role}
          profileEmail={profile.email ?? undefined}
    >
      <ActionCenterPage
        role={adminRole}
        title={t("adminActionCenter")}
        description={t("companyReviewsInvestorApprovals")}
      />
    </AppShell>
  );
}
