"use client";

import { useEffect, useState, type ReactNode } from "react";
import { PREVIEW_JOB_PATHS } from "@/lib/cron/preview-paths";

type Tab = "next" | "sent" | "runs";

type PreviewItem = {
  recipientName: string | null;
  toEmail: string | null;
  companyName: string | null;
  subject: string;
  channels: Array<"email" | "in_app">;
  message: string;
  html: string | null;
};

type Delivery = {
  id: number;
  channel: "email" | "in_app";
  recipientName: string | null;
  toEmail: string | null;
  subject: string;
  status: "sent" | "failed" | "skipped";
  error: string | null;
  createdAt: string;
};

type Viewing = { title: string; to: string; when: string | null; html: string | null; message: string | null; status?: string };

const WHEN = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

const CHANNEL: Record<"email" | "in_app", { text: string; cls: string }> = {
  email: { text: "Email", cls: "bg-blue-50 text-blue-700" },
  in_app: { text: "In app", cls: "bg-indigo-50 text-indigo-700" },
};

const STATUS: Record<Delivery["status"], { text: string; cls: string }> = {
  sent: { text: "Delivered", cls: "bg-emerald-50 text-emerald-800" },
  failed: { text: "Failed", cls: "bg-rose-50 text-rose-700" },
  skipped: { text: "Not sent", cls: "bg-amber-50 text-amber-800" },
};

function useJson<T>(url: string | null): { data: T | null; error: string | null } {
  const [state, setState] = useState<{ url: string | null; data: T | null; error: string | null }>({ url: null, data: null, error: null });
  useEffect(() => {
    if (!url) return;
    let live = true;
    fetch(url)
      .then(async (res) => {
        const body = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
        if (!live) return;
        if (res.ok && body) setState({ url, data: body, error: null });
        else setState({ url, data: null, error: body?.error ?? "Couldn't load this. Try again." });
      })
      .catch(() => live && setState({ url, data: null, error: "Couldn't load this. Try again." }));
    return () => {
      live = false;
    };
  }, [url]);
  return state.url === url ? { data: state.data, error: state.error } : { data: null, error: null };
}

/**
 * A job's activity on Scheduled jobs: Next run (a dry run, for jobs that support
 * it), Sent (what it delivered in the last 30 days) and Last runs.
 */
export function JobActivity({ path, runs }: Readonly<{ path: string; runs: ReactNode }>) {
  const hasPreview = PREVIEW_JOB_PATHS.includes(path);
  const [tab, setTab] = useState<Tab>(hasPreview ? "next" : "sent");
  const [viewing, setViewing] = useState<Viewing | null>(null);

  const preview = useJson<{ label: string; note: string; items: PreviewItem[] }>(hasPreview && tab === "next" ? `/api/admin/scheduled-jobs/preview?job=${encodeURIComponent(path)}` : null);
  const sent = useJson<{ deliveries: Delivery[] }>(tab === "sent" ? `/api/admin/scheduled-jobs/deliveries?job=${encodeURIComponent(path)}` : null);

  async function openDelivery(d: Delivery) {
    setViewing({ title: d.subject, to: to(d.recipientName, d.toEmail), when: WHEN.format(new Date(d.createdAt)), html: null, message: null, status: STATUS[d.status].text + (d.error ? `: ${d.error}` : "") });
    const res = await fetch(`/api/admin/scheduled-jobs/deliveries?id=${d.id}`).catch(() => null);
    const body = res?.ok ? ((await res.json().catch(() => null)) as { delivery?: { bodyHtml: string | null; message: string | null } } | null) : null;
    setViewing((v) => (v ? { ...v, html: body?.delivery?.bodyHtml ?? null, message: body?.delivery?.message ?? (body ? null : "Couldn't load the message.") } : v));
  }

  const tabBtn = (key: Tab, label: string) => (
    <button
      key={key}
      type="button"
      onClick={() => setTab(key)}
      aria-pressed={tab === key}
      className={`rounded-full border px-2.5 py-0.5 text-xs ${tab === key ? "border-indigo-400 bg-indigo-50 font-semibold text-indigo-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
    >
      {label}
    </button>
  );
  const th = "px-3 py-1.5 text-left text-[11.5px] font-medium text-slate-500";
  const td = "px-3 py-2 align-top text-[12.5px]";

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {hasPreview ? tabBtn("next", `Next run${preview.data ? ` · ${preview.data.items.length} ${preview.data.items.length === 1 ? "person" : "people"}` : ""}`) : null}
        {tabBtn("sent", `Sent${sent.data ? ` · ${sent.data.deliveries.length}` : ""}`)}
        {tabBtn("runs", "Last runs")}
      </div>

      {tab === "runs" ? runs : null}

      {tab === "next" ? (
        preview.error ? <p className="m-0 text-xs text-red-700">{preview.error}</p>
        : !preview.data ? <p className="m-0 text-xs text-slate-500">Building the preview…</p>
        : (
          <>
            {preview.data.items.length === 0 ? (
              <p className="m-0 text-xs text-slate-500">Nobody would be contacted if it ran now.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <table className="w-full min-w-[760px] border-collapse">
                  <thead className="border-b border-slate-200 bg-slate-50"><tr><th className={th}>To</th><th className={th}>Company</th><th className={th}>What</th><th className={th}>Channel</th><th className={th} /></tr></thead>
                  <tbody>
                    {preview.data.items.map((it, i) => (
                      <tr key={i} className="border-b border-slate-100 last:border-0">
                        <td className={td}><span className="text-slate-900">{it.recipientName ?? "Unknown"}</span>{it.toEmail ? <span className="block text-slate-500">{it.toEmail}</span> : null}</td>
                        <td className={td}>{it.companyName ?? "·"}</td>
                        <td className={td}>{it.subject}</td>
                        <td className={td}>{it.channels.map((c) => <span key={c} className={`mr-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${CHANNEL[c].cls}`}>{CHANNEL[c].text}</span>)}</td>
                        <td className={`${td} text-right font-semibold`}>
                          <button type="button" className="text-indigo-700 hover:underline" onClick={() => setViewing({ title: it.subject, to: to(it.recipientName, it.toEmail), when: null, html: it.html, message: it.message })}>View</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-1.5 text-[11.5px] text-slate-500">Dry run from today&apos;s data: nothing is sent from this tab. {preview.data.note}</p>
          </>
        )
      ) : null}

      {tab === "sent" ? (
        sent.error ? <p className="m-0 text-xs text-red-700">{sent.error}</p>
        : !sent.data ? <p className="m-0 text-xs text-slate-500">Loading…</p>
        : sent.data.deliveries.length === 0 ? (
          <p className="m-0 text-xs text-slate-500">Nothing sent in the last 30 days. Sends are recorded from 27 Sep 2026.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full min-w-[760px] border-collapse">
              <thead className="border-b border-slate-200 bg-slate-50"><tr><th className={th}>Sent</th><th className={th}>To</th><th className={th}>What</th><th className={th}>Channel</th><th className={th}>Result</th><th className={th} /></tr></thead>
              <tbody>
                {sent.data.deliveries.map((d) => (
                  <tr key={d.id} className="border-b border-slate-100 last:border-0">
                    <td className={`${td} whitespace-nowrap tabular-nums`}>{WHEN.format(new Date(d.createdAt))}</td>
                    <td className={td}><span className="text-slate-900">{d.recipientName ?? d.toEmail ?? "Unknown"}</span>{d.recipientName && d.toEmail ? <span className="block text-slate-500">{d.toEmail}</span> : null}</td>
                    <td className={td}>{d.subject}</td>
                    <td className={td}><span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${CHANNEL[d.channel].cls}`}>{CHANNEL[d.channel].text}</span></td>
                    <td className={td}><span className={`inline-block rounded-md px-2 py-0.5 text-[11.5px] ${STATUS[d.status].cls}`} title={d.error ?? undefined}>{STATUS[d.status].text}</span></td>
                    <td className={`${td} text-right font-semibold`}><button type="button" className="text-indigo-700 hover:underline" onClick={() => void openDelivery(d)}>View</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}

      {viewing ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4" role="dialog" aria-modal="true" onClick={() => setViewing(null)}>
          <div className="flex max-h-[90vh] w-full max-w-xl flex-col rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-start justify-between gap-3">
              <h3 className="text-base font-semibold text-slate-900">{viewing.title}</h3>
              <button type="button" onClick={() => setViewing(null)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100" aria-label="Close">✕</button>
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12.5px]">
              <dt className="text-slate-500">To</dt><dd className="text-slate-900">{viewing.to}</dd>
              <dt className="text-slate-500">{viewing.when ? "Sent" : "Sends"}</dt><dd className="text-slate-900">{viewing.when ? `${viewing.when} Paris` : "On the next run, if nothing changes before then"}</dd>
              {viewing.status ? (<><dt className="text-slate-500">Result</dt><dd className="text-slate-900">{viewing.status}</dd></>) : null}
            </dl>
            {viewing.html ? (
              <iframe
                title="Email message"
                sandbox=""
                srcDoc={`<!doctype html><meta charset="utf-8"><body style="margin:0;padding:14px;font:13px/1.6 -apple-system,Segoe UI,Arial,sans-serif;color:#0f172a">${viewing.html}</body>`}
                className="mt-3 h-80 w-full flex-none rounded-lg border border-slate-200 bg-slate-50"
              />
            ) : viewing.message ? (
              <p className="mt-3 whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-3 text-[13px] text-slate-900">{viewing.message}</p>
            ) : (
              <p className="mt-3 text-xs text-slate-500">Loading…</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function to(name: string | null, email: string | null): string {
  if (name && email) return `${name} · ${email}`;
  return name ?? email ?? "Unknown";
}
