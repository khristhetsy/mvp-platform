import { AppShell } from "@/components/AppShell";
import { requirePermissionPage } from "@/lib/api/permissions";
import { EventEmailWizard } from "@/components/admin-events/EventEmailWizard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Event Template — Email" };

export default async function EventEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ eventId?: string; type?: string; bookletEditionId?: string }>;
}) {
  const { profile } = await requirePermissionPage("manage_events");
  const { eventId, type, bookletEditionId } = await searchParams;
  const emailType = (["invite", "reminder", "day_of", "booklet"] as const).find((t) => t === type);

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle="Event Template"
    >
      <div className="mx-auto max-w-5xl px-1 py-2">
        <h1 className="text-xl font-semibold text-[var(--navy)]">Event Template — Email</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Turn a published event into a branded email: pick the event, review the auto-pulled data, and preview. Uses the
          existing Marketing Hub send pipeline.
        </p>
        <div className="mt-6">
          <EventEmailWizard initialEventId={eventId} initialType={emailType} bookletEditionId={bookletEditionId} />
        </div>
      </div>
    </AppShell>
  );
}
