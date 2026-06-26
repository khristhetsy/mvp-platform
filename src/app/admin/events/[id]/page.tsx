import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { requirePermissionPage } from "@/lib/api/permissions";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getEventById } from "@/lib/icfo-events/queries";
import { listSponsors, listEventSponsors } from "@/lib/icfo-events/sponsors";
import { EventDetailManager } from "@/components/admin-events/EventDetailManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Manage event" };

export default async function AdminEventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { profile } = await requirePermissionPage("manage_events");
  const { id } = await params;
  const admin = createServiceRoleClient();

  const event = await getEventById(admin, id).catch(() => null);
  if (!event) notFound();

  const [sponsorCatalog, eventSponsors] = await Promise.all([
    listSponsors(admin).catch(() => []),
    listEventSponsors(admin, id).catch(() => []),
  ]);

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle="Manage event"
    >
      <EventDetailManager
        event={event}
        sponsorCatalog={sponsorCatalog}
        initialEventSponsors={eventSponsors}
      />
    </AppShell>
  );
}
