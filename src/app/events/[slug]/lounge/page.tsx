import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { MarketingFooter } from "@/components/MarketingFooter";
import { LoungeRoom } from "@/components/events/LoungeRoom";
import { NetworkingConnections } from "@/components/events/NetworkingConnections";
import { EventPresenceProvider } from "@/components/events/EventPresenceProvider";
import { EventVenueHeader } from "@/components/events/EventVenueHeader";
import { LiveAnnouncementPopup } from "@/components/events/LiveAnnouncementPopup";
import { EventInfoDesk } from "@/components/events/EventInfoDesk";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/supabase/auth";
import { getEventBySlug } from "@/lib/icfo-events/queries";
import { loadLoungeTables } from "@/lib/icfo-events/lounge";
import { listSuggestions, listConnections } from "@/lib/icfo-events/networking";
import { isBanned } from "@/lib/icfo-events/engagement";

export const dynamic = "force-dynamic";
export const metadata = { title: "Networking Lounge — iCFO Events", robots: { index: false } };

export default async function LoungePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createServerSupabaseClient();
  const event = await getEventBySlug(supabase, slug).catch(() => null);
  if (!event || !["published", "live"].includes(event.status)) notFound();

  const profile = await getCurrentUserProfile();
  if (!profile) redirect(`/auth/sign-in?next=/events/${slug}/lounge`);
  if (await isBanned(supabase, event.id, profile.id)) notFound();

  const me = { id: profile.id, name: profile.full_name ?? profile.email ?? "You" };
  const [tables, suggestions, connections] = await Promise.all([
    loadLoungeTables(supabase, event.id).catch(() => []),
    listSuggestions(supabase, event.id, profile.id).catch(() => []),
    listConnections(supabase, event.id, profile.id).catch(() => []),
  ]);

  const tracksHref = `/events/${slug}/tracks`;

  return (
    <MarketingShell>
      <section className="mx-auto max-w-5xl px-4 py-8">
        <Link href={`/events/${slug}/lobby`} className="inline-flex items-center gap-1 text-sm text-[var(--text-muted)] hover:text-[var(--navy)]">
          <ArrowLeft className="h-4 w-4" /> Back to lobby
        </Link>

        <EventPresenceProvider eventId={event.id} slug={slug} room="Networking" me={me}>
          <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--border-subtle)] shadow-[var(--shadow-card)]">
            <EventVenueHeader slug={slug} current="networking" tracksHref={tracksHref} />
            <div className="p-4 sm:p-5">
              <h1 className="text-xl font-semibold text-[var(--navy)]">Networking Lounge</h1>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                Join a topic table, or connect with a sector-matched attendee. Introductions are double opt-in.
                Education &amp; community — not an offer of securities.
              </p>

              <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_320px]">
                <LoungeRoom eventId={event.id} me={me} initialTables={tables} />
                <div>
                  <h2 className="mb-2 text-sm font-semibold text-[var(--navy)]">Suggested for you</h2>
                  <NetworkingConnections eventId={event.id} suggestions={suggestions} initialConnections={connections} />
                </div>
              </div>
            </div>
          </div>
          <LiveAnnouncementPopup />
          <EventInfoDesk slug={slug} />

        </EventPresenceProvider>
      </section>
      <MarketingFooter />
    </MarketingShell>
  );
}
