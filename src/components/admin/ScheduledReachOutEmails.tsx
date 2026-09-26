"use client";

import { useCallback, useEffect, useState } from "react";
import type { UsZone } from "@/lib/founder-outreach/us-time-zone";
import { ReachOutEmailViewer, founderTime, parisTime } from "@/components/admin/ReachOutEmailViewer";

type Tab = "scheduled" | "sent" | "failed" | "canceled";
const TABS: { key: Tab; label: string }[] = [
  { key: "scheduled", label: "Scheduled" },
  { key: "sent", label: "Sent" },
  { key: "failed", label: "Failed" },
  { key: "canceled", label: "Canceled" },
];

type Item = {
  id: string;
  companyId: string;
  companyName: string;
  founderName: string;
  subject: string;
  via: "icapos" | "gmail";
  senderName: string;
  sendAt: string;
  sentAt: string | null;
  status: "scheduled" | "sending" | "sent" | "canceled" | "failed";
  error: string | null;
  zone: UsZone | null;
};

type ListBody = { items?: Item[]; counts?: Record<Tab, number>; error?: string };

const API = "/api/admin/scheduled-jobs/reach-outs";

async function fetchTab(tab: Tab): Promise<ListBody> {
  const res = await fetch(`${API}?tab=${tab}`).catch(() => null);
  if (!res) return { error: "Couldn't load the emails. Try again." };
  const body = (await res.json().catch(() => null)) as ListBody | null;
  return res.ok && body ? body : { error: body?.error ?? "Couldn't load the emails. Try again." };
}

async function postAction(action: "send-now" | "cancel", id: string): Promise<string | null> {
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, id }),
  }).catch(() => null);
  if (!res) return "Something went wrong.";
  if (res.ok) return null;
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? "Something went wrong.";
}

/**
 * Admin, System, Scheduled jobs, Scheduled reach outs row: every company's Reach
 * out emails by status, with View, Send now and Cancel.
 */
export function ScheduledReachOutEmails() {
  const [tab, setTab] = useState<Tab>("scheduled");
  const [data, setData] = useState<ListBody | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const reload = useCallback((t: Tab) => fetchTab(t).then(setData), []);

  useEffect(() => {
    let live = true;
    fetchTab(tab).then((b) => { if (live) setData(b); });
    return () => {
      live = false;
    };
  }, [tab]);

  async function act(action: "send-now" | "cancel", id: string): Promise<string | null> {
    setBusy(id + action);
    setMessage(null);
    const err = await postAction(action, id);
    setBusy(null);
    setMessage(err ?? (action === "cancel" ? "Email canceled." : "Email sent."));
    await reload(tab);
    return err;
  }

  const th = "px-3 py-1.5 text-left text-[11.5px] font-medium text-slate-500";
  const td = "px-3 py-2 align-top text-[12.5px]";
  const items = data?.items ?? [];

  return (
    <div className="mb-3">
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        <p className="m-0 text-xs font-semibold text-slate-500">Emails</p>
        <div className="flex flex-wrap gap-1.5">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => { setTab(t.key); setMessage(null); }}
              aria-pressed={tab === t.key}
              className={`rounded-full border px-2.5 py-0.5 text-xs ${tab === t.key ? "border-indigo-400 bg-indigo-50 font-semibold text-indigo-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
            >
              {t.label} {data?.counts ? data.counts[t.key] : ""}
            </button>
          ))}
        </div>
        {message ? <span className="text-[11.5px] font-medium text-indigo-700">{message}</span> : null}
      </div>

      {data?.error ? (
        <p className="m-0 text-xs text-red-700">{data.error}</p>
      ) : data === null ? (
        <p className="m-0 text-xs text-slate-500">Loading…</p>
      ) : items.length === 0 ? (
        <p className="m-0 text-xs text-slate-500">
          {tab === "scheduled" ? "No emails scheduled." : tab === "failed" ? "No failed emails." : `None in the last 30 days.`}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full min-w-[820px] border-collapse">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className={th}>{tab === "sent" ? "Sent" : "Sends"}</th>
                <th className={th}>Company</th>
                <th className={th}>Founder</th>
                <th className={th}>Subject</th>
                <th className={th}>Sender</th>
                <th className={th} />
              </tr>
            </thead>
            <tbody>
              {items.map((it) => {
                const when = it.sentAt ?? it.sendAt;
                const ft = founderTime(when, it.zone);
                const canAct = it.status === "scheduled" || it.status === "failed";
                return (
                  <tr key={it.id} className="border-b border-slate-100 last:border-0">
                    <td className={td}>
                      <span className="font-semibold tabular-nums text-slate-900">{parisTime(when)}</span>
                      {ft ? <span className="block text-slate-500">{ft}</span> : null}
                    </td>
                    <td className={td}>{it.companyName}</td>
                    <td className={td}>{it.founderName}</td>
                    <td className={td}>
                      {it.subject}
                      {it.status === "failed" ? <span className="block text-rose-600">Not sent: {it.error ?? "unknown error"}</span> : null}
                      {it.status === "sending" ? <span className="block text-slate-500">Sending…</span> : null}
                    </td>
                    <td className={td}>{it.via === "icapos" ? "iCapOS" : "Gmail"} · {it.senderName}</td>
                    <td className={`${td} whitespace-nowrap text-right font-semibold`}>
                      <button type="button" onClick={() => setViewing(it.id)} className="text-indigo-700 hover:underline">View</button>
                      {canAct ? (
                        <>
                          <button type="button" disabled={busy !== null} onClick={() => void act("send-now", it.id)} className="ml-3 text-indigo-700 hover:underline disabled:opacity-50">
                            {busy === it.id + "send-now" ? "Sending…" : it.status === "failed" ? "Send again" : "Send now"}
                          </button>
                          <button type="button" disabled={busy !== null} onClick={() => void act("cancel", it.id)} className="ml-3 text-slate-500 hover:underline disabled:opacity-50">
                            Cancel
                          </button>
                        </>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {tab === "scheduled" && items.length ? (
        <p className="mt-1.5 text-[11.5px] text-slate-500">Times in Paris, with the founder&apos;s time below.</p>
      ) : null}

      {viewing ? (
        <ReachOutEmailViewer
          detailUrl={`${API}?id=${viewing}`}
          onClose={() => setViewing(null)}
          onAction={(kind) => act(kind, viewing)}
        />
      ) : null}
    </div>
  );
}
