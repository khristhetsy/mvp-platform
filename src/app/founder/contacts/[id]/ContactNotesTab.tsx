"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PLATFORM_TZ, PLATFORM_TZ_LABEL } from "@/lib/time/platform-tz";
import type { ContactNote } from "@/lib/founder-crm/contact-notes-types";

/** Note log tab on the founder contact page. Private notes: newest first, pinned notes on top. */


function when(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const text = new Intl.DateTimeFormat("en-US", { timeZone: PLATFORM_TZ, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(d);
  return `${text} ${PLATFORM_TZ_LABEL}`;
}

function order(notes: ContactNote[]): ContactNote[] {
  return [...notes].sort((a, b) => Number(b.pinned) - Number(a.pinned) || Date.parse(b.created_at) - Date.parse(a.created_at));
}

export function ContactNotesTab({
  contactId,
  firstName,
  initialNotes,
}: Readonly<{ contactId: string; firstName: string; initialNotes: ContactNote[] }>) {
  const router = useRouter();
  const [notes, setNotes] = useState<ContactNote[]>(initialNotes);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canAdd = draft.trim().length > 0 && !busy;

  async function addNote() {
    if (!canAdd) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/founder/contact-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId, body: draft.trim() }),
      });
      const data = (await res.json().catch(() => null)) as { note?: ContactNote; error?: string } | null;
      if (!res.ok || !data?.note) {
        setError(data?.error ?? "Couldn't save the note. Try again.");
        return;
      }
      setNotes((prev) => [data.note as ContactNote, ...prev]);
      setDraft("");
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function togglePin(note: ContactNote) {
    setError(null);
    const res = await fetch(`/api/founder/contact-notes/${note.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned: !note.pinned }),
    }).catch(() => null);
    if (!res || !res.ok) {
      setError("Couldn't update the note.");
      return;
    }
    setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, pinned: !n.pinned } : n)));
  }

  async function remove(note: ContactNote) {
    setError(null);
    const res = await fetch(`/api/founder/contact-notes/${note.id}`, { method: "DELETE" }).catch(() => null);
    if (!res || !res.ok) {
      setError("Couldn't delete the note.");
      return;
    }
    setNotes((prev) => prev.filter((n) => n.id !== note.id));
    router.refresh();
  }

  return (
    <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_280px]">
      <div>
        <p className="mb-2 text-[13px] font-semibold text-slate-900">Note log</p>
        <div className="mb-3 rounded-lg border border-slate-200 p-3">
          <textarea
            aria-label="New note"
            rows={3}
            maxLength={4000}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={`Write a private note about ${firstName || "this investor"}`}
            className="w-full resize-y rounded-md border border-slate-200 bg-white px-2.5 py-2 text-[13px] text-slate-800"
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[12px] text-slate-500">Only you see notes. They are never sent to the investor.</span>
            <button type="button" onClick={() => void addNote()} disabled={!canAdd} className="cap-btn-primary rounded-lg px-3.5 py-1.5 text-[12.5px] font-semibold disabled:opacity-50">
              {busy ? "Saving…" : "Add note"}
            </button>
          </div>
        </div>
        {error ? <p className="mb-2 text-[12px] text-red-600" role="status">{error}</p> : null}
        {notes.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 px-3.5 py-3.5 text-[13px] text-slate-500">No notes yet. Add what you learned about this investor.</p>
        ) : (
          <ul className="space-y-2">
            {order(notes).map((n) => (
              <li key={n.id} className="rounded-lg border border-slate-200 bg-white px-3.5 py-3">
                <div className="mb-1.5 flex flex-wrap items-center gap-2 text-[12px]">
                  <span className="text-[13px] font-semibold text-slate-900">You</span>
                  <span className="text-slate-500">{when(n.created_at)}</span>
                  {n.pinned ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">Pinned</span> : null}
                  <span className="ml-auto" />
                  <button type="button" onClick={() => void togglePin(n)} className="text-[#1A6CE4] hover:underline">{n.pinned ? "Unpin" : "Pin"}</button>
                  <button type="button" onClick={() => void remove(n)} className="text-red-700 hover:underline">Delete</button>
                </div>
                <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-slate-800">{n.body}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-[12.5px]">
        <p className="mb-1.5 text-[13px] font-semibold text-slate-900">How notes work</p>
        <p className="leading-relaxed text-slate-700">Newest first. Pinned notes stay at the top. Notes belong to your account and are not visible to the investor or to iCFO Capital.</p>
        <div className="my-3 border-t border-slate-200" />
        <p className="leading-relaxed text-slate-700">Emails sent and replies are on the Activity tab, not here.</p>
      </div>
    </div>
  );
}
