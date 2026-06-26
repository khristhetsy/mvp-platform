import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { ComplianceBlock } from "@/components/ComplianceBlock";
import { MarketingFooter } from "@/components/MarketingFooter";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { JsonLd } from "@/components/seo/JsonLd";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getEventBySlug } from "@/lib/icfo-events/queries";
import { sectorLabel } from "@/lib/icfo-events/sectors";
import type { EventWithDetail, EventSession } from "@/lib/icfo-events/types";

export const dynamic = "force-dynamic";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://icapos.com";

const SESSION_TYPE_LABEL: Record<EventSession["type"], string> = {
  keynote: "Keynote",
  panel: "Panel",
  talk_show: "Talk Show",
  founder_showcase: "Founder Showcase",
  workshop: "Workshop",
};

async function loadEvent(slug: string): Promise<EventWithDetail | null> {
  const supabase = await createServerSupabaseClient();
  try {
    return await getEventBySlug(supabase, slug);
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const event = await loadEvent(slug);
  if (!event || event.status === "draft" || event.status === "archived") {
    return { title: "Event not found" };
  }
  const description = event.summary ?? "An iCFO Events sector showcase convening founders and investors.";
  return {
    title: `${event.title} — iCFO Events`,
    description,
    alternates: { canonical: `/events/${event.slug}` },
    openGraph: { title: event.title, description, url: `/events/${event.slug}`, type: "website" },
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

export default async function EventDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await loadEvent(slug);

  // Drafts/archived aren't public (RLS also blocks anon, but guard the staff path too).
  if (!event || event.status === "draft" || event.status === "archived") {
    notFound();
  }

  const visibleSessions = event.sessions.filter((s) => s.status !== "draft");

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    description: event.summary ?? undefined,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode",
    url: `${SITE_URL}/events/${event.slug}`,
    ...(event.startsAt ? { startDate: event.startsAt } : {}),
    ...(event.endsAt ? { endDate: event.endsAt } : {}),
    organizer: { "@type": "Organization", name: "iCFO Capital", url: SITE_URL },
  };

  return (
    <MarketingShell>
      <JsonLd data={jsonLd} />

      <section className="mx-auto max-w-4xl px-4 py-14">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-[var(--indigo-soft)] px-2.5 py-0.5 text-xs font-medium capitalize text-[var(--indigo)]">
            {event.format.replace("_", " ")}
          </span>
          {event.status === "live" && (
            <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-700">Live now</span>
          )}
          {event.status === "ended" && (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">Concluded</span>
          )}
        </div>

        <h1 className="mt-4 text-3xl font-bold tracking-tight text-[var(--navy)] sm:text-4xl">{event.title}</h1>

        <div className="mt-3 flex items-center gap-2 text-sm text-[var(--text-muted)]">
          <CalendarDays className="h-4 w-4" />
          {fmtRange(event.startsAt, event.endsAt)}
        </div>

        {event.summary && <p className="mt-5 max-w-2xl text-[var(--text-secondary)]">{event.summary}</p>}

        {event.sectors.length > 0 && (
          <div className="mt-8">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">Sector tracks</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {event.sectors.map((s) => (
                <span
                  key={s.id}
                  className="rounded-full border border-[var(--border-subtle)] bg-white px-3 py-1 text-sm font-medium text-[var(--text-secondary)]"
                >
                  {s.label || sectorLabel(s.sectorSlug)}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">Agenda</h2>
          {visibleSessions.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--text-muted)]">Sessions will be announced soon.</p>
          ) : (
            <ol className="mt-4 space-y-3">
              {visibleSessions.map((s) => (
                <li
                  key={s.id}
                  className="rounded-xl border border-[var(--border-subtle)] bg-white px-5 py-4 shadow-[var(--shadow-panel)]"
                >
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-[var(--indigo-soft)] px-2 py-0.5 text-xs font-medium text-[var(--indigo)]">
                      {SESSION_TYPE_LABEL[s.type]}
                    </span>
                    {s.sectorSlug && (
                      <span className="text-xs text-[var(--text-muted)]">{sectorLabel(s.sectorSlug)}</span>
                    )}
                  </div>
                  <h3 className="mt-2 font-semibold text-[var(--navy)]">{s.title}</h3>
                  {s.abstract && <p className="mt-1 text-sm text-[var(--text-secondary)]">{s.abstract}</p>}
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>

      <ComplianceBlock />
      <MarketingFooter />
    </MarketingShell>
  );
}
