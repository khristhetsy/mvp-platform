import { AppShell } from "@/components/AppShell";
import { getTranslations } from "next-intl/server";
import { requirePermissionPage } from "@/lib/api/permissions";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { listApplications, listAllPresenters } from "@/lib/icfo-events/applications";
import { listAllEvents, loadSessions } from "@/lib/icfo-events/queries";
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

  // Sessions for every event, so a presenter can be billed under one. Loaded
  // here rather than on demand because the manager spans all events.
  const sessions = (
    await Promise.all(
      events.map(async (e) => (await loadSessions(admin, e.id).catch(() => [])).map((s: { id: string; title: string }) => ({
        id: s.id,
        eventId: e.id,
        title: s.title,
      }))),
    )
  ).flat();

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
          sessions={sessions}
        />
      </div>
    </AppShell>
  );
}
