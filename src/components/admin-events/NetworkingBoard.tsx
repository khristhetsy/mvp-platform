"use client";

import { useMemo, useState } from "react";
import type { MatchPair, NetworkingBoard as Board } from "@/lib/icfo-events/networking-board";

const I = "rounded-md border border-[var(--border-subtle)] px-2.5 py-1.5 text-xs";

const STATUS: Record<MatchPair["status"], { label: string; cls: string }> = {
  none: { label: "Not introduced", cls: "bg-slate-100 text-slate-600" },
  requested: { label: "Awaiting investor", cls: "bg-amber-50 text-amber-700" },
  // Accepted and unscheduled is a stall, not a finish line — the investor said
  // yes and is waiting on the founder, so it is coloured like a thing to do.
  accepted: { label: "Founder hasn't set a time", cls: "bg-amber-50 text-amber-700" },
  scheduled: { label: "Scheduled", cls: "bg-emerald-50 text-emerald-700" },
  declined: { label: "Declined", cls: "bg-rose-50 text-rose-700" },
};

const MAX_PER_INVESTOR = 25;

/** The founder's slot, in the reader's own timezone. */
function slotLabel(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
    });
  } catch {
    return "scheduled";
  }
}

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
      {side.company ? <span className="block truncate text-[10px] text-[var(--text-muted)]">{side.company}</span> : null}
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
export function NetworkingBoard({ board, events, eventId, gmail }: Readonly<{
  board: Board;
  events: { id: string; title: string }[];
  eventId: string;
  /** Offered as a sender only when it can actually send. */
  gmail?: { available: boolean; address: string | null };
}>) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [allMatches, setAllMatches] = useState(false);
  const [cap, setCap] = useState(5);
  const [sendVia, setSendVia] = useState<"icapos" | "gmail">("icapos");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Only a pair with nobody introduced yet can be introduced.
  const selectable = (p: MatchPair) => p.status === "none";

  function toggle(p: MatchPair) {
    if (!selectable(p)) return;
    setAllMatches(false);
    setPicked((s) => {
      const next = new Set(s);
      if (next.has(p.key)) next.delete(p.key); else next.add(p.key);
      return next;
    });
  }

  async function send(dryRun: boolean) {
    if (picked.size === 0) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/events/${eventId}/introductions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pairKeys: allMatches ? [] : [...picked],
          allMatches,
          maxPerInvestor: cap,
          sendVia,
          dryRun,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) { setMsg(String(json.error ?? "Could not send.")); return; }

      if (dryRun) {
        const repeat = Number(json.wouldRepeat ?? 0);
        const held = Number(json.held ?? 0);
        setMsg(
          `${json.emails} introductions to ${json.recipients} investors.` +
          (held
            ? ` ${held} held back by the cap of ${cap} — they stay unsent and are picked up next time.`
            : "") +
          (repeat
            ? ` ${repeat} matched more than one founder — each of them gets a single email listing all of theirs.`
            : ""),
        );
        return;
      }
      setMsg(
        `${json.created} introductions created, ${json.sent} emails sent` +
        (Number(json.held ?? 0) ? `, ${json.held} held back by the cap.` : "."),
      );
      setPicked(new Set());
      setAllMatches(false);
      window.location.reload();
    } catch {
      setMsg("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const introducible = useMemo(() => board.pairs.filter(selectable), [board.pairs]);
  const pageAllPicked = introducible.length > 0 && introducible.every((p) => picked.has(p.key));
  const someOnPagePicked = introducible.some((p) => picked.has(p.key));
  // Matches beyond the rendered page exist but their keys were never sent to
  // the browser, so "select all" is a flag the server acts on, not a list.
  const beyondPage = Math.max(board.counts.matches - introducible.length, 0);
  const selectedCount = allMatches ? board.counts.notSent : picked.size;

  function toggleAllOnPage() {
    setAllMatches(false);
    setPicked(pageAllPicked ? new Set() : new Set(introducible.map((p) => p.key)));
  }

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
        <Stat n={board.matchable} label={`investors & founders of ${board.registered}`} />
        <Stat n={board.counts.matches} label="matches found" />
        <Stat n={board.counts.requested} label="awaiting an answer" warn={board.counts.requested > 0} />
        <Stat n={board.counts.scheduled} label="scheduled" />
        <Stat n={board.counts.accepted} label="no time set" warn={board.counts.accepted > 0} />
        <Stat n={board.counts.notSent} label="not introduced" />
        <Stat n={board.counts.declined} label="declined" />
        {board.withoutSectors > 0 ? (
          <Stat n={board.withoutSectors} label="declared no sector" warn />
        ) : null}
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
            <option value="accepted">No time set</option>
            <option value="scheduled">Scheduled</option>
            <option value="declined">Declined</option>
          </select>
          {selectedCount > 0 ? (
            <>
              <button type="button" disabled={busy} onClick={() => void send(true)}
                className="rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] disabled:opacity-50">
                Preview send
              </button>
              <button type="button" disabled={busy} onClick={() => void send(false)}
                className="rounded-md bg-[var(--navy)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">
                {busy ? "Sending…" : `Introduce ${selectedCount}`}
              </button>
            </>
          ) : null}
          <span className="text-[11.5px] text-[var(--text-muted)]">
            {shown.length === board.pairs.length ? `${board.pairs.length}` : `${shown.length} of ${board.pairs.length}`}
            {board.totalPairs > board.pairs.length
              ? ` · strongest ${board.pairs.length} of ${board.totalPairs}`
              : ""}
          </span>
        </div>

        {selectedCount > 0 ? (
          <div className="border-b border-[var(--border-subtle)] bg-sky-50/70 px-3.5 py-2.5">
            <div className="flex flex-wrap items-center gap-2 text-[12px] text-sky-900">
              <span>
                {allMatches
                  ? `All ${board.counts.notSent} matches selected.`
                  : `${picked.size} selected on this page.`}
              </span>
              {!allMatches && pageAllPicked && beyondPage > 0 ? (
                <button type="button" onClick={() => { setAllMatches(true); setPicked(new Set()); }}
                  className="font-semibold underline">
                  Select all {board.counts.notSent} matches
                </button>
              ) : null}
              {allMatches ? (
                <button type="button" onClick={() => setAllMatches(false)} className="font-semibold underline">
                  Clear
                </button>
              ) : null}
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2.5">
              <label htmlFor="cap" className="text-[11.5px] text-sky-900">
                Most invitations one investor receives
              </label>
              <input
                id="cap" type="range" min={1} max={MAX_PER_INVESTOR} step={1} value={cap}
                onChange={(e) => setCap(Number(e.target.value))}
                className="h-1 w-40 accent-[var(--navy)]"
              />
              <span className="text-[11.5px] font-semibold tabular-nums text-sky-900">
                {cap} of {MAX_PER_INVESTOR}
              </span>
              <span className="text-[11px] text-sky-900/70">
                Strongest first. What the cap holds back is not recorded, so the next send finds it again.
              </span>
            </div>

            {gmail?.available ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-[11.5px] text-sky-900">Send from</span>
                {(["icapos", "gmail"] as const).map((v) => (
                  <button key={v} type="button" onClick={() => setSendVia(v)}
                    className={`rounded-lg px-2.5 py-1 text-[11.5px] ${
                      sendVia === v
                        ? "border-2 border-[var(--navy)] bg-white font-semibold text-[var(--navy)]"
                        : "border border-[var(--border-subtle)] bg-white/70 text-[var(--text-secondary)]"
                    }`}>
                    {v === "icapos" ? "iCapOS" : gmail.address ?? "Gmail"}
                  </button>
                ))}
                {sendVia === "gmail" ? (
                  <span className="text-[11px] text-amber-800">
                    Replies go to your inbox, not the board — these rows will stop updating.
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {shown.length === 0 ? (
          <p className="px-3.5 py-8 text-center text-sm text-[var(--text-muted)]">
            {board.matchable === 0
              ? "Nobody has registered as an investor or a founder for this event yet."
              : board.pairs.length === 0
                ? "Nobody shares a sector, and there is no founder–investor pairing to suggest."
                : "No match matches that search."}
          </p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-left text-[10.4px] uppercase tracking-wide text-[var(--text-muted)]">
                <th className="w-6 px-3.5 py-2">
                  <input
                    type="checkbox"
                    aria-label="Select every match on this page"
                    checked={pageAllPicked && !allMatches}
                    ref={(el) => {
                      if (el) el.indeterminate = !allMatches && someOnPagePicked && !pageAllPicked;
                    }}
                    disabled={introducible.length === 0}
                    onChange={toggleAllOnPage}
                    className="h-3.5 w-3.5 accent-[var(--navy)] disabled:opacity-30"
                  />
                </th>
                <th className="px-3.5 py-2 font-bold">Match</th>
                <th className="px-3.5 py-2 font-bold">With</th>
                <th className="px-3.5 py-2 font-bold">Why matched</th>
                <th className="px-3.5 py-2 font-bold">Score</th>
                <th className="px-3.5 py-2 font-bold">Status</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => (
                <tr key={p.key} className={`border-t border-[var(--border-subtle)] ${picked.has(p.key) ? "bg-sky-50/50" : ""}`}>
                  <td className="px-3.5 py-2">
                    <input
                      type="checkbox"
                      aria-label={`Introduce ${p.a.name} to ${p.b.name}`}
                      checked={allMatches ? selectable(p) : picked.has(p.key)}
                      disabled={!selectable(p)}
                      onChange={() => toggle(p)}
                      className="h-3.5 w-3.5 accent-[var(--navy)] disabled:opacity-30"
                    />
                  </td>
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
                    {p.rescheduleAsked ? (
                      <span className="mt-0.5 block text-[10px] font-medium text-amber-700">
                        investor asked for another time
                      </span>
                    ) : p.scheduledAt ? (
                      <span className="mt-0.5 block text-[10px] text-[var(--text-muted)]">
                        {slotLabel(p.scheduledAt)}{p.meetingUrl ? " · link set" : ""}
                      </span>
                    ) : p.status === "accepted" && p.founderReminders > 0 ? (
                      <span className="mt-0.5 block text-[10px] text-[var(--text-muted)]">
                        founder reminded {p.founderReminders}×
                      </span>
                    ) : p.followUps > 0 ? (
                      <span className="mt-0.5 block text-[10px] text-[var(--text-muted)]">
                        followed up {p.followUps}×
                      </span>
                    ) : p.requestedBy ? (
                      <span className="mt-0.5 block text-[10px] text-[var(--text-muted)]">
                        asked by {p.requestedBy === p.a.profileId ? p.a.name : p.b.name}
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {msg ? (
        <p className="rounded-lg border border-sky-200 bg-sky-50/60 px-3.5 py-2.5 text-[12px] text-sky-900">{msg}</p>
      ) : null}

      <p className="rounded-lg border border-dashed border-[var(--border-subtle)] bg-slate-50/60 px-3.5 py-2.5 text-[11.6px] text-[var(--text-secondary)]">
        Everyone registered as an investor or a founder is matched — registration is the qualifier, not the
        networking opt-in. A pair can be two investors who share sectors, which is why the columns are sides rather
        than roles; a founder–investor pairing scores three points higher. The introduction goes <b>to the
        investor, about the founder</b>; the founder follow-up chases them, twice at most, never after a decline
        and never inside the last day before the event. <b>Preview send</b> shows who would be mailed and flags
        anyone who would get more than one.
        An investor who matched several founders gets one email listing them, each with its own accept button,
        rather than one email per match. Accepting no longer creates a room: the founder picks a slot inside the
        event and brings the meeting link, and the investor is emailed the time. An acceptance with no time on it
        is chased — the founder, not the investor — twice at most, and never once the event has started. The
        investor can ask for another time; the founder still chooses it.
      </p>
    </div>
  );
}
