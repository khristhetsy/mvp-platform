import { FounderAppShell } from "@/components/FounderAppShell";
import { CalendarWorkspace } from "@/components/calendar/CalendarWorkspace";
import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getGoogleConnectionStatus } from "@/lib/integrations/connected-accounts";
import { assertFeatureEnabled } from "@/lib/feature-controls/server";

export const dynamic = "force-dynamic";

export default async function FounderCalendarPage() {
  const profile = await requireRole(["founder"]);
  const t = await getTranslations("appPages");
  await assertFeatureEnabled("founder", "calendar", "/founder/dashboard");
  const supabase = await createServerSupabaseClient();
  const status = await getGoogleConnectionStatus(supabase, profile.id);

  return (
    <FounderAppShell profileName={profile.full_name ?? profile.email ?? "Founder"} profileSubtitle={t("calendar")}>
      <CalendarWorkspace googleConnected={status.connected} />
    </FounderAppShell>
  );
}
