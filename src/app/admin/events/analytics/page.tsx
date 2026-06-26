import { AppShell } from "@/components/AppShell";
import { requirePermissionPage } from "@/lib/api/permissions";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getEventAnalytics } from "@/lib/icfo-events/analytics";

export const dynamic = "force-dynamic";
export const metadata = { title: "Event analytics" };

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-white p-5">
      <div className="text-2xl font-bold text-[var(--navy)]">{value}</div>
      <div className="mt-1 text-xs uppercase tracking-wide text-[var(--text-muted)]">{label}</div>
    </div>
  );
}

export default async function AdminEventAnalyticsPage() {
  const { profile } = await requirePermissionPage("manage_events");
  const admin = createServiceRoleClient();
  const { rows, totals } = await getEventAnalytics(admin).catch(() => ({
    rows: [],
    totals: { events: 0, registrations: 0, applications: 0, approved: 0, acceptanceRate: 0 },
  }));

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle="Event analytics"
    >
      <div className="mx-auto max-w-5xl px-4 py-6">
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">Event analytics</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Aggregate engagement across iCFO Events. Counts only — no raw attendee data.
        </p>

        <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Events" value={String(totals.events)} />
          <Stat label="Registrations" value={String(totals.registrations)} />
          <Stat label="Applications" value={String(totals.applications)} />
          <Stat label="Acceptance rate" value={`${Math.round(totals.acceptanceRate * 100)}%`} />
        </div>

        <div className="mt-6 overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-white">
          {rows.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-[var(--text-muted)]">No events yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] text-left text-xs uppercase tracking-wide text-[var(--text-muted)]">
                  <th className="px-4 py-3 font-semibold">Event</th>
                  <th className="px-4 py-3 font-semibold text-right">Registered</th>
                  <th className="px-4 py-3 font-semibold text-right">Applications</th>
                  <th className="px-4 py-3 font-semibold text-right">Approved</th>
                  <th className="px-4 py-3 font-semibold text-right">Sessions</th>
                  <th className="px-4 py-3 font-semibold text-right">Sponsors</th>
                  <th className="px-4 py-3 font-semibold text-right">Networking</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.eventId} className="border-b border-[var(--border-subtle)] last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-medium text-[var(--navy)]">{r.title}</div>
                      <div className="text-xs capitalize text-[var(--text-muted)]">{r.status}</div>
                    </td>
                    <td className="px-4 py-3 text-right text-[var(--text-secondary)]">{r.registrations}</td>
                    <td className="px-4 py-3 text-right text-[var(--text-secondary)]">{r.applications}</td>
                    <td className="px-4 py-3 text-right text-[var(--text-secondary)]">{r.approved}</td>
                    <td className="px-4 py-3 text-right text-[var(--text-secondary)]">{r.sessions}</td>
                    <td className="px-4 py-3 text-right text-[var(--text-secondary)]">{r.sponsors}</td>
                    <td className="px-4 py-3 text-right text-[var(--text-secondary)]">{r.networkingOptIns}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AppShell>
  );
}
