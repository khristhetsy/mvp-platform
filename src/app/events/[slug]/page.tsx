import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { ComplianceBlock } from "@/components/ComplianceBlock";
import { MarketingFooter } from "@/components/MarketingFooter";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { JsonLd } from "@/components/seo/JsonLd";
import { RegisterButton } from "@/components/events/RegisterButton";
import { NetworkingOptIn } from "@/components/events/NetworkingOptIn";
import { NetworkingConnections } from "@/components/events/NetworkingConnections";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/supabase/auth";
import { getEventBySlug } from "@/lib/icfo-events/queries";
import { listEventPresenters } from "@/lib/icfo-events/applications";
import { listEventSponsors } from "@/lib/icfo-events/sponsors";
import { getRegistration } from "@/lib/icfo-events/registrations";
import { getOptin, listSuggestions, listConnections } from "@/lib/icfo-events/networking";
import type { NetworkingSuggestion, NetworkingConnection } from "@/lib/icfo-events/networking";
import { sessionVideoSignedUrl } from "@/lib/icfo-events/video/storage";
import { sectorLabel } from "@/lib/icfo-events/sectors";
import type { EventWithDetail, EventSession, EventPresenter, EventSponsor } from "@/lib/icfo-events/types";

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

function initials(name: string): string {
  return name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

function SponsorLockup({ sponsors }: { sponsors: EventSponsor[] }) {
  if (sponsors.length === 0) return null;
  const presenting = sponsors.filter((s) => s.placement === "presenting");
  const others = sponsors.filter((s) => s.placement !== "presenting");
  return (
    <div className="mt-10">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">Partners</h2>
      {presenting.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {presenting.map((s) => (
            <Link
              key={s.eventSponsorId}
              href={`/events/sponsors/${s.id}`}
              className="flex items-center gap-3 rounded-xl border border-[var(--indigo)] bg-[var(--indigo-soft)] px-4 py-3 transition hover:brightness-95"
            >
              <span className="text-xs font-medium uppercase tracking-wide text-[var(--indigo)]">Presented with</span>
              {s.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.logoUrl} alt={s.name} className="h-7 object-contain" />
              ) : (
                <span className="font-semibold text-[var(--navy)]">{s.name}</span>
              )}
            </Link>
          ))}
        </div>
      )}
      {others.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-4">
          {others.map((s) => (
            <Link
              key={s.eventSponsorId}
              href={`/events/sponsors/${s.id}`}
              className="flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-white px-3 py-2 transition hover:border-[var(--indigo)]"
            >
              {s.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.logoUrl} alt={s.name} className="h-6 object-contain" />
              ) : (
                <span className="text-sm font-medium text-[var(--text-secondary)]">{s.name}</span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Presenters({ presenters }: { presenters: EventPresenter[] }) {
  if (presenters.length === 0) return null;
  return (
    <div className="mt-10">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">Speakers</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {presenters.map((p) => (
          <div key={p.id} className="flex items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-white px-4 py-3">
            <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-[var(--indigo-soft)] text-sm font-semibold text-[var(--indigo)]">
              {initials(p.displayName)}
            </div>
            <div>
              <div className="font-medium text-[var(--navy)]">{p.displayName}</div>
              {p.roleLabel && <div className="text-xs text-[var(--text-muted)]">{p.roleLabel}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function EventDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await loadEvent(slug);

  if (!event || event.status === "draft" || event.status === "archived") {
    notFound();
  }

  const supabase = await createServerSupabaseClient();
  const profile = await getCurrentUserProfile();
  const role = String(profile?.role ?? "").toLowerCase();
  const canApply = role === "founder" || role === "investor";

  const [presenters, sponsors, registration, optin] = await Promise.all([
    listEventPresenters(supabase, event.id).catch(() => [] as EventPresenter[]),
    listEventSponsors(supabase, event.id).catch(() => [] as EventSponsor[]),
    profile ? getRegistration(supabase, event.id, profile.id).catch(() => null) : Promise.resolve(null),
    profile ? getOptin(supabase, event.id, profile.id).catch(() => null) : Promise.resolve(null),
  ]);

  // If the viewer has opted into networking, fetch their matches + connections.
  const [suggestions, connections]: [NetworkingSuggestion[], NetworkingConnection[]] =
    profile && optin?.optedIn
      ? await Promise.all([
          listSuggestions(supabase, event.id, profile.id).catch(() => [] as NetworkingSuggestion[]),
          listConnections(supabase, event.id, profile.id).catch(() => [] as NetworkingConnection[]),
        ])
      : [[], []];

  const visibleSessions = event.sessions.filter((s) => s.status !== "draft");

  // Sign playback URLs for any visible session that has a recording.
  const playbackEntries = await Promise.all(
    visibleSessions.map(async (s): Promise<[string, string | null]> => [
      s.id,
      s.recordingPath ? await sessionVideoSignedUrl(s.recordingPath) : null,
    ]),
  );
  const playback = new Map<string, string | null>(playbackEntries);

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

        <div className="mt-6 flex flex-wrap items-center gap-3">
          {event.status !== "ended" && (
            <RegisterButton
              eventId={event.id}
              slug={event.slug}
              isAuthenticated={Boolean(profile)}
              alreadyRegistered={Boolean(registration)}
            />
          )}
          {canApply && (
            <Link
              href={`/events/${event.slug}/apply`}
              className="inline-flex items-center rounded-md border border-[var(--border-subtle)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-slate-50"
            >
              Apply to present
            </Link>
          )}
        </div>

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

        <Presenters presenters={presenters} />

        <SponsorLockup sponsors={sponsors} />

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
                  {playback.get(s.id) && (
                    <video
                      controls
                      preload="none"
                      src={playback.get(s.id) ?? undefined}
                      className="mt-3 w-full rounded-lg border border-[var(--border-subtle)] bg-black"
                    >
                      Your browser doesn&apos;t support embedded video.
                    </video>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>

        {profile && (
          <div className="mt-10">
            <NetworkingOptIn
              eventId={event.id}
              initialOptedIn={Boolean(optin?.optedIn)}
              initialInterests={optin?.interests ?? []}
            />

            {optin?.optedIn && (
              <NetworkingConnections
                eventId={event.id}
                suggestions={suggestions}
                initialConnections={connections}
              />
            )}
          </div>
        )}
      </section>

      <ComplianceBlock />
      <MarketingFooter />
    </MarketingShell>
  );
}
