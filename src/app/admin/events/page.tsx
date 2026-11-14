import { AppShell } from "@/components/AppShell";
import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { listAllEvents } from "@/lib/icfo-events/queries";
import { EventsManager } from "@/components/admin-events/EventsManager";
import { EventNudgeSettingsCard } from "@/components/admin-events/EventNudgeSettingsCard";
import { loadEventNotificationSettings } from "@/lib/icfo-events/notification-settings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Events" };

export default async function AdminEventsPage() {
  const profile = await requireRole(["admin", "analyst"]);
  const t = await getTranslations("adminPages");
  const admin = createServiceRoleClient();
  const events = await listAllEvents(admin).catch(() => []);
  const nudge = await loadEventNotificationSettings();

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle={t("events")}
    >
      <EventNudgeSettingsCard initialEnabled={nudge.nudgeHome || nudge.nudgeBanner} initialDays={nudge.nudgeStartDays} />
      <EventsManager initialEvents={events} />
    </AppShell>
  );
}
