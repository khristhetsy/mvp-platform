import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CalendarDays } from "lucide-react";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { MarketingFooter } from "@/components/MarketingFooter";
import { ComplianceBlock } from "@/components/ComplianceBlock";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { listEventsBySector } from "@/lib/icfo-events/queries";
import { isValidSectorSlug, sectorLabel } from "@/lib/icfo-events/sectors";
import type { EventRecord } from "@/lib/icfo-events/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  if (!isValidSectorSlug(slug)) return { title: "Sector not found" };
  const label = sectorLabel(slug);
  return {
    title: `${label} events — iCFO Events`,
    description: `Founder showcases, panels, and talk shows in ${label}.`,
    alternates: { canonical: `/events/sectors/${slug}` },
    openGraph: { title: `${label} — iCFO Events`, description: `${label} sector events.`, url: `/events/sectors/${slug}` },
  };
}

function fmtRange(start: string | null, end: string | null): string {
  if (!start) return "Date to be announced";
  const s = new Date(start);
  const opts: Intl.DateTimeFormatOptions = { month: "long", day: "numeric", year: "numeric" };
  if (!end) return s.toLocaleDateString(undefined, opts);
  const e = new Date(end);
  return `${s.toLocaleDateString(undefined, { month: "long", day: "numeric" })} – ${e.toLocaleDateString(undefined, opts)}`;
}

export default async function SectorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isValidSectorSlug(slug)) notFound();

  const supabase = await createServerSupabaseClient();
  let events: EventRecord[] = [];
  try {
    events = await listEventsBySector(supabase, slug);
  } catch {
    events = [];
  }

  const label = sectorLabel(slug);

  return (
    <MarketingShell>
      <section className="mx-auto max-w-5xl px-4 py-14">
        <Link href="/events" className="inline-flex items-center gap-1 text-sm text-[var(--text-muted)] hover:text-[var(--navy)]">
          <ArrowLeft className="h-4 w-4" /> All events
        </Link>
        <p className="mt-4 text-sm font-semibold uppercase tracking-wide text-[var(--indigo)]">Sector track</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-[var(--navy)] sm:text-4xl">{label}</h1>
        <p className="mt-3 max-w-2xl text-[var(--text-secondary)]">
          Founder showcases, panels, and talk shows in {label}. Education and community — deals stay behind the
          accredited diligence flow.
        </p>

        <div className="mt-10 grid gap-4">
          {events.length === 0 ? (
            <div className="rounded-xl border border-[var(--border-subtle)] bg-white px-6 py-16 text-center">
              <CalendarDays className="mx-auto h-8 w-8 text-[var(--text-muted)]" />
              <p className="mt-3 text-sm font-medium text-[var(--text-primary)]">No {label} events yet</p>
              <p className="mt-1 text-sm text-[var(--text-muted)]">Check back soon.</p>
            </div>
          ) : (
            events.map((ev) => (
              <Link
                key={ev.id}
                href={`/events/${ev.slug}`}
                className="group flex items-center justify-between rounded-xl border border-[var(--border-subtle)] bg-white px-6 py-5 shadow-[var(--shadow-panel)] transition hover:border-[var(--indigo)]"
              >
                <div>
                  <span className="rounded-full bg-[var(--indigo-soft)] px-2.5 py-0.5 text-xs font-medium capitalize text-[var(--indigo)]">
                    {ev.format.replace("_", " ")}
                  </span>
                  <h2 className="mt-2 text-lg font-semibold text-[var(--navy)]">{ev.title}</h2>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">{fmtRange(ev.startsAt, ev.endsAt)}</p>
                </div>
                <ArrowRight className="h-5 w-5 flex-none text-[var(--text-muted)] transition group-hover:translate-x-0.5 group-hover:text-[var(--indigo)]" />
              </Link>
            ))
          )}
        </div>
      </section>

      <ComplianceBlock />
      <MarketingFooter />
    </MarketingShell>
  );
}
