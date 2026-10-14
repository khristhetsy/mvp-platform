"use client";
// Task title / Activity field with a shared list of ready made titles (Proposal, Call, Email).
// Picking one fills the title and sets the type. Text that is not in the list can be saved
// as a new option for the whole team. Used on a contact's Tasks tab and Activities tab.
import { useEffect, useState } from "react";

type TitleOpt = { id: string; title: string; task_type: string };

export function TaskTitleInput({ value, placeholder, inputStyle, allowedTypes, taskType, autoFocus, onChange }: {
  value: string;
  placeholder: string;
  inputStyle: React.CSSProperties;
  /** Types the surrounding Type dropdown can show. A picked option only sets the type when it is one of these. */
  allowedTypes: readonly string[];
  /** Current value of the Type dropdown, used to say where a new option will be saved. */
  taskType: string;
  autoFocus?: boolean;
  onChange: (next: { title: string; taskType?: string }) => void;
}) {
  const [opts, setOpts] = useState<TitleOpt[]>([]);
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");

  async function load() {
    try {
      const res = await fetch("/api/sales/task-titles");
      const data = res.ok ? await res.json() : { options: [] };
      setOpts(data.options ?? []);
    } catch { /* keep whatever is already loaded */ }
  }
  useEffect(() => { void load(); }, []);

  async function saveNew() {
    const title = value.trim();
    if (!title) return;
    try {
      const res = await fetch("/api/sales/task-titles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, taskType }) });
      if (!res.ok) { setMsg((await res.json().catch(() => ({})))?.error || "Couldn’t save the option."); return; }
      await load();
      setMsg(`Saved. “${title}” is now in the list under ${taskType}.`);
    } catch { setMsg("Network error. Couldn’t save the option."); }
    setOpen(false);
  }

  const q = value.trim().toLowerCase();
  const shown = opts.filter((o) => !q || o.title.toLowerCase().includes(q));
  const types = ["Proposal", "Call", "Email", ...Array.from(new Set(opts.map((o) => o.task_type))).filter((t) => !["Proposal", "Call", "Email"].includes(t))];
  const exact = opts.some((o) => o.title.toLowerCase() === q);

  return (
    <div style={{ position: "relative", minWidth: 0 }} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false); }}>
      <div style={{ ...inputStyle, display: "flex", alignItems: "center", gap: 6, padding: "0 9px", height: 32, boxSizing: "border-box", ...(open ? { borderColor: "#185FA5" } : {}) }}>
        <input value={value} onChange={(e) => { onChange({ title: e.target.value }); setMsg(""); setOpen(true); }} onFocus={() => setOpen(true)} onClick={() => setOpen(true)} onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }} placeholder={placeholder} autoComplete="off" autoFocus={autoFocus} style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", fontSize: 12, color: "var(--foreground)" }} />
        <button type="button" aria-label="Show suggestions" onClick={() => setOpen((o) => !o)} style={{ border: "none", background: "none", color: "var(--muted-foreground)", cursor: "pointer", fontSize: 11, padding: 2 }}>▾</button>
      </div>
      {open && (
        <div role="listbox" style={{ position: "absolute", zIndex: 20, left: 0, right: 0, top: 36, maxHeight: 340, overflowY: "auto", background: "#fff", border: "0.5px solid #d7dbe3", borderRadius: 8, boxShadow: "0 8px 24px rgba(10,20,40,.16)", padding: 6 }}>
          {types.map((t) => {
            const items = shown.filter((o) => o.task_type === t);
            if (items.length === 0) return null;
            return (
              <div key={t}>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted-foreground)", padding: "6px 8px 3px" }}>{t}</div>
                {items.map((o) => (
                  <button key={o.id} type="button" role="option" aria-selected={value === o.title} onMouseDown={(e) => e.preventDefault()} onClick={() => { onChange({ title: o.title, taskType: allowedTypes.includes(o.task_type) ? o.task_type : undefined }); setOpen(false); setMsg(""); }} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", border: "none", background: value === o.title ? "#F0F5FC" : "none", borderRadius: 6, padding: "7px 8px", cursor: "pointer", fontSize: 12.5, color: "var(--foreground)" }}>
                    <span style={{ flex: 1, minWidth: 0 }}>{o.title}</span>
                    <span style={{ fontSize: 10.5, fontWeight: 600, padding: "1px 7px", borderRadius: 999, background: "#E6F1FB", color: "#185FA5", whiteSpace: "nowrap" }}>{o.task_type}</span>
                  </button>
                ))}
              </div>
            );
          })}
          {q && shown.length === 0 && <div style={{ padding: 8, fontSize: 12, color: "var(--muted-foreground)" }}>No match. Your text will be used as the title.</div>}
          {q && !exact && (
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={saveNew} style={{ display: "block", width: "100%", textAlign: "left", marginTop: 6, border: "1px dashed #0F6E56", background: "#E1F5EE", color: "#0F6E56", borderRadius: 6, padding: 8, fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>+ Save “{value.trim()}” as a new option under {taskType}</button>
          )}
        </div>
      )}
      {msg && <div role="status" style={{ fontSize: 11.5, color: "#0F6E56", marginTop: 3 }}>{msg}</div>}
    </div>
  );
}
