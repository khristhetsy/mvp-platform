import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { MarketingFooter } from "@/components/MarketingFooter";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/supabase/auth";
import { getEventBySlug, getVenueNavFlags } from "@/lib/icfo-events/queries";
import { isBanned } from "@/lib/icfo-events/engagement";
import { sectorLabel } from "@/lib/icfo-events/sectors";
import { loadSpotlightPlaylist } from "@/lib/icfo-events/spotlight/service";
import { EventPresenceProvider } from "@/components/events/EventPresenceProvider";
import { EventVenueHeader } from "@/components/events/EventVenueHeader";
import { EventInfoDesk } from "@/components/events/EventInfoDesk";
import { IcfoDisclaimer } from "@/components/events/IcfoDisclaimer";
import { SpotlightPlayer } from "@/components/events/SpotlightPlayer";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return { title: "Founder Spotlight — iCFO Events", alternates: { canonical: `/events/${slug}/spotlight` }, robots: { index: false } };
}

export default async function SpotlightPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createServerSupabaseClient();
  const event = await getEventBySlug(supabase, slug).catch(() => null);
  if (!event || event.status === "draft" || event.status === "archived") notFound();

  const profile = await getCurrentUserProfile().catch(() => null);
  if (profile && (await isBanned(supabase, event.id, profile.id))) notFound();
  const me = profile ? { id: profile.id, name: profile.full_name ?? profile.email ?? "Attendee" } : null;

  const [playlist, navFlags] = await Promise.all([
    loadSpotlightPlaylist(event.id).catch(() => []),
    getVenueNavFlags(supabase, event),
  ]);
  const labels: Record<string, string> = {};
  for (const s of event.sectors ?? []) labels[s.sectorSlug] = s.label || sectorLabel(s.sectorSlug);
  for (const p of playlist) if (p.sectorSlug && !labels[p.sectorSlug]) labels[p.sectorSlug] = sectorLabel(p.sectorSlug);

  return (
    <MarketingShell>
      <section className="mx-auto max-w-5xl px-4 py-8">
        <Link href={`/events/${slug}/lobby`} className="inline-flex items-center gap-1 text-sm text-[var(--text-muted)] hover:text-[var(--navy)]">
          <ArrowLeft className="h-4 w-4" /> Back to lobby
        </Link>
        <EventPresenceProvider eventId={event.id} slug={slug} room="Main Stage" me={me}>
          <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--border-subtle)] shadow-[var(--shadow-card)]">
            <EventVenueHeader slug={slug} current="spotlight" flags={navFlags} />
            <SpotlightPlayer items={playlist} sectorLabels={labels} />
          </div>
          <IcfoDisclaimer className="mt-4" />
          <EventInfoDesk slug={slug} />
        </EventPresenceProvider>
      </section>
      <MarketingFooter />
    </MarketingShell>
  );
}
