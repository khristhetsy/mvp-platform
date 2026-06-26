import { AppShell } from "@/components/AppShell";
import { requirePermissionPage } from "@/lib/api/permissions";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { listSponsors } from "@/lib/icfo-events/sponsors";
import { SponsorCatalog } from "@/components/admin-events/SponsorCatalog";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sponsor catalog" };

export default async function AdminSponsorsPage() {
  const { profile } = await requirePermissionPage("manage_events");
  const admin = createServiceRoleClient();
  const sponsors = await listSponsors(admin).catch(() => []);

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle="Sponsor catalog"
    >
      <SponsorCatalog initialSponsors={sponsors} />
    </AppShell>
  );
}
