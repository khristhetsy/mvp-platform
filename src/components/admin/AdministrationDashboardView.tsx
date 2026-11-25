"use client";

import { useState } from "react";
import Link from "next/link";
import { MetricCard } from "@/components/MetricCard";
import { MetricDetailDrawer } from "@/components/ui/MetricDetailDrawer";
import type { AdministrationDashboard, QueueRow } from "@/lib/dashboard/administration-dashboard";

const TONE_DOT: Record<string, string> = { bad: "bg-red-500", warn: "bg-amber-500", good: "bg-emerald-600" };
const NA = "Not available";
const show = (n: number | null) => (n === null ? NA : String(n));
const ROW = "w-full text-left hover:bg-indigo-50/40 cursor-pointer";

function queueStatus(q: QueueRow): { text: string; cls: string } {
  if (q.open === null) return { text: NA, cls: "bg-slate-100 text-slate-500" };
  if (q.open === 0) return { text: "Clear", cls: "bg-emerald-50 text-emerald-700" };
  return { text: "Needs work", cls: "bg-amber-50 text-amber-700" };
}

/** Administration dashboard body. Tiles, table rows and list rows open a popup whose records link to their pages. */
export function AdministrationDashboardView({ d }: Readonly<{ d: AdministrationDashboard }>) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const pop = openKey ? d.popups[openKey] : null;
  const u = d.users;
  const usersMax = Math.max(1, u?.total ?? 1);
  const statusRows = u
    ? [
        { key: "Active", value: u.active, popup: "u_active" },
        { key: "Invited", value: u.invited, popup: "u_invited" },
        { key: "Inactive", value: u.inactive, popup: "u_inactive" },
      ]
    : [];
  const tile = (key: string, accent: "blue" | "slate" | "violet", ring: { percent: number | null; center: string; pending: boolean }) => {
    const p = d.popups[key];
    return (
      <MetricCard
        label={p.label}
        value={p.value}
        unit={p.unit}
        detail={p.detail}
        accent={accent}
        ring={ring}
        flag={p.flag}
        audience="admin"
        detailPanel={p.extra}
      />
    );
  };

  return (
    <>
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 [&>*]:h-full">
        {tile("users", "blue", { percent: u && u.total > 0 ? Math.round((u.active / u.total) * 100) : null, center: u ? String(u.total) : "", pending: !u })}
        {tile("compliance", "slate", { percent: null, center: d.compliance === null ? "" : String(d.compliance), pending: true })}
        {tile("spv", "violet", { percent: null, center: d.spvBlockers === null ? "" : String(d.spvBlockers), pending: true })}
        {tile("reviews", "slate", { percent: null, center: d.pendingReviews === null ? "" : String(d.pendingReviews), pending: true })}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <h2 className="text-sm font-semibold text-[var(--navy)]">Approvals and reviews</h2>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-[#eef3ff] px-2 py-0.5 text-[11px] font-semibold text-[#1A6CE4]">{d.queues.length}</span>
                <Link href="/admin/queues" className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-semibold text-[#1A6CE4]">All queues</Link>
                <Link href="/admin/compliance" className="rounded-md bg-[#1A6CE4] px-2.5 py-1 text-xs font-semibold text-white">Open compliance</Link>
              </div>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2 font-semibold">Queue</th>
                  <th className="px-4 py-2 text-right font-semibold">Open</th>
                  <th className="px-4 py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {d.queues.map((q) => {
                  const s = queueStatus(q);
                  return (
                    <tr key={q.key} className="cursor-pointer border-t border-slate-100 hover:bg-indigo-50/40" onClick={() => setOpenKey(q.key)}>
                      <td className="px-4 py-2.5">
                        <button type="button" onClick={() => setOpenKey(q.key)} className="font-medium text-slate-800 hover:text-[#1A6CE4]">{q.label}</button>
                      </td>
                      <td className="px-4 py-2.5 text-right text-slate-700">{show(q.open)}</td>
                      <td className="px-4 py-2.5"><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.cls}`}>{s.text}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400">Source: compliance, SPV, company, upgrade and investor tables, read when the page loaded.</p>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <h2 className="text-sm font-semibold text-[var(--navy)]">Platform users by status</h2>
              <Link href="/admin/users/manage" className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-semibold text-[#1A6CE4]">User management</Link>
            </div>
            {!u ? (
              <p className="px-4 py-10 text-center text-sm text-slate-400">The user counts could not be read.</p>
            ) : (
              <>
                {statusRows.map((r) => (
                  <button key={r.key} type="button" onClick={() => setOpenKey(r.popup)} className={`${ROW} flex items-center gap-3 border-t border-slate-100 px-4 py-2.5 text-sm first:border-t-0`}>
                    <span className="w-24 text-slate-700">{r.key}</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <span className="block h-full rounded-full bg-[#1A6CE4]" style={{ width: `${Math.round(((r.value ?? 0) / usersMax) * 100)}%` }} />
                    </span>
                    <span className="w-24 text-right font-bold text-[var(--navy)]">{show(r.value)}</span>
                  </button>
                ))}
                <button type="button" onClick={() => setOpenKey("u_role")} className={`${ROW} flex items-center justify-between border-t border-slate-100 px-4 py-2.5 text-sm`}>
                  <span className="text-slate-700">By role</span>
                  <span className="text-right text-slate-600">{u.byRole.map((r) => `${r.role} ${r.count}`).join(", ")}</span>
                </button>
                <p className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400">{u.active} of {u.total} users are active. Source: profiles and sign in records.</p>
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
                <button key={a.text} type="button" onClick={() => setOpenKey(a.popup)} className={`${ROW} flex gap-2 border-t border-slate-100 px-4 py-2.5 text-sm first:border-t-0`}>
                  <span className={`mt-1.5 h-2 w-2 flex-none rounded-full ${TONE_DOT[a.tone]}`} />
                  <span className="text-slate-700">{a.text}</span>
                </button>
              ))
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <h2 className="text-sm font-semibold text-[var(--navy)]">Access and billing</h2>
              <Link href="/admin/users/permissions" className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-semibold text-[#1A6CE4]">Permissions</Link>
            </div>
            {d.access.map((a) => (
              <button key={a.label} type="button" onClick={() => setOpenKey(a.popup)} className={`${ROW} flex items-center justify-between border-t border-slate-100 px-4 py-2.5 text-sm first:border-t-0`}>
                <span className="text-slate-700">{a.label}</span>
                <span className="font-bold text-[var(--navy)]">{show(a.value)}</span>
              </button>
            ))}
            <p className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400">Source: upgrade requests, sign in records and invoices.</p>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <h2 className="text-sm font-semibold text-[var(--navy)]">Shortcuts</h2>
              <div className="flex gap-2">
                <Link href="/admin/users/manage" className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-semibold text-[#1A6CE4]">User Management</Link>
                <Link href="/admin/billing" className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-semibold text-[#1A6CE4]">Billing</Link>
                <Link href="/admin/pricing" className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-semibold text-[#1A6CE4]">Pricing</Link>
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2.5 text-sm first:border-t-0">
              <Link href="/admin/users/permissions" className="text-slate-700 hover:text-[#1A6CE4]">User Permissions</Link>
              <span className="text-xs font-semibold text-[#1A6CE4]">Open</span>
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2.5 text-sm">
              <Link href="/admin/crm/connectors" className="text-slate-700 hover:text-[#1A6CE4]">Contact Sync</Link>
              <span className="text-xs font-semibold text-[#1A6CE4]">Open</span>
            </div>
          </section>
        </div>
      </div>

      {pop ? (
        <MetricDetailDrawer open onClose={() => setOpenKey(null)} label={pop.label} value={pop.value} unit={pop.unit} detail={pop.detail} flag={pop.flag} audience="admin" extra={pop.extra} />
      ) : null}
    </>
  );
}
