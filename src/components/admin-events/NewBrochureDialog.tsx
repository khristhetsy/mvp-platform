"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  isTitleTaken,
  nextAvailableTitle,
  suggestTitle,
  validateTitle,
} from "@/lib/event-hub/brochure/naming";
import { useDismiss } from "@/lib/ui/use-dismiss";

type PickerEvent = { id: string; title: string; status: string; startsAt: string | null };
type ExistingEdition = { id: string; title: string; eventId: string | null };

const INP = "w-full rounded-lg border border-[var(--border-subtle)] px-2.5 py-1.5 text-[12.6px] text-[var(--text-secondary)]";

/**
 * Name a booklet before it exists.
 *
 * The row used to be written the instant an event was picked, so backing out
 * left a draft behind and two attempts produced two identically-named rows.
 * Nothing is created until Create is pressed, and the name is checked against
 * the event's other booklets while it's typed.
 */
export function NewBrochureDialog({
  existing,
  baseEditionId,
  label,
  className,
}: Readonly<{
  existing: ExistingEdition[];
  /** Cloning an edition — the new booklet copies its structure. */
  baseEditionId?: string;
  label: string;
  className?: string;
}>) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<PickerEvent[]>([]);
  const [pickedEventId, setPickedEventId] = useState("");
  const [typedTitle, setTypedTitle] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ref = useDismiss<HTMLDivElement>(open, () => setOpen(false));

  useEffect(() => {
    if (!open || events.length) return;
    void (async () => {
      try {
        const res = await fetch("/api/admin/events/email/events");
        const json = await res.json();
        if (res.ok) setEvents(json.events as PickerEvent[]);
      } catch { /* the select simply stays empty */ }
    })();
  }, [open, events.length]);

  // Derived rather than stored: the first event is the default until one is
  // picked, and the suggestion follows the event until the name is typed over.
  const eventId = pickedEventId || events[0]?.id || "";
  const forEvent = useMemo(
    () => existing.filter((e) => e.eventId === eventId).map((e) => ({ id: e.id, title: e.title })),
    [existing, eventId],
  );
  const suggested = useMemo(() => {
    const ev = events.find((e) => e.id === eventId);
    return ev ? nextAvailableTitle(suggestTitle(ev.title), forEvent) : "";
  }, [events, eventId, forEvent]);
  const title = typedTitle ?? suggested;

  const invalid = title ? validateTitle(title) : null;
  const taken = Boolean(title) && !invalid && isTitleTaken(title, forEvent);
  const canCreate = Boolean(eventId) && Boolean(title.trim()) && !invalid && !taken && !busy;

  async function create() {
    if (!canCreate) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/events/brochure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, title: title.trim(), baseEditionId }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        edition?: { id: string };
        error?: string;
        suggestion?: string;
      };
      if (!res.ok) {
        // 409 comes back with a free name — offer it rather than just refusing.
        if (json.suggestion) setTypedTitle(json.suggestion);
        throw new Error(json.error ?? "Couldn't create the booklet.");
      }
      router.push(`/admin/events/brochure/new?editionId=${json.edition?.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create the booklet.");
      setBusy(false);
    }
  }

  return (
    <div className={`relative ${className ?? ""}`} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={baseEditionId
          ? "text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--blue)] hover:underline"
          : "cap-btn-primary rounded-md px-4 py-2 text-sm font-medium"}
      >
        {label}
      </button>

      {open ? (
        <div className="absolute right-0 top-[calc(100%+8px)] z-30 w-[430px] max-w-[92vw] overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-white shadow-xl">
          <div className="border-b border-[var(--border-subtle)] px-4 py-3">
            <p className="text-[14px] font-semibold text-[var(--navy)]">
              {baseEditionId ? "Start from this booklet" : "New booklet"}
            </p>
            <p className="mt-0.5 text-[11.6px] text-[var(--text-muted)]">
              {baseEditionId
                ? "Copies the page layout and hand-written pages. Nothing is saved until you press Create."
                : "Nothing is saved until you press Create."}
            </p>
          </div>

          <div className="px-4 py-3">
            <label className="block">
              <span className="mb-1.5 block text-[10.6px] font-bold text-[var(--text-secondary)]">Event</span>
              <select value={eventId} onChange={(e) => { setPickedEventId(e.target.value); setTypedTitle(null); }} className={INP}>
                {events.length === 0 ? <option value="">Loading events…</option> : null}
                {events.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
              </select>
            </label>

            <label className="mt-3 block">
              <span className="mb-1.5 block text-[10.6px] font-bold text-[var(--text-secondary)]">Booklet name</span>
              <input
                value={title}
                onChange={(e) => setTypedTitle(e.target.value)}
                className={`${INP} ${taken || invalid ? "border-rose-300 bg-rose-50/40" : title ? "border-emerald-200" : ""}`}
              />
              {invalid ? (
                <p className="mt-1.5 text-[11px] text-rose-700">{invalid}</p>
              ) : taken ? (
                <p className="mt-1.5 text-[11px] text-rose-700">
                  A booklet with this name already exists for this event. Try{" "}
                  <button
                    type="button"
                    onClick={() => setTypedTitle(nextAvailableTitle(title, forEvent))}
                    className="font-semibold underline"
                  >
                    {nextAvailableTitle(title, forEvent)}
                  </button>.
                </p>
              ) : (
                <p className="mt-1.5 text-[11px] text-emerald-700">
                  ✓ Available. Suggested from the event — change it to anything you like.
                </p>
              )}
            </label>

            {error ? <p className="mt-2 text-[11.5px] text-rose-700">{error}</p> : null}
          </div>

          <div className="flex items-center gap-2 border-t border-[var(--border-subtle)] bg-slate-50/60 px-4 py-2.5">
            <span className="flex-1" />
            <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)]">
              Cancel
            </button>
            <button type="button" onClick={() => void create()} disabled={!canCreate} className="cap-btn-primary rounded-md px-3 py-1.5 text-xs font-medium disabled:opacity-50">
              {busy ? "Creating…" : "Create booklet"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
