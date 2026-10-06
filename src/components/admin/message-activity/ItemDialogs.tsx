"use client";

import { useEffect, useState } from "react";
import type { EmailLogDetail } from "@/lib/email/email-log";
import {
  SENT_COLUMNS,
  localDay,
  localTime,
  shortDay,
  longDay,
  sourceLabel,
  type MessagePerson,
  type ReceivedItem,
  type SentItem,
} from "@/lib/analytics/message-activity-metrics";

export type OpenList = {
  title: string;
  /** null = every person currently in the table. */
  person: MessagePerson | null;
  side: "received" | "sent";
  received: ReceivedItem[];
  sent: SentItem[];
};

type Open = { kind: "received"; item: ReceivedItem } | { kind: "sent"; item: SentItem };

const LIMIT = 500;

function StatusPill({ status }: { status: string }) {
  const good = ["sent", "read", "contacted", "completed"].includes(status);
  const bad = ["dismissed", "failed", "bounced"].includes(status);
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${
        good ? "bg-emerald-50 text-emerald-700" : bad ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"
      }`}
    >
      {status}
    </span>
  );
}

function when(iso: string) {
  return `${shortDay(localDay(iso))} ${localTime(iso)}`;
}

/**
 * Two layers over the page: a list of the items behind a number, and one item in
 * full (the email exactly as sent, or the notification text). "Back to list"
 * returns from the item to the list it came from.
 */
export function ItemDialogs({
  list,
  onClose,
  people,
  periodText,
}: Readonly<{
  list: OpenList | null;
  onClose: () => void;
  people: Map<string, MessagePerson>;
  periodText: string;
}>) {
  const [open, setOpen] = useState<Open | null>(null);
  const [email, setEmail] = useState<{ id: number; detail: EmailLogDetail | null; failed: boolean } | null>(null);

  // A new list starts at the list, not at an item left open from the last one.
  const [shown, setShown] = useState<OpenList | null>(list);
  if (shown !== list) {
    setShown(list);
    setOpen(null);
  }

  const emailId = open ? open.item.emailId : null;
  useEffect(() => {
    if (!emailId) return;
    let live = true;
    fetch(`/api/admin/email-log?id=${emailId}`)
      .then((r) => r.json())
      .then((d: { email?: EmailLogDetail }) => { if (live) setEmail({ id: emailId, detail: d.email ?? null, failed: !d.email }); })
      .catch(() => { if (live) setEmail({ id: emailId, detail: null, failed: true }); });
    return () => { live = false; };
  }, [emailId]);

  useEffect(() => {
    if (!list) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (open) setOpen(null);
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [list, open, onClose]);

  if (!list) return null;

  const items: Array<ReceivedItem | SentItem> = list.side === "received" ? list.received : list.sent;
  const showWho = !list.person;
  const th = "px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500";
  const loaded = emailId && email?.id === emailId ? email : null;

  const meta: Array<[string, string]> = [];
  let heading = list.title + (list.person ? ` · ${list.person.company ?? list.person.name}` : " · everyone in the table");
  let body: React.ReactNode = null;

  if (!open) {
    if (list.person) meta.push(["Person", `${list.person.name} <${list.person.email}>`], ["Plan", list.person.role === "investor" ? "Investor" : list.person.plan]);
    meta.push(["Period", periodText], ["Items", String(items.length)]);
    body = items.length ? (
      <>
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full border-collapse text-[13px]">
            <thead className="bg-slate-50">
              <tr>
                <th className={th}>Date</th>
                {showWho ? <th className={th}>Company</th> : null}
                <th className={th}>{list.side === "received" ? "What" : "Investor"}</th>
                {list.side === "sent" ? <th className={th}>Subject</th> : null}
                <th className={th}>Status</th>
                <th className={th} />
              </tr>
            </thead>
            <tbody>
              {items.slice(0, LIMIT).map((it) => {
                const p = people.get(it.personKey);
                return (
                  <tr key={it.id} className="border-t border-slate-100">
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-[12px] text-slate-500">{when(it.at)}</td>
                    {showWho ? <td className="px-3 py-2 text-slate-700">{p?.company ?? p?.name ?? "Unknown"}</td> : null}
                    {"channel" in it ? (
                      <td className="px-3 py-2">
                        <span className="text-slate-900">{it.title}</span>
                        <span className="block text-[11.5px] text-slate-500">
                          {sourceLabel(it.source)} · {it.channel === "email" ? "email" : "in app"}
                        </span>
                      </td>
                    ) : (
                      <>
                        <td className="px-3 py-2">
                          <span className="text-slate-900">{it.investor}</span>
                          {it.investorEmail ? <span className="block font-mono text-[11px] text-slate-500">{it.investorEmail}</span> : null}
                        </td>
                        <td className="px-3 py-2 text-slate-700">{it.title}</td>
                      </>
                    )}
                    <td className="px-3 py-2"><StatusPill status={it.status} /></td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => setOpen("channel" in it ? { kind: "received", item: it } : { kind: "sent", item: it })}
                        className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-[#1A6CE4] hover:bg-slate-50"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {items.length > LIMIT ? <p className="mt-2 text-xs text-slate-500">Showing the latest {LIMIT} of {items.length}. Narrow the period to see the rest.</p> : null}
      </>
    ) : (
      <p className="rounded-lg border border-slate-200 p-6 text-center text-xs text-slate-500">Nothing of this type in this period.</p>
    );
  } else {
    const it = open.item;
    const p = people.get(it.personKey);
    heading = it.title || "(no subject)";
    if (open.kind === "received") {
      const r = open.item;
      meta.push(
        ["To", p ? `${p.name} <${p.email}>` : "Unknown"],
        ["Company", p?.company ?? "None on file"],
        ["Sent", `${longDay(localDay(r.at))} ${localTime(r.at)} Pacific`],
        ["Channel", r.channel === "email" ? "Email" : "In-app notification"],
        ["Type", sourceLabel(r.source)],
        ["Status", r.status],
      );
      if (r.link) meta.push(["Opens", r.link]);
    } else {
      const s = open.item;
      meta.push(
        ["For founder", p ? `${p.name}${p.company ? ` · ${p.company}` : ""}` : "Unknown"],
        ["Investor", s.investor + (s.investorEmail ? ` <${s.investorEmail}>` : "")],
        ["Date", `${longDay(localDay(s.at))} ${localTime(s.at)} Pacific`],
        ["Type", SENT_COLUMNS.find((c) => c.kind === s.kind)?.label ?? s.kind],
        ["Status", s.status],
      );
      if (s.handledAt) meta.push(["Handled by iCFO", `${longDay(localDay(s.handledAt))} ${localTime(s.handledAt)} Pacific`]);
    }
    const text = open.kind === "received" ? open.item.message : open.item.detail;
    body = (
      <>
        <button type="button" onClick={() => setOpen(null)} className="mb-3 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">
          <i className="ti ti-chevron-left" aria-hidden="true" /> Back to list ({items.length})
        </button>
        {it.emailId ? (
          !loaded ? (
            <p className="text-xs text-slate-500">Loading the email…</p>
          ) : loaded.detail?.html ? (
            <iframe title="Email message" sandbox="" srcDoc={loaded.detail.html} className="h-[26rem] w-full rounded-lg border border-slate-200 bg-slate-50" />
          ) : loaded.detail?.text ? (
            <p className="max-h-[26rem] overflow-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-3 text-[13px] text-slate-900">{loaded.detail.text}</p>
          ) : (
            <p className="text-xs text-slate-500">{loaded.failed ? "The email couldn't be loaded. Try again in a moment." : "No body is stored for this email."}</p>
          )
        ) : (
          <p className="whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-3 text-[13px] text-slate-800">
            {text || (open.kind === "received" ? "This notification has no message beyond its title." : "No further detail is stored.")}
          </p>
        )}
      </>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={heading}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-xl">
        <div className="border-b border-slate-100 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-base font-semibold text-slate-900">{heading}</h3>
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-500 hover:bg-slate-50" aria-label="Close">
              <i className="ti ti-x" aria-hidden="true" />
            </button>
          </div>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[12.5px]">
            {meta.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-slate-500">{k}</dt>
                <dd className="break-words text-slate-900">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="overflow-y-auto px-5 py-4">{body}</div>
      </div>
    </div>
  );
}
