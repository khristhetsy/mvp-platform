"use client";

import { useCallback, useEffect, useState } from "react";
import { arrivalLabel, type UsZone } from "@/lib/founder-outreach/us-time-zone";

type Item = {
  id: string;
  to_email: string;
  subject: string;
  via: "icapos" | "gmail";
  send_at: string;
  status: "scheduled" | "sending" | "failed";
  error: string | null;
};

async function fetchScheduled(companyId: string): Promise<{ items?: Item[]; zone?: UsZone | null } | null> {
  const res = await fetch(`/api/admin/companies/${companyId}/reach-out`).catch(() => null);
  if (!res?.ok) return null;
  return (await res.json().catch(() => null)) as { items?: Item[]; zone?: UsZone | null } | null;
}

function localTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/**
 * Reach out emails scheduled for this company and not sent yet, with Send now and
 * Cancel. Hidden when there are none. Refreshes when the Reach out window schedules one.
 */
export function ScheduledReachOuts({ companyId, founderName }: Readonly<{ companyId: string; founderName: string }>) {
  const [items, setItems] = useState<Item[]>([]);
  const [zone, setZone] = useState<UsZone | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const apply = useCallback((j: { items?: Item[]; zone?: UsZone | null } | null) => {
    if (!j) return;
    setItems(j.items ?? []);
    setZone(j.zone ?? null);
  }, []);

  const load = useCallback(() => fetchScheduled(companyId).then(apply), [companyId, apply]);

  useEffect(() => {
    let live = true;
    fetchScheduled(companyId).then((j) => { if (live) apply(j); });
    const onScheduled = (e: Event) => {
      if ((e as CustomEvent<{ companyId: string }>).detail?.companyId === companyId) void load();
    };
    window.addEventListener("reach-out-scheduled", onScheduled);
    return () => {
      live = false;
      window.removeEventListener("reach-out-scheduled", onScheduled);
    };
  }, [companyId, apply, load]);

  async function act(id: string, action: "send-scheduled-now" | "cancel-scheduled") {
    setBusy(id + action);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/companies/${companyId}/reach-out`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, scheduledId: id }),
      });
      const j = await res.json().catch(() => ({}));
      setMessage(res.ok ? (action === "cancel-scheduled" ? "Scheduled email canceled." : "Email sent.") : (j.error ?? "Something went wrong."));
      await load();
    } finally {
      setBusy(null);
    }
  }

  if (items.length === 0 && !message) return null;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-2">
        <i className="ti ti-calendar-time text-sky-700" aria-hidden="true" />
        <h3 className="text-sm font-semibold text-slate-900">Scheduled emails</h3>
        {message ? <span className="ml-auto text-[11.5px] font-medium text-indigo-700">{message}</span> : null}
      </div>
      <div className="space-y-2">
        {items.map((it) => (
          <div key={it.id} className="flex flex-wrap items-start gap-3 rounded-lg border border-slate-200 px-3 py-2.5">
            <span className={`mt-1.5 h-2 w-2 flex-none rounded-full ${it.status === "failed" ? "bg-rose-500" : "bg-indigo-500"}`} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-slate-900">{it.subject}</p>
              <p className="text-[12px] text-slate-500">
                To {founderName} · {localTime(it.send_at)} your time
                {zone ? ` (${arrivalLabel(it.send_at, zone).split(", ")[1]})` : ""} · with {it.via === "icapos" ? "iCapOS" : "your Gmail"}
              </p>
              {it.status === "failed" ? <p className="text-[12px] text-rose-600">Not sent: {it.error ?? "unknown error"}</p> : null}
              {it.status === "sending" ? <p className="text-[12px] text-slate-500">Sending…</p> : null}
            </div>
            {it.status !== "sending" ? (
              <div className="flex gap-3 whitespace-nowrap text-[12px] font-semibold">
                <button type="button" disabled={busy !== null} onClick={() => void act(it.id, "send-scheduled-now")} className="text-indigo-700 hover:underline disabled:opacity-50">
                  {busy === it.id + "send-scheduled-now" ? "Sending…" : "Send now"}
                </button>
                <button type="button" disabled={busy !== null} onClick={() => void act(it.id, "cancel-scheduled")} className="text-slate-500 hover:underline disabled:opacity-50">
                  Cancel
                </button>
              </div>
            ) : null}
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11.5px] text-slate-400">Once sent it moves to the company timeline, like any other reach out.</p>
    </section>
  );
}
