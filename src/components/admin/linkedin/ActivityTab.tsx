"use client";

import { useEffect, useState } from "react";
import { OdooPager } from "@/components/admin/OdooPager";
import { ACTIVITY_PAGE_SIZE, ACTIVITY_STATUSES, activityLabel, type ActivityRow, type ActivityStatus } from "@/lib/linkedin/activity";
import type { CampaignWithStats } from "@/lib/linkedin/store";
import { ErrorLine, Section, Tag, api, btnCls, inputCls } from "./ui";

type Tone = "ok" | "warn" | "bad" | "info" | "pro" | "mute";
const TONE: Record<ActivityStatus, Tone> = {
  sent: "ok", dry_run: "warn", failed: "bad", already_connected: "mute", accepted: "info", message_sent: "info",
  replied: "pro", handed_off: "pro", withdrawn: "mute", warning: "bad", queued: "mute",
};

function when(iso: string, timeZone: string): string {
  try { return new Intl.DateTimeFormat("en-US", { timeZone, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso)); } catch { return iso; }
}

const linkCls = "inline-flex items-center gap-1 font-medium text-[#1A6CE4] hover:underline";

/** Admin › LinkedIn › Activity. Every action on a person: when, who, which account, status and why. */
export function ActivityTab({ campaigns, timeZone }: Readonly<{ campaigns: CampaignWithStats[]; timeZone: string }>) {
  const [status, setStatus] = useState("");
  const [campaign, setCampaign] = useState("");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<ActivityRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [tz, setTz] = useState(timeZone);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { const t = setTimeout(() => { setQ(search.trim()); setPage(1); }, 300); return () => clearTimeout(t); }, [search]);

  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (campaign) params.set("campaign", campaign);
  if (q) params.set("q", q);
  const base = params.toString();

  useEffect(() => {
    let alive = true;
    const p = new URLSearchParams(base);
    p.set("page", String(page));
    api<{ rows: ActivityRow[]; total: number; timeZone: string }>(`/api/admin/linkedin/activity?${p.toString()}`).then((r) => {
      if (!alive) return;
      if (r.ok) { setRows(r.data.rows); setTotal(r.data.total); setTz(r.data.timeZone); setError(null); } else setError(r.error);
    });
    return () => { alive = false; };
  }, [base, page]);

  const first = total === 0 ? 0 : (page - 1) * ACTIVITY_PAGE_SIZE + 1;
  const last = Math.min(page * ACTIVITY_PAGE_SIZE, total);
  const csvHref = `/api/admin/linkedin/activity?${new URLSearchParams([...params.entries(), ["format", "csv"]]).toString()}`;

  return (
    <Section title="Activity" icon="ti-list-details">
      <div className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="Status" className={`${inputCls} !w-auto`} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All statuses</option>
            {ACTIVITY_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <select aria-label="Campaign" className={`${inputCls} !w-auto`} value={campaign} onChange={(e) => { setCampaign(e.target.value); setPage(1); }}>
            <option value="">All campaigns</option>
            {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input aria-label="Search a person" className={`${inputCls} min-w-[160px] flex-1`} placeholder="Search a person" value={search} onChange={(e) => setSearch(e.target.value)} />
          <a href={csvHref} className={btnCls}><i className="ti ti-download" aria-hidden="true" /> Export CSV</a>
        </div>
        <ErrorLine text={error} />
        {rows === null ? (error ? null : <p className="text-[13px] text-slate-500">Loading…</p>) : rows.length === 0 ? (
          <p className="py-4 text-[13px] text-slate-600">No activity yet. Each invite, failure and reply shows here once the sender runs.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-[13px]">
              <thead className="text-[12px] text-slate-500">
                <tr><th className="py-2 pr-2 font-medium">When</th><th className="px-2 py-2 font-medium">Person</th><th className="px-2 py-2 font-medium">Account</th><th className="px-2 py-2 font-medium">Action</th><th className="px-2 py-2 font-medium">Status</th><th className="px-2 py-2 font-medium">Reason</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100 align-top">
                    <td className="whitespace-nowrap py-2.5 pr-2 text-slate-700">{when(r.at, tz)}</td>
                    <td className="px-2 py-2.5">
                      {r.personUrl ? <a href={r.personUrl} target="_blank" rel="noopener noreferrer" className={linkCls}>{r.person}<i className="ti ti-brand-linkedin" aria-label="Open on LinkedIn" /></a> : <span className="font-medium text-slate-900">{r.person}</span>}
                    </td>
                    <td className="px-2 py-2.5">
                      {r.accountUrl ? <a href={r.accountUrl} target="_blank" rel="noopener noreferrer" className={linkCls}>{r.account}<i className="ti ti-external-link" aria-label="Open sender profile" /></a> : <span className="text-slate-700">{r.account}</span>}
                    </td>
                    <td className="px-2 py-2.5">{r.action}{r.campaign ? <span className="block text-[12px] text-slate-500">{r.campaign}</span> : null}</td>
                    <td className="px-2 py-2.5"><Tag tone={TONE[r.status]}>{activityLabel(r.status)}</Tag></td>
                    <td className="px-2 py-2.5 text-[12.5px] text-slate-600">{r.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {total > 0 ? (
          <div className="flex items-center justify-between gap-3 text-[12.5px] text-slate-500">
            <span>Dry run rows are never real invites. Times are in {tz.replaceAll("_", " ")}.</span>
            <OdooPager label={`${first}-${last} / ${total}`} prev={{ onClick: () => setPage((p) => Math.max(1, p - 1)), disabled: page <= 1 }} next={{ onClick: () => setPage((p) => p + 1), disabled: last >= total }} />
          </div>
        ) : null}
      </div>
    </Section>
  );
}
