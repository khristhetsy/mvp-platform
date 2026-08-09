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
                        <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-700">{t("live")}</span>
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

          <div className="mt-10">
            <ComplianceBlock />
          </div>
        </WorkspacePageContainer>
    </FounderAppShell>
  );
}
