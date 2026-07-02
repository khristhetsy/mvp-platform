import { AppShell } from "@/components/AppShell";
import { getTranslations } from "next-intl/server";
import { CalendarWorkspace } from "@/components/calendar/CalendarWorkspace";
import { requireRole } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getGoogleConnectionStatus } from "@/lib/integrations/connected-accounts";

export const dynamic = "force-dynamic";

export default async function AdminCalendarPage() {
  const profile = await requireRole(["admin", "analyst"]);
  const t = await getTranslations("adminPages");
  const supabase = await createServerSupabaseClient();
  const status = await getGoogleConnectionStatus(supabase, profile.id);

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle={t("calendar")}
    >
      <CalendarWorkspace googleConnected={status.connected} />
    </AppShell>
  );
}
