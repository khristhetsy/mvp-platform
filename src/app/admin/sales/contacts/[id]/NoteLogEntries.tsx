"use client";

// Note Log list of iCapOS notes with edit, delete and a 10 second undo.
// The notes live in one text column; every change sends the full new text plus
// the text this screen last saw, so the server can refuse a stale overwrite.
import { useEffect, useRef, useState } from "react";
import { deleteNoteEntry, editNoteEntry, parseNoteLog } from "@/lib/sales/note-log";

type Undo = { kind: "edit" | "delete"; prev: string; current: string; index: number };
const UNDO_SECONDS = 10;

export function NoteLogEntries({ contactId, notes, onChange }: { contactId: string; notes: string | null; onChange: (next: string) => void }) {
  const blob = notes ?? "";
  const entries = parseNoteLog(blob);
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [draftErr, setDraftErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [undo, setUndo] = useState<Undo | null>(null);
  const [left, setLeft] = useState(UNDO_SECONDS);
  const [flash, setFlash] = useState<number | null>(null);
  const undoRef = useRef<() => void>(() => {});

  // A new note (or any outside change) makes the pending undo stale, so drop it.
  const activeUndo = undo && undo.current === blob ? undo : null;

  useEffect(() => {
    if (!activeUndo) return;
    setLeft(UNDO_SECONDS);
    const t = setInterval(() => setLeft((s) => {
      if (s <= 1) { clearInterval(t); setUndo(null); return 0; }
      return s - 1;
    }), 1000);
    return () => clearInterval(t);
  }, [activeUndo]);

  useEffect(() => {
    if (flash === null) return;
    const t = setTimeout(() => setFlash(null), 1600);
    return () => clearTimeout(t);
  }, [flash]);

  async function write(next: string, action: "edit" | "delete" | "undo"): Promise<boolean> {
    setBusy(true); setErr(null);
    try {
      const res = await fetch(`/api/sales/contacts/${contactId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: next, expected: blob, action }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Save failed.");
      onChange(next);
      return true;
    } catch (e) { setErr(e instanceof Error ? e.message : "Save failed."); return false; } finally { setBusy(false); }
  }

  function startEdit(i: number) { setEditing(i); setDraft(entries[i]?.text ?? ""); setDraftErr(null); setErr(null); }

  async function saveEdit(i: number) {
    if (!draft.trim()) { setDraftErr("Note can't be empty."); return; }
    if (draft.trim() === entries[i]?.text.trim()) { setEditing(null); return; }
    const next = editNoteEntry(blob, i, draft);
    if (await write(next, "edit")) { setEditing(null); setUndo({ kind: "edit", prev: blob, current: next, index: i }); }
  }

  async function remove(i: number) {
    if (editing !== null) setEditing(null);
    const next = deleteNoteEntry(blob, i);
    if (await write(next, "delete")) setUndo({ kind: "delete", prev: blob, current: next, index: i });
  }

  async function doUndo() {
    if (!activeUndo || busy) return;
    const u = activeUndo;
    if (await write(u.prev, "undo")) { setUndo(null); setFlash(u.index); }
  }
  // Keep the keyboard shortcut pointed at the latest doUndo; set after render, not during it.
  useEffect(() => { undoRef.current = doUndo; });

  // Ctrl/Cmd+Z undoes while the bar is showing (but not while typing in a field).
  useEffect(() => {
    if (!activeUndo) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === "z" && tag !== "TEXTAREA" && tag !== "INPUT") {
        e.preventDefault(); undoRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeUndo]);

  if (entries.length === 0 && !activeUndo) return null;

  const isDel = activeUndo?.kind === "delete";
  const iconBtn: React.CSSProperties = { width: 26, height: 26, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 14, background: "#fff", border: "0.5px solid #dfe3ea", borderRadius: 6, cursor: "pointer", padding: 0 };

  return (
    <div style={{ marginTop: 8 }}>
      <style>{`.nle-row:hover{background:#F5F9FF}.nle-row .nle-acts{opacity:0;transition:opacity .12s}.nle-row:hover .nle-acts,.nle-row:focus-within .nle-acts{opacity:1}@keyframes nleFlash{from{background:#E6F1FB}to{background:transparent}}`}</style>

      {activeUndo && (
        <div role="status" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontSize: 11.5, borderRadius: 8, padding: "6px 10px", marginBottom: 8, background: isDel ? "#FAEEDA" : "#E6F1FB", color: isDel ? "#854F0B" : "#185FA5", border: `0.5px solid ${isDel ? "#FAC775" : "#B5D4F4"}` }}>
          <span><i className={`ti ${isDel ? "ti-trash" : "ti-pencil"}`} aria-hidden="true" style={{ marginRight: 6 }} />{isDel ? "Note deleted." : "Note updated."} Undo available for {left}s</span>
          <button type="button" onClick={doUndo} disabled={busy} style={{ fontSize: 11, fontWeight: 600, color: "inherit", background: "#fff", border: "0.5px solid currentColor", borderRadius: 6, padding: "3px 10px", cursor: "pointer", opacity: busy ? 0.5 : 1 }}>
            <i className="ti ti-arrow-back-up" aria-hidden="true" /> Undo
          </button>
        </div>
      )}
      {err && <div style={{ fontSize: 11, color: "#A32D2D", marginBottom: 6 }}>{err}</div>}

      {entries.length > 0 && (
        <div style={{ border: "0.5px solid #eef1f5", borderRadius: 8, maxHeight: 340, overflow: "auto" }}>
          {entries.map((e) => e).reverse().map((e, pos, arr) => (
            <div key={`${e.index}-${e.raw.length}`} className="nle-row" style={{ position: "relative", padding: "8px 10px", borderBottom: pos === arr.length - 1 ? "none" : "0.5px solid #eef1f5", animation: flash === e.index ? "nleFlash 1.6s ease-out" : undefined }}>
              <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                <span style={{ fontWeight: 600, color: "#185FA5" }}><i className="ti ti-note" aria-hidden="true" /> {e.date ? new Date(`${e.date}T12:00:00`).toLocaleDateString() : "Note"}</span>
                <span style={{ fontSize: 9, marginLeft: 6 }}>· from iCapOS</span>
              </div>
              {editing === e.index ? (
                <div style={{ marginTop: 4 }}>
                  <textarea autoFocus value={draft} onChange={(ev) => { setDraft(ev.target.value); setDraftErr(null); }}
                    onKeyDown={(ev) => { if (ev.key === "Escape") setEditing(null); if (ev.key === "Enter" && (ev.metaKey || ev.ctrlKey)) saveEdit(e.index); }}
                    style={{ width: "100%", minHeight: 64, resize: "vertical", fontSize: 11.5, lineHeight: 1.5, border: "0.5px solid #B5D4F4", borderRadius: 6, padding: 6, boxSizing: "border-box" }} />
                  {draftErr && <div style={{ fontSize: 11, color: "#A32D2D", marginTop: 2 }}>{draftErr}</div>}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
                    <button type="button" onClick={() => saveEdit(e.index)} disabled={busy} style={{ fontSize: 11, fontWeight: 600, color: "#fff", background: "#2E78F5", border: "none", borderRadius: 6, padding: "5px 12px", cursor: "pointer", opacity: busy ? 0.5 : 1 }}>Save</button>
                    <button type="button" onClick={() => setEditing(null)} style={{ fontSize: 11, color: "var(--muted-foreground)", background: "#fff", border: "0.5px solid #dfe3ea", borderRadius: 6, padding: "5px 12px", cursor: "pointer" }}>Cancel</button>
                    <span style={{ fontSize: 10, color: "var(--muted-foreground)" }}>Esc to cancel</span>
                  </div>
                </div>
              ) : (
                <>
                  <div className="nle-acts" style={{ position: "absolute", top: 6, right: 8, display: "flex", gap: 4 }}>
                    <button type="button" aria-label="Edit note" title="Edit" disabled={busy} onClick={() => startEdit(e.index)} style={{ ...iconBtn, color: "#185FA5" }}><i className="ti ti-pencil" aria-hidden="true" /></button>
                    <button type="button" aria-label="Delete note" title="Delete" disabled={busy} onClick={() => remove(e.index)} style={{ ...iconBtn, color: "#A32D2D" }}><i className="ti ti-trash" aria-hidden="true" /></button>
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--foreground)", whiteSpace: "pre-wrap", lineHeight: 1.5, marginTop: 2, paddingRight: 64 }}>{e.text}</div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
