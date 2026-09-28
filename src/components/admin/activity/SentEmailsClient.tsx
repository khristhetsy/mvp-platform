"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ROLE_LABEL, emailResult, sourceLabel } from "@/lib/email/email-log-labels";
import type { EmailLogDetail, EmailLogItem, EmailRole } from "@/lib/email/email-log";

type Filter = "all" | "failed" | "bounced" | "opened" | "unopened";
type Counts = Record<EmailRole | "all", number>;

const WHEN = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

const TONE: Record<string, string> = {
  bad: "bg-rose-50 text-rose-700",
  warn: "bg-amber-50 text-amber-800",
  good: "bg-emerald-50 text-emerald-800",
  info: "bg-blue-50 text-blue-700",
  muted: "bg-slate-100 text-slate-600",
};

const ROLE_CLS: Record<EmailRole, string> = {
  founder: "bg-blue-50 text-blue-700",
  investor: "bg-emerald-50 text-emerald-800",
  staff: "bg-slate-100 text-slate-700",
  external: "bg-amber-50 text-amber-800",
};

const ROLE_TABS: Array<{ key: EmailRole | null; label: string; count: keyof Counts }> = [
  { key: null, label: "All", count: "all" },
  { key: "founder", label: "Founders", count: "founder" },
  { key: "investor", label: "Investors", count: "investor" },
  { key: "staff", label: "Staff", count: "staff" },
  { key: "external", label: "External", count: "external" },
];

const th = "px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500";
const td = "px-3 py-2.5 align-top text-[12.5px] text-slate-700";

function isRole(v: string | null): v is EmailRole {
  return v === "founder" || v === "investor" || v === "staff" || v === "external";
}

function trigger(e: EmailLogItem): string {
  if (e.triggeredByName) return e.triggeredByName;
  if (e.job) return "Scheduled";
  return "Automatic";
}

/**
 * Every email the platform sent: who got it, what triggered it, and what
 * happened after. Full page under Admin, Activity, Sent; pass userId (and
 * compact) to show one person's emails on their profile.
 */
export function SentEmailsClient({
  initialRole = null,
  initialQuery = "",
  userId = null,
  compact = false,
}: Readonly<{ initialRole?: string | null; initialQuery?: string; userId?: string | null; compact?: boolean }>) {
  const [role, setRole] = useState<EmailRole | null>(isRole(initialRole) ? initialRole : null);
  const [filter, setFilter] = useState<Filter>("all");
  const [days, setDays] = useState(30);
  const [query, setQuery] = useState(initialQuery);
  const [q, setQ] = useState(initialQuery);
  // Results carry the query they answer, so a changed filter reads as loading
  // until its own results arrive.
  const [page, setPage] = useState<{ key: string; items: EmailLogItem[]; counts: Counts; nextBefore: number | null; error: string | null } | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [viewing, setViewing] = useState<EmailLogDetail | null>(null);
  const [viewingId, setViewingId] = useState<number | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setQ(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const url = useCallback(
    (before: number | null) => {
      const p = new URLSearchParams({ filter, days: String(days), limit: compact ? "20" : "100" });
      if (role) p.set("role", role);
      if (q) p.set("q", q);
      if (userId) p.set("user", userId);
      if (before) p.set("before", String(before));
      return `/api/admin/email-log?${p.toString()}`;
    },
    [filter, days, role, q, userId, compact],
  );

  const key = url(null);
  useEffect(() => {
    const mine = ++seq.current;
    fetch(key)
      .then(async (r) => (r.ok ? r.json() : Promise.reject(new Error((await r.json().catch(() => ({}))).error ?? `Error ${r.status}`))))
      .then((d: { items: EmailLogItem[]; counts: Counts; nextBefore: number | null }) => {
        if (mine === seq.current) setPage({ key, items: d.items, counts: d.counts, nextBefore: d.nextBefore, error: null });
      })
      .catch((e: Error) => {
        if (mine === seq.current) setPage((cur) => ({ key, items: [], counts: cur?.counts ?? { all: 0, founder: 0, investor: 0, staff: 0, external: 0 }, nextBefore: null, error: e.message }));
      });
  }, [key]);

  const current = page && page.key === key ? page : null;
  const items = current ? current.items : null;
  const counts = page?.counts ?? null;
  const nextBefore = current?.nextBefore ?? null;
  const error = current?.error ?? null;

  async function loadMore() {
    if (!current || !nextBefore) return;
    setLoadingMore(true);
    const d = (await fetch(url(nextBefore)).then((r) => r.json()).catch(() => null)) as { items: EmailLogItem[]; nextBefore: number | null } | null;
    setLoadingMore(false);
    if (!d) return;
    setPage((cur) => (cur && cur.key === key ? { ...cur, items: [...cur.items, ...d.items], nextBefore: d.nextBefore } : cur));
  }

  async function open(id: number) {
    setViewingId(id);
    setViewing(null);
    const d = (await fetch(`/api/admin/email-log?id=${id}`).then((r) => r.json()).catch(() => null)) as { email?: EmailLogDetail } | null;
    if (d?.email) setViewing(d.email);
  }

  const closed = () => {
    setViewingId(null);
    setViewing(null);
  };

  return (
    <div className={compact ? "space-y-3" : "rounded-xl border border-slate-200 bg-white"}>
      {compact ? null : (
        <div className="border-b border-slate-100 px-4 py-3">
          <h1 className="text-base font-semibold text-slate-900">Sent emails</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Every email the platform sends: who got it, what triggered it, and what happened after. Recorded from 28 Sep 2026.
          </p>
        </div>
      )}

      <div className={`flex flex-wrap items-center gap-2 ${compact ? "" : "px-4 pt-3"}`}>
        {compact
          ? null
          : ROLE_TABS.map((t) => (
              <button
                key={t.label}
                type="button"
                onClick={() => setRole(t.key)}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${role === t.key ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
              >
                {t.label}
                {counts ? <span className={`ml-1.5 tabular-nums ${role === t.key ? "text-indigo-100" : "text-slate-400"}`}>{counts[t.count]}</span> : null}
              </button>
            ))}
        <span className="flex-1" />
        <select value={filter} onChange={(e) => setFilter(e.target.value as Filter)} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700" aria-label="Result">
          <option value="all">Any result</option>
          <option value="failed">Failed</option>
          <option value="bounced">Bounced</option>
          <option value="opened">Opened</option>
          <option value="unopened">Not opened</option>
        </select>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700" aria-label="Period">
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
          <option value={180}>Last 180 days</option>
        </select>
        {compact ? null : (
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search email or subject"
            className="w-56 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700"
          />
        )}
      </div>

      <div className={compact ? "" : "p-4"}>
        {error ? (
          <p className="m-0 text-xs text-rose-700">{error}</p>
        ) : items === null ? (
          <p className="m-0 text-xs text-slate-500">Loading…</p>
        ) : items.length === 0 ? (
          <p className="m-0 text-xs text-slate-500">No emails match. The log starts on 28 Sep 2026.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full min-w-[820px] border-collapse">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className={th}>Sent</th>
                  {compact ? null : <th className={th}>To</th>}
                  <th className={th}>Email</th>
                  <th className={th}>Triggered by</th>
                  <th className={th}>Result</th>
                  <th className={th} />
                </tr>
              </thead>
              <tbody>
                {items.map((e) => {
                  const r = emailResult(e);
                  return (
                    <tr key={e.id} className="border-b border-slate-100 last:border-0">
                      <td className={`${td} whitespace-nowrap tabular-nums`}>{WHEN.format(new Date(e.createdAt))}</td>
                      {compact ? null : (
                        <td className={td}>
                          <span className="text-slate-900">{e.recipientName ?? e.toEmail}</span>
                          <span className={`ml-1.5 inline-block rounded-full px-1.5 py-px text-[10.5px] font-semibold ${ROLE_CLS[e.recipientRole]}`}>{ROLE_LABEL[e.recipientRole]}</span>
                          {e.recipientName ? <span className="block text-slate-500">{e.toEmail}</span> : null}
                        </td>
                      )}
                      <td className={td}>
                        <span className="text-slate-900">{e.subject}</span>
                        <span className="block text-slate-500">{sourceLabel(e.source)}</span>
                      </td>
                      <td className={td}>{trigger(e)}</td>
                      <td className={td}>
                        <span className={`inline-block rounded-md px-2 py-0.5 text-[11.5px] ${TONE[r.tone]}`} title={r.hint}>{r.text}</span>
                      </td>
                      <td className={`${td} text-right font-semibold`}>
                        <button type="button" className="text-indigo-700 hover:underline" onClick={() => void open(e.id)}>
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-3 flex items-center gap-3">
          {nextBefore ? (
            <button type="button" disabled={loadingMore} onClick={() => void loadMore()} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-60">
              {loadingMore ? "Loading…" : "Load more"}
            </button>
          ) : null}
          {compact && userId ? (
            <Link href={`/admin/activity/sent?user=${userId}`} className="text-xs text-indigo-600 hover:underline">
              Open in Sent emails
            </Link>
          ) : null}
        </div>
      </div>

      {viewingId !== null ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4" role="dialog" aria-modal="true" onClick={closed}>
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white p-5 shadow-xl" onClick={(ev) => ev.stopPropagation()}>
            <div className="mb-2 flex items-start justify-between gap-3">
              <h3 className="text-base font-semibold text-slate-900">{viewing?.subject ?? "Loading…"}</h3>
              <button type="button" onClick={closed} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100" aria-label="Close">
                ✕
              </button>
            </div>
            {viewing ? (
              <>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12.5px]">
                  <dt className="text-slate-500">To</dt>
                  <dd className="text-slate-900">
                    {viewing.recipientName ? `${viewing.recipientName} · ` : ""}
                    {viewing.toEmail} · {ROLE_LABEL[viewing.recipientRole]}
                  </dd>
                  <dt className="text-slate-500">Sent</dt>
                  <dd className="text-slate-900">{WHEN.format(new Date(viewing.createdAt))} Paris</dd>
                  <dt className="text-slate-500">Triggered by</dt>
                  <dd className="text-slate-900">
                    {trigger(viewing)} · {sourceLabel(viewing.source)}
                  </dd>
                  <dt className="text-slate-500">Result</dt>
                  <dd className="text-slate-900">
                    {emailResult(viewing).text}
                    <span className="text-slate-500"> · {emailResult(viewing).hint}</span>
                  </dd>
                  {(
                    [
                      ["Delivered", viewing.deliveredAt],
                      ["Opened", viewing.openedAt],
                      ["Clicked", viewing.clickedAt],
                      ["Bounced", viewing.bouncedAt],
                      ["Spam report", viewing.complainedAt],
                    ] as Array<[string, string | null]>
                  )
                    .filter(([, at]) => at)
                    .map(([label, at]) => (
                      <div key={label} className="contents">
                        <dt className="text-slate-500">{label}</dt>
                        <dd className="text-slate-900">{WHEN.format(new Date(at as string))} Paris</dd>
                      </div>
                    ))}
                </dl>
                {viewing.html ? (
                  <iframe
                    title="Email message"
                    sandbox=""
                    srcDoc={viewing.html}
                    className="mt-3 h-[26rem] w-full flex-none rounded-lg border border-slate-200 bg-slate-50"
                  />
                ) : viewing.text ? (
                  <p className="mt-3 max-h-[26rem] overflow-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-3 text-[13px] text-slate-900">{viewing.text}</p>
                ) : (
                  <p className="mt-3 text-xs text-slate-500">The body isn&apos;t stored for this email (marketing sends keep only who got what).</p>
                )}
              </>
            ) : (
              <p className="text-xs text-slate-500">Loading…</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
