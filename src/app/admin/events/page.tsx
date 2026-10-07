import { AppShell } from "@/components/AppShell";
import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { listAllEvents } from "@/lib/icfo-events/queries";
import { EventsManager } from "@/components/admin-events/EventsManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Events" };

export default async function AdminEventsPage() {
  const profile = await requireRole(["admin", "analyst"]);
  const t = await getTranslations("adminPages");
  const admin = createServiceRoleClient();
  const events = await listAllEvents(admin).catch(() => []);

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle={t("events")}
    >
      <EventsManager initialEvents={events} />
    </AppShell>
  );
}
