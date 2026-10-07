"use client";

/**
 * Template picker for the mass-email dialog: a search box and one collapsible group per
 * department. One group is open at a time (the selected template's, else
 * `defaultDepartment`); a search opens every group with a hit. "New template",
 * "New branded template" and "Duplicate selected" save a template to
 * Marketing › Templates and select it.
 */
import { useMemo, useState } from "react";
import { DEPARTMENTS } from "@/lib/marketing/department-grouping";
import { BrandedTemplateEditor } from "@/components/marketing/BrandedTemplateEditor";

export type PickerTemplate = { id: string; name: string; subject: string; html_body: string; department: string | null };

const inp: React.CSSProperties = { fontSize: 12.5, padding: "7px 9px", borderRadius: 8, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--foreground)", boxSizing: "border-box" };
const OTHER = "Other";
const deptOf = (t: PickerTemplate) => t.department || OTHER;

export function TemplatePicker({ templates, value, onPick, onCreated, defaultDepartment, mergeTags = ["first_name", "company"] }: {
  templates: PickerTemplate[]; value: string; onPick: (id: string) => void; onCreated: (t: PickerTemplate) => void;
  defaultDepartment?: string; mergeTags?: string[];
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  // undefined = follow the selected template's department (or the default); null = all closed.
  const [openDept, setOpenDept] = useState<string | null | undefined>(undefined);
  const [form, setForm] = useState<null | { name: string; department: string; subject: string; html: string }>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [branded, setBranded] = useState(false);

  const selected = templates.find((t) => t.id === value) ?? null;
  const needle = q.trim().toLowerCase();
  const groups = useMemo(() => {
    const m = new Map<string, PickerTemplate[]>();
    for (const t of templates) {
      if (needle && !`${t.name} ${t.subject}`.toLowerCase().includes(needle)) continue;
      const k = deptOf(t);
      (m.get(k) ?? m.set(k, []).get(k)!).push(t);
    }
    return [...m.entries()];
  }, [templates, needle]);
  const autoDept = selected ? deptOf(selected) : defaultDepartment ?? null;
  const current = openDept === undefined ? autoDept : openDept;
  const isOpen = (dept: string) => (needle ? true : dept === current);

  function pick(id: string) { onPick(id); setOpen(false); setQ(""); setOpenDept(undefined); }
  function startNew(from: PickerTemplate | null) {
    setErr(null);
    setForm(from
      ? { name: `${from.name} (copy)`, department: from.department ?? "", subject: from.subject, html: from.html_body }
      : { name: "", department: defaultDepartment ?? "", subject: "", html: "" });
    setOpen(false);
  }
  async function save() {
    if (!form) return;
    if (!form.name.trim()) { setErr("Name the template."); return; }
    if (!form.subject.trim()) { setErr("Add a subject."); return; }
    if (!form.html.trim()) { setErr("Add a body."); return; }
    setSaving(true); setErr(null);
    try {
      const r = await fetch("/api/marketing/templates", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name.trim(), subject: form.subject.trim(), html_body: form.html, department: form.department || null, status: "active" }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.id) { setErr("Couldn't save the template. Try again."); return; }
      onCreated(j as PickerTemplate);
      setForm(null);
    } finally { setSaving(false); }
  }

  const row = (active: boolean): React.CSSProperties => ({ display: "flex", alignItems: "center", gap: 6, width: "100%", textAlign: "left", border: "none", cursor: "pointer", fontSize: 12.5, padding: "6px 10px 6px 28px", background: active ? "#E6F1FB" : "transparent", color: active ? "#0C447C" : "var(--foreground)" });

  return (
    <div style={{ marginBottom: 10 }}>
      <button type="button" onClick={() => { setOpen((o) => !o); setForm(null); }} aria-expanded={open}
        style={{ ...inp, width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", textAlign: "left" }}>
        <span style={{ color: selected ? "var(--foreground)" : "var(--muted-foreground)" }}>{selected ? selected.name : "Write without a template…"}</span>
        <i className={`ti ti-chevron-${open ? "up" : "down"}`} aria-hidden="true" />
      </button>

      {open ? (
        <div style={{ border: "0.5px solid var(--border)", borderRadius: 8, marginTop: 4, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderBottom: "0.5px solid var(--border)" }}>
            <i className="ti ti-search" aria-hidden="true" style={{ color: "var(--muted-foreground)" }} />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search templates" aria-label="Search templates"
              style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 12.5, color: "var(--foreground)" }} />
          </div>
          <div style={{ maxHeight: 300, overflowY: "auto" }}>
            {!needle ? <button type="button" onClick={() => pick("")} style={{ ...row(value === ""), paddingLeft: 10, color: value === "" ? "#0C447C" : "var(--muted-foreground)" }}>Write without a template…</button> : null}
            {groups.map(([dept, ts]) => (
              <div key={dept} style={{ borderTop: "0.5px solid var(--border)" }}>
                <button type="button" aria-expanded={isOpen(dept)} onClick={() => setOpenDept(isOpen(dept) && !needle ? null : dept)}
                  style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", border: "none", background: "transparent", cursor: "pointer", padding: "7px 10px", fontSize: 12, fontWeight: 600, color: isOpen(dept) ? "var(--foreground)" : "var(--muted-foreground)" }}>
                  <i className={`ti ti-chevron-${isOpen(dept) ? "down" : "right"}`} aria-hidden="true" />
                  {dept}
                  <span style={{ marginLeft: "auto", fontWeight: 400, color: "var(--muted-foreground)" }}>{ts.length}</span>
                </button>
                {isOpen(dept) ? ts.map((t) => (
                  <button key={t.id} type="button" onClick={() => pick(t.id)} style={row(t.id === value)}>
                    {t.id === value ? <i className="ti ti-check" aria-hidden="true" /> : null}{t.name}
                  </button>
                )) : null}
              </div>
            ))}
            {groups.length === 0 ? <p style={{ fontSize: 12, color: "var(--muted-foreground)", padding: "10px", margin: 0 }}>No templates match “{q}”.</p> : null}
          </div>
          <div style={{ display: "flex", gap: 6, padding: "7px 10px", borderTop: "0.5px solid var(--border)" }}>
            <button type="button" onClick={() => startNew(null)} style={{ fontSize: 12, padding: "5px 10px", borderRadius: 7, border: "0.5px solid var(--border)", background: "transparent", cursor: "pointer", color: "var(--foreground)" }}><i className="ti ti-plus" aria-hidden="true" /> New template</button>
            <button type="button" onClick={() => { setOpen(false); setForm(null); setBranded(true); }} style={{ fontSize: 12, padding: "5px 10px", borderRadius: 7, border: "0.5px solid #B5D4F4", background: "transparent", cursor: "pointer", color: "#185FA5" }}><i className="ti ti-layout" aria-hidden="true" /> New branded template</button>
            {selected ? <button type="button" onClick={() => startNew(selected)} style={{ fontSize: 12, padding: "5px 10px", borderRadius: 7, border: "0.5px solid var(--border)", background: "transparent", cursor: "pointer", color: "var(--foreground)" }}><i className="ti ti-copy" aria-hidden="true" /> Duplicate selected</button> : null}
          </div>
        </div>
      ) : null}

      {branded ? (
        <BrandedTemplateEditor
          defaultDepartment={defaultDepartment}
          primaryLabel="Save and use"
          onClose={() => setBranded(false)}
          onSaved={(t) => { setBranded(false); onCreated({ id: t.id, name: t.name, subject: t.subject, html_body: t.html_body, department: t.department ?? null }); }}
        />
      ) : null}

      {form ? (
        <div style={{ border: "1px solid #B5D4F4", borderRadius: 9, padding: "10px 12px", marginTop: 6 }}>
          <p style={{ fontSize: 12.5, fontWeight: 600, margin: "0 0 8px" }}>New template</p>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,2fr) minmax(0,1fr)", gap: 8, marginBottom: 8 }}>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="08 investor thesis nudge" aria-label="Template name" style={inp} />
            <select value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} aria-label="Department" style={inp}>
              <option value="">{OTHER}</option>
              {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Subject" aria-label="Subject" style={{ ...inp, width: "100%", marginBottom: 8 }} />
          <textarea value={form.html} onChange={(e) => setForm({ ...form, html: e.target.value })} rows={6} placeholder="<p>Hi {{first_name}},</p>…" aria-label="Body (HTML)" style={{ ...inp, width: "100%", fontFamily: "var(--font-mono)", resize: "vertical" }} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, margin: "6px 0 8px" }}>
            {mergeTags.map((k) => <button key={k} type="button" title="Add to the body" onClick={() => setForm({ ...form, html: `${form.html}{{${k}}}` })} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, border: "none", background: "var(--muted)", color: "var(--muted-foreground)", cursor: "pointer" }}>{`{{${k}}}`}</button>)}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11, color: "#A32D2D" }}>{err}</span>
            <button type="button" onClick={() => setForm(null)} style={{ marginLeft: "auto", fontSize: 12, padding: "6px 12px", borderRadius: 7, border: "0.5px solid var(--border)", background: "transparent", cursor: "pointer", color: "var(--foreground)" }}>Cancel</button>
            <button type="button" onClick={() => void save()} disabled={saving} style={{ fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: 7, border: "none", background: "#2E78F5", color: "#fff", cursor: "pointer", opacity: saving ? 0.6 : 1 }}>{saving ? "Saving…" : "Save and use"}</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
