"use client";

import { useCallback, useEffect, useState } from "react";

type Answered = { accepted: boolean; roomUrl: string | null; roomError: string | null };

/**
 * Accept or decline, and then be told how to meet.
 *
 * The email's buttons carry the answer in the URL, so arriving from one
 * submits straight away — a second confirmation step after someone has already
 * clicked "Accept" is a page nobody reads.
 */
export function IntroRespondClient({ token, preset }: Readonly<{
  token: string;
  preset: "accept" | "decline" | null;
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
      setDone({ accepted: json.accepted, roomUrl: json.roomUrl ?? null, roomError: json.roomError ?? null });
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }, [token]);

  // Arriving from the email's button submits the answer it carries — a second
  // "are you sure" after someone has already clicked Accept is a page nobody
  // reads. Deferred a tick so the request starts after the first paint rather
  // than during it.
  useEffect(() => {
    if (!preset) return;
    const t = setTimeout(() => void respond(preset === "accept"), 0);
    return () => clearTimeout(t);
  }, [preset, respond]);

  if (done) {
    return (
      <div className="rounded-xl border border-[var(--border-subtle)] bg-white p-6">
        <h1 className="text-lg font-semibold text-[var(--navy)]">
          {done.accepted ? "Introduction accepted" : "Thanks — we won't ask again"}
        </h1>
        {done.accepted ? (
          <>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              You&rsquo;ve both been named to each other, and a conversation is open.
            </p>
            {done.roomUrl ? (
              <a href={done.roomUrl} target="_blank" rel="noreferrer"
                className="mt-4 inline-block rounded-lg bg-[var(--blue)] px-4 py-2 text-sm font-semibold text-white">
                Open the video room →
              </a>
            ) : (
              <p className="mt-3 rounded-lg border border-dashed border-slate-300 bg-slate-50/60 px-3 py-2.5 text-[12.5px] text-[var(--text-secondary)]">
                {done.roomError ?? "A room couldn't be created."} You can still arrange a time by replying to the
                email — the introduction stands either way.
              </p>
            )}
          </>
        ) : (
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            Nobody is told who declined.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-white p-6">
      <h1 className="text-lg font-semibold text-[var(--navy)]">An introduction at iCFO Events</h1>
      <p className="mt-2 text-sm text-[var(--text-secondary)]">
        Accepting names you both to each other and opens a conversation. Nothing is shared before that.
      </p>
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
