"use client";

import { useState } from "react";
import { Clock, Mail } from "lucide-react";
import { FollowUpGuide } from "@/components/founder/FollowUpGuide";
import type { FounderFollowUpRow } from "@/lib/icfo-events/introductions-server";

const MAX = 2;

/** "today, 7:12 AM" for today, otherwise "Nov 21, 7:12 AM". Local to the viewer. */
function stampLabel(iso: string): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (d.toDateString() === new Date().toDateString()) return `today, ${time}`;
  const day = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${day}, ${time}`;
}

function lastSentLabel(iso: string | null): string {
  return iso ? `Last sent ${stampLabel(iso)}` : "Not sent yet";
}

type Row = Pick<FounderFollowUpRow, "introId" | "investorName" | "investorCompany" | "followUps" | "lastFollowUpAt" | "scheduledAt" | "canFollowUp" | "linkExpired" | "linkRequestedAt">;

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

  async function sendNewLink(id: string) {
    setBusy(id);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/founder/event-follow-ups/new-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ introId: id }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; lastFollowUpAt?: string };
      if (!res.ok) {
        setError(body.error ?? "Could not send a new link.");
        return;
      }
      const target = rows.find((r) => r.introId === id);
      setNotice(`New link sent to ${target?.investorName ?? "the investor"}`);
      setRows((rs) =>
        rs.map((r) =>
          r.introId === id
            ? { ...r, linkExpired: false, lastFollowUpAt: body.lastFollowUpAt ?? new Date().toISOString() }
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
          <div key={r.introId} className="px-4 py-3">
            <div className="flex items-center justify-between gap-3">
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
                    {r.linkExpired ? (
                      <span className="rounded bg-rose-50 px-2 py-0.5 text-xs text-rose-800">Link expired</span>
                    ) : (
                      <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">No time yet</span>
                    )}
                    <span className="text-xs text-slate-500">
                      {r.followUps} of {MAX}
                    </span>
                    {r.linkExpired ? (
                      <button
                        type="button"
                        disabled={busy === r.introId}
                        onClick={() => sendNewLink(r.introId)}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Mail className="h-3 w-3" aria-hidden="true" />
                        {busy === r.introId ? "Sending" : "Send new link"}
                      </button>
                    ) : r.followUps >= MAX ? (
                      <span className="text-xs text-slate-500">Follow up limit reached</span>
                    ) : (
                      <button
                        type="button"
                        disabled={!r.canFollowUp || busy === r.introId}
                        onClick={() => followUp(r.introId)}
                        className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Mail className="h-3 w-3" aria-hidden="true" />
                        {busy === r.introId ? "Sending" : "Follow up"}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
            {!r.scheduledAt && r.linkExpired && (
              <p className="mt-1 text-xs text-slate-400">Does not count as a follow up.</p>
            )}
            {!r.scheduledAt && r.linkRequestedAt && (
              <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600" suppressHydrationWarning>
                <Clock className="h-3 w-3" aria-hidden="true" />
                Investor requested a new link, {stampLabel(r.linkRequestedAt)}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
