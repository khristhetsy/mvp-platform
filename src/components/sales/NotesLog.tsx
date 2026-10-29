"use client";

/**
 * Notes log for the admin contact page: notes and every logged communication in one
 * timeline, with chips, tags, PT timestamps with the year, and Show more for entries
 * older than 1 year. Live Odoo chatter is merged in exactly as the previous Note Log
 * showed it (same set, de-duplicated by id). Notes (iCapOS and Odoo) keep edit, delete,
 * a 10 second Undo and Recently deleted, through the existing /api/sales/chatter routes.
 * Auto entries have no edit or delete. Admin only: no founder page renders this.
 * Data: GET /api/admin/contacts/[id]/notes-log (src/lib/notes-log.ts).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { formatPhone } from "@/lib/phone";
import type { NotesLogChip, NotesLogCounts, NotesLogEntry, NotesLogPage } from "@/lib/notes-log";
import type { OdooNoteTarget } from "@/lib/crm-connectors/odoo/notes";

type Win = "recent" | "older";
type Cursor = { cursor: string | null; hasMore: boolean };
type Undo =
  | { type: "delete"; id: string; label: string; left: number }
  | { type: "edit"; id: string; prevText: string; prevEditedAt: string | null; left: number };
type Deleted = { id: string; summary: string; deleted_at: string | null };
const UNDO_SECONDS = 10;

const CHIPS: Array<{ key: NotesLogChip; label: string }> = [
  { key: "all", label: "All" }, { key: "notes", label: "Notes" }, { key: "email", label: "Email" },
  { key: "messages", label: "Messages" }, { key: "calls", label: "Calls" },
  { key: "sequences", label: "Sequences" }, { key: "marketing", label: "Marketing" },
];

const KIND_ICON: Record<string, { icon: string; color: string; bg: string }> = {
  note: { icon: "ti-note", color: "#185FA5", bg: "#E6F1FB" },
  opp_note: { icon: "ti-note", color: "#185FA5", bg: "#E6F1FB" },
  odoo_note: { icon: "ti-note", color: "#854D0E", bg: "#FEF9C3" },
  email: { icon: "ti-mail", color: "#185FA5", bg: "#E6F1FB" },
  email_draft: { icon: "ti-mail", color: "#854F0B", bg: "#FAEEDA" },
  odoo_message: { icon: "ti-mail", color: "#185FA5", bg: "#E6F1FB" },
  message: { icon: "ti-message", color: "#854F0B", bg: "#FAEEDA" },
  call: { icon: "ti-phone", color: "#0F6E56", bg: "#E1F5EE" },
  sequence: { icon: "ti-list-numbers", color: "#1A6CE4", bg: "#E6F1FB" },
  marketing: { icon: "ti-speakerphone", color: "#6B21A8", bg: "#F3E8FF" },
  note_edited: { icon: "ti-pencil", color: "#5F5E5A", bg: "#F1EFE8" },
  note_deleted: { icon: "ti-trash", color: "#5F5E5A", bg: "#F1EFE8" },
  note_restored: { icon: "ti-restore", color: "#5F5E5A", bg: "#F1EFE8" },
  task_created: { icon: "ti-calendar-plus", color: "#854F0B", bg: "#FAEEDA" },
  task_done: { icon: "ti-check", color: "#0F6E56", bg: "#E1F5EE" },
  stage_changed: { icon: "ti-arrow-right", color: "#5F5E5A", bg: "#F1EFE8" },
  won: { icon: "ti-trophy", color: "#0F6E56", bg: "#E1F5EE" },
  lost: { icon: "ti-x", color: "#A32D2D", bg: "#FCEBEB" },
  converted: { icon: "ti-refresh", color: "#185FA5", bg: "#E6F1FB" },
  outreach_queued: { icon: "ti-clock", color: "#5F5E5A", bg: "#F1EFE8" },
  outreach_sent: { icon: "ti-send", color: "#0F6E56", bg: "#E1F5EE" },
  intro: { icon: "ti-arrows-exchange", color: "#185FA5", bg: "#E6F1FB" },
};
function icon(kind: string) { return KIND_ICON[kind] ?? { icon: "ti-point", color: "#5F5E5A", bg: "#F1EFE8" }; }

const TAG: Record<string, { label: string; color: string; bg: string }> = {
  auto: { label: "Auto", color: "#5F5E5A", bg: "#F1EFE8" },
  inbound: { label: "Inbound", color: "#0F6E56", bg: "#E1F5EE" },
  marketing: { label: "Marketing", color: "#6B21A8", bg: "#F3E8FF" },
};
const OUTCOME: Record<string, string> = { answered: "Answered", no_answer: "No answer", voicemail: "Voicemail", busy: "Busy" };

const PT = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
function ptStamp(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : `${PT.format(d).replace(/[  ]/g, " ")} PT`;
}
function duration(s: number): string { const m = Math.floor(s / 60); return `${m}:${String(Math.round(s % 60)).padStart(2, "0")}`; }
function firstLine(t: string): string { const l = t.trim().split("\n")[0] ?? ""; return l.length > 60 ? `${l.slice(0, 57)}...` : l; }
// Postgres ("+00:00") and Odoo ("Z") timestamps are compared as times, never as strings.
function ms(iso: string): number { const t = Date.parse(iso); return Number.isNaN(t) ? 0 : t; }
function byNewest(a: NotesLogEntry, b: NotesLogEntry) { return ms(b.created_at) - ms(a.created_at); }
function oldest(list: NotesLogEntry[]): string | null { return list.length ? list.reduce((m, e) => (ms(e.created_at) < ms(m) ? e.created_at : m), list[0].created_at) : null; }
const SYSTEM = (e: NotesLogEntry) => e.chip === null;

export function NotesLog({ contactCrmId, reloadKey, onOdooTarget }: {
  contactCrmId: string;
  /** Bumped by the parent after a send, note or task so the log refetches. */
  reloadKey: number;
  onOdooTarget?: (t: OdooNoteTarget | null) => void;
}) {
  const [chip, setChip] = useState<NotesLogChip>("all");
  const [native, setNative] = useState<Map<string, NotesLogEntry>>(new Map());
  const [odoo, setOdoo] = useState<NotesLogEntry[]>([]);
  const [counts, setCounts] = useState<NotesLogCounts | null>(null);
  const [cutoff, setCutoff] = useState<string | null>(null);
  const [cursors, setCursors] = useState<Record<Win, Cursor>>({ recent: { cursor: null, hasMore: false }, older: { cursor: null, hasMore: false } });
  const [exhausted, setExhausted] = useState<Set<string>>(new Set());
  const [showOlder, setShowOlder] = useState(false);
  const [olderLoaded, setOlderLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [flashMsg, setFlashMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [undo, setUndo] = useState<Undo | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);
  const [deleted, setDeleted] = useState<Deleted[]>([]);
  const undoTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const showOlderRef = useRef(showOlder);
  useEffect(() => { showOlderRef.current = showOlder; }, [showOlder]);

  const base = `/api/admin/contacts/${encodeURIComponent(contactCrmId)}/notes-log`;
  const scopeQ = `contactCrmId=${encodeURIComponent(contactCrmId)}`;

  const fetchPage = useCallback(async (params: { kind?: NotesLogChip; before?: string | null }): Promise<NotesLogPage> => {
    const q = new URLSearchParams();
    if (params.kind && params.kind !== "all") q.set("kind", params.kind);
    if (params.before) q.set("before", params.before);
    const res = await fetch(`${base}${q.size ? `?${q}` : ""}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Couldn't load the Notes log.");
    return data as NotesLogPage;
  }, [base]);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const first = await fetchPage({});
      const older = showOlderRef.current && first.cutoff ? await fetchPage({ before: first.cutoff }) : null;
      const map = new Map<string, NotesLogEntry>();
      for (const e of [...first.entries, ...(older?.entries ?? [])]) map.set(e.id, e);
      setNative(map);
      setOdoo(first.odoo ?? []);
      setCounts(first.counts);
      setCutoff(first.cutoff);
      setCursors({
        recent: { cursor: oldest(first.entries), hasMore: first.hasMore },
        older: older ? { cursor: oldest(older.entries) ?? first.cutoff, hasMore: older.hasMore } : { cursor: first.cutoff, hasMore: false },
      });
      setExhausted(new Set());
      setOlderLoaded(Boolean(older));
      onOdooTarget?.(first.odooTarget ?? null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't load the Notes log.");
    } finally {
      setLoading(false);
    }
  }, [fetchPage, onOdooTarget]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- load on mount and when the parent logs something
  useEffect(() => { void load(); }, [load, reloadKey]);
  useEffect(() => () => { if (undoTimer.current) clearInterval(undoTimer.current); }, []);

  function flash(kind: "ok" | "err", text: string) {
    setFlashMsg({ kind, text });
    setTimeout(() => setFlashMsg(null), 4000);
  }

  // ------------------------------------------------------------ derived lists

  const all = useMemo(() => {
    const merged = new Map(native);
    for (const e of odoo) if (!merged.has(e.id)) merged.set(e.id, e);
    return [...merged.values()].sort(byNewest);
  }, [native, odoo]);

  const inWin = useCallback((e: NotesLogEntry, w: Win) => {
    if (!cutoff) return w === "recent";
    return w === "recent" ? ms(e.created_at) >= ms(cutoff) : ms(e.created_at) < ms(cutoff);
  }, [cutoff]);

  const visible = useCallback((w: Win) => all.filter((e) => inWin(e, w) && (chip === "all" || e.chip === chip)), [all, chip, inWin]);
  const recent = visible("recent");
  const older = visible("older");

  function countFor(c: NotesLogChip, w: Win): number { return counts ? counts[w][c] : 0; }
  function chipCount(c: NotesLogChip): number { return countFor(c, "recent") + (showOlder ? countFor(c, "older") : 0); }

  function canLoadMore(w: Win): boolean {
    if (w === "older" && !showOlder) return false;
    const cur = cursors[w];
    if (chip === "all") return cur.hasMore;
    if (exhausted.has(`${w}:${chip}`) || !cur.hasMore) return false;
    return visible(w).length < countFor(chip, w);
  }

  async function loadMore(w: Win) {
    setBusy(true);
    try {
      if (chip === "all") {
        const page = await fetchPage({ before: cursors[w].cursor ?? (w === "older" ? cutoff : null) });
        setNative((m) => { const n = new Map(m); for (const e of page.entries) n.set(e.id, e); return n; });
        setCursors((c) => ({ ...c, [w]: { cursor: oldest(page.entries) ?? c[w].cursor, hasMore: page.hasMore } }));
      } else {
        // Everything newer than the oldest loaded row of this chip is already loaded.
        // Odoo chatter is not paged, so only rows from the paged queries set the cursor.
        const own = [...native.values()].filter((e) => inWin(e, w) && e.chip === chip);
        const before = oldest(own) ?? cursors[w].cursor ?? (w === "older" ? cutoff : null);
        const page = await fetchPage({ kind: chip, before });
        setNative((m) => { const n = new Map(m); for (const e of page.entries) n.set(e.id, e); return n; });
        if (!page.hasMore) setExhausted((s) => new Set(s).add(`${w}:${chip}`));
      }
    } catch (e) {
      flash("err", e instanceof Error ? e.message : "Couldn't load more.");
    } finally { setBusy(false); }
  }

  async function toggleOlder() {
    if (showOlder) { setShowOlder(false); return; }
    setShowOlder(true);
    if (olderLoaded) return;
    setBusy(true);
    try {
      const page = await fetchPage({ before: cutoff });
      setNative((m) => { const n = new Map(m); for (const e of page.entries) n.set(e.id, e); return n; });
      setCursors((c) => ({ ...c, older: { cursor: oldest(page.entries) ?? cutoff, hasMore: page.hasMore } }));
      setOlderLoaded(true);
    } catch (e) {
      flash("err", e instanceof Error ? e.message : "Couldn't load older entries.");
    } finally { setBusy(false); }
  }

  // ------------------------------------------------------------ notes: edit, delete, undo

  function startUndo(u: Undo) {
    if (undoTimer.current) clearInterval(undoTimer.current);
    setUndo(u);
    undoTimer.current = setInterval(() => {
      setUndo((cur) => {
        if (!cur) return null;
        if (cur.left <= 1) { if (undoTimer.current) clearInterval(undoTimer.current); return null; }
        return { ...cur, left: cur.left - 1 };
      });
    }, 1000);
  }
  function clearUndo() { if (undoTimer.current) clearInterval(undoTimer.current); setUndo(null); }

  async function noteRequest(id: string, init: RequestInit): Promise<{ id: string } | null> {
    const res = await fetch(`/api/sales/chatter/notes/${encodeURIComponent(id)}${init.method === "DELETE" ? `?${scopeQ}` : ""}`, {
      ...init, headers: { "Content-Type": "application/json" },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { flash("err", data.error ?? "Something went wrong. Try again."); return null; }
    return (data.note ?? null) as { id: string } | null;
  }

  async function loadDeleted() {
    try {
      const res = await fetch(`/api/sales/chatter?${scopeQ}&deleted=1`);
      const d = res.ok ? await res.json() : { deleted: [] };
      setDeleted((d.deleted ?? []) as Deleted[]);
    } catch { /* leave as-is */ }
  }

  async function toggleDeleted() {
    const next = !showDeleted;
    setShowDeleted(next);
    if (next) await loadDeleted();
  }

  async function saveEdit() {
    if (!editing) return;
    const item = all.find((a) => a.id === editing.id);
    if (!item) { setEditing(null); return; }
    const text = editing.text.trim();
    if (!text) { flash("err", "A note can't be empty. Delete it instead."); return; }
    if (text === item.summary.trim()) { setEditing(null); return; }
    setBusy(true);
    try {
      const saved = await noteRequest(item.id, { method: "PATCH", body: JSON.stringify({ action: "edit", text, contactCrmId }) });
      if (!saved) return;
      setEditing(null);
      startUndo({ type: "edit", id: saved.id, prevText: item.summary, prevEditedAt: item.edited_at, left: UNDO_SECONDS });
      await load();
    } finally { setBusy(false); }
  }

  async function removeNote(item: NotesLogEntry) {
    setBusy(true);
    setNative((m) => { const n = new Map(m); n.delete(item.id); return n; });
    setOdoo((l) => l.filter((e) => e.id !== item.id));
    try {
      const gone = await noteRequest(item.id, { method: "DELETE" });
      if (!gone) { await load(); return; }
      startUndo({ type: "delete", id: gone.id, label: firstLine(item.summary), left: UNDO_SECONDS });
      await load();
      if (showDeleted) await loadDeleted();
    } finally { setBusy(false); }
  }

  async function restore(id: string) {
    setBusy(true);
    try {
      const back = await noteRequest(id, { method: "PATCH", body: JSON.stringify({ action: "restore", contactCrmId }) });
      if (back) { flash("ok", "Note restored."); await Promise.all([load(), showDeleted ? loadDeleted() : Promise.resolve()]); }
    } finally { setBusy(false); }
  }

  async function runUndo() {
    const u = undo;
    if (!u) return;
    clearUndo();
    if (u.type === "delete") { await restore(u.id); return; }
    setBusy(true);
    try {
      const back = await noteRequest(u.id, { method: "PATCH", body: JSON.stringify({ action: "edit", text: u.prevText, undo: { editedAt: u.prevEditedAt }, contactCrmId }) });
      if (back) await load();
    } finally { setBusy(false); }
  }

  // ------------------------------------------------------------ render

  const sectionLabel: React.CSSProperties = { fontSize: 10.5, fontWeight: 600, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.04em" };
  const iconBtn: React.CSSProperties = { background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)", fontSize: 14, padding: 2, lineHeight: 1 };
  const ghostBtn: React.CSSProperties = { fontSize: 11.5, color: "var(--foreground)", background: "#fff", border: "0.5px solid #d7dbe3", borderRadius: 6, padding: "4px 10px", cursor: "pointer" };
  const pill = (color: string, bg: string): React.CSSProperties => ({ fontSize: 10, color, background: bg, borderRadius: 4, padding: "1px 6px", whiteSpace: "nowrap" });
  const odooBadge = pill("#6B21A8", "#F3E8FF");
  const viaBadge = pill("#185FA5", "#E6F1FB");
  const field: React.CSSProperties = { width: "100%", fontSize: 12.5, padding: "8px 10px", borderRadius: 8, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--foreground)", boxSizing: "border-box" };
  const primary: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: "#fff", background: "#185FA5", border: "none", borderRadius: 8, padding: "5px 12px", cursor: "pointer" };
  const detail: React.CSSProperties = { fontSize: 11.5, color: "var(--muted-foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };

  function title(e: NotesLogEntry) {
    if (!e.meta.href) return <>{e.summary}</>;
    return (
      <Link href={e.meta.href} style={{ color: "#185FA5", textDecoration: "underline", textUnderlineOffset: 2 }}>
        {e.summary}<i className="ti ti-chevron-right" aria-hidden="true" style={{ fontSize: 12, marginLeft: 2, verticalAlign: -1 }} />
      </Link>
    );
  }

  function entry(e: NotesLogEntry) {
    const ic = icon(e.kind);
    if (SYSTEM(e)) {
      return (
        <div style={{ fontSize: 11.5, color: "var(--muted-foreground)", display: "flex", gap: 8, paddingLeft: 4 }}>
          <i className={`ti ${ic.icon}`} aria-hidden="true" style={{ marginTop: 2 }} />
          <span style={{ minWidth: 0 }}>{title(e)} · {e.actor_name ? `${e.actor_name} · ` : ""}{e.created_at_pt}</span>
        </div>
      );
    }
    const isNote = e.chip === "notes";
    const isEditing = editing?.id === e.id;
    const m = e.meta;
    const tag = e.tag ? TAG[e.tag] : null;
    return (
      <div style={{ display: "flex", gap: 9 }}>
        <div style={{ width: 26, height: 26, borderRadius: "50%", background: ic.bg, color: ic.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><i className={`ti ${ic.icon}`} aria-hidden="true" /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", minWidth: 0 }}>
              {!isNote && <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--foreground)", whiteSpace: "pre-wrap" }}>{title(e)}</span>}
              {tag && <span style={pill(tag.color, tag.bg)}>{tag.label}</span>}
              {e.source === "odoo" && <span style={odooBadge}><i className="ti ti-refresh" aria-hidden="true" /> {e.origin ?? "Odoo"}</span>}
              {e.odoo_synced && <span style={odooBadge}><i className="ti ti-check" aria-hidden="true" /> Also in Odoo</span>}
              {m.via === "icapos" ? <span style={viaBadge}><i className="ti ti-building" aria-hidden="true" /> via iCapOS</span> : m.via === "gmail" ? <span style={viaBadge}><i className="ti ti-brand-gmail" aria-hidden="true" /> via Gmail</span> : null}
            </div>
            {e.editable && !isEditing && (
              <span style={{ display: "inline-flex", gap: 2, flexShrink: 0 }}>
                <button type="button" aria-label="Edit note" title="Edit" onClick={() => setEditing({ id: e.id, text: e.summary })} disabled={busy} style={iconBtn}><i className="ti ti-pencil" aria-hidden="true" /></button>
                <button type="button" aria-label="Delete note" title="Delete" onClick={() => removeNote(e)} disabled={busy} style={iconBtn}><i className="ti ti-trash" aria-hidden="true" /></button>
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 1 }}>
            {e.actor_name ? `${e.actor_name} · ` : ""}{e.created_at_pt}{e.edited_at ? " · edited" : ""}
          </div>

          {isNote && (isEditing ? (
            <div style={{ marginTop: 4 }}>
              <textarea value={editing.text} onChange={(ev) => setEditing({ id: e.id, text: ev.target.value })} rows={Math.min(12, Math.max(3, editing.text.split("\n").length + 1))} style={field} autoFocus />
              {e.source === "odoo" && <p style={{ fontSize: 11, color: "var(--muted-foreground)", margin: "4px 0 0" }}>Your edit shows in iCapOS. The note in Odoo keeps its original text.</p>}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginTop: 6 }}>
                <button type="button" onClick={() => setEditing(null)} style={ghostBtn}>Cancel</button>
                <button type="button" onClick={saveEdit} disabled={busy || !editing.text.trim()} style={{ ...primary, opacity: busy || !editing.text.trim() ? 0.5 : 1 }}>Save</button>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 12.5, color: "var(--foreground)", whiteSpace: "pre-wrap", marginTop: 3, lineHeight: 1.55 }}>{e.summary}</div>
          ))}

          {!isNote && (
            <div style={{ display: "flex", flexDirection: "column", gap: 1, marginTop: 3 }}>
              {m.to && <div style={detail}>To: {m.to}</div>}
              {m.subject && <div style={detail}>Subject: {m.subject}</div>}
              {m.campaign_name && <div style={detail}>Campaign: {m.campaign_name}</div>}
              {m.step != null && <div style={detail}>Step {m.step}</div>}
              {m.investor_matches && (
                <div style={{ ...detail, whiteSpace: "normal" }}>
                  Investor matches in the host&apos;s copy (top {m.investor_matches.matches.length} of {m.investor_matches.total}): {m.investor_matches.matches.map((x) => `${x.company} ${x.fit}%`).join(" · ")}
                </div>
              )}
              {e.chip === "calls" && (m.direction || m.phone || m.duration_seconds != null || m.outcome) && (
                <div style={{ ...detail, whiteSpace: "normal" }}>
                  {[m.direction === "inbound" ? "Inbound" : m.direction === "outbound" ? "Outbound" : null, m.phone ? formatPhone(m.phone) : null,
                    m.duration_seconds != null ? duration(m.duration_seconds) : null, m.outcome ? OUTCOME[m.outcome] ?? m.outcome : null].filter(Boolean).join(" · ")}
                  {m.recording_url && <> · <a href={m.recording_url} target="_blank" rel="noopener noreferrer" style={{ color: "#185FA5" }}><i className="ti ti-player-play" aria-hidden="true" /> Listen</a></>}
                </div>
              )}
              {m.preview && <div style={{ fontSize: 12, color: "var(--foreground)", opacity: 0.85, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", lineHeight: 1.45 }}>{m.preview}</div>}
            </div>
          )}
        </div>
      </div>
    );
  }

  function list(items: NotesLogEntry[], w: Win) {
    return (
      <>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {items.map((e) => <div key={e.id}>{entry(e)}</div>)}
        </div>
        {canLoadMore(w) && (
          <div style={{ marginTop: 10 }}><button type="button" onClick={() => loadMore(w)} disabled={busy} style={ghostBtn}>Load more</button></div>
        )}
      </>
    );
  }

  const chipLabel = CHIPS.find((c) => c.key === chip)?.label ?? "entries";
  const olderCount = countFor(chip, "older");

  return (
    <div style={{ padding: "10px 12px", borderTop: "0.5px solid #eef1f5" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <div style={sectionLabel}>Notes log</div>
        <button type="button" onClick={toggleDeleted} style={{ fontSize: 11, color: "var(--muted-foreground)", background: "none", border: "none", cursor: "pointer" }}>
          <i className="ti ti-trash" aria-hidden="true" /> Recently deleted{showDeleted ? ` · ${deleted.length}` : ""} <i className={`ti ${showDeleted ? "ti-chevron-up" : "ti-chevron-down"}`} aria-hidden="true" />
        </button>
      </div>

      <div role="tablist" aria-label="Filter the Notes log" style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, marginBottom: 10, WebkitOverflowScrolling: "touch" }}>
        {CHIPS.map((c) => {
          const on = chip === c.key;
          return (
            <button key={c.key} type="button" role="tab" aria-selected={on} onClick={() => setChip(c.key)}
              style={{ flexShrink: 0, fontSize: 11.5, cursor: "pointer", border: "none", borderRadius: 14, padding: "4px 11px", background: on ? "#1A6CE4" : "var(--muted)", color: on ? "#fff" : "var(--muted-foreground)", whiteSpace: "nowrap" }}>
              {c.label}{counts ? ` ${chipCount(c.key)}` : ""}
            </button>
          );
        })}
      </div>

      {showDeleted && (
        <div style={{ border: "0.5px dashed #d7dbe3", borderRadius: 8, padding: "8px 10px", marginBottom: 10 }}>
          {deleted.length === 0 ? <p style={{ fontSize: 11.5, color: "var(--muted-foreground)", margin: 0 }}>No notes deleted in the last 30 days.</p> : deleted.map((d) => (
            <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "4px 0" }}>
              <span style={{ fontSize: 12, color: "var(--muted-foreground)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{firstLine(d.summary)} · deleted {ptStamp(d.deleted_at)}</span>
              <button type="button" onClick={() => restore(d.id)} disabled={busy} style={ghostBtn}>Restore</button>
            </div>
          ))}
        </div>
      )}

      {undo && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, fontSize: 12, background: "#F1EFE8", color: "#444441", borderRadius: 8, padding: "7px 10px", marginBottom: 10 }}>
          <span><i className={`ti ${undo.type === "delete" ? "ti-trash" : "ti-pencil"}`} aria-hidden="true" /> {undo.type === "delete" ? `Note deleted: ${undo.label}` : "Note edited"}</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>{undo.left}s <button type="button" onClick={runUndo} disabled={busy} style={ghostBtn}>Undo</button></span>
        </div>
      )}

      {flashMsg && <p style={{ fontSize: 12, margin: "0 0 8px", color: flashMsg.kind === "err" ? "#A32D2D" : "#0F6E56" }}>{flashMsg.text}</p>}

      {loading ? <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: 0 }}>Loading the Notes log…</p>
        : err ? (
          <p style={{ fontSize: 12, color: "#A32D2D", margin: 0 }}>{err} <button type="button" onClick={() => { setLoading(true); void load(); }} style={ghostBtn}>Retry</button></p>
        ) : (
          <>
            {recent.length === 0
              ? <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: 0 }}>{chip === "all" ? "Nothing in the last 12 months." : `No ${chipLabel.toLowerCase()} in the last 12 months.`}</p>
              : list(recent, "recent")}

            {olderCount > 0 && (
              <div style={{ marginTop: 14 }}>
                {showOlder && (
                  <>
                    <div style={{ ...sectionLabel, margin: "4px 0 10px", paddingTop: 10, borderTop: "0.5px dashed #e2e6ed" }}>Older than 1 year</div>
                    {list(older, "older")}
                  </>
                )}
                <button type="button" onClick={toggleOlder} disabled={busy} style={{ ...ghostBtn, marginTop: showOlder ? 10 : 0 }}>
                  {showOlder ? "Show less" : `Show more (${olderCount} older than 1 year)`}
                </button>
              </div>
            )}
          </>
        )}
    </div>
  );
}
