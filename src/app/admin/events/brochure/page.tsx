import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { requirePermissionPage } from "@/lib/api/permissions";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { listEditions } from "@/lib/event-hub/brochure/editions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Event Brochure — editions" };

export default async function BrochureLibraryPage() {
  const { profile } = await requirePermissionPage("manage_events");
  const admin = createServiceRoleClient();
  const editions = await listEditions(admin).catch(() => []);

  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle="Event Brochure">
      <div className="mx-auto max-w-4xl px-1 py-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-[var(--navy)]">Event Brochure</h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">Conference booklet editions — build from an event, preview page-by-page, and save an edition.</p>
          </div>
          <Link href="/admin/events/brochure/new" className="cap-btn-primary rounded-md px-4 py-2 text-sm font-medium">New booklet</Link>
        </div>

        <div className="mt-6">
          {editions.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[var(--border-subtle)] p-8 text-center text-sm text-[var(--text-muted)]">No editions yet. Create your first booklet.</p>
          ) : (
            <ul className="divide-y divide-[var(--border-subtle)] rounded-xl border border-[var(--border-subtle)] bg-white">
              {editions.map((e) => (
                <li key={e.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-[var(--navy)]">{e.title}</p>
                    <p className="text-xs text-[var(--text-muted)]">{e.status} · {new Date(e.createdAt).toLocaleDateString()}</p>
                  </div>
                  <Link href={`/admin/events/brochure/new?editionId=${e.id}`} className="text-xs font-semibold text-[var(--blue)] hover:underline">Open →</Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AppShell>
  );
}
