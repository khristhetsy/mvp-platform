"use client";

import { useCallback, useEffect, useState } from "react";

type Person = { name: string; company: string | null };
type EventInfo = {
  title: string;
  when: string | null;
  googleUrl: string | null;
  icsUrl: string | null;
};

type Answered = { accepted: boolean; founderNotified: boolean };

const CARD = "rounded-xl border border-[var(--border-subtle)] bg-white p-6";
const CAL = "inline-block rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)]";

/** The event, stated the same way here as in every email about it. */
function WhenBlock({ event }: Readonly<{ event: EventInfo }>) {
  return (
    <div className="mt-4 rounded-lg border border-[var(--border-subtle)] bg-slate-50/70 px-3.5 py-3">
      <p className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-[var(--text-muted)]">
        Where you will both be
      </p>
      <p className="mt-1.5 text-sm text-[var(--navy)]">{event.title}</p>
      {event.when ? <p className="mt-0.5 text-[13px] text-[var(--text-secondary)]">{event.when}</p> : null}
      {event.googleUrl || event.icsUrl ? (
        <div className="mt-2.5 flex flex-wrap gap-2">
          {event.googleUrl ? (
            <a href={event.googleUrl} target="_blank" rel="noreferrer" className={CAL}>Add to calendar</a>
          ) : null}
          {event.icsUrl ? (
            <a href={event.icsUrl} download={`${event.title.slice(0, 40)}.ics`} className={CAL}>iCal / Outlook</a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Accept or decline, and then be told what happens next.
 *
 * The email's buttons carry the answer in the URL, so arriving from one
 * submits straight away — a second confirmation step after someone has already
 * clicked "Accept" is a page nobody reads.
 *
 * Accepting no longer hands over a video room. The founder picks the slot and
 * brings the link, so what this page owes the investor is the event's date and
 * the name of the person who will be in touch.
 */
export function IntroRespondClient({ token, preset, founder, event }: Readonly<{
  token: string;
  preset: "accept" | "decline" | null;
  founder: Person | null;
  event: EventInfo | null;
}>) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Answered | null>(null);
  const [error, setError] = useState<string | null>(null);

  const respond = useCallback(async (accept: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/events/introductions/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, accept }),
      });
      const json = (await res.json().catch(() => ({}))) as Answered & { error?: string };
      if (!res.ok) { setError(json.error ?? "Something went wrong."); return; }
      setDone({ accepted: json.accepted, founderNotified: Boolean(json.founderNotified) });
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }, [token]);

  // Arriving from the email's button submits the answer it carries. Deferred a
  // tick so the request starts after the first paint rather than during it.
  useEffect(() => {
    if (!preset) return;
    const t = setTimeout(() => void respond(preset === "accept"), 0);
    return () => clearTimeout(t);
  }, [preset, respond]);

  const name = founder?.name ?? null;
  const described = founder?.company ? `${founder.name} — ${founder.company}` : name;

  if (done) {
    return (
      <div className={CARD}>
        <h1 className="text-lg font-semibold text-[var(--navy)]">
          {done.accepted ? "Introduction accepted" : "Thanks — we won't ask again"}
        </h1>

        {done.accepted ? (
          <>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              {described
                ? <>You and <span className="text-[var(--navy)]">{described}</span> have been named to each other.</>
                : <>You have both been named to each other.</>}
              {" "}
              {done.founderNotified
                ? <>We have let {name ?? "them"} know.</>
                : <>We are letting {name ?? "them"} know.</>}
            </p>

            {event ? <WhenBlock event={event} /> : null}

            <p className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50/60 px-3 py-2.5 text-[12.5px] text-[var(--text-secondary)]">
              {name ?? "They"} will pick a time inside the event and send you the meeting link. Nothing is booked
              until they do.
            </p>
          </>
        ) : (
          <p className="mt-2 text-sm text-[var(--text-secondary)]">Nobody is told who declined.</p>
        )}
      </div>
    );
  }

  return (
    <div className={CARD}>
      <h1 className="text-lg font-semibold text-[var(--navy)]">
        {described ? `An introduction to ${described}` : "An introduction at iCFO Events"}
      </h1>
      <p className="mt-2 text-sm text-[var(--text-secondary)]">
        Accepting names you both to each other, and {name ?? "they"} will send a time and a meeting link.
        Nothing is shared before that.
      </p>

      {event ? <WhenBlock event={event} /> : null}

      {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={() => void respond(true)}
          className="rounded-lg bg-[var(--blue)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {busy ? "Saving…" : "Accept the introduction →"}
        </button>
        <button type="button" disabled={busy} onClick={() => void respond(false)}
          className="rounded-lg border border-[var(--border-subtle)] px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] disabled:opacity-50">
          Not right now
        </button>
      </div>
    </div>
  );
}
