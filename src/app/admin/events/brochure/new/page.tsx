import { AppShell } from "@/components/AppShell";
import { requirePermissionPage } from "@/lib/api/permissions";
import { BrochureWizard } from "@/components/admin-events/BrochureWizard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Event Brochure — builder" };

export default async function BrochureBuilderPage({
  searchParams,
}: {
  searchParams: Promise<{ eventId?: string; baseEditionId?: string; editionId?: string }>;
}) {
  const { profile } = await requirePermissionPage("manage_events");
  // `editionId` used to be dropped here, so "Open →" from the library started a
  // blank builder and created a second booklet with the same generated name.
  const { eventId, baseEditionId, editionId } = await searchParams;

  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle="Event Brochure">
      <div className="w-full max-w-6xl px-4 py-2">
        <h1 className="text-xl font-semibold text-[var(--navy)]">Event Brochure — builder</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          {editionId
            ? "Arrange the booklet pages and preview. Changes save as you work; the PDF is rebuilt when you generate."
            : "Name the booklet, arrange its pages, and preview. Data pulls from the event record; disclaimers & footer are locked."}
        </p>
        <div className="mt-6">
          <BrochureWizard initialEventId={eventId} baseEditionId={baseEditionId} openEditionId={editionId} />
        </div>
      </div>
    </AppShell>
  );
}
