"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ImpactConfirm, type ImpactLine } from "@/components/ui/ImpactConfirm";

export type AllRegRow = {
  id: string;
  eventId: string;
  eventTitle: string | null;
  attendeeType: string | null;
  contactName: string | null;
  contactEmail: string | null;
  company: string | null;
  createdAt: string;
  /** "staff" when added from an event's registrations board. */
  registeredBy: "self" | "staff";
};

type Impact = { introductions: number | null; accepted: number | null; scheduled: number | null; emailRecords: number | null };

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
  const [by, setBy] = useState<"" | "self" | "staff">("");
  const router = useRouter();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  // Rows deleted in this visit, hidden at once; the refresh below confirms them.
  const [gone, setGone] = useState<Set<string>>(new Set());
  // The ids the open confirmation is about, so it cannot drift from what was clicked.
  const [asking, setAsking] = useState<string[] | null>(null);
  const [impact, setImpact] = useState<Impact | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (gone.has(r.id)) return false;
      if (eventId && r.eventId !== eventId) return false;
      if (type && r.attendeeType !== type) return false;
      if (by && r.registeredBy !== by) return false;
      if (!needle) return true;
      return [r.contactName, r.contactEmail, r.company, r.eventTitle]
        .filter(Boolean).join(" ").toLowerCase().includes(needle);
    });
  }, [rows, q, eventId, type, by, gone]);

  // Staff-added registrations count in every total, and are shown separately.
  const staffCount = shown.filter((r) => r.registeredBy === "staff").length;

  // Only rows still on screen count as selected: a filter that hides a ticked
  // row must not leave it quietly in the delete.
  const selected = shown.filter((r) => picked.has(r.id));
  const allShownPicked = shown.length > 0 && selected.length === shown.length;

  function toggle(id: string) {
    setPicked((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  /** Open the confirmation, then count what would go with them. */
  async function ask(ids: string[]) {
    setAsking(ids);
    setImpact(null);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/events/registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, dryRun: true }),
      });
      const json = (await res.json().catch(() => ({}))) as { impact?: Impact };
      // A failed count is shown as dashes, never as zeros.
      setImpact(res.ok && json.impact ? json.impact : { introductions: null, accepted: null, scheduled: null, emailRecords: null });
    } catch {
      setImpact({ introductions: null, accepted: null, scheduled: null, emailRecords: null });
    }
  }

  async function confirmDelete() {
    if (!asking || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/events/registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: asking, dryRun: false }),
      });
      const json = (await res.json().catch(() => ({}))) as { deleted?: number; error?: string };
      if (!res.ok) { setMsg(json.error ?? "Couldn't delete the registrations."); return; }
      const removed = new Set(asking);
      setGone((g) => new Set([...g, ...removed]));
      setPicked((p) => new Set([...p].filter((id) => !removed.has(id))));
      setMsg(`${json.deleted ?? removed.size} registration${(json.deleted ?? removed.size) === 1 ? "" : "s"} deleted.`);
      router.refresh();
    } catch {
      setMsg("Network error. Nothing was deleted.");
    } finally {
      setBusy(false);
      setAsking(null);
    }
  }

  const lines: ImpactLine[] = [
    { count: impact?.introductions ?? null, text: "introductions sent to or about them are deleted, with their match rows" },
    { count: impact?.scheduled ?? null, text: "accepted introductions with a time set lose that meeting" },
    { count: impact?.emailRecords ?? null, text: "invitation and attendee email records are deleted" },
    { count: 0, text: "emails are sent. Nobody is told they were removed", benign: true },
  ];

  function namesOf(ids: string[]): string {
    const names = ids.map((id) => rows.find((r) => r.id === id)).map((r) => r?.contactName ?? r?.contactEmail ?? "Unnamed");
    return names.slice(0, 4).join(", ") + (names.length > 4 ? ` and ${names.length - 4} more` : "");
  }

  function exportCsv() {
    const header = ["Name", "Email", "Company", "Type", "Event", "Registered", "Registered by"];
    const body = shown.map((r) => [
      r.contactName, r.contactEmail, r.company, r.attendeeType, r.eventTitle, r.createdAt, r.registeredBy,
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
    <div className="ma-pad overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-white">
      <div className="ma-filters flex flex-wrap items-center gap-2 border-b border-[var(--border-subtle)] px-3.5 py-2.5">
        <select value={eventId} onChange={(e) => setEventId(e.target.value)} className={`${I} ma-full`}>
          <option value="">All events</option>
          {events.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
        </select>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email or company…"
          className={`${I} ma-full min-w-[180px] flex-1`} />
        <select value={type} onChange={(e) => setType(e.target.value)} className={I}>
          <option value="">Any type</option>
          {types.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={by} onChange={(e) => setBy(e.target.value as "" | "self" | "staff")} className={I} aria-label="Registered by">
          <option value="">Registered by anyone</option>
          <option value="staff">Registered by staff</option>
          <option value="self">Registered themselves</option>
        </select>
        <button type="button" onClick={exportCsv}
          className="ma-export rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)]">
          Export CSV
        </button>
        <span className="ma-count text-[11.5px] text-[var(--text-muted)]">
          {shown.length === rows.length ? `${rows.length}` : `${shown.length} of ${rows.length}`}
          {" · "}staff {staffCount} · self {shown.length - staffCount}
        </span>
      </div>

      {selected.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-sky-200 bg-sky-50/70 px-3.5 py-2.5 text-[12px] text-sky-900">
          <span>{selected.length} selected{selected.length === shown.length ? "" : ` of ${shown.length} shown`}.</span>
          <span className="flex-1" />
          <button type="button" onClick={() => setPicked(new Set())}
            className="rounded-md border border-[var(--border-subtle)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)]">
            Clear
          </button>
          <button type="button" onClick={() => void ask(selected.map((r) => r.id))}
            className="rounded-md bg-red-700 px-3 py-1.5 text-xs font-semibold text-white">
            Delete {selected.length}
          </button>
        </div>
      ) : null}

      {msg ? <p className="border-b border-[var(--border-subtle)] bg-slate-50 px-3.5 py-2 text-[12px] text-[var(--text-secondary)]">{msg}</p> : null}

      {shown.length === 0 ? (
        <p className="px-3.5 py-8 text-center text-sm text-[var(--text-muted)]">
          {rows.length === 0 ? "Nobody has registered yet." : "No registration matches that search."}
        </p>
      ) : (
        <table className="ma-cards ma-reg w-full text-xs">
          <thead>
            <tr className="bg-slate-50 text-left text-[10.4px] uppercase tracking-wide text-[var(--text-muted)]">
              <th className="w-10 px-3.5 py-2">
                <input type="checkbox" aria-label="Select all shown" checked={allShownPicked}
                  ref={(el) => { if (el) el.indeterminate = selected.length > 0 && !allShownPicked; }}
                  onChange={() => setPicked(allShownPicked ? new Set() : new Set(shown.map((r) => r.id)))} />
              </th>
              <th className="px-3.5 py-2 font-bold">Attendee</th>
              <th className="px-3.5 py-2 font-bold">Type</th>
              <th className="px-3.5 py-2 font-bold">Registered by</th>
              <th className="px-3.5 py-2 font-bold">Event</th>
              <th className="px-3.5 py-2 font-bold">Registered</th>
              <th className="w-10 px-3.5 py-2"><span className="sr-only">Delete</span></th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id} className={`border-t border-[var(--border-subtle)] ${picked.has(r.id) ? "bg-sky-50/50" : ""}`}>
                <td className="ma-x px-3.5 py-2">
                  <input type="checkbox" checked={picked.has(r.id)} onChange={() => toggle(r.id)}
                    aria-label={`Select ${r.contactName ?? r.contactEmail ?? "registration"}`} />
                </td>
                <td className="ma-a px-3.5 py-2">
                  <span className="block font-medium text-[var(--navy)]">{r.contactName ?? "—"}</span>
                  <span className="block text-[10.4px] text-[var(--text-muted)]">
                    {[r.contactEmail, r.company].filter(Boolean).join(" · ") || "—"}
                  </span>
                </td>
                <td className="ma-t px-3.5 py-2">
                  {r.attendeeType ? (
                    <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${TYPE_STYLE[r.attendeeType] ?? "bg-slate-100 text-slate-600"}`}>
                      {r.attendeeType}
                    </span>
                  ) : <span className="text-[var(--text-muted)]">—</span>}
                </td>
                <td className="ma-b px-3.5 py-2 text-[var(--text-secondary)]">{r.registeredBy === "staff" ? "Staff" : "Self"}</td>
                <td className="ma-e px-3.5 py-2 text-[var(--text-secondary)]">{r.eventTitle ?? "—"}</td>
                <td className="ma-d px-3.5 py-2 text-[var(--text-muted)]">{fmt(r.createdAt)}</td>
                <td className="ma-r px-3.5 py-2">
                  <button type="button" onClick={() => void ask([r.id])}
                    aria-label={`Delete ${r.contactName ?? r.contactEmail ?? "registration"}`}
                    className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-700">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <ImpactConfirm
        open={asking !== null}
        tone="danger"
        title={asking && asking.length === 1 ? "Delete this registration?" : `Delete ${asking?.length ?? 0} registrations?`}
        subtitle={asking ? namesOf(asking) : undefined}
        lines={lines}
        loading={impact === null}
        note="Only the registration is deleted. A person's account, if they have one, is not touched."
        confirmText="DELETE"
        confirmLabel={busy ? "Deleting…" : asking && asking.length === 1 ? "Delete registration" : `Delete ${asking?.length ?? 0} registrations`}
        onConfirm={() => void confirmDelete()}
        onCancel={() => { if (!busy) setAsking(null); }}
      />
    </div>
  );
}
