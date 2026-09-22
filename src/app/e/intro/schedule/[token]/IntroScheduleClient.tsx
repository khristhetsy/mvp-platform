"use client";

import { useState } from "react";
import { checkMeetingUrl } from "@/lib/icfo-events/intro-scheduling";

type Slot = { startsAt: string; endsAt: string; taken: boolean; label: string };
type Person = { name: string; company: string | null };

const CARD = "rounded-xl border border-[var(--border-subtle)] bg-white p-6";
const LABEL = "text-[10.5px] font-bold uppercase tracking-[0.06em] text-[var(--text-muted)]";

/** Google's own "new meeting" page. We cannot mint a link on someone's behalf
 * without their connected account, and most founders here are guests — so the
 * button opens Google rather than pretending to do it for them. */
const MEET_NEW = "https://meet.google.com/new";

/**
 * Pick a slot, bring a link.
 *
 * The founder is the one pursuing, so the scheduling work is theirs. Any
 * provider is accepted: requiring Google would exclude every founder who never
 * connected an account, which is most of them.
 */
export function IntroScheduleClient({
  token, status, investor, eventTitle, eventWhen, slots, existing,
}: Readonly<{
  token: string;
  status: "sent" | "accepted" | "declined";
  investor: Person | null;
  eventTitle: string;
  eventWhen: string | null;
  slots: Slot[];
  existing: { startsAt: string; label: string; meetingUrl: string } | null;
}>) {
  const [chosen, setChosen] = useState<string | null>(existing?.startsAt ?? null);
  const [url, setUrl] = useState(existing?.meetingUrl ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ when: string; notified: boolean } | null>(null);

  const who = investor?.company ? `${investor.name} — ${investor.company}` : investor?.name ?? "the investor";
  const firstName = investor?.name?.split(/\s+/)[0] ?? "they";

  if (status !== "accepted") {
    return (
      <div className={CARD}>
        <h1 className="text-lg font-semibold text-[var(--navy)]">Nothing to schedule yet</h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          {status === "declined"
            ? "This introduction was declined, so there is no meeting to arrange."
            : "This introduction has not been accepted yet. We will email you the moment it is."}
        </p>
      </div>
    );
  }

  if (saved) {
    return (
      <div className={CARD}>
        <h1 className="text-lg font-semibold text-[var(--navy)]">Time set — {saved.when}</h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          {saved.notified
            ? <>{firstName} has the time and your link.</>
            : <>We could not email {firstName} — send them the link yourself, and the time stands either way.</>}
        </p>
        <p className="mt-3 text-[12.5px] text-[var(--text-muted)]">
          Changed your mind? Open this link again to pick a different slot.
        </p>
      </div>
    );
  }

  async function submit() {
    setError(null);
    setLinkError(null);
    if (!chosen) { setError("Pick a slot first."); return; }

    const link = checkMeetingUrl(url);
    if (!link.ok) { setLinkError(link.reason); return; }

    setBusy(true);
    try {
      const res = await fetch("/api/events/introductions/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, startsAt: chosen, meetingUrl: link.url }),
      });
      const json = (await res.json().catch(() => ({}))) as
        { ok?: boolean; when?: string; notified?: boolean; error?: string };
      if (!res.ok) { setError(json.error ?? "Could not set the time."); return; }
      setSaved({ when: json.when ?? "", notified: Boolean(json.notified) });
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={CARD}>
      <h1 className="text-lg font-semibold text-[var(--navy)]">Meet {who}</h1>
      <p className="mt-1.5 text-sm text-[var(--text-secondary)]">
        {eventTitle}{eventWhen ? ` · ${eventWhen}` : ""}
      </p>
      {existing ? (
        <p className="mt-3 rounded-lg border border-[var(--border-subtle)] bg-slate-50/70 px-3 py-2 text-[12.5px] text-[var(--text-secondary)]">
          Currently set for {existing.label}. Choosing another slot replaces it and tells {firstName}.
        </p>
      ) : null}

      <div className="mt-6">
        <p className={LABEL}>Pick a slot</p>
        {slots.length === 0 ? (
          <p className="mt-2 rounded-lg border border-dashed border-slate-300 bg-slate-50/60 px-3 py-2.5 text-[12.5px] text-[var(--text-secondary)]">
            This event has no times left to meet in. Reply to the email and we will sort something out.
          </p>
        ) : (
          <>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {slots.map((s) => {
                const active = chosen === s.startsAt;
                return (
                  <button
                    key={s.startsAt}
                    type="button"
                    disabled={s.taken}
                    onClick={() => setChosen(s.startsAt)}
                    className={`rounded-lg px-2 py-2 text-center text-[12.5px] ${
                      s.taken
                        ? "cursor-not-allowed border border-[var(--border-subtle)] text-[var(--text-muted)] line-through"
                        : active
                          ? "border-2 border-[var(--blue)] bg-[var(--blue-muted)] font-semibold text-[var(--navy)]"
                          : "border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-slate-50"
                    }`}
                  >
                    {s.label.replace(/^.*?,\s*/, "")}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[11.5px] text-[var(--text-muted)]">
              Slots are 30 minutes, inside the event only. Crossed-out ones you have already given to someone else.
            </p>
          </>
        )}
      </div>

      <div className="mt-6">
        <p className={LABEL}>Your meeting link</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            value={url}
            onChange={(e) => { setUrl(e.target.value); setLinkError(null); }}
            placeholder="https://meet.google.com/…"
            className="min-w-[200px] flex-1 rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-[12.5px]"
          />
          <a
            href={MEET_NEW}
            target="_blank"
            rel="noreferrer"
            className="whitespace-nowrap rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-[12.5px] font-semibold text-[var(--text-secondary)]"
          >
            Create a Meet link ↗
          </a>
        </div>
        {linkError ? <p className="mt-1.5 text-[12.5px] text-rose-700">{linkError}</p> : null}
        <p className="mt-2 text-[11.5px] text-[var(--text-muted)]">
          Opens Google Meet in a new tab — copy the link it gives you and paste it here. Zoom or Teams links work
          just as well.
        </p>
      </div>

      {error ? <p className="mt-4 text-sm text-rose-700">{error}</p> : null}

      <div className="mt-6">
        <button
          type="button"
          disabled={busy || slots.length === 0}
          onClick={() => void submit()}
          className="rounded-lg bg-[var(--blue)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Saving…" : chosen
            ? `Confirm ${slots.find((s) => s.startsAt === chosen)?.label.replace(/^.*?,\s*/, "") ?? ""} and send`
            : "Confirm and send"}
        </button>
      </div>
    </div>
  );
}
