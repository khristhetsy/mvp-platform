import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { requirePermissionPage } from "@/lib/api/permissions";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getEventById, listAllEvents } from "@/lib/icfo-events/queries";
import { loadSessionGuests } from "@/lib/icfo-events/live-session";
import { pickStudioEvent, sessionsForRoom } from "@/lib/icfo-events/studio";
import { StudioTabs } from "@/components/admin-events/StudioTabs";
import { SessionStudio } from "@/components/admin-events/SessionStudio";

/** Page body for the Talk Show studio. */
export async function StudioRoomPage({ searchParams }: { room: "talk-show"; searchParams: Promise<{ event?: string }> }) {
  const { profile, effective } = await requirePermissionPage("view_events");
  const canEdit = effective.permissions.includes("manage_events");
  const { event: requested } = await searchParams;
  const admin = createServiceRoleClient();

  const events = await listAllEvents(admin).catch(() => []);
  const chosen = pickStudioEvent(events, requested);
  const detail = chosen ? await getEventById(admin, chosen.id).catch(() => null) : null;

  const sessions = detail ? sessionsForRoom(detail.sessions, "talk-show") : [];
  const guestCounts: Record<string, { total: number; onstage: number }> = {};
  await Promise.all(
    sessions.map(async (s) => {
      const guests = await loadSessionGuests(admin, s.id).catch(() => []);
      guestCounts[s.id] = { total: guests.length, onstage: guests.filter((g) => g.status === "onstage").length };
    }),
  );

  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle="Talk Show Studio">
      <div className="space-y-5">
        <StudioTabs current="talk-show" eventId={chosen?.id} />
        {detail ? (
          <SessionStudio
            key={detail.id}
            events={events.map((e) => ({ id: e.id, title: e.title }))}
            eventId={detail.id}
            slug={detail.slug}
            timezone={detail.timezone ?? "America/Los_Angeles"}
            initialSessions={sessions}
            guestCounts={guestCounts}
            canEdit={canEdit}
          />
        ) : (
          <div className="rounded-xl border border-dashed border-[var(--border-subtle)] p-10 text-center text-sm text-[var(--text-muted)]">
            No events yet. <Link href="/admin/events" className="font-medium text-[#1A6CE4] hover:underline">Create one in Events</Link>.
          </div>
        )}
      </div>
    </AppShell>
  );
}
