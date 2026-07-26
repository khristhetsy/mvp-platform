"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/** Merged-booklet distribute: email the event's registered guests from a published
 *  edition, with an editable cover note. Creates a Marketing campaign to send. */
export function BrochureDistribute({ id, eventId }: { id: string; eventId: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [count, setCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ campaignId: string; count: number } | null>(null);

  useEffect(() => {
    if (!open || !eventId || count !== null) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/admin/events/email/audience?eventId=${eventId}`);
        const json = await res.json();
        if (!cancelled && res.ok) setCount(json.registrants?.registered ?? 0);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [open, eventId, count]);

  async function distribute() {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/admin/events/brochure/${id}/distribute`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coverNote: note.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Couldn't create the guest email.");
      setDone({ campaignId: json.campaignId, count: json.count });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create the guest email.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return <button type="button" onClick={() => setOpen(true)} className="text-xs font-semibold text-[var(--blue)] hover:underline">Email guests →</button>;
  }

  return (
    <div className="w-72 rounded-xl border border-[var(--border-subtle)] bg-white p-3 text-left shadow-sm">
      {done ? (
        <div className="text-xs text-emerald-700">
          <p className="font-semibold">Guest email created for {done.count} registrant{done.count === 1 ? "" : "s"}.</p>
          <p className="mt-1 text-[var(--text-muted)]">Review and send it in Marketing Hub.</p>
          <a href="/admin/marketing/campaigns" className="mt-1 inline-block font-semibold text-[var(--blue)] underline">Open campaigns →</a>
        </div>
      ) : (
        <>
          <p className="text-xs font-semibold text-[var(--navy)]">Email the booklet to registered guests</p>
          <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">{count === null ? "Counting registrants…" : `${count} registered guest${count === 1 ? "" : "s"}`} · they get a download link.</p>
          {error && <div className="mt-2 rounded-md bg-rose-50 px-2 py-1 text-[11px] text-rose-700">{error}</div>}
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Optional cover note (a personal line above the booklet)…" className="mt-2 w-full rounded-md border border-[var(--border-subtle)] px-2 py-1 text-xs" />
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={distribute} disabled={busy || count === 0} className="cap-btn-primary rounded-md px-3 py-1.5 text-xs font-medium disabled:opacity-50">{busy ? "Creating…" : "Create guest email"}</button>
            <button type="button" onClick={() => setOpen(false)} className="rounded-md px-2 py-1.5 text-xs font-medium text-[var(--text-muted)]">Cancel</button>
          </div>
        </>
      )}
    </div>
  );
}
