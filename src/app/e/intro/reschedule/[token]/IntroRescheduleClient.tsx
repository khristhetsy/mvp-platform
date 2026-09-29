"use client";

import { useState } from "react";

const CARD = "rounded-xl border border-[var(--border-subtle)] bg-white p-6";
const MAX_NOTE = 400;

/**
 * Ask the founder for a different time.
 *
 * The investor asks; the founder still chooses. Nothing moves here — the slot
 * is simply put back in front of the person who owns it.
 */
export function IntroRescheduleClient({
  token, status, founderName, eventTitle, currentWhen, alreadyAsked,
}: Readonly<{
  token: string;
  status: "sent" | "accepted" | "declined";
  founderName: string;
  eventTitle: string;
  currentWhen: string | null;
  alreadyAsked: boolean;
}>) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ notified: boolean } | null>(null);

  const first = founderName.split(/\s+/)[0] || founderName;

  if (status !== "accepted") {
    return (
      <div className={CARD}>
        <h1 className="text-lg font-semibold text-[var(--navy)]">There is no meeting to move</h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          {status === "declined"
            ? "This introduction was declined."
            : "This introduction has not been accepted yet."}
        </p>
      </div>
    );
  }

  if (sent) {
    return (
      <div className={CARD}>
        <h1 className="text-lg font-semibold text-[var(--navy)]">Asked</h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          {sent.notified
            ? <>{first} will pick another slot and you will get the new time by email.</>
            : <>We could not reach {first} by email. The request is recorded and we will chase it.</>}
        </p>
        {currentWhen ? (
          <p className="mt-3 text-[12.5px] text-[var(--text-muted)]">
            {currentWhen} stays booked until they choose a new one, so nothing is lost if they cannot move.
          </p>
        ) : null}
      </div>
    );
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/events/introductions/reschedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, note: note.trim() || undefined }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; notified?: boolean; error?: string };
      if (!res.ok) { setError(json.error ?? "Could not send that."); return; }
      setSent({ notified: Boolean(json.notified) });
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={CARD}>
      <h1 className="text-lg font-semibold text-[var(--navy)]">Ask {first} for another time</h1>
      <p className="mt-2 text-sm text-[var(--text-secondary)]">
        {currentWhen
          ? <>You are currently down for {currentWhen} at {eventTitle}.</>
          : <>No time has been set for {eventTitle} yet.</>}
        {" "}
        {first} picks the slot, so this puts it back in front of them.
      </p>

      {alreadyAsked ? (
        <p className="mt-3 rounded-lg border border-[var(--border-subtle)] bg-slate-50/70 px-3 py-2 text-[12.5px] text-[var(--text-secondary)]">
          You have already asked once. Sending again nudges them.
        </p>
      ) : null}

      <label className="mt-5 block">
        <span className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-[var(--text-muted)]">
          Anything that would help (optional)
        </span>
        <textarea
          rows={3}
          maxLength={MAX_NOTE}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Could we do anything after 2pm?"
          className="mt-1.5 w-full rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-[12.5px]"
        />
        <span className="mt-1 block text-[11px] text-[var(--text-muted)]">
          {note.length}/{MAX_NOTE} · sent to {first} as written.
        </span>
      </label>

      {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}

      <div className="mt-4">
        <button
          type="button"
          disabled={busy}
          onClick={() => void submit()}
          className="rounded-lg bg-[var(--blue)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Sending…" : "Ask for another time"}
        </button>
      </div>
    </div>
  );
}
