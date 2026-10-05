import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { requirePermissionPage } from "@/lib/api/permissions";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getEventById } from "@/lib/icfo-events/queries";
import { sectorLabel } from "@/lib/icfo-events/sectors";
import { listSpotlightApplications, spotlightVideoUrl } from "@/lib/icfo-events/spotlight/service";
import { SpotlightStudio, type StudioSession } from "@/components/admin-events/SpotlightStudio";

export const dynamic = "force-dynamic";
export const metadata = { title: "Spotlight studio" };

export default async function SpotlightStudioPage({ params }: { params: Promise<{ id: string }> }) {
  const { profile, effective } = await requirePermissionPage("view_events");
  const canEdit = effective.permissions.includes("manage_events");
  const { id } = await params;
  const admin = createServiceRoleClient();

  const event = await getEventById(admin, id).catch(() => null);
  if (!event) notFound();

  const applications = await listSpotlightApplications(id).catch(() => []);
  const videoUrls: Record<string, string> = {};
  await Promise.all(
    applications.map(async (a) => {
      const url = await spotlightVideoUrl(a.videoPath, 6 * 3600);
      if (url) videoUrls[a.id] = url;
    }),
  );

  const sessions: StudioSession[] = (event.sessions ?? [])
    .map((s) => ({ id: s.id, title: s.title, type: s.type, startsAt: s.startsAt, endsAt: s.endsAt }))
    .sort((a, b) => (a.startsAt ?? "9").localeCompare(b.startsAt ?? "9"));

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle="Spotlight studio"
    >
      <SpotlightStudio
        event={{ id: event.id, title: event.title, slug: event.slug, timezone: event.timezone ?? "America/Los_Angeles", startsAt: event.startsAt, endsAt: event.endsAt }}
        sessions={sessions}
        sectors={(event.sectors ?? []).map((s) => ({ slug: s.sectorSlug, label: s.label || sectorLabel(s.sectorSlug) }))}
        initialApplications={applications}
        videoUrls={videoUrls}
        canEdit={canEdit}
      />
    </AppShell>
  );
}
