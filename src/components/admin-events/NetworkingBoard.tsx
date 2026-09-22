"use client";

import { useMemo, useState } from "react";
import type { MatchPair, NetworkingBoard as Board } from "@/lib/icfo-events/networking-board";

const I = "rounded-md border border-[var(--border-subtle)] px-2.5 py-1.5 text-xs";

const STATUS: Record<MatchPair["status"], { label: string; cls: string }> = {
  none: { label: "No request", cls: "bg-slate-100 text-slate-600" },
  requested: { label: "Awaiting answer", cls: "bg-amber-50 text-amber-700" },
  accepted: { label: "Accepted", cls: "bg-emerald-50 text-emerald-700" },
  declined: { label: "Declined", cls: "bg-rose-50 text-rose-700" },
};

function Stat({ n, label, warn }: Readonly<{ n: number; label: string; warn?: boolean }>) {
  return (
    <span className={`rounded-lg border px-3 py-2 ${warn ? "border-amber-200 bg-amber-50" : "border-[var(--border-subtle)] bg-white"}`}>
      <b className={`block text-[17px] leading-none ${warn ? "text-amber-700" : "text-[var(--navy)]"}`}>{n}</b>
      <span className="mt-0.5 block text-[10.4px] text-[var(--text-muted)]">{label}</span>
    </span>
  );
}

function Who({ side }: Readonly<{ side: MatchPair["a"] }>) {
  const role = side.role.toLowerCase();
  return (
    <span className="min-w-0">
      <span className="block truncate font-medium text-[var(--navy)]">{side.name}</span>
      <span className={`mt-0.5 inline-block rounded px-1.5 py-px text-[9px] font-bold uppercase tracking-wide ${
        role === "investor" ? "bg-blue-50 text-blue-700" : role === "founder" ? "bg-violet-50 text-violet-700" : "bg-slate-100 text-slate-500"
      }`}>
        {side.role || "—"}
      </span>
    </span>
  );
}

/**
 * Who matched with whom at one event.
 *
 * Filtered in the browser: matches are recomputed server-side on each load and
 * the whole set is already on the page, so a round-trip per keystroke would
 * buy nothing.
 */
export function NetworkingBoard({ board, events, eventId }: Readonly<{
  board: Board;
  events: { id: string; title: string }[];
  eventId: string;
}>) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return board.pairs.filter((p) => {
      if (status && p.status !== status) return false;
      if (!needle) return true;
      return [p.a.name, p.b.name, ...p.sharedInterests].join(" ").toLowerCase().includes(needle);
    });
  }, [board.pairs, q, status]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Stat n={board.optedIn} label={`opted in of ${board.registered}`} />
        <Stat n={board.counts.matches} label="matches found" />
        <Stat n={board.counts.requested} label="awaiting an answer" warn={board.counts.requested > 0} />
        <Stat n={board.counts.accepted} label="accepted" />
        <Stat n={board.counts.declined} label="declined" />
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-white">
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border-subtle)] px-3.5 py-2.5">
          <select
            value={eventId}
            onChange={(e) => { window.location.href = `/admin/events/networking?eventId=${e.target.value}`; }}
            className={I}
          >
            {events.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
          </select>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search either side, or a sector…"
            className={`${I} min-w-[180px] flex-1`} />
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={I}>
            <option value="">All statuses</option>
            <option value="none">No request</option>
            <option value="requested">Awaiting answer</option>
            <option value="accepted">Accepted</option>
            <option value="declined">Declined</option>
          </select>
          <span className="text-[11.5px] text-[var(--text-muted)]">
            {shown.length === board.pairs.length ? `${board.pairs.length}` : `${shown.length} of ${board.pairs.length}`}
          </span>
        </div>

        {shown.length === 0 ? (
          <p className="px-3.5 py-8 text-center text-sm text-[var(--text-muted)]">
            {board.optedIn === 0
              ? "Nobody has opted into networking for this event yet."
              : board.pairs.length === 0
                ? "Nobody shares a sector, and there is no founder–investor pairing to suggest."
                : "No match matches that search."}
          </p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-left text-[10.4px] uppercase tracking-wide text-[var(--text-muted)]">
                <th className="px-3.5 py-2 font-bold">Investor</th>
                <th className="px-3.5 py-2 font-bold">Founder</th>
                <th className="px-3.5 py-2 font-bold">Why matched</th>
                <th className="px-3.5 py-2 font-bold">Score</th>
                <th className="px-3.5 py-2 font-bold">Status</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => (
                <tr key={p.key} className="border-t border-[var(--border-subtle)]">
                  <td className="px-3.5 py-2"><Who side={p.a} /></td>
                  <td className="px-3.5 py-2"><Who side={p.b} /></td>
                  <td className="px-3.5 py-2 text-[10.8px] text-[var(--text-muted)]">
                    {p.sharedInterests.length ? p.sharedInterests.join(", ") : "complementary roles only"}
                  </td>
                  <td className="px-3.5 py-2 font-bold tabular-nums text-[var(--navy)]">{p.score}</td>
                  <td className="px-3.5 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS[p.status].cls}`}>
                      {STATUS[p.status].label}
                    </span>
                    {p.requestedBy ? (
                      <span className="mt-0.5 block text-[10px] text-[var(--text-muted)]">
                        requested by {p.requestedBy === p.a.profileId ? p.a.name : p.b.name}
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="rounded-lg border border-dashed border-amber-200 bg-amber-50/60 px-3.5 py-2.5 text-[11.8px] text-amber-900">
        <b>Read-only for now.</b> Connection requests come from attendees, in the app — nothing here sends an
        invitation, and no email goes out when a request is made. Matches are recomputed on every load rather than
        stored, so a score can move as people edit their sectors. Staff-sent invitations and founder follow-ups are
        the next build.
      </p>
    </div>
  );
}
