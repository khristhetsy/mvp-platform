"use client";

import { useMemo, useState } from "react";

export type AllRegRow = {
  id: string;
  eventId: string;
  eventTitle: string | null;
  attendeeType: string | null;
  contactName: string | null;
  contactEmail: string | null;
  company: string | null;
  createdAt: string;
  /** Whether they agreed to appear on the public event page. */
  listedPublicly: boolean;
};

const I = "rounded-md border border-[var(--border-subtle)] px-2.5 py-1.5 text-xs";

const TYPE_STYLE: Record<string, string> = {
  investor: "bg-blue-50 text-blue-700",
  founder: "bg-violet-50 text-violet-700",
  service: "bg-slate-100 text-slate-600",
  sponsor: "bg-amber-50 text-amber-700",
};

function fmt(iso: string): string {
  try { return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" }); }
  catch { return "—"; }
}

function csvCell(v: string | null): string {
  const s = v ?? "";
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Every registration, across every event.
 *
 * Filters in the browser rather than round-tripping: the whole set is already
 * on the page, and a search that pauses between keystrokes reads as broken
 * even when it isn't.
 */
export function AllRegistrationsTable({ rows, events }: Readonly<{
  rows: AllRegRow[];
  events: { id: string; title: string }[];
}>) {
  const [q, setQ] = useState("");
  const [eventId, setEventId] = useState("");
  const [type, setType] = useState("");

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (eventId && r.eventId !== eventId) return false;
      if (type && r.attendeeType !== type) return false;
      if (!needle) return true;
      return [r.contactName, r.contactEmail, r.company, r.eventTitle]
        .filter(Boolean).join(" ").toLowerCase().includes(needle);
    });
  }, [rows, q, eventId, type]);

  function exportCsv() {
    const header = ["Name", "Email", "Company", "Type", "Event", "Registered", "Listed publicly"];
    const body = shown.map((r) => [
      r.contactName, r.contactEmail, r.company, r.attendeeType, r.eventTitle,
      r.createdAt, r.listedPublicly ? "yes" : "no",
    ].map(csvCell).join(","));
    const blob = new Blob([[header.join(","), ...body].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `registrations-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const types = [...new Set(rows.map((r) => r.attendeeType).filter(Boolean))] as string[];

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border-subtle)] px-3.5 py-2.5">
        <select value={eventId} onChange={(e) => setEventId(e.target.value)} className={I}>
          <option value="">All events</option>
          {events.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
        </select>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email or company…"
          className={`${I} min-w-[180px] flex-1`} />
        <select value={type} onChange={(e) => setType(e.target.value)} className={I}>
          <option value="">Any type</option>
          {types.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <button type="button" onClick={exportCsv}
          className="rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)]">
          Export CSV
        </button>
        <span className="text-[11.5px] text-[var(--text-muted)]">
          {shown.length === rows.length ? `${rows.length}` : `${shown.length} of ${rows.length}`}
        </span>
      </div>

      {shown.length === 0 ? (
        <p className="px-3.5 py-8 text-center text-sm text-[var(--text-muted)]">
          {rows.length === 0 ? "Nobody has registered yet." : "No registration matches that search."}
        </p>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 text-left text-[10.4px] uppercase tracking-wide text-[var(--text-muted)]">
              <th className="px-3.5 py-2 font-bold">Attendee</th>
              <th className="px-3.5 py-2 font-bold">Type</th>
              <th className="px-3.5 py-2 font-bold">Event</th>
              <th className="px-3.5 py-2 font-bold">Registered</th>
              <th className="px-3.5 py-2 font-bold">Listed publicly</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id} className="border-t border-[var(--border-subtle)]">
                <td className="px-3.5 py-2">
                  <span className="block font-medium text-[var(--navy)]">{r.contactName ?? "—"}</span>
                  <span className="block text-[10.4px] text-[var(--text-muted)]">
                    {[r.contactEmail, r.company].filter(Boolean).join(" · ") || "—"}
                  </span>
                </td>
                <td className="px-3.5 py-2">
                  {r.attendeeType ? (
                    <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${TYPE_STYLE[r.attendeeType] ?? "bg-slate-100 text-slate-600"}`}>
                      {r.attendeeType}
                    </span>
                  ) : <span className="text-[var(--text-muted)]">—</span>}
                </td>
                <td className="px-3.5 py-2 text-[var(--text-secondary)]">{r.eventTitle ?? "—"}</td>
                <td className="px-3.5 py-2 text-[var(--text-muted)]">{fmt(r.createdAt)}</td>
                <td className="px-3.5 py-2">
                  {r.listedPublicly
                    ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Yes</span>
                    : <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">Private</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
