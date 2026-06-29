import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { MarketingFooter } from "@/components/MarketingFooter";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/supabase/auth";
import { getEventBySlug } from "@/lib/icfo-events/queries";
import { isBanned } from "@/lib/icfo-events/engagement";
import { buildSectorTracks } from "@/lib/icfo-events/rooms";
import { sectorLabel } from "@/lib/icfo-events/sectors";
import { getVideoProvider } from "@/lib/icfo-events/video/provider";
import { embeddableLiveUrl } from "@/lib/icfo-events/video/external";
import { EventPresenceProvider } from "@/components/events/EventPresenceProvider";
import { EventVenueHeader } from "@/components/events/EventVenueHeader";
import { LiveAnnouncementPopup } from "@/components/events/LiveAnnouncementPopup";
import { EventInfoDesk } from "@/components/events/EventInfoDesk";
import { SectorTracksRoom, type TrackData } from "@/components/events/SectorTracksRoom";
import type { EventSession } from "@/lib/icfo-events/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return { title: "Sector Tracks — iCFO Events", alternates: { canonical: `/events/${slug}/tracks` }, robots: { index: false } };
}

/** Resolve the live embed/join URL for a now-playing session (server-side, so
 *  the client component never imports the video providers). */
function stageEmbed(s: EventSession | null): { embedUrl: string | null; joinUrl: string | null } {
  if (!s || s.status !== "live" || !s.videoRef) return { embedUrl: null, joinUrl: null };
  if (s.videoProvider === "whereby") return { embedUrl: getVideoProvider("whereby").embedUrl(s.videoRef), joinUrl: null };
  if (s.videoProvider === "external") {
    const e = embeddableLiveUrl(s.videoRef);
    return e ? { embedUrl: e, joinUrl: null } : { embedUrl: null, joinUrl: s.videoRef };
  }
  return { embedUrl: null, joinUrl: null };
}

export default async function TracksPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createServerSupabaseClient();
  const event = await getEventBySlug(supabase, slug).catch(() => null);
  if (!event || event.status === "draft" || event.status === "archived") notFound();

  const profile = await getCurrentUserProfile().catch(() => null);
  if (profile && (await isBanned(supabase, event.id, profile.id))) notFound();
  const me = profile ? { id: profile.id, name: profile.full_name ?? profile.email ?? "Attendee" } : null;

  const trackViews = buildSectorTracks(
    event.sectors.map((s) => ({ sectorSlug: s.sectorSlug, label: s.label || sectorLabel(s.sectorSlug) })),
    event.sessions,
  );

  const tracks: TrackData[] = trackViews.map((t) => {
    const embed = stageEmbed(t.nowPlaying);
    return {
      sectorSlug: t.sectorSlug,
      label: t.label,
      isLive: t.isLive,
      now: t.nowPlaying
        ? { title: t.nowPlaying.title, status: t.nowPlaying.status, startsAt: t.nowPlaying.startsAt, embedUrl: embed.embedUrl, joinUrl: embed.joinUrl }
        : null,
      agenda: t.agenda.map((s) => ({ id: s.id, title: s.title, type: s.type, status: s.status, startsAt: s.startsAt })),
    };
  });

  return (
    <MarketingShell>
      <section className="mx-auto max-w-5xl px-4 py-8">
        <Link href={`/events/${slug}/lobby`} className="inline-flex items-center gap-1 text-sm text-[var(--text-muted)] hover:text-[var(--navy)]">
          <ArrowLeft className="h-4 w-4" /> Back to lobby
        </Link>

        <EventPresenceProvider eventId={event.id} slug={slug} room="On-Demand" me={me}>
          <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--border-subtle)] shadow-[var(--shadow-card)]">
            <EventVenueHeader slug={slug} current="ondemand" tracksHref={`/events/${slug}/tracks`} />
            <SectorTracksRoom tracks={tracks} />
          </div>
          <p className="mt-3 text-center text-xs text-[var(--text-muted)]">Parallel sector rooms — each with its own now-playing session and agenda.</p>
          <LiveAnnouncementPopup />
          <EventInfoDesk slug={slug} />
        </EventPresenceProvider>
      </section>
      <MarketingFooter />
    </MarketingShell>
  );
}
