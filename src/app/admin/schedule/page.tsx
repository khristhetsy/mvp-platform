import { AppShell } from "@/components/AppShell";
import { getTranslations } from "next-intl/server";
import { AvailabilityEditor } from "@/components/calendar/AvailabilityEditor";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function AdminSchedulePage() {
  const profile = await requireRole(["admin", "analyst"]);
  const t = await getTranslations("adminPages");
  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle={t("scheduling")}
    >
      <AvailabilityEditor bookingPath={`/schedule/${profile.id}`} />
    </AppShell>
  );
}
