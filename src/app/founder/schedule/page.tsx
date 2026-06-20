import { FounderAppShell } from "@/components/FounderAppShell";
import { AvailabilityEditor } from "@/components/calendar/AvailabilityEditor";
import { requireRole } from "@/lib/supabase/auth";
import { assertFeatureEnabled } from "@/lib/feature-controls/server";

export const dynamic = "force-dynamic";

export default async function FounderSchedulePage() {
  const profile = await requireRole(["founder"]);
  await assertFeatureEnabled("founder", "scheduling", "/founder/dashboard");
  return (
    <FounderAppShell profileName={profile.full_name ?? profile.email ?? "Founder"} profileSubtitle="Scheduling">
      <AvailabilityEditor bookingPath={`/schedule/${profile.id}`} />
    </FounderAppShell>
  );
}
