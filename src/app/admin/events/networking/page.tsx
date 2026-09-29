import { AppShell } from "@/components/AppShell";
import { requirePermissionPage } from "@/lib/api/permissions";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getGoogleConnectionStatus } from "@/lib/integrations/connected-accounts";
import { listAllEvents } from "@/lib/icfo-events/queries";
import { loadNetworkingBoard, type NetworkingBoard as Board } from "@/lib/icfo-events/networking-board";
import { DEFAULT_PAIR_TYPES } from "@/lib/icfo-events/pair-types";
import { NetworkingBoard } from "@/components/admin-events/NetworkingBoard";
import { listTemplates } from "@/lib/icfo-events/introductions-server";
import { IntroTemplatesEditor } from "@/components/admin-events/IntroTemplatesEditor";
import { MatchingRulesEditor } from "@/components/admin-events/MatchingRulesEditor";
import { MatchStrength } from "@/components/admin-events/MatchStrength";
import Link from "next/link";

type Tab = "matches" | "rules" | "messages";

const TABS: Array<{ key: Tab; label: string }> = [
  { key: "matches", label: "Matches" },
  { key: "rules", label: "Matching rules" },
  { key: "messages", label: "Messages" },
];

export const dynamic = "force-dynamic";
export const metadata = { title: "Networking Matching" };

/**
 * Who matched with whom, and where their connection request got to.
 *
 * One event at a time: matches are every pair of registered attendees, so the
 * set grows with the square of the room and there is nothing useful to say
 * across events at once.
 */
export default async function NetworkingMatchingPage({
  searchParams,
}: {
  searchParams: Promise<{ eventId?: string; tab?: string }>;
}) {
  const { profile } = await requirePermissionPage("manage_events");
  const { eventId, tab } = await searchParams;
  const view: Tab = tab === "rules" || tab === "messages" ? tab : "matches";
  const admin = createServiceRoleClient();

  const events = await listAllEvents(admin).catch(() => []);
  const selected = eventId && events.some((e) => e.id === eventId) ? eventId : events[0]?.id ?? null;
  const empty: Board = {
    matchable: 0, registered: 0, withoutSectors: 0, pairs: [], totalPairs: 0,
    counts: { matches: 0, requested: 0, accepted: 0, declined: 0, notSent: 0, scheduled: 0 },
    rules: DEFAULT_PAIR_TYPES,
    bands: [],
    median: null,
    byPairType: {},
  };
  const board = selected ? await loadNetworkingBoard(selected) : empty;
  const templates = await listTemplates().catch(() => []);

  // Where a test may go: the signed-in staff address, plus one alternate from
  // the environment for checking how another mail client renders it. Neither
  // is invented — an unset alternate simply does not appear.
  const testAddresses = [profile.email, process.env.EVENT_TEST_EMAIL]
    .map((a) => (a ?? "").trim())
    .filter((a, i, all) => a.includes("@") && all.indexOf(a) === i);

  // Whether Gmail can actually send. Never offered as a live choice otherwise —
  // failing after the introduction rows exist would leave introductions
  // recorded that nobody received.
  const googleStatus = await getGoogleConnectionStatus(await createServerSupabaseClient(), profile.id)
    .catch(() => null);
  const canSendGmail = Boolean(
    googleStatus?.connected && googleStatus.scopes.includes("https://www.googleapis.com/auth/gmail.send"),
  );
  const gmail = {
    available: canSendGmail,
    address: googleStatus?.email ?? null,
    reason: !googleStatus?.connected
      ? "Connect your Google account in Settings to send from Gmail."
      : canSendGmail
        ? null
        : "Reconnect your Google account with send permission to use this.",
  };

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
            <>
              <div className="mb-4 flex flex-wrap gap-0.5 border-b border-[var(--border-subtle)]">
                {TABS.map((t) => (
                  <Link
                    key={t.key}
                    href={`/admin/events/networking?eventId=${selected ?? ""}&tab=${t.key}`}
                    className={`-mb-px rounded-t-lg border border-b-0 px-3.5 py-2 text-[12.5px] ${
                      view === t.key
                        ? "border-[var(--border-subtle)] bg-white font-semibold text-[var(--navy)]"
                        : "border-transparent text-[var(--text-secondary)]"
                    }`}
                  >
                    {t.label}
                  </Link>
                ))}
              </div>

              {view === "matches" ? (
                <div className="space-y-3">
                  <MatchStrength bands={board.bands} median={board.median} total={board.counts.matches} />
                  <NetworkingBoard
                    board={board}
                    eventId={selected ?? ""}
                    events={events.map((e) => ({ id: e.id, title: e.title }))}
                    gmail={{ available: gmail.available, address: gmail.address }}
                  />
                </div>
              ) : null}

              {view === "rules" ? (
                <MatchingRulesEditor
                  eventId={selected ?? ""}
                  initial={board.rules}
                  byPairType={board.byPairType}
                />
              ) : null}

              {view === "messages" ? (
                templates.length ? (
                  <IntroTemplatesEditor
                    initial={templates}
                    eventId={selected ?? ""}
                    testAddresses={testAddresses}
                    gmail={gmail}
                  />
                ) : (
                  <p className="rounded-xl border border-dashed border-[var(--border-subtle)] p-8 text-center text-sm text-[var(--text-muted)]">
                    No message templates yet — run the migration that seeds them.
                  </p>
                )
              ) : null}
            </>
          )}
        </div>
      </WorkspacePageContainer>
    </AppShell>
  );
}
