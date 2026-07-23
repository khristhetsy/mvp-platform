import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { ComplianceBlock } from "@/components/ComplianceBlock";
import { MarketingFooter } from "@/components/MarketingFooter";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { JsonLd } from "@/components/seo/JsonLd";
import { RegisterButton } from "@/components/events/RegisterButton";
import { NetworkingOptIn } from "@/components/events/NetworkingOptIn";
import { NetworkingConnections } from "@/components/events/NetworkingConnections";
import { SessionVideo } from "@/components/events/SessionVideo";
import { LiveSessionPanel } from "@/components/events/LiveSessionPanel";
import { CallInBar } from "@/components/events/CallInBar";
import { OnStageGuests } from "@/components/events/OnStageGuests";
import { EventCountdown } from "@/components/events/EventCountdown";
import { EventSideRail } from "@/components/events/EventSideRail";
import { sanitizeBannerHtml } from "@/lib/icfo-events/sanitize-html";
import { loadSessionQuestions, loadSessionChat, loadCallInQueue } from "@/lib/icfo-events/live-session";
import type { SessionQuestion, SessionChatMessage, CallInEntry } from "@/lib/icfo-events/live-session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getCurrentUserProfile } from "@/lib/supabase/auth";
import { getEventBySlug } from "@/lib/icfo-events/queries";
import { getLeaderboard, getMemberStats } from "@/lib/icfo-events/gamification";
import type { LeaderboardEntry, MemberStats } from "@/lib/icfo-events/gamification";
import { getMissionProgress } from "@/lib/icfo-events/missions";
import type { MissionProgress } from "@/lib/icfo-events/missions";
import { listEventPresenters } from "@/lib/icfo-events/applications";
import { listEventSponsors } from "@/lib/icfo-events/sponsors";
import { getRegistration } from "@/lib/icfo-events/registrations";
import { getOptin, listSuggestions, listConnections } from "@/lib/icfo-events/networking";
import type { NetworkingSuggestion, NetworkingConnection } from "@/lib/icfo-events/networking";
import { sessionVideoSignedUrl } from "@/lib/icfo-events/video/storage";
import { getVideoProvider } from "@/lib/icfo-events/video/provider";
import { embeddableLiveUrl } from "@/lib/icfo-events/video/external";
import { bannerPublicUrl } from "@/lib/icfo-events/banner";
import { loadMarketing } from "@/lib/icfo-events/marketing";
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
  // Saved Marketing Hub SEO overrides the defaults (read via service role —
  // the table is staff-only). Falls back to the event summary.
  const mk = await loadMarketing(createServiceRoleClient(), event.id).catch(() => null);
  const title = mk?.seoTitle?.trim() || `${event.title} — iCFO Events`;
  const description = mk?.seoDescription?.trim() || event.summary || "An iCFO Events sector showcase convening founders and investors.";
  const keywords = mk?.seoKeywords?.trim() || undefined;
  return {
    title,
    description,
    ...(keywords ? { keywords } : {}),
    alternates: { canonical: `/events/${event.slug}` },
    openGraph: { title: mk?.seoTitle?.trim() || event.title, description, url: `/events/${event.slug}`, type: "website" },
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

async function SponsorLockup({ sponsors }: { sponsors: EventSponsor[] }) {
  const t = await getTranslations("appPages");
  if (sponsors.length === 0) return null;
  const presenting = sponsors.filter((s) => s.placement === "presenting");
  const others = sponsors.filter((s) => s.placement !== "presenting");
  return (
    <div id="partners" className="mt-10 scroll-mt-24">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">{t("partners")}</h2>
      {presenting.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {presenting.map((s) => (
            <Link
              key={s.eventSponsorId}
              href={`/events/sponsors/${s.id}`}
              className="flex items-center gap-3 rounded-xl border border-[var(--indigo)] bg-[var(--indigo-soft)] px-4 py-3 transition hover:brightness-95"
            >
              <span className="text-xs font-medium uppercase tracking-wide text-[var(--indigo)]">{t("presented_with")}</span>
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
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {others.map((s) => (
            <Link
              key={s.eventSponsorId}
              href={`/events/sponsors/${s.id}`}
              className="flex items-center gap-2.5 rounded-xl border border-[var(--border-subtle)] bg-white px-3 py-2.5 transition hover:border-[var(--indigo)]"
            >
              {s.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.logoUrl} alt={s.name} className="h-8 w-8 flex-none rounded-lg object-contain" />
              ) : (
                <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-[var(--indigo-soft)] text-xs font-semibold text-[var(--indigo)]">
                  {initials(s.name)}
                </span>
              )}
              <span className="truncate text-sm font-medium text-[var(--navy)]">{s.name}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

async function Presenters({ presenters }: { presenters: EventPresenter[] }) {
  const t = await getTranslations("appPages");
  if (presenters.length === 0) return null;
  return (
    <div className="mt-10">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">{t("speakers")}</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {presenters.map((p) => (
          <div key={p.id} className="rounded-xl border border-[var(--border-subtle)] bg-white px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-[var(--indigo-soft)] text-sm font-semibold text-[var(--indigo)]">
                {initials(p.displayName)}
              </div>
              <div>
                <div className="font-medium text-[var(--navy)]">{p.displayName}</div>
                {p.roleLabel && <div className="text-xs capitalize text-[var(--text-muted)]">{p.roleLabel}</div>}
              </div>
            </div>
            {p.headline && <p className="mt-2 text-sm font-medium text-[var(--text-secondary)]">{p.headline}</p>}
            {p.bio && <p className="mt-1 text-sm text-[var(--text-muted)]">{p.bio}</p>}
            {p.links.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {p.links.map((l) => (
                  <a key={l} href={l} target="_blank" rel="noopener noreferrer" className="text-xs text-[var(--blue)] underline">
                    {l.replace(/^https?:\/\//, "").slice(0, 32)}
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function EventDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const t = await getTranslations("appPages");
  const event = await loadEvent(slug);

  if (!event || event.status === "draft" || event.status === "archived") {
    notFound();
  }

  const supabase = await createServerSupabaseClient();
  const profile = await getCurrentUserProfile();
  const role = String(profile?.role ?? "").toLowerCase();
  const canApply = role === "founder" || role === "investor";
  const coverUrl = bannerPublicUrl(supabase, event.coverPath);

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
  const sponsorNames = new Map(sponsors.map((s) => [s.id, s.name]));
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now();

  // Live-session interaction (Q&A + chat) — only for signed-in viewers, live sessions.
  const isStaffViewer = ["admin", "analyst"].includes(role);
  const liveData = new Map<string, { questions: SessionQuestion[]; chat: SessionChatMessage[]; queue: CallInEntry[] }>();
  if (profile) {
    const liveSessions = visibleSessions.filter((s) => s.status === "live");
    await Promise.all(
      liveSessions.map(async (s) => {
        const [questions, chat, queue] = await Promise.all([
          loadSessionQuestions(supabase, s.id, profile.id).catch(() => [] as SessionQuestion[]),
          loadSessionChat(supabase, s.id).catch(() => [] as SessionChatMessage[]),
          s.type === "talk_show"
            ? loadCallInQueue(supabase, s.id, profile.id, isStaffViewer).catch(() => [] as CallInEntry[])
            : Promise.resolve([] as CallInEntry[]),
        ]);
        liveData.set(s.id, { questions, chat, queue });
      }),
    );
  }

  // Gamification (status only). Leaderboard needs cross-member reads → service role.
  const adminClient = createServiceRoleClient();
  // Missions first — completing one awards a bonus before we tally member points.
  const missions: MissionProgress[] = profile
    ? await getMissionProgress(adminClient, event.id, profile.id).catch(() => [])
    : [];
  const [leaderboard, memberStats]: [LeaderboardEntry[], MemberStats | null] = await Promise.all([
    getLeaderboard(adminClient, event.id).catch(() => [] as LeaderboardEntry[]),
    profile ? getMemberStats(adminClient, event.id, profile.id).catch(() => null) : Promise.resolve(null),
  ]);

  const bannerHtml = sanitizeBannerHtml(event.bannerHtml);
  const bannerTheme: Record<string, { bg: string; text: string; border: string }> = {
    indigo: { bg: "#EEEDFE", text: "#1A6CE4", border: "transparent" },
    teal: { bg: "#E1F5EE", text: "#0F6E56", border: "transparent" },
    navy: { bg: "#0f2147", text: "#dbe4f5", border: "transparent" },
    plain: { bg: "#ffffff", text: "#0f2147", border: "var(--border-subtle)" },
  };
  const bnr = bannerTheme[event.bannerBg] ?? bannerTheme.indigo;
  const formatLabel = t("online_event");

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

      <section className="mx-auto max-w-6xl px-4 py-14">
        <div className="relative overflow-hidden rounded-2xl" style={{ background: "#0c2340" }}>
          {coverUrl && (
            <>
              <div
                aria-hidden
                className="absolute inset-0"
                style={{ backgroundImage: `url(${coverUrl})`, backgroundSize: "cover", backgroundPosition: event.coverFocal }}
              />
              <div aria-hidden className="absolute inset-0" style={{ background: "#0c2340", opacity: event.coverOverlay / 100 }} />
            </>
          )}
          <div className="relative flex flex-col gap-5 p-6 sm:flex-row sm:items-end sm:justify-between sm:p-8">
            <div className="min-w-0">
              <p className="text-xs font-medium tracking-wide" style={{ color: "#5DCAA5" }}>
                iCFO CAPITAL · ECOSYSTEM SHOWCASE
              </p>
              <h1 className="mt-1.5 text-3xl font-bold tracking-tight text-white sm:text-4xl">{event.title}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm" style={{ color: "#aeb8c7" }}>
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4" />
                  {fmtRange(event.startsAt, event.endsAt)}
                </span>
                <span className="capitalize">· {event.format.replace("_", " ")}</span>
                {event.status === "live" && (
                  <span className="rounded-full px-2 py-0.5 text-xs font-medium text-white" style={{ background: "#3a1d1d" }}>{t("live_now")}</span>
                )}
                {event.status === "ended" && (
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs">{t("concluded")}</span>
                )}
              </div>
              {event.summary && <p className="mt-4 max-w-2xl text-sm" style={{ color: "#cdd6e4" }}>{event.summary}</p>}
              <div className="mt-5 flex flex-wrap items-center gap-3">
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
                    className="inline-flex items-center rounded-md border border-white/25 px-4 py-2 text-sm font-medium text-white hover:bg-white/10"
                  >
                    Apply to present
                  </Link>
                )}
                <Link
                  href={`/events/${event.slug}/lobby`}
                  className="inline-flex items-center rounded-md px-4 py-2 text-sm font-medium text-white"
                  style={{ background: "#1D9E75" }}
                >
                  Enter lobby ↗
                </Link>
              </div>
            </div>
            {sponsors.some((s) => s.placement === "presenting") && (
              <p className="shrink-0 text-xs sm:text-right" style={{ color: "#8e9bb0" }}>
                Presented with{" "}
                <span className="text-white">{sponsors.find((s) => s.placement === "presenting")?.name}</span>
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {[
            { href: `/events/${event.slug}/stage`, label: "Main Stage" },
            { href: `/events/${event.slug}/tracks`, label: "Sector Tracks" },
            { href: `/events/${event.slug}/talk-show`, label: "Talk Show" },
          ].map((r) => (
            <Link
              key={r.href}
              href={r.href}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-white px-4 py-2 text-sm font-medium text-[var(--navy)] transition hover:border-[var(--indigo)]"
            >
              {event.status === "live" && <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#E24B4A" }} aria-hidden />}
              {r.label}
            </Link>
          ))}
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="min-w-0">

            {bannerHtml && (
              <div className="rounded-2xl p-6" style={{ background: bnr.bg, border: `1px solid ${bnr.border}` }}>
                {event.bannerTitle && (
                  <h2 className="text-lg font-semibold" style={{ color: bnr.text }}>{event.bannerTitle}</h2>
                )}
                <div
                  className="mt-2 text-sm leading-relaxed [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5"
                  style={{ color: bnr.text }}
                  dangerouslySetInnerHTML={{ __html: bannerHtml }}
                />
              </div>
            )}

            {event.showCountdown && event.startsAt && (
              <div className={bannerHtml ? "mt-6" : ""}>
                <EventCountdown startsAt={event.startsAt} />
              </div>
            )}

        {event.sectors.length > 0 && (
          <div className="mt-8">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">{t("sector_tracks")}</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {event.sectors.map((s) => {
                const count = event.sessions.filter((x) => x.sectorSlug === s.sectorSlug).length;
                return (
                  <Link
                    key={s.id}
                    href={`/events/sectors/${s.sectorSlug}`}
                    className="rounded-xl border border-[var(--border-subtle)] bg-white p-4 transition hover:border-[var(--indigo)]"
                  >
                    <p className="font-medium text-[var(--navy)]">{s.label || sectorLabel(s.sectorSlug)}</p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      {count > 0 ? `${count} session${count === 1 ? "" : "s"}` : "Sector track"}
                    </p>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        <Presenters presenters={presenters} />

        <SponsorLockup sponsors={sponsors} />

        <div id="agenda" className="mt-10 scroll-mt-24">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">{t("agenda")}</h2>
          {visibleSessions.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--text-muted)]">{t("sessions_will_be_announced_soon")}</p>
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
                  {s.hostSponsorId && sponsorNames.get(s.hostSponsorId) && (
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">Hosted by {sponsorNames.get(s.hostSponsorId)}</p>
                  )}
                  {s.abstract && <p className="mt-1 text-sm text-[var(--text-secondary)]">{s.abstract}</p>}
                  {s.status === "live" && s.videoProvider === "whereby" && s.videoRef ? (
                    <iframe
                      title={s.title}
                      src={getVideoProvider("whereby").embedUrl(s.videoRef)}
                      allow="camera; microphone; fullscreen; speaker; display-capture; autoplay"
                      className="mt-3 aspect-video w-full rounded-lg border border-[var(--border-subtle)]"
                    />
                  ) : s.status === "live" && s.videoProvider === "external" && s.videoRef ? (
                    embeddableLiveUrl(s.videoRef) ? (
                      <iframe
                        title={s.title}
                        src={embeddableLiveUrl(s.videoRef) ?? s.videoRef}
                        allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
                        className="mt-3 aspect-video w-full rounded-lg border border-[var(--border-subtle)]"
                      />
                    ) : (
                      <a
                        href={s.videoRef}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-flex items-center rounded-lg bg-[var(--blue)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--blue-hover)]"
                      >
                        Join the live session ↗
                      </a>
                    )
                  ) : playback.get(s.id) ? (
                    s.startsAt && new Date(s.startsAt).getTime() > nowMs ? (
                      <div className="mt-3 rounded-lg border border-dashed border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-4 py-6 text-center">
                        <p className="text-sm font-medium text-[var(--navy)]">
                          Premieres {new Date(s.startsAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                        </p>
                        <p className="mt-1 text-xs text-[var(--text-muted)]">{t("the_recording_unlocks_at_the_premiere_time")}</p>
                      </div>
                    ) : (
                      <SessionVideo src={playback.get(s.id) as string} eventId={event.id} sessionId={s.id} />
                    )
                  ) : null}
                  {s.status === "live" && s.type === "talk_show" && <OnStageGuests sessionId={s.id} />}
                  {s.status === "live" && profile && s.type === "talk_show" && (
                    <CallInBar
                      sessionId={s.id}
                      eventId={event.id}
                      me={{ id: profile.id, name: profile.full_name ?? profile.email ?? "You" }}
                      isStaff={isStaffViewer}
                      roomUrl={s.videoRef}
                      initialQueue={liveData.get(s.id)?.queue ?? []}
                    />
                  )}
                  {s.status === "live" && profile && (
                    <LiveSessionPanel
                      sessionId={s.id}
                      eventId={event.id}
                      me={{ id: profile.id, name: profile.full_name ?? profile.email ?? "You" }}
                      isStaff={isStaffViewer}
                      initialQuestions={liveData.get(s.id)?.questions ?? []}
                      initialChat={liveData.get(s.id)?.chat ?? []}
                    />
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>

        {profile && (
          <div id="networking" className="mt-10 scroll-mt-24">
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

        {memberStats && memberStats.badges.length > 0 && (
          <div className="mt-10">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Your participation
            </h2>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[var(--navy)] px-3 py-1 text-sm font-semibold text-white">
                {memberStats.points} pts
              </span>
              {memberStats.badges.map((b) => (
                <span key={b} className="rounded-full border border-[var(--indigo)] bg-[var(--indigo-soft)] px-3 py-1 text-xs font-medium text-[var(--indigo)]">
                  {b}
                </span>
              ))}
            </div>
          </div>
        )}

        {missions.length > 0 && (
          <div className="mt-10">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">{t("missions")}</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {missions.map((m) => (
                <div key={m.id} className="rounded-xl border border-[var(--border-subtle)] bg-white p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-[var(--navy)]">{m.title}</span>
                    {m.done ? (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">Complete +{m.bonusPoints}</span>
                    ) : (
                      <span className="text-xs text-[var(--text-muted)]">{m.completedActions.length}/{m.requiredActions.length}</span>
                    )}
                  </div>
                  {m.description && <p className="mt-1 text-xs text-[var(--text-muted)]">{m.description}</p>}
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-[var(--indigo)]"
                      style={{ width: `${m.requiredActions.length ? (m.completedActions.length / m.requiredActions.length) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {leaderboard.length > 0 && (
          <div className="mt-10">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">{t("leaderboard")}</h2>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Points reward participation — status, not prizes.
            </p>
            <ol className="mt-3 divide-y divide-[var(--border-subtle)] overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-white">
              {leaderboard.map((m) => (
                <li key={m.profileId} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="w-5 text-sm font-semibold text-[var(--text-muted)]">{m.rank}</span>
                    <span className="text-sm font-medium text-[var(--navy)]">{m.displayName}</span>
                  </div>
                  <span className="text-sm font-semibold text-[var(--indigo)]">{m.points} pts</span>
                </li>
              ))}
            </ol>
          </div>
        )}
          </div>

          <aside className="lg:sticky lg:top-6 lg:self-start">
            <EventSideRail
              title={event.title}
              startsAt={event.startsAt}
              endsAt={event.endsAt}
              timezone={event.timezone}
              formatLabel={formatLabel}
              organizerName={event.organizerName}
              organizerPhone={event.organizerPhone}
              organizerEmail={event.organizerEmail}
              alreadyRegistered={Boolean(registration)}
              ended={event.status === "ended"}
            />
          </aside>
        </div>
      </section>

      <ComplianceBlock />
      <MarketingFooter />
    </MarketingShell>
  );
}
