import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Presentation, Layers, Store, Users, ArrowLeft } from "lucide-react";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { MarketingFooter } from "@/components/MarketingFooter";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getEventBySlug } from "@/lib/icfo-events/queries";
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

  const firstSector = event.sectors[0]?.sectorSlug;
  const tracksHref = firstSector ? `/events/sectors/${firstSector}` : `/events/${slug}#agenda`;

  const hotspots = [
    {
      key: "stage",
      label: "Main Stage",
      desc: "Keynotes & headline sessions",
      href: `/events/${slug}#agenda`,
      Icon: Presentation,
      enabled: true,
      pos: "left-[8%] top-[14%]",
    },
    {
      key: "tracks",
      label: "Sector Tracks",
      desc: "Parallel sector rooms",
      href: tracksHref,
      Icon: Layers,
      enabled: true,
      pos: "right-[8%] top-[14%]",
    },
    {
      key: "sponsors",
      label: "Sponsor Hall",
      desc: "Partner booths & resources",
      href: `/events/${slug}#partners`,
      Icon: Store,
      enabled: true,
      pos: "left-[8%] bottom-[14%]",
    },
    {
      key: "lounge",
      label: "Networking Lounge",
      desc: "Topic tables & live chat",
      href: `/events/${slug}/lounge`,
      Icon: Users,
      enabled: true,
      pos: "right-[8%] bottom-[14%]",
    },
  ];

  return (
    <MarketingShell>
      <section className="mx-auto max-w-5xl px-4 py-10">
        <div className="flex items-center justify-between">
          <Link href={`/events/${slug}`} className="inline-flex items-center gap-1 text-sm text-[var(--text-muted)] hover:text-[var(--navy)]">
            <ArrowLeft className="h-4 w-4" /> Back to event
          </Link>
          <Link href={`/events/${slug}`} className="text-sm font-medium text-[var(--blue)] hover:underline">
            Skip lobby →
          </Link>
        </div>

        <h1 className="mt-4 text-center text-2xl font-bold tracking-tight text-[var(--navy)]">{event.title}</h1>
        <p className="mt-1 text-center text-sm text-[var(--text-muted)]">Choose where to go — or skip straight to the event.</p>

        {/* 2D hotspot hall — a styled floor with four clickable zones. Pure CSS, no WebGL. */}
        <nav
          aria-label="Event lobby"
          className="relative mx-auto mt-8 aspect-[16/9] w-full max-w-4xl overflow-hidden rounded-3xl border border-[var(--border-subtle)]"
          style={{
            background:
              "radial-gradient(120% 90% at 50% 0%, var(--indigo-soft) 0%, #ffffff 45%), linear-gradient(180deg, #ffffff 0%, var(--surface-sunken) 100%)",
          }}
        >
          {/* faux floor + horizon for a "hall" feel */}
          <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[var(--navy-muted)] to-transparent" />
          <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 h-40 w-px -translate-x-1/2 -translate-y-1/2 bg-[var(--border-subtle)]" />

          {hotspots.map(({ key, label, desc, href, Icon, enabled, pos }) =>
            enabled ? (
              <Link
                key={key}
                href={href}
                aria-label={`${label} — ${desc}`}
                className={`absolute ${pos} flex w-44 flex-col items-center gap-2 rounded-2xl border border-[var(--border-subtle)] bg-white/90 p-4 text-center shadow-[var(--shadow-card)] backdrop-blur transition hover:-translate-y-0.5 hover:border-[var(--indigo)]`}
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--indigo-soft)] text-[var(--indigo)]">
                  <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                </span>
                <span className="text-sm font-semibold text-[var(--navy)]">{label}</span>
                <span className="text-xs text-[var(--text-muted)]">{desc}</span>
              </Link>
            ) : (
              <div
                key={key}
                aria-label={`${label} — coming soon`}
                className={`absolute ${pos} flex w-44 cursor-not-allowed flex-col items-center gap-2 rounded-2xl border border-dashed border-[var(--border-subtle)] bg-white/60 p-4 text-center opacity-70`}
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                  <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                </span>
                <span className="text-sm font-semibold text-slate-500">{label}</span>
                <span className="text-xs text-[var(--text-muted)]">{desc}</span>
              </div>
            ),
          )}
        </nav>

        <p className="mt-4 text-center text-xs text-[var(--text-muted)]">
          The lobby is a navigation aid only. Education &amp; community — not an offer of securities.
        </p>
      </section>

      <MarketingFooter />
    </MarketingShell>
  );
}
