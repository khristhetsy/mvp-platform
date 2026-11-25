import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { MetricCard } from "@/components/MetricCard";
import { requirePermissionPage } from "@/lib/api/permissions";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { loadEventsDashboard } from "@/lib/icfo-events/dashboard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Events dashboard" };

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "No date";

const TONE_DOT: Record<string, string> = { bad: "bg-red-500", warn: "bg-amber-500", info: "bg-[#1A6CE4]" };

export default async function AdminEventsDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string }>;
}) {
  const { profile } = await requirePermissionPage("manage_events");
  const { event: eventParam } = await searchParams;
  const admin = createServiceRoleClient();
  const d = await loadEventsDashboard(admin).catch(() => null);

  const shell = (children: React.ReactNode) => (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle="Events">
      <div className="mx-auto max-w-6xl px-4 py-6">{children}</div>
    </AppShell>
  );

  if (!d) {
    return shell(
      <>
        <h1 className="text-xl font-semibold text-[var(--navy)]">Events dashboard</h1>
        <p className="mt-3 text-sm text-slate-500">The event figures could not be loaded. Reload the page to try again.</p>
      </>,
    );
  }

  const t = d.totals;
  const selected = d.rows.find((r) => r.id === eventParam) ?? d.rows.find((r) => r.id === d.nextEvent?.id) ?? d.rows[0] ?? null;
  const invited = selected ? d.invitedByEvent[selected.id] ?? 0 : 0;
  const started = selected ? selected.datePassed || selected.status === "ended" || selected.status === "live" : false;

  const funnel = selected
    ? [
        { key: "Invited", value: invited, show: String(invited) },
        { key: "Registered", value: selected.registered, show: String(selected.registered) },
        { key: "Attended", value: selected.attended, show: started ? String(selected.attended) : "Not started" },
        { key: "No show", value: selected.noShow, show: started ? String(selected.noShow) : "Not started" },
      ]
    : [];
  const funnelMax = Math.max(1, ...funnel.map((f) => f.value));

  return shell(
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[var(--navy)]">Events dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">One view across events, registrations, speaker applications, sponsors and invitations.</p>
        </div>
        <Link href="/admin/events" className="rounded-lg bg-[#1A6CE4] px-3 py-2 text-sm font-semibold text-white">New event</Link>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 [&>*]:h-full">
        <MetricCard
          label="Published events"
          value={String(t.published)}
          unit={`of ${t.events} total`}
          detail={`${t.events - t.published} not published`}
          accent="blue"
          ring={{ percent: t.events > 0 ? Math.round((t.published / t.events) * 100) : null, center: String(t.published), pending: t.events === 0 }}
          flag={t.draftsPastDate > 0 ? { text: `${t.draftsPastDate} draft with a date that has passed`, tone: "warn" } : null}
          audience="admin"
          detailPanel={{
            breakdown: d.rows.map((r) => ({ label: r.title, value: r.status })),
            href: "/admin/events",
            hrefLabel: "All events",
          }}
        />
        <MetricCard
          label="Registrations"
          value={t.registrations.toLocaleString()}
          unit="registered"
          detail={d.nextEvent ? `Next event: ${d.nextEvent.daysAway} days away` : "No upcoming published event"}
          accent="slate"
          ring={{ percent: null, center: t.registrations.toLocaleString(), pending: t.registrations === 0 }}
          flag={d.nextEvent ? { text: `${d.nextEvent.title} is ${d.nextEvent.daysAway} days out`, tone: "good" } : null}
          audience="admin"
          detailPanel={{
            breakdown: d.rows.map((r) => ({ label: r.title, value: String(r.registered) })),
            href: "/admin/events/registrations",
            hrefLabel: "Registrations",
          }}
        />
        <MetricCard
          label="Speaker applications"
          value={String(t.applicationsOpen)}
          unit="to review"
          detail={`${t.applicationsSubmitted} submitted, ${t.applicationsUnderReview} under review`}
          accent="violet"
          ring={{ percent: null, center: String(t.applicationsOpen), pending: t.applicationsOpen === 0 }}
          flag={t.applicationsSubmitted > 0 ? { text: `${t.applicationsSubmitted} waiting on a first review`, tone: "warn" } : null}
          audience="admin"
          detailPanel={{
            breakdown: [
              { label: "Submitted", value: String(t.applicationsSubmitted) },
              { label: "Under review", value: String(t.applicationsUnderReview) },
            ],
            href: "/admin/events/applications",
            hrefLabel: "Applications",
          }}
        />
        <MetricCard
          label="Sponsors"
          value={String(t.sponsors)}
          unit="listed"
          detail="Pipeline stage is not measured yet"
          accent="slate"
          ring={{ percent: null, center: String(t.sponsors), pending: true }}
          flag={null}
          audience="admin"
          detailPanel={{
            note: "Counts sponsor listings on events. No sponsor pipeline status is recorded, so there is no stage breakdown.",
            href: "/admin/events/sponsors",
            hrefLabel: "Sponsors",
          }}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <h2 className="text-sm font-semibold text-[var(--navy)]">Events</h2>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-[#eef3ff] px-2 py-0.5 text-[11px] font-semibold text-[#1A6CE4]">{t.events}</span>
                <Link href="/admin/events" className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-semibold text-[#1A6CE4]">All events</Link>
              </div>
            </div>
            {d.rows.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-slate-400">No events yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
                    <th className="px-4 py-2 font-semibold">Event</th>
                    <th className="px-4 py-2 font-semibold">Starts</th>
                    <th className="px-4 py-2 font-semibold">Status</th>
                    <th className="px-4 py-2 text-right font-semibold">Registered</th>
                    <th className="px-4 py-2 text-right font-semibold">Attended</th>
                  </tr>
                </thead>
                <tbody>
                  {d.rows.map((r) => {
                    const begun = r.datePassed || r.status === "ended" || r.status === "live";
                    const stale = r.status === "draft" && r.datePassed;
                    return (
                      <tr key={r.id} className="border-t border-slate-100">
                        <td className="px-4 py-2.5">
                          <Link href={`/admin/events/dashboard?event=${r.id}`} className="font-medium text-slate-800 hover:text-[#1A6CE4]">{r.title}</Link>
                        </td>
                        <td className="px-4 py-2.5 text-slate-600">{fmtDate(r.startsAt)}</td>
                        <td className="px-4 py-2.5">
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${stale ? "bg-amber-50 text-amber-700" : r.status === "published" || r.status === "live" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                            {stale ? "Draft, date passed" : r.status}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right text-slate-700">{r.registered}</td>
                        <td className="px-4 py-2.5 text-right text-slate-700">{begun ? r.attended : "Not started"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            <p className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400">Source: events and registrations tables, read when the page loaded.</p>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <h2 className="text-sm font-semibold text-[var(--navy)]">Registration funnel{selected ? `, ${selected.title}` : ""}</h2>
              <Link href="/admin/events/registrations" className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-semibold text-[#1A6CE4]">Registrations</Link>
            </div>
            {!selected ? (
              <p className="px-4 py-10 text-center text-sm text-slate-400">No events yet.</p>
            ) : (
              <>
                {funnel.map((f) => (
                  <div key={f.key} className="flex items-center gap-3 border-t border-slate-100 px-4 py-2.5 first:border-t-0 text-sm">
                    <span className="w-24 text-slate-700">{f.key}</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <span className="block h-full rounded-full bg-[#1A6CE4]" style={{ width: `${Math.round((f.value / funnelMax) * 100)}%` }} />
                    </span>
                    <span className="w-24 text-right font-bold text-[var(--navy)]">{f.show}</span>
                  </div>
                ))}
                <p className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400">
                  Registered {selected.registered} of {invited} invited. Attended and no show fill in once the event has started. Pick another event from the table.
                </p>
              </>
            )}
          </section>
        </div>

        <div className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <h2 className="text-sm font-semibold text-[var(--navy)]">Needs attention</h2>
              <span className="rounded-full bg-[#eef3ff] px-2 py-0.5 text-[11px] font-semibold text-[#1A6CE4]">{d.attention.length}</span>
            </div>
            {d.attention.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-400">Nothing needs attention.</p>
            ) : (
              d.attention.map((a) => (
                <div key={a.text} className="flex gap-2 border-t border-slate-100 px-4 py-2.5 text-sm first:border-t-0">
                  <span className={`mt-1.5 h-2 w-2 flex-none rounded-full ${TONE_DOT[a.tone]}`} />
                  <span className="text-slate-700">{a.text}</span>
                </div>
              ))
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <h2 className="text-sm font-semibold text-[var(--navy)]">Invitation campaigns</h2>
              <Link href="/admin/events/invitations" className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-semibold text-[#1A6CE4]">Invitations</Link>
            </div>
            {(["sending", "scheduled", "paused", "done", "draft"] as const).map((k) => (
              <div key={k} className="flex items-center justify-between border-t border-slate-100 px-4 py-2.5 text-sm first:border-t-0">
                <span className="capitalize text-slate-700">{k}</span>
                <span className="font-bold text-[var(--navy)]">{d.campaigns[k]}</span>
              </div>
            ))}
            <p className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400">Source: invitation campaigns, by status.</p>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <h2 className="text-sm font-semibold text-[var(--navy)]">Studio</h2>
              <div className="flex gap-2">
                <Link href="/admin/studio/spotlight" className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-semibold text-[#1A6CE4]">Spotlight</Link>
                <Link href="/admin/studio/talk-show" className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-semibold text-[#1A6CE4]">Talk Show</Link>
              </div>
            </div>
            <p className="px-4 py-3 text-sm text-slate-600">
              {d.nextEvent ? `Next event: ${d.nextEvent.title}, in ${d.nextEvent.daysAway} days.` : "No upcoming published event."}
            </p>
          </section>
        </div>
      </div>
    </>,
  );
}
