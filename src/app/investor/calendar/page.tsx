import { AppShell } from "@/components/AppShell";
import { CalendarWorkspace } from "@/components/calendar/CalendarWorkspace";
import { requireInvestorWorkspaceSession } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getGoogleConnectionStatus } from "@/lib/integrations/connected-accounts";
import { assertFeatureEnabled } from "@/lib/feature-controls/server";

export const dynamic = "force-dynamic";

export default async function InvestorCalendarPage() {
  const { profile } = await requireInvestorWorkspaceSession();
  await assertFeatureEnabled("investor", "calendar", "/investor/dashboard");
  const supabase = await createServerSupabaseClient();
  const status = await getGoogleConnectionStatus(supabase, profile.id);

  return (
    <AppShell
      role="INVESTOR"
      workspace="investor"
      profileName={profile.full_name ?? profile.email ?? "Investor"}
      profileSubtitle="Calendar"
    >
      <CalendarWorkspace googleConnected={status.connected} />
    </AppShell>
  );
}
