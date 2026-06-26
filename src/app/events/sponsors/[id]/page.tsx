import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { MarketingFooter } from "@/components/MarketingFooter";
import { ComplianceBlock } from "@/components/ComplianceBlock";
import { SponsorIntroButton } from "@/components/events/SponsorIntroButton";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/supabase/auth";
import { track } from "@/lib/analytics/posthog";
import { getSponsorBooth } from "@/lib/icfo-events/sponsors";
import { sectorLabel } from "@/lib/icfo-events/sectors";
import type { SponsorBooth } from "@/lib/icfo-events/sponsors";

export const dynamic = "force-dynamic";

const TIER_LABEL: Record<string, string> = {
  presenting: "Presenting partner",
  gold: "Gold sponsor",
  silver: "Silver sponsor",
  community: "Community sponsor",
};

async function loadBooth(id: string): Promise<SponsorBooth | null> {
  const supabase = await createServerSupabaseClient();
  try {
    return await getSponsorBooth(supabase, id);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const booth = await loadBooth(id);
  if (!booth) return { title: "Sponsor not found" };
  const description = booth.blurb ?? `${booth.name} — a partner at iCFO Events.`;
  return {
    title: `${booth.name} — iCFO Events`,
    description,
    alternates: { canonical: `/events/sponsors/${id}` },
    openGraph: { title: booth.name, description, url: `/events/sponsors/${id}` },
  };
}

export default async function SponsorBoothPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const booth = await loadBooth(id);
  if (!booth) notFound();

  const profile = await getCurrentUserProfile();
  track("event_sponsor_viewed", { sponsorId: id, userId: profile?.id ?? null });

  return (
    <MarketingShell>
      <section className="mx-auto max-w-3xl px-4 py-14">
        <Link href="/events" className="inline-flex items-center gap-1 text-sm text-[var(--text-muted)] hover:text-[var(--navy)]">
          <ArrowLeft className="h-4 w-4" /> All events
        </Link>

        <div className="mt-4 flex items-center gap-4">
          {booth.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={booth.logoUrl} alt={booth.name} className="h-14 w-14 rounded-lg object-contain" />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-[var(--indigo-soft)] text-lg font-bold text-[var(--indigo)]">
              {booth.name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--navy)]">{booth.name}</h1>
            <div className="mt-1 flex items-center gap-2">
              <span className="rounded-full bg-[var(--indigo-soft)] px-2.5 py-0.5 text-xs font-medium text-[var(--indigo)]">
                {TIER_LABEL[booth.tier] ?? booth.tier}
              </span>
              {booth.sectorSlug && <span className="text-xs text-[var(--text-muted)]">{sectorLabel(booth.sectorSlug)}</span>}
            </div>
          </div>
        </div>

        {booth.blurb && <p className="mt-5 max-w-2xl text-[var(--text-secondary)]">{booth.blurb}</p>}

        {booth.website && (
          <a
            href={booth.website}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-[var(--blue)] hover:underline"
          >
            Visit website <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}

        <div className="mt-6">
          <SponsorIntroButton sponsorId={booth.id} sponsorName={booth.name} isAuthenticated={Boolean(profile)} />
        </div>

        {booth.events.length > 0 && (
          <div className="mt-10">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">Partnering at</h2>
            <div className="mt-3 space-y-2">
              {booth.events.map((e) => (
                <Link
                  key={e.eventId}
                  href={`/events/${e.slug}`}
                  className="flex items-center justify-between rounded-lg border border-[var(--border-subtle)] bg-white px-4 py-3 hover:border-[var(--indigo)]"
                >
                  <span className="font-medium text-[var(--navy)]">{e.title}</span>
                  <span className="text-xs capitalize text-[var(--text-muted)]">{e.placement}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>

      <ComplianceBlock />
      <MarketingFooter />
    </MarketingShell>
  );
}
