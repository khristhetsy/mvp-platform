"use client";

import { useEffect, useState } from "react";
import { arrivalLabel, type UsZone } from "@/lib/founder-outreach/us-time-zone";
import { PLATFORM_TZ, PLATFORM_TZ_LABEL } from "@/lib/time/platform-tz";

export type ReachOutEmail = {
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
  toEmail: string;
  replyTo: string | null;
  html: string;
  alsoNudge: boolean;
  createdAt: string;
};

const PARIS = new Intl.DateTimeFormat("en-GB", { timeZone: PLATFORM_TZ, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function parisTime(iso: string): string {
  return PARIS.format(new Date(iso));
}

/** "9:00 AM ET" for the founder, or null when their zone isn't known. */
export function founderTime(iso: string, zone: UsZone | null): string | null {
  return zone ? arrivalLabel(iso, zone).split(", ")[1] ?? null : null;
}

/**
 * A Reach out email in full, exactly as it will be (or was) sent. The message is
 * shown in a sandboxed frame, so nothing in it can run.
 */
export function ReachOutEmailViewer({
  detailUrl,
  onClose,
  onAction,
}: Readonly<{
  detailUrl: string;
  onClose: () => void;
  /** Send now / Cancel; resolves to an error message, or null when it worked. */
  onAction: (kind: "send-now" | "cancel") => Promise<string | null>;
}>) {
  const [email, setEmail] = useState<ReachOutEmail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "send-now" | "cancel">(null);

  useEffect(() => {
    let live = true;
    fetch(detailUrl)
      .then(async (res) => {
        const body = (await res.json().catch(() => null)) as { email?: ReachOutEmail; error?: string } | null;
        if (!live) return;
        if (res.ok && body?.email) setEmail(body.email);
        else setError(body?.error ?? "Couldn't load this email.");
      })
      .catch(() => live && setError("Couldn't load this email."));
    return () => {
      live = false;
    };
  }, [detailUrl]);

  async function run(kind: "send-now" | "cancel") {
    setBusy(kind);
    const err = await onAction(kind);
    setBusy(null);
    if (err) setError(err);
    else onClose();
  }

  const open = email && (email.status === "scheduled" || email.status === "failed");
  const ft = email ? founderTime(email.sentAt ?? email.sendAt, email.zone) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4" role="dialog" aria-modal="true">
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <h3 className="text-base font-semibold text-slate-900">{email?.subject ?? "Scheduled email"}</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100" aria-label="Close">✕</button>
        </div>
        {error ? <p className="mb-2 text-xs font-medium text-red-600">{error}</p> : null}
        {!email ? (
          !error ? <p className="text-sm text-slate-500">Loading…</p> : null
        ) : (
          <>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12.5px]">
              <dt className="text-slate-500">To</dt>
              <dd className="text-slate-900">{email.founderName} · {email.toEmail}</dd>
              <dt className="text-slate-500">From</dt>
              <dd className="text-slate-900">
                {email.via === "icapos" ? `iCapOS${email.replyTo ? `, replies to ${email.replyTo}` : ""}` : `${email.senderName}'s Gmail`}
              </dd>
              <dt className="text-slate-500">{email.status === "sent" ? "Sent" : "Sends"}</dt>
              <dd className="text-slate-900">
                {parisTime(email.sentAt ?? email.sendAt)} {PLATFORM_TZ_LABEL}{ft ? ` · ${ft}` : ""}
              </dd>
              <dt className="text-slate-500">Company</dt>
              <dd className="text-slate-900">{email.companyName}</dd>
              <dt className="text-slate-500">Scheduled by</dt>
              <dd className="text-slate-900">{email.senderName}, {parisTime(email.createdAt)}</dd>
              {email.alsoNudge ? (
                <>
                  <dt className="text-slate-500">Also</dt>
                  <dd className="text-slate-900">In-app nudge to the founder</dd>
                </>
              ) : null}
              {email.status === "failed" ? (
                <>
                  <dt className="text-slate-500">Not sent</dt>
                  <dd className="text-rose-600">{email.error ?? "unknown error"}</dd>
                </>
              ) : null}
              {email.status === "canceled" ? (
                <>
                  <dt className="text-slate-500">Status</dt>
                  <dd className="text-slate-600">Canceled</dd>
                </>
              ) : null}
            </dl>
            <iframe
              title="Email message"
              sandbox=""
              srcDoc={`<!doctype html><meta charset="utf-8"><body style="margin:0;padding:14px;font:13px/1.6 -apple-system,Segoe UI,Arial,sans-serif;color:#0f172a">${email.html}</body>`}
              className="mt-3 h-72 w-full flex-none rounded-lg border border-slate-200 bg-slate-50"
            />
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <a href={`/admin/companies/${email.companyId}`} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                Open company
              </a>
              {open ? (
                <>
                  <button type="button" disabled={busy !== null} onClick={() => void run("cancel")} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                    {busy === "cancel" ? "Canceling…" : "Cancel email"}
                  </button>
                  <button type="button" disabled={busy !== null} onClick={() => void run("send-now")} className="rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
                    {busy === "send-now" ? "Sending…" : email.status === "failed" ? "Send again" : "Send now"}
                  </button>
                </>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
