import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { requirePermissionPage } from "@/lib/api/permissions";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getEventById, listAllEvents } from "@/lib/icfo-events/queries";
import { pickStudioEvent, sessionsForRoom } from "@/lib/icfo-events/studio";
import { StudioTabs } from "@/components/admin-events/StudioTabs";
import { SessionStudio } from "@/components/admin-events/SessionStudio";

const TITLE = { "talk-show": "Talk Show Studio" } as const;

/** Page body for the Talk Show studio. */
export async function StudioRoomPage({ room, searchParams }: { room: "talk-show"; searchParams: Promise<{ event?: string }> }) {
  const { profile, effective } = await requirePermissionPage("view_events");
  const canEdit = effective.permissions.includes("manage_events");
  const { event: requested } = await searchParams;
  const admin = createServiceRoleClient();

  const events = await listAllEvents(admin).catch(() => []);
  const chosen = pickStudioEvent(events, requested);
  const detail = chosen ? await getEventById(admin, chosen.id).catch(() => null) : null;

  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle={TITLE[room]}>
      <div className="space-y-6">
        <StudioTabs current={room} eventId={chosen?.id} />
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs text-[var(--text-muted)]">Studio</p>
            <h1 className="text-xl font-semibold text-[var(--text-primary)]">{TITLE[room]}</h1>
          </div>
          {events.length > 0 ? (
            <form method="get" className="flex items-center gap-2">
              <select name="event" defaultValue={chosen?.id} aria-label="Event" className="rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-sm">
                {events.map((e) => (
                  <option key={e.id} value={e.id}>{e.title}</option>
                ))}
              </select>
              <button type="submit" className="rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-sm hover:bg-slate-50">Open</button>
            </form>
          ) : null}
        </div>

        {detail ? (
          <SessionStudio
            key={detail.id}
            room={room}
            eventId={detail.id}
            slug={detail.slug}
            timezone={detail.timezone ?? "America/Los_Angeles"}
            initialSessions={sessionsForRoom(detail.sessions, room)}
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
