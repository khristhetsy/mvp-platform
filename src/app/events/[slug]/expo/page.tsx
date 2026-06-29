import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { MarketingFooter } from "@/components/MarketingFooter";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/supabase/auth";
import { getEventBySlug } from "@/lib/icfo-events/queries";
import { listEventSponsors } from "@/lib/icfo-events/sponsors";
import { EventPresenceProvider } from "@/components/events/EventPresenceProvider";
import { EventVenueHeader } from "@/components/events/EventVenueHeader";
import { LiveAnnouncementPopup } from "@/components/events/LiveAnnouncementPopup";
import { EventInfoDesk } from "@/components/events/EventInfoDesk";
import { SponsorHall } from "@/components/events/SponsorHall";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return { title: "Sponsor Hall — iCFO Events", alternates: { canonical: `/events/${slug}/expo` }, robots: { index: false } };
}

export default async function ExpoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createServerSupabaseClient();
  const event = await getEventBySlug(supabase, slug).catch(() => null);
  if (!event || event.status === "draft" || event.status === "archived") notFound();

  const profile = await getCurrentUserProfile().catch(() => null);
  const me = profile ? { id: profile.id, name: profile.full_name ?? profile.email ?? "Attendee" } : null;
  const sponsors = await listEventSponsors(supabase, event.id).catch(() => []);

  const firstSector = event.sectors[0]?.sectorSlug;
  const tracksHref = firstSector ? `/events/sectors/${firstSector}` : `/events/${slug}#agenda`;

  return (
    <MarketingShell>
      <section className="mx-auto max-w-5xl px-4 py-8">
        <Link href={`/events/${slug}/lobby`} className="inline-flex items-center gap-1 text-sm text-[var(--text-muted)] hover:text-[var(--navy)]">
          <ArrowLeft className="h-4 w-4" /> Back to lobby
        </Link>

        <EventPresenceProvider eventId={event.id} slug={slug} room="Sponsor Hall" me={me}>
          <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--border-subtle)] shadow-[var(--shadow-card)]">
            <EventVenueHeader slug={slug} current="sponsors" tracksHref={tracksHref} />
            <SponsorHall sponsors={sponsors} />
          </div>
          <LiveAnnouncementPopup />
          <EventInfoDesk slug={slug} />

        </EventPresenceProvider>
      </section>
      <MarketingFooter />
    </MarketingShell>
  );
}
