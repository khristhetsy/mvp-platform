import { AppShell } from "@/components/AppShell";
import { requirePermissionPage } from "@/lib/api/permissions";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { listAllEvents } from "@/lib/icfo-events/queries";
import { loadNetworkingBoard, type NetworkingBoard as Board } from "@/lib/icfo-events/networking-board";
import { NetworkingBoard } from "@/components/admin-events/NetworkingBoard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Networking Matching" };

/**
 * Who matched with whom, and where their connection request got to.
 *
 * One event at a time: matches are every pair of opted-in attendees, so the
 * set grows with the square of the room and there is nothing useful to say
 * across events at once.
 */
export default async function NetworkingMatchingPage({
  searchParams,
}: {
  searchParams: Promise<{ eventId?: string }>;
}) {
  const { profile } = await requirePermissionPage("manage_events");
  const { eventId } = await searchParams;
  const admin = createServiceRoleClient();

  const events = await listAllEvents(admin).catch(() => []);
  const selected = eventId && events.some((e) => e.id === eventId) ? eventId : events[0]?.id ?? null;
  const empty: Board = {
    matchable: 0, registered: 0, withoutSectors: 0, pairs: [], totalPairs: 0,
    counts: { matches: 0, requested: 0, accepted: 0, declined: 0 },
  };
  const board = selected ? await loadNetworkingBoard(selected) : empty;

  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle="Networking Matching">
      <WorkspacePageContainer>
        <PageHeader
          eyebrow="Event Hub"
          title="Networking Matching"
          description="Who was matched with whom at an event, and what happened to the request."
        />
        <div className="mt-6">
          {events.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[var(--border-subtle)] p-8 text-center text-sm text-[var(--text-muted)]">
              No events yet.
            </p>
          ) : (
            <NetworkingBoard
              board={board}
              eventId={selected ?? ""}
              events={events.map((e) => ({ id: e.id, title: e.title }))}
            />
          )}
        </div>
      </WorkspacePageContainer>
    </AppShell>
  );
}
