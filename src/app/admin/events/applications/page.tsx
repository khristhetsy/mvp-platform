import { AppShell } from "@/components/AppShell";
import { getTranslations } from "next-intl/server";
import { requirePermissionPage } from "@/lib/api/permissions";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { listApplications } from "@/lib/icfo-events/applications";
import { ApplicationsQueue } from "@/components/admin-events/ApplicationsQueue";

export const dynamic = "force-dynamic";
export const metadata = { title: "Speaker applications" };

export default async function AdminEventApplicationsPage() {
  const t = await getTranslations("adminPages");
  const { profile } = await requirePermissionPage("manage_events");
  const admin = createServiceRoleClient();
  const applications = await listApplications(admin).catch(() => []);

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle={t("speakerApplications")}
    >
      <ApplicationsQueue initialApplications={applications} />
    </AppShell>
  );
}
