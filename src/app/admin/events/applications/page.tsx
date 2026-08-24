import { AppShell } from "@/components/AppShell";
import { getTranslations } from "next-intl/server";
import { requirePermissionPage } from "@/lib/api/permissions";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { listApplications, listAllPresenters } from "@/lib/icfo-events/applications";
import { listAllEvents } from "@/lib/icfo-events/queries";
import { ApplicationsQueue } from "@/components/admin-events/ApplicationsQueue";
import { PresentersManager } from "@/components/admin-events/PresentersManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Speaker applications" };

export default async function AdminEventApplicationsPage() {
  const t = await getTranslations("adminPages");
  const { profile } = await requirePermissionPage("manage_events");
  const admin = createServiceRoleClient();
  const [applications, presenters, events] = await Promise.all([
    listApplications(admin).catch(() => []),
    listAllPresenters(admin).catch(() => []),
    listAllEvents(admin).catch(() => []),
  ]);

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle={t("speakerApplications")}
    >
      <ApplicationsQueue initialApplications={applications} />
      <div className="mt-8">
        <PresentersManager
          initialPresenters={presenters}
          events={events.map((e) => ({ id: e.id, title: e.title, timezone: e.timezone ?? null }))}
        />
      </div>
    </AppShell>
  );
}
