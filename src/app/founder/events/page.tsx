import Link from "next/link";
import { ArrowRight, CalendarDays } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { FounderAppShell } from "@/components/FounderAppShell";
import { ComplianceBlock } from "@/components/ComplianceBlock";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/supabase/auth";
import { getActiveCompanyForUser } from "@/lib/organizations/active-company";
import { listPublicEvents } from "@/lib/icfo-events/queries";
import { bannerPublicUrl } from "@/lib/icfo-events/banner";
import { listFounderFollowUps } from "@/lib/icfo-events/introductions-server";
import type { EventRecord } from "@/lib/icfo-events/types";

export const dynamic = "force-dynamic";

// Founder-workspace framing of the iCFO Events list. Same data and links as the
// public /events page, but rendered inside the founder shell so the sidebar and
// header stay put (no jump to the marketing site). The public /events page is
// left untouched for visitors and investors; individual event pages still use
// the public layout for now.

function fmtRange(start: string | null, end: string | null): string {
  if (!start) return "Date to be announced";
  const s = new Date(start);
  const opts: Intl.DateTimeFormatOptions = { month: "long", day: "numeric", year: "numeric" };
  if (!end) return s.toLocaleDateString(undefined, opts);
  const e = new Date(end);
  return `${s.toLocaleDateString(undefined, { month: "long", day: "numeric" })} – ${e.toLocaleDateString(undefined, opts)}`;
}

export default async function FounderEventsPage() {
  const profile = await requireRole(["founder"]);
  const t = await getTranslations("appPages");
  const supabase = await createServerSupabaseClient();
  const { company } = await getActiveCompanyForUser(profile);

  let events: EventRecord[] = [];
  try {
    events = await listPublicEvents(supabase);
  } catch {
    events = [];
  }

  // Follow-up counts from the same data the follow-ups page lists: every
  // accepted introduction across the founder's events. Pending uses the same
  // rule as that page's "To follow up" tile: an investor stays pending until a
  // time is booked. If the load fails the card shows no count at all.
  let followTotal = 0;
  let followDone = 0;
  let followError = false;
  try {
    const followEvents = await listFounderFollowUps(profile.id);
    for (const fe of followEvents) {
      for (const r of fe.rows) {
        followTotal += 1;
        if (r.scheduledAt) followDone += 1;
      }
    }
  } catch {
    followError = true;
  }
  const followPending = followTotal - followDone;
  const followPct = followTotal > 0 ? Math.round((followDone / followTotal) * 100) : 0;

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle={company?.company_name ?? "Your company"}
    >
      <WorkspacePageContainer>
          <PageHeader
            eyebrow="iCFO Events"
            title="Where capital-ready founders meet the room"
            description="Sector-curated showcases, panels, and talk shows convening founders, investors, and operators. Education and community in the room — deals stay behind the accredited diligence flow."
          />

          <section
            aria-label="Investor follow-ups"
            className="mt-6 flex flex-col gap-5 rounded-xl border-2 border-[var(--indigo)] bg-white p-5 shadow-[var(--shadow-panel)] sm:flex-row sm:items-center sm:p-6"
          >
            {!followError && (
              <div
                className={`flex h-20 w-20 flex-none flex-col items-center justify-center rounded-xl ${
                  followPending > 0 ? "bg-[var(--indigo-soft)] text-[var(--indigo)]" : "bg-emerald-50 text-emerald-700"
                }`}
              >
                <span className="text-3xl font-semibold leading-none">{followPending}</span>
                <span className="mt-1 text-[11px] font-medium uppercase tracking-wide">pending</span>
              </div>
            )}

            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold text-[var(--navy)]">
                {followError
                  ? "Investor follow-ups"
                  : followPending > 0
                    ? "Investors accepted your invite"
                    : "All caught up"}
              </h2>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                {followError
                  ? "We couldn't load your follow-up count. Open your follow-ups to see who still needs a reply."
                  : followPending > 0
                    ? `${followPending} of ${followTotal} still need a follow up. Reach out while the conversation is warm.`
                    : followTotal > 0
                      ? "Every investor who accepted your invite has been followed up."
                      : "No investor has accepted a meeting with you yet."}
              </p>
              {followTotal > 0 && (
                <div className="mt-3 flex items-center gap-3">
                  <div
                    className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--indigo-soft)]"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={followTotal}
                    aria-valuenow={followDone}
                    aria-label="Investors followed up"
                  >
                    <div className="h-full rounded-full bg-[var(--indigo)]" style={{ width: `${followPct}%` }} />
                  </div>
                  <span className="flex-none text-xs font-medium text-[var(--text-muted)]">
                    {followDone} of {followTotal} followed up
                  </span>
                </div>
              )}
            </div>

            {!followError && followPending > 0 ? (
              <Link
                href="/founder/events/follow-ups"
                className="inline-flex flex-none items-center justify-center gap-1.5 rounded-lg bg-[var(--indigo)] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
              >
                Follow up now <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <Link
                href="/founder/events/follow-ups"
                className="inline-flex flex-none items-center justify-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] transition hover:border-[var(--indigo)] hover:text-[var(--indigo)]"
              >
                View follow-ups
              </Link>
            )}
          </section>

          <div className="mt-8 grid gap-4">
            {events.length === 0 ? (
              <div className="rounded-xl border border-[var(--border-subtle)] bg-white px-6 py-16 text-center">
                <CalendarDays className="mx-auto h-8 w-8 text-[var(--text-muted)]" />
                <p className="mt-3 text-sm font-medium text-[var(--text-primary)]">{t("no_events_scheduled_yet")}</p>
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  Check back soon — the first sector showcases are being lined up.
                </p>
              </div>
            ) : (
              events.map((ev) => {
                // The same banner image (with its focal point and overlay) the
                // Present at an event page shows; navy block when none is set.
                const coverUrl = bannerPublicUrl(supabase, ev.coverPath);
                return (
                  <Link
                    key={ev.id}
                    href={`/events/${ev.slug}`}
                    className="group flex flex-col overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-white shadow-[var(--shadow-panel)] transition hover:border-[var(--indigo)] sm:flex-row"
                  >
                    <div
                      className="relative h-40 w-full flex-none overflow-hidden sm:h-auto sm:min-h-[9rem] sm:w-56"
                      style={{ background: "#0c2340" }}
                    >
                      {coverUrl ? (
                        <div
                          aria-hidden
                          className="absolute inset-0"
                          style={{ backgroundImage: `url(${coverUrl})`, backgroundSize: "cover", backgroundPosition: ev.coverFocal ?? "center" }}
                        />
                      ) : null}
                      <div
                        aria-hidden
                        className="absolute inset-0"
                        style={{ background: "#0c2340", opacity: coverUrl ? (ev.coverOverlay ?? 40) / 100 : 1 }}
                      />
                    </div>
                    <div className="flex flex-1 items-center justify-between gap-4 px-6 py-5">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-[var(--indigo-soft)] px-2.5 py-0.5 text-xs font-medium capitalize text-[var(--indigo)]">
                            {ev.format.replace("_", " ")}
                          </span>
                          {ev.status === "live" && (
                            <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-700">{t("live")}</span>
                          )}
                        </div>
                        <h2 className="mt-2 text-lg font-semibold text-[var(--navy)]">{ev.title}</h2>
                        <p className="mt-1 text-sm text-[var(--text-muted)]">{fmtRange(ev.startsAt, ev.endsAt)}</p>
                        {ev.summary && <p className="mt-2 max-w-2xl text-sm text-[var(--text-secondary)]">{ev.summary}</p>}
                      </div>
                      <ArrowRight className="h-5 w-5 flex-none text-[var(--text-muted)] transition group-hover:translate-x-0.5 group-hover:text-[var(--indigo)]" />
                    </div>
                  </Link>
                );
              })
            )}
          </div>

          <div className="mt-10">
            <ComplianceBlock />
          </div>
        </WorkspacePageContainer>
    </FounderAppShell>
  );
}
