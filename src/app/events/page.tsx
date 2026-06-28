import Link from "next/link";
import { ArrowRight, ArrowLeft, CalendarDays } from "lucide-react";
import { ComplianceBlock } from "@/components/ComplianceBlock";
import { MarketingFooter } from "@/components/MarketingFooter";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUserProfile, dashboardForRole } from "@/lib/supabase/auth";
import { normalizeUserRole } from "@/lib/api/admin";
import { listPublicEvents } from "@/lib/icfo-events/queries";
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

export default async function EventsListPage() {
  const supabase = await createServerSupabaseClient();
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

  return (
    <MarketingShell>
      <section className="mx-auto max-w-5xl px-4 py-16">
        {dashboardHref ? (
          <Link
            href={dashboardHref}
            className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--text-secondary)] transition hover:text-[var(--indigo)]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </Link>
        ) : null}
        <p className="text-sm font-semibold uppercase tracking-wide text-[var(--indigo)]">iCFO Events</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-[var(--navy)] sm:text-4xl">
          Where capital-ready founders meet the room
        </h1>
        <p className="mt-3 max-w-2xl text-[var(--text-secondary)]">
          Sector-curated showcases, panels, and talk shows convening founders, investors, and operators.
          Education and community in the room — deals stay behind the accredited diligence flow.
        </p>

        <div className="mt-10 grid gap-4">
          {events.length === 0 ? (
            <div className="rounded-xl border border-[var(--border-subtle)] bg-white px-6 py-16 text-center">
              <CalendarDays className="mx-auto h-8 w-8 text-[var(--text-muted)]" />
              <p className="mt-3 text-sm font-medium text-[var(--text-primary)]">No events scheduled yet</p>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                Check back soon — the first sector showcases are being lined up.
              </p>
            </div>
          ) : (
            events.map((ev) => (
              <Link
                key={ev.id}
                href={`/events/${ev.slug}`}
                className="group flex items-center justify-between rounded-xl border border-[var(--border-subtle)] bg-white px-6 py-5 shadow-[var(--shadow-panel)] transition hover:border-[var(--indigo)]"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-[var(--indigo-soft)] px-2.5 py-0.5 text-xs font-medium capitalize text-[var(--indigo)]">
                      {ev.format.replace("_", " ")}
                    </span>
                    {ev.status === "live" && (
                      <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-700">Live</span>
                    )}
                  </div>
                  <h2 className="mt-2 text-lg font-semibold text-[var(--navy)]">{ev.title}</h2>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">{fmtRange(ev.startsAt, ev.endsAt)}</p>
                  {ev.summary && <p className="mt-2 max-w-2xl text-sm text-[var(--text-secondary)]">{ev.summary}</p>}
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
