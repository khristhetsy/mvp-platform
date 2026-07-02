import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { requirePermissionPage } from "@/lib/api/permissions";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getEventById } from "@/lib/icfo-events/queries";
import { loadControlSummary } from "@/lib/icfo-events/control-center";
import { listEventModerators } from "@/lib/icfo-events/moderators";
import { listOpenHelpRequests } from "@/lib/icfo-events/help-desk";
import { EventPresenceProvider } from "@/components/events/EventPresenceProvider";
import { EventControlCenter } from "@/components/admin-events/EventControlCenter";

export const dynamic = "force-dynamic";
export const metadata = { title: "Live control center" };

export default async function EventControlPage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getTranslations("adminPages");
  const { profile, effective } = await requirePermissionPage("manage_events");
  const { id } = await params;
  const admin = createServiceRoleClient();

  const event = await getEventById(admin, id).catch(() => null);
  if (!event) notFound();

  const [summary, helpRequests, moderators] = await Promise.all([
    loadControlSummary(admin, id),
    listOpenHelpRequests(admin, id),
    listEventModerators(admin, id).catch(() => []),
  ]);
  const me = { id: profile.id, name: profile.full_name ?? profile.email ?? "Staff" };

  // Super admins (and unscoped staff) control all rooms; an assigned room
  // moderator is limited to their rooms.
  const isSuperAdmin = effective.permissions.includes("assign_roles");
  const myMod = moderators.find((m) => m.userId === profile.id);
  const allowedRooms =
    isSuperAdmin || !myMod || myMod.rooms.includes("*") ? null : myMod.rooms;

  return (
    <AppShell role="ADMIN" workspace="admin" profileName={me.name} profileSubtitle={t("liveControlCenter")}>
      <div className="mx-auto max-w-4xl px-4 pt-6">
        <Link href={`/admin/events/${id}`} className="inline-flex items-center gap-1 text-sm text-[var(--text-muted)] hover:text-[var(--navy)]">
          <ArrowLeft className="h-4 w-4" /> Back to manage
        </Link>
        <div className="mt-3 rounded-xl px-5 py-4" style={{ background: "#0c2340" }}>
          <p className="text-xs font-medium" style={{ color: "#5DCAA5" }}>Live control center</p>
          <h1 className="text-lg font-medium text-white">{event.title}</h1>
        </div>
      </div>

      <EventPresenceProvider eventId={event.id} slug={event.slug} room="Lobby" me={me}>
        <EventControlCenter
          eventId={event.id}
          slug={event.slug}
          initialSessions={event.sessions}
          summary={summary}
          allowedRooms={allowedRooms}
          initialHelp={helpRequests}
        />
      </EventPresenceProvider>
    </AppShell>
  );
}
