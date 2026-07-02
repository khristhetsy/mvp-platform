import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/AppShell";
import { requirePermissionPage } from "@/lib/api/permissions";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getEventById } from "@/lib/icfo-events/queries";
import { listSponsors, listEventSponsors } from "@/lib/icfo-events/sponsors";
import { isLiveVideoConfigured } from "@/lib/icfo-events/video/whereby";
import { listEventModerators } from "@/lib/icfo-events/moderators";
import { bannerPublicUrl } from "@/lib/icfo-events/banner";
import { listInternalUsers } from "@/lib/rbac/internal-users";
import { EventDetailManager } from "@/components/admin-events/EventDetailManager";
import { EventModeratorsManager } from "@/components/admin-events/EventModeratorsManager";
import { EventBannerEditor } from "@/components/admin-events/EventBannerEditor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Manage event" };

export default async function AdminEventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getTranslations("adminPages");
  const { profile, effective } = await requirePermissionPage("manage_events");
  const { id } = await params;
  const admin = createServiceRoleClient();

  const event = await getEventById(admin, id).catch(() => null);
  if (!event) notFound();

  const [sponsorCatalog, eventSponsors, moderators, staff] = await Promise.all([
    listSponsors(admin).catch(() => []),
    listEventSponsors(admin, id).catch(() => []),
    listEventModerators(admin, id).catch(() => []),
    listInternalUsers(admin).catch(() => []),
  ]);
  const canManageModerators = effective.permissions.includes("assign_roles");

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle={t("manageEvent")}
    >
      <EventDetailManager
        event={event}
        sponsorCatalog={sponsorCatalog}
        initialEventSponsors={eventSponsors}
        liveVideoConfigured={isLiveVideoConfigured()}
      />
      <div className="mx-auto max-w-4xl px-4">
        <EventBannerEditor
          eventId={id}
          eventTitle={event.title}
          initialUrl={bannerPublicUrl(admin, event.coverPath)}
          initialOverlay={event.coverOverlay}
          initialFocal={event.coverFocal}
        />
      </div>
      <div className="mx-auto max-w-4xl px-4 pb-8">
        <EventModeratorsManager
          eventId={id}
          initialModerators={moderators}
          staff={staff}
          canManage={canManageModerators}
        />
      </div>
    </AppShell>
  );
}
