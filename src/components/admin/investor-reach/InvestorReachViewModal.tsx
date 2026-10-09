"use client";

/**
 * View for one Investor reach row: the emails actually sent to the investor
 * (full body as delivered, with sent, delivered, opened and clicked times) and
 * the replies actually received, oldest first, as one thread.
 */
import Link from "next/link";
import { useEffect, useState } from "react";
import { emailResult } from "@/lib/email/email-log-labels";
import type { EmailLogDetail } from "@/lib/email/email-log";
import type { ReachRow, ReceivedMail } from "@/lib/admin/investor-reach";
import { PLATFORM_TZ, PLATFORM_TZ_LABEL } from "@/lib/time/platform-tz";

const WHEN = new Intl.DateTimeFormat("en-US", { timeZone: PLATFORM_TZ, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const when = (iso: string | null | undefined) => (iso ? `${WHEN.format(new Date(iso))} ${PLATFORM_TZ_LABEL}` : "");

type Item = { kind: "sent"; at: string; mail: EmailLogDetail } | { kind: "received"; at: string; mail: ReceivedMail };

const CARD_LABEL = { intro: "Introduction", auto: "Automated outreach", manual: "Manual outreach" } as const;

export function InvestorReachViewModal({ row, onClose }: Readonly<{ row: ReachRow; onClose: () => void }>) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const qs = new URLSearchParams({ ids: row.mailIds.join(","), email: row.email ?? "", since: row.since ?? "" });
    let live = true;
    fetch(`/api/admin/investor-reach/view?${qs.toString()}`)
      .then(async (r) => {
        const d = (await r.json().catch(() => null)) as { sent?: EmailLogDetail[]; received?: ReceivedMail[]; error?: string } | null;
        if (!live) return;
        if (!r.ok || !d) return setError(d?.error ?? "Could not load the emails.");
        const list: Item[] = [
          ...(d.sent ?? []).map((m) => ({ kind: "sent" as const, at: m.createdAt, mail: m })),
          ...(d.received ?? []).map((m) => ({ kind: "received" as const, at: m.at, mail: m })),
        ].sort((a, b) => a.at.localeCompare(b.at));
        setItems(list);
      })
      .catch(() => live && setError("Could not load the emails."));
    return () => {
      live = false;
    };
  }, [row]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const subject = items?.find((i) => i.kind === "sent")?.mail.subject ?? `${CARD_LABEL[row.card]}: ${row.name}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4" role="dialog" aria-modal="true" aria-label="Email" onClick={onClose}>
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-start justify-between gap-3">
          <h3 className="text-base font-semibold text-slate-900">{subject}</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100" aria-label="Close">
            ✕
          </button>
        </div>
        <p className="mb-3 text-[12px] text-slate-500">
          {CARD_LABEL[row.card]}
          {row.step ? ` · step ${row.step}` : ""} · {row.name}
          {row.email ? ` <${row.email}>` : ""}
          {row.companyName ? ` · for ${row.companyName}` : ""}
          {items ? ` · ${items.length} message${items.length === 1 ? "" : "s"}` : ""}
        </p>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          {error ? <p className="text-sm text-rose-700">{error}</p> : null}
          {!items && !error ? <p className="text-xs text-slate-500">Loading…</p> : null}
          {items && items.length === 0 ? (
            <p className="text-xs text-slate-500">
              {row.repliedAt
                ? `Replied ${when(row.repliedAt)}. The reply went to an inbox outside iCapOS, so it isn't stored here.`
                : "No stored email for this row."}
            </p>
          ) : null}
          {items?.map((it, i) =>
            it.kind === "sent" ? (
              <div key={`s${i}`} className="border-l-[3px] border-indigo-500 pl-3">
                <p className="text-[12px] text-slate-700">
                  <span className="mr-1.5 inline-block rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">Sent</span>
                  to {it.mail.recipientName ? `${it.mail.recipientName} · ` : ""}
                  {it.mail.toEmail}
                </p>
                <dl className="mt-1.5 grid grid-cols-[90px_1fr] gap-x-3 gap-y-0.5 text-[12px]">
                  <dt className="text-slate-500">Subject</dt>
                  <dd className="text-slate-900">{it.mail.subject}</dd>
                  <dt className="text-slate-500">Sent</dt>
                  <dd className="text-slate-900">{when(it.mail.createdAt)}</dd>
                  <dt className="text-slate-500">Result</dt>
                  <dd className="text-slate-900">
                    {emailResult(it.mail).text}
                    <span className="text-slate-500"> · {emailResult(it.mail).hint}</span>
                  </dd>
                  {(
                    [
                      ["Delivered", it.mail.deliveredAt],
                      ["Opened", it.mail.openedAt],
                      ["Clicked", it.mail.clickedAt],
                      ["Bounced", it.mail.bouncedAt],
                    ] as Array<[string, string | null]>
                  )
                    .filter(([, at]) => at)
                    .map(([label, at]) => (
                      <div key={label} className="contents">
                        <dt className="text-slate-500">{label}</dt>
                        <dd className="text-slate-900">{when(at)}</dd>
                      </div>
                    ))}
                </dl>
                <Body html={it.mail.html} text={it.mail.text} />
              </div>
            ) : (
              <div key={`r${i}`} className="border-l-[3px] border-emerald-500 pl-3">
                <p className="text-[12px] text-slate-700">
                  <span className="mr-1.5 inline-block rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">Received</span>
                  from {it.mail.from}
                </p>
                <dl className="mt-1.5 grid grid-cols-[90px_1fr] gap-x-3 gap-y-0.5 text-[12px]">
                  {it.mail.subject ? (
                    <>
                      <dt className="text-slate-500">Subject</dt>
                      <dd className="text-slate-900">{it.mail.subject}</dd>
                    </>
                  ) : null}
                  <dt className="text-slate-500">Received</dt>
                  <dd className="text-slate-900">
                    {when(it.mail.at)}
                    {it.mail.via === "forwarded" ? <span className="text-slate-500"> · as forwarded to the founder</span> : null}
                  </dd>
                </dl>
                <Body html={it.mail.html} text={it.mail.text} />
              </div>
            ),
          )}
          {items && items.length > 0 && row.repliedAt && !items.some((i) => i.kind === "received") ? (
            <p className="text-xs text-slate-500">Replied {when(row.repliedAt)}. The reply went to an inbox outside iCapOS, so it isn&apos;t stored here.</p>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          {row.email ? (
            <Link href={`/admin/activity/sent?q=${encodeURIComponent(row.email)}`} className="rounded-lg border border-slate-300 px-3 py-1.5 text-[12.5px] font-semibold text-slate-700 hover:bg-slate-50">
              Open in Sent emails
            </Link>
          ) : null}
          {row.contactId ? (
            <Link href={`/admin/sales/contacts/${row.contactId}`} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-[12.5px] font-semibold text-white hover:bg-indigo-700">
              Reply from contact record
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Body({ html, text }: Readonly<{ html: string | null; text: string | null }>) {
  if (html) return <iframe title="Email message" sandbox="" srcDoc={html} className="mt-2 h-[22rem] w-full rounded-lg border border-slate-200 bg-slate-50" />;
  if (text) return <p className="mt-2 max-h-[22rem] overflow-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-3 text-[13px] text-slate-900">{text}</p>;
  return <p className="mt-2 text-xs text-slate-500">The body isn&apos;t stored for this email.</p>;
}
