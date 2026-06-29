import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { MarketingFooter } from "@/components/MarketingFooter";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/supabase/auth";
import { getEventBySlug } from "@/lib/icfo-events/queries";
import { EventPresenceProvider } from "@/components/events/EventPresenceProvider";
import { EventVenueHeader } from "@/components/events/EventVenueHeader";
import { LobbyHall } from "@/components/events/LobbyHall";
import { LiveAnnouncementPopup } from "@/components/events/LiveAnnouncementPopup";
import { EventInfoDesk } from "@/components/events/EventInfoDesk";
import type { EventWithDetail } from "@/lib/icfo-events/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: "Lobby — iCFO Events",
    alternates: { canonical: `/events/${slug}/lobby` },
    robots: { index: false },
  };
}

async function loadEvent(slug: string): Promise<EventWithDetail | null> {
  const supabase = await createServerSupabaseClient();
  try {
    return await getEventBySlug(supabase, slug);
  } catch {
    return null;
  }
}

export default async function EventLobbyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await loadEvent(slug);
  if (!event || event.status === "draft" || event.status === "archived") notFound();

  const profile = await getCurrentUserProfile().catch(() => null);
  const me = profile ? { id: profile.id, name: profile.full_name ?? profile.email ?? "Attendee" } : null;

  const firstSector = event.sectors[0]?.sectorSlug;
  const tracksHref = firstSector ? `/events/sectors/${firstSector}` : `/events/${slug}#agenda`;

  return (
    <MarketingShell>
      <section className="mx-auto max-w-5xl px-4 py-8">
        <div className="flex items-center justify-between">
          <Link href={`/events/${slug}`} className="inline-flex items-center gap-1 text-sm text-[var(--text-muted)] hover:text-[var(--navy)]">
            <ArrowLeft className="h-4 w-4" /> Back to event
          </Link>
          <Link href={`/events/${slug}`} className="text-sm font-medium text-[var(--blue)] hover:underline">
            Skip lobby →
          </Link>
        </div>

        <EventPresenceProvider eventId={event.id} slug={slug} room="Lobby" me={me}>
          <div className="mt-5 overflow-hidden rounded-2xl border border-[var(--border-subtle)] shadow-[var(--shadow-card)]">
            <EventVenueHeader slug={slug} current="lobby" tracksHref={tracksHref} />
            <LobbyHall slug={slug} eventTitle={event.title} tracksHref={tracksHref} />
          </div>
          <LiveAnnouncementPopup />
          <EventInfoDesk slug={slug} />

        </EventPresenceProvider>

        <p className="mt-4 text-center text-xs text-[var(--text-muted)]">
          The lobby is a navigation aid only. Education &amp; community — not an offer of securities.
        </p>
      </section>

      <MarketingFooter />
    </MarketingShell>
  );
}
