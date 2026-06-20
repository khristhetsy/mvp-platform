import { AppShell } from "@/components/AppShell";
import { AvailabilityEditor } from "@/components/calendar/AvailabilityEditor";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function AdminSchedulePage() {
  const profile = await requireRole(["admin", "analyst"]);
  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle="Scheduling"
    >
      <AvailabilityEditor bookingPath={`/schedule/${profile.id}`} />
    </AppShell>
  );
}
