import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { MarketingFooter } from "@/components/MarketingFooter";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/supabase/auth";
import { getEventBySlug } from "@/lib/icfo-events/queries";
import { getLeaderboard, getMemberStats } from "@/lib/icfo-events/gamification";
import { getMissionProgress } from "@/lib/icfo-events/missions";
import { isBanned } from "@/lib/icfo-events/engagement";
import { EventPresenceProvider } from "@/components/events/EventPresenceProvider";
import { EventVenueHeader } from "@/components/events/EventVenueHeader";
import { LiveAnnouncementPopup } from "@/components/events/LiveAnnouncementPopup";
import { EventInfoDesk } from "@/components/events/EventInfoDesk";
import { GamificationDashboard } from "@/components/events/GamificationDashboard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Leaderboard — iCFO Events", robots: { index: false } };

export default async function LeaderboardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createServerSupabaseClient();
  const event = await getEventBySlug(supabase, slug).catch(() => null);
  if (!event || event.status === "draft" || event.status === "archived") notFound();

  const profile = await getCurrentUserProfile();
  if (!profile) redirect(`/auth/sign-in?next=/events/${slug}/leaderboard`);
  if (await isBanned(supabase, event.id, profile.id)) notFound();

  const me = { id: profile.id, name: profile.full_name ?? profile.email ?? "You" };
  const [stats, missions, leaderboard] = await Promise.all([
    getMemberStats(supabase, event.id, profile.id).catch(() => ({ points: 0, badges: [] })),
    getMissionProgress(supabase, event.id, profile.id).catch(() => []),
    getLeaderboard(supabase, event.id, 50).catch(() => []),
  ]);
  const rank = leaderboard.find((e) => e.profileId === profile.id)?.rank ?? null;

  const firstSector = event.sectors[0]?.sectorSlug;
  const tracksHref = firstSector ? `/events/sectors/${firstSector}` : `/events/${slug}#agenda`;

  return (
    <MarketingShell>
      <section className="mx-auto max-w-5xl px-4 py-8">
        <Link href={`/events/${slug}/lobby`} className="inline-flex items-center gap-1 text-sm text-[var(--text-muted)] hover:text-[var(--navy)]">
          <ArrowLeft className="h-4 w-4" /> Back to lobby
        </Link>

        <EventPresenceProvider eventId={event.id} slug={slug} room="Lobby" me={me}>
          <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--border-subtle)] shadow-[var(--shadow-card)]">
            <EventVenueHeader slug={slug} current="leaderboard" tracksHref={tracksHref} />
            <GamificationDashboard stats={stats} rank={rank} missions={missions} leaderboard={leaderboard.slice(0, 10)} meId={profile.id} />
          </div>
          <LiveAnnouncementPopup />
          <EventInfoDesk slug={slug} />

        </EventPresenceProvider>
      </section>
      <MarketingFooter />
    </MarketingShell>
  );
}
