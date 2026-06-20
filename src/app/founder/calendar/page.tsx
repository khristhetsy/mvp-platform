import { FounderAppShell } from "@/components/FounderAppShell";
import { CalendarWorkspace } from "@/components/calendar/CalendarWorkspace";
import { requireRole } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getGoogleConnectionStatus } from "@/lib/integrations/connected-accounts";

export const dynamic = "force-dynamic";

export default async function FounderCalendarPage() {
  const profile = await requireRole(["founder"]);
  const supabase = await createServerSupabaseClient();
  const status = await getGoogleConnectionStatus(supabase, profile.id);

  return (
    <FounderAppShell profileName={profile.full_name ?? profile.email ?? "Founder"} profileSubtitle="Calendar">
      <CalendarWorkspace googleConnected={status.connected} />
    </FounderAppShell>
  );
}
