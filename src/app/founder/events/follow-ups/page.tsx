import Link from "next/link";
import { FounderAppShell } from "@/components/FounderAppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { FollowUpList } from "@/components/founder/FollowUpList";
import { requireRole } from "@/lib/supabase/auth";
import { getActiveCompanyForUser } from "@/lib/organizations/active-company";
import { listFounderFollowUps } from "@/lib/icfo-events/introductions-server";

export const dynamic = "force-dynamic";

export default async function FounderFollowUpsPage({
  searchParams,
}: {
  searchParams: Promise<{ eventId?: string }>;
}) {
  const profile = await requireRole(["founder"]);
  const { company } = await getActiveCompanyForUser(profile);
  const { eventId } = await searchParams;

  const events = await listFounderFollowUps(profile.id);
  const current = events.find((e) => e.eventId === eventId) ?? events[0] ?? null;

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle={company?.company_name ?? "Your company"}
    >
      <WorkspacePageContainer>
        <PageHeader
          eyebrow="iCFO Events"
          title="Follow up with investors"
          description="Investors who said yes to meeting you at an event. Send a link to book a time on your scheduling page."
        />

        {!current ? (
          <div className="mt-8 rounded-xl border border-[var(--border-subtle)] bg-white px-6 py-16 text-center text-sm text-[var(--text-muted)]">
            No investor has accepted a meeting with you yet.
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {events.length > 1 && (
              <div className="flex flex-wrap gap-2">
                {events.map((e) => (
                  <Link
                    key={e.eventId}
                    href={`/founder/events/follow-ups?eventId=${e.eventId}`}
                    className={`rounded-full border px-3 py-1 text-xs ${
                      e.eventId === current.eventId
                        ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                        : "border-slate-200 bg-white text-slate-600"
                    }`}
                  >
                    {e.title}
                  </Link>
                ))}
              </div>
            )}
            <FollowUpList
              key={current.eventId}
              rows={current.rows}
              anySent={events.some((e) => e.rows.some((r) => r.followUps > 0))}
            />
          </div>
        )}
      </WorkspacePageContainer>
    </FounderAppShell>
  );
}
