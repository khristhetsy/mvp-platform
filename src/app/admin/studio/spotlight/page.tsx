import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { requirePermissionPage } from "@/lib/api/permissions";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { listAllEvents } from "@/lib/icfo-events/queries";
import { pickStudioEvent } from "@/lib/icfo-events/studio";
import { StudioTabs } from "@/components/admin-events/StudioTabs";

export const dynamic = "force-dynamic";
export const metadata = { title: "Spotlight Studio" };

// The Spotlight Studio is per event and already lives at
// /admin/events/[id]/spotlight. This tab opens it for the chosen event.
export default async function SpotlightStudioTab({ searchParams }: { searchParams: Promise<{ event?: string }> }) {
  const { profile } = await requirePermissionPage("view_events");
  const { event: requested } = await searchParams;
  const events = await listAllEvents(createServiceRoleClient()).catch(() => []);
  const chosen = pickStudioEvent(events, requested);
  if (chosen) redirect(`/admin/events/${chosen.id}/spotlight`);

  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle="Spotlight Studio">
      <div className="space-y-6">
        <StudioTabs current="spotlight" />
        <div className="rounded-xl border border-dashed border-[var(--border-subtle)] p-10 text-center text-sm text-[var(--text-muted)]">
          No events yet. <Link href="/admin/events" className="font-medium text-[#1A6CE4] hover:underline">Create one in Events</Link>.
        </div>
      </div>
    </AppShell>
  );
}
