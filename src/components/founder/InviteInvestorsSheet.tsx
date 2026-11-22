"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { MAX_INVITES_PER_SEND, parseInviteEmails } from "@/lib/data-room/invite-emails";

type Result = { email: string; ok: boolean; error?: string };

/**
 * Invite investors into the data room. The button is greyed out until the one
 * pager is published, with the reason shown. Each email goes through the existing
 * data room access endpoint, which also sends the invitation email.
 */
export function InviteInvestorsSheet({
  canInvite,
  variant = "primary",
}: {
  canInvite: boolean;
  variant?: "primary" | "compact";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [raw, setRaw] = useState("");
  const [expiry, setExpiry] = useState("30");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<Result[] | null>(null);

  const { valid, invalid } = parseInviteEmails(raw);
  const tooMany = valid.length > MAX_INVITES_PER_SEND;

  function close() {
    if (sending) return;
    setOpen(false);
    if (results?.some((r) => r.ok)) router.refresh();
    setResults(null);
    setRaw("");
    setMessage("");
  }

  async function send() {
    if (sending || valid.length === 0 || tooMany) return;
    setSending(true);
    const out: Result[] = [];
    for (const email of valid) {
      try {
        const res = await fetch("/api/founder/data-room/access", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            expiresInDays: expiry === "0" ? null : Number(expiry),
            ...(message.trim() ? { message: message.trim() } : {}),
          }),
        });
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        out.push(res.ok ? { email, ok: true } : { email, ok: false, error: data?.error ?? "Could not invite." });
      } catch {
        out.push({ email, ok: false, error: "Network error." });
      }
    }
    setResults(out);
    setSending(false);
  }

  const trigger =
    variant === "primary"
      ? "w-full rounded-xl px-5 py-3 text-sm font-semibold sm:w-auto"
      : "rounded-lg px-4 py-2 text-xs font-semibold";

  return (
    <>
      <div className={variant === "primary" ? "flex flex-col items-center" : ""}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={!canInvite}
          className={`${trigger} ${canInvite ? "bg-indigo-600 text-white hover:bg-indigo-500" : "cursor-not-allowed bg-slate-200 text-slate-400"}`}
        >
          Invite investors
        </button>
        {!canInvite ? (
          <p className="mt-1.5 text-xs text-amber-700">Publish your one pager first to invite investors.</p>
        ) : null}
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/45 sm:items-center" onClick={close}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Invite investors to your data room"
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded bg-slate-300 sm:hidden" />
            <h2 className="text-base font-bold text-slate-900">Invite investors to your data room</h2>
            <p className="mt-1 text-xs text-slate-600">
              They receive an email with a link to your one pager. Investors need an iCapOS investor account.
            </p>

            {results ? (
              <div className="mt-4 space-y-2">
                {results.map((r) => (
                  <p key={r.email} className={`text-sm ${r.ok ? "text-emerald-700" : "text-red-700"}`}>
                    {r.ok ? "Invited " : "Not invited "}
                    <span className="font-medium">{r.email}</span>
                    {r.ok ? "" : `: ${r.error}`}
                  </p>
                ))}
                <button
                  type="button"
                  onClick={close}
                  className="mt-3 w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-500"
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                <label className="mt-4 block text-xs font-bold text-slate-800" htmlFor="invite-emails">
                  Investor emails
                </label>
                <textarea
                  id="invite-emails"
                  value={raw}
                  onChange={(e) => setRaw(e.target.value)}
                  rows={3}
                  placeholder="Add one or more emails, separated by commas or new lines"
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
                {valid.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {valid.map((e) => (
                      <span key={e} className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                        {e}
                      </span>
                    ))}
                  </div>
                ) : null}
                {invalid.length > 0 ? (
                  <p className="mt-2 text-xs text-red-700">Not an email: {invalid.join(", ")}</p>
                ) : null}
                {tooMany ? <p className="mt-2 text-xs text-red-700">Invite up to {MAX_INVITES_PER_SEND} investors at a time.</p> : null}

                <label className="mt-4 block text-xs font-bold text-slate-800" htmlFor="invite-expiry">
                  How long they have access
                </label>
                <select
                  id="invite-expiry"
                  value={expiry}
                  onChange={(e) => setExpiry(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="7">7 days</option>
                  <option value="14">14 days</option>
                  <option value="30">30 days</option>
                  <option value="90">90 days</option>
                  <option value="0">No expiry</option>
                </select>

                <label className="mt-4 block text-xs font-bold text-slate-800" htmlFor="invite-message">
                  Personal message (optional)
                </label>
                <textarea
                  id="invite-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  maxLength={1000}
                  placeholder="Hi, we are raising our seed round and would value your view."
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />

                <button
                  type="button"
                  onClick={send}
                  disabled={sending || valid.length === 0 || tooMany}
                  className="mt-4 w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  {sending ? "Sending..." : valid.length > 0 ? `Send ${valid.length} invite${valid.length === 1 ? "" : "s"}` : "Send invites"}
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
