import Link from "next/link";
import { ArrowLeft, CalendarDays } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { ComplianceBlock } from "@/components/ComplianceBlock";
import { MarketingFooter } from "@/components/MarketingFooter";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUserProfile, dashboardForRole } from "@/lib/supabase/auth";
import { normalizeUserRole } from "@/lib/api/admin";
import { listPublicEvents } from "@/lib/icfo-events/queries";
import { bannerPublicUrl } from "@/lib/icfo-events/banner";
import { EventCountdown } from "@/components/events/EventCountdown";
import { EventsList, type EventCardData } from "@/components/events/EventsList";
import type { EventRecord } from "@/lib/icfo-events/types";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "iCFO Events — founder & investor showcase",
  description:
    "Sector-curated founder showcases, panels, and talk shows convening founders, investors, and operators. Education and community — not a securities offering.",
  alternates: { canonical: "/events" },
  openGraph: {
    title: "iCFO Events — founder & investor showcase",
    description: "Sector-curated founder showcases convening founders, investors, and operators.",
    url: "/events",
  },
};

function fmtRange(start: string | null, end: string | null): string {
  if (!start) return "Date to be announced";
  const s = new Date(start);
  const opts: Intl.DateTimeFormatOptions = { month: "long", day: "numeric", year: "numeric" };
  if (!end) return s.toLocaleDateString(undefined, opts);
  const e = new Date(end);
  return `${s.toLocaleDateString(undefined, { month: "long", day: "numeric" })} – ${e.toLocaleDateString(undefined, opts)}`;
}

function badge(start: string | null, tz: string | null): { month: string | null; day: string | null } {
  if (!start) return { month: null, day: null };
  const d = new Date(start);
  const timeZone = tz ?? undefined;
  return {
    month: d.toLocaleDateString("en-US", { month: "short", timeZone }).toUpperCase(),
    day: d.toLocaleDateString("en-US", { day: "numeric", timeZone }),
  };
}

export default async function EventsListPage() {
  const supabase = await createServerSupabaseClient();
  const t = await getTranslations("appPages");
  let events: EventRecord[] = [];
  try {
    events = await listPublicEvents(supabase);
  } catch {
    events = [];
  }

  // Founders/investors reach /events from inside their workspace nav, which drops
  // them on this marketing page. Give a signed-in user a way back to their menu.
  const profile = await getCurrentUserProfile();
  const role = profile ? normalizeUserRole(profile.role) : null;
  const dashboardHref = role ? dashboardForRole(role) : null;

  // eslint-disable-next-line react-hooks/purity -- server component; single render, real request time
  const nowMs = Date.now();
  const isPast = (ev: EventRecord) =>
    ev.status === "ended" || (ev.endsAt ? new Date(ev.endsAt).getTime() < nowMs : false);
  const cards: EventCardData[] = events.map((ev) => ({
    id: ev.id,
    slug: ev.slug,
    title: ev.title,
    format: ev.format,
    status: ev.status,
    summary: ev.summary,
    dateRange: fmtRange(ev.startsAt, ev.endsAt),
    ...badge(ev.startsAt, ev.timezone),
    coverUrl: bannerPublicUrl(supabase, ev.coverPath),
    coverFocal: ev.coverFocal,
    coverOverlay: ev.coverOverlay,
    isPast: isPast(ev),
  }));
  const upcoming = events.filter((ev) => !isPast(ev));
  const next = upcoming.find((ev) => ev.startsAt && new Date(ev.startsAt).getTime() > nowMs) ?? upcoming[0] ?? null;

  return (
    <MarketingShell>
      <section
        className="relative text-white"
        style={{
          background: "#031a55 url(/events-hero.jpg) right center / cover no-repeat",
        }}
      >
        <div className="mx-auto max-w-5xl px-4 pb-16 pt-14 sm:pb-20 sm:pt-16">
          {dashboardHref ? (
            <Link
              href={dashboardHref}
              className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-blue-100 transition hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to dashboard
            </Link>
          ) : null}
          <div className="max-w-xl">
            <p className="text-sm font-semibold uppercase tracking-wider text-blue-200">iCFO Events</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-5xl sm:leading-[1.08]">
              Where capital-ready founders meet the room
            </h1>
            <p className="mt-4 text-blue-50/90">
              Sector-curated showcases, panels, and talk shows convening founders, investors, and operators.
              Education and community in the room — deals stay behind the accredited diligence flow.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {next ? (
                <Link
                  href={`/events/${next.slug}`}
                  className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-[var(--navy)] transition hover:bg-blue-50"
                >
                  Register for the next event
                </Link>
              ) : null}
              <Link
                href="/founder/events/present"
                className="rounded-xl border border-white/40 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Present at an event
              </Link>
            </div>
          </div>

          {next ? (
            <div className="mt-8 grid max-w-2xl items-center gap-4 rounded-2xl border border-white/25 bg-[#03103c]/55 p-4 backdrop-blur sm:grid-cols-[1fr_auto] sm:p-5">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-blue-200">Next event</p>
                <h2 className="mt-1 text-lg font-semibold">{next.title}</h2>
                <p className="text-sm text-blue-100">{fmtRange(next.startsAt, next.endsAt)}</p>
              </div>
              {next.startsAt && next.showCountdown ? <EventCountdown startsAt={next.startsAt} hero /> : null}
              <Link
                href={`/events/${next.slug}`}
                className="rounded-xl bg-[var(--indigo)] px-5 py-2.5 text-center text-sm font-semibold text-white transition hover:opacity-90 sm:col-span-2"
              >
                Save my spot
              </Link>
            </div>
          ) : null}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-12">
        {events.length === 0 ? (
          <div className="rounded-xl border border-[var(--border-subtle)] bg-white px-6 py-16 text-center">
            <CalendarDays className="mx-auto h-8 w-8 text-[var(--text-muted)]" />
            <p className="mt-3 text-sm font-medium text-[var(--text-primary)]">{t("no_events_scheduled_yet")}</p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Check back soon — the first sector showcases are being lined up.
            </p>
          </div>
        ) : (
          <EventsList events={cards} />
        )}
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-6">
        <h2 className="text-2xl font-bold tracking-tight text-[var(--navy)]">How an iCFO event works</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {[
            ["1", "Register", "Pick your event and sector track. Your iCapOS profile fills the form for you."],
            ["2", "Join the live room", "Main stage, sector sessions, lounge, and networking with founders and investors."],
            ["3", "Follow up in iCapOS", "Intro requests and diligence continue inside the platform, behind accredited access."],
          ].map(([n, h, p]) => (
            <div key={n} className="rounded-2xl border border-[var(--border-subtle)] bg-white p-5">
              <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--indigo-soft)] font-bold text-[var(--indigo)]">
                {n}
              </div>
              <h3 className="font-semibold text-[var(--navy)]">{h}</h3>
              <p className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">{p}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-10">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-[var(--navy)] p-8 text-white">
          <div>
            <h2 className="text-xl font-bold">Have a company ready to show?</h2>
            <p className="mt-1 max-w-lg text-sm text-blue-100">
              Founders with a strong Capital Readiness Rating can apply to present at an upcoming event.
            </p>
          </div>
          <Link
            href="/founder/events/present"
            className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-[var(--navy)] transition hover:bg-blue-50"
          >
            Apply to present
          </Link>
        </div>
      </section>

      <ComplianceBlock />
      <MarketingFooter />
    </MarketingShell>
  );
}
