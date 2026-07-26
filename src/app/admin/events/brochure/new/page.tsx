import { AppShell } from "@/components/AppShell";
import { requirePermissionPage } from "@/lib/api/permissions";
import { BrochureWizard } from "@/components/admin-events/BrochureWizard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Event Brochure — builder" };

export default async function BrochureBuilderPage({ searchParams }: { searchParams: Promise<{ eventId?: string }> }) {
  const { profile } = await requirePermissionPage("manage_events");
  const { eventId } = await searchParams;

  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle="Event Brochure">
      <div className="mx-auto max-w-5xl px-1 py-2">
        <h1 className="text-xl font-semibold text-[var(--navy)]">Event Brochure — builder</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">Pick an event, arrange the booklet pages, and preview. Data pulls from the event record; disclaimers &amp; footer are locked.</p>
        <div className="mt-6">
          <BrochureWizard initialEventId={eventId} />
        </div>
      </div>
    </AppShell>
  );
}
