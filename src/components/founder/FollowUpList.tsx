"use client";

import { useState } from "react";
import { Mail } from "lucide-react";
import { FollowUpGuide } from "@/components/founder/FollowUpGuide";
import type { FounderFollowUpRow } from "@/lib/icfo-events/introductions-server";

const MAX = 2;

/** "today, 7:12 AM" for today, otherwise "Nov 21, 7:12 AM". Local to the viewer. */
function lastSentLabel(iso: string | null): string {
  if (!iso) return "Not sent yet";
  const d = new Date(iso);
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (d.toDateString() === new Date().toDateString()) return `Last sent today, ${time}`;
  const day = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `Last sent ${day}, ${time}`;
}

type Row = Pick<FounderFollowUpRow, "introId" | "investorName" | "investorCompany" | "followUps" | "lastFollowUpAt" | "scheduledAt" | "canFollowUp">;

export function FollowUpList({ rows: initial, anySent }: { rows: Row[]; anySent: boolean }) {
  const [rows, setRows] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(anySent);
  const [notice, setNotice] = useState<string | null>(null);

  const toFollow = rows.filter((r) => !r.scheduledAt).length;
  const booked = rows.filter((r) => r.scheduledAt).length;

  async function followUp(id: string) {
    setBusy(id);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/founder/event-follow-ups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ introId: id }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; followUps?: number; lastFollowUpAt?: string };
      if (!res.ok) {
        setError(body.error ?? "Could not send the follow up.");
        return;
      }
      setSent(true);
      const target = rows.find((r) => r.introId === id);
      setNotice(`Follow up sent to ${target?.investorName ?? "the investor"}`);
      setRows((rs) =>
        rs.map((r) =>
          r.introId === id
            ? {
                ...r,
                followUps: body.followUps ?? r.followUps + 1,
                lastFollowUpAt: body.lastFollowUpAt ?? new Date().toISOString(),
                canFollowUp: (body.followUps ?? r.followUps + 1) < MAX,
              }
            : r,
        ),
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <FollowUpGuide key={sent ? "sent" : "new"} defaultOpen={!sent} />

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs text-slate-500">To follow up</p>
          <p className="text-xl font-semibold text-slate-900">{toFollow}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs text-slate-500">Booked</p>
          <p className="text-xl font-semibold text-slate-900">{booked}</p>
        </div>
      </div>

      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      {notice && (
        <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {notice}
        </p>
      )}

      <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
        {rows.map((r) => (
          <div key={r.introId} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900">{r.investorName}</p>
              {r.investorCompany && <p className="truncate text-xs text-slate-500">{r.investorCompany}</p>}
              {!r.scheduledAt && (
                <p className="truncate text-xs text-slate-400" suppressHydrationWarning>
                  {lastSentLabel(r.lastFollowUpAt)}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-3">
              {r.scheduledAt ? (
                <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">Booked</span>
              ) : (
                <>
                  <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">No time yet</span>
                  <span className="text-xs text-slate-500">
                    {r.followUps} of {MAX}
                  </span>
                  <button
                    type="button"
                    disabled={!r.canFollowUp || busy === r.introId}
                    onClick={() => followUp(r.introId)}
                    className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Mail className="h-3 w-3" aria-hidden="true" />
                    {busy === r.introId ? "Sending" : "Follow up"}
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
