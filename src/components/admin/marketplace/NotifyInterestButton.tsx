"use client";

import { useState, useTransition } from "react";
import { notifyInterestList } from "@/app/admin/marketplace/actions";

export function NotifyInterestButton({
  listingId,
  interestCount,
}: Readonly<{ listingId: string; interestCount: number }>) {
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run() {
    if (!window.confirm("Notify everyone who expressed interest that this offering is live on its portal?")) return;
    setMsg(null);
    setErr(null);
    startTransition(async () => {
      const res = await notifyInterestList(listingId);
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      setMsg(
        res.live
          ? `Sent to ${res.sent} of ${res.intended} interested ${res.intended === 1 ? "person" : "people"}.`
          : `Email delivery is off (counsel-pending). ${res.intended} ${res.intended === 1 ? "person is" : "people are"} on the interest list and would be notified when enabled.`,
      );
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={run}
        disabled={pending || interestCount === 0}
        className="rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
      >
        {pending ? "Notifying…" : `Notify interest list (${interestCount})`}
      </button>
      {msg ? <span className="text-[11px] text-emerald-700">{msg}</span> : null}
      {err ? <span className="text-[11px] text-red-600">{err}</span> : null}
    </div>
  );
}
