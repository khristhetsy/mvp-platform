"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { groupContactProfile } from "@/lib/sales/contact-profile-sections";

type Contact = {
  id: string; source: string; name: string; email: string | null; company: string | null; phone: string | null; phone2: string | null;
  website: string | null; lead_status: string | null; lead_source: string | null; tags: string[]; owner: string | null; owner_id: string | null; assignee_ids: string[]; membership: string | null;
  job_position: string | null; street: string | null; street2: string | null; city: string | null; state: string | null; zip: string | null;
  country: string | null; language: string | null; created_on: string | null; note: string | null;
  extra: Array<{ label: string; values: string[] }>;
};
type LinkedOpp = { id: string; title: string; stage_name: string | null; value_cents: number | null; probability: number | null; status: string };
type Staff = { id: string; name: string };
type Activity = { id: string; kind: string; summary: string; actor_name: string | null; created_at: string };
const LEAD_STATUSES = ["new", "contacted", "qualified", "paused", "not interested", "won", "lost"];
const ACT_ICON: Record<string, { icon: string; color: string; bg: string }> = {
  note: { icon: "ti-note", color: "#185FA5", bg: "#E6F1FB" },
  call: { icon: "ti-phone", color: "#0F6E56", bg: "#E1F5EE" },
  email: { icon: "ti-mail", color: "#4338CA", bg: "#EEF2FF" },
  message: { icon: "ti-message", color: "#854F0B", bg: "#FAEEDA" },
  opp_note: { icon: "ti-note", color: "#185FA5", bg: "#E6F1FB" },
  contact_edit: { icon: "ti-edit", color: "#5F5E5A", bg: "#F1EFE8" },
  task_created: { icon: "ti-calendar-plus", color: "#854F0B", bg: "#FAEEDA" },
  task_done: { icon: "ti-check", color: "#0F6E56", bg: "#E1F5EE" },
  converted: { icon: "ti-arrow-right", color: "#185FA5", bg: "#E6F1FB" },
  stage_changed: { icon: "ti-arrow-right", color: "#854F0B", bg: "#FAEEDA" },
  won: { icon: "ti-trophy", color: "#3B6D11", bg: "#EAF3DE" },
  lost: { icon: "ti-x", color: "#A32D2D", bg: "#FCEBEB" },
  email_draft: { icon: "ti-mail", color: "#4338CA", bg: "#EEF2FF" },
};
function actWhen(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + ", " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

const money = (c: number | null) => (c == null ? "—" : `$${(c / 100).toLocaleString()}`);
const inp: React.CSSProperties = { fontSize: 12, padding: "7px 9px", borderRadius: 7, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--foreground)", boxSizing: "border-box" };
const outlineBtn: React.CSSProperties = { fontSize: 11.5, color: "var(--muted-foreground)", background: "transparent", border: "0.5px solid var(--border-strong, #cbd5e1)", borderRadius: 7, padding: "7px 13px", cursor: "pointer" };

const LEAD_TONE: Record<string, { bg: string; c: string }> = {
  new: { bg: "#E6F1FB", c: "#185FA5" }, contacted: { bg: "#FAEEDA", c: "#854F0B" },
  qualified: { bg: "#E1F5EE", c: "#0F6E56" }, paused: { bg: "#F1EFE8", c: "#5F5E5A" },
  "not interested": { bg: "#FCEBEB", c: "#A32D2D" }, won: { bg: "#EAF3DE", c: "#3B6D11" }, lost: { bg: "#FCEBEB", c: "#A32D2D" },
};
function StatusPill({ status }: { status: string }) {
  const t = LEAD_TONE[status.toLowerCase()] ?? { bg: "#F1EFE8", c: "#5F5E5A" };
  return <span style={{ fontSize: 11, fontWeight: 600, background: t.bg, color: t.c, borderRadius: 20, padding: "2px 10px", textTransform: "capitalize" }}>{status}</span>;
}
function Chip({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ background: "#F6F8FB", borderRadius: 8, padding: "9px 12px" }}>
      <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 600, color: "#0A1A40", marginTop: 2, fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  );
}
function Row({ icon, label, value, link }: { icon: string; label: string; value: string | null; link?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", fontSize: 12.5 }}>
      <i className={`ti ${icon}`} aria-hidden="true" style={{ fontSize: 15, color: "var(--muted-foreground)", width: 18, flexShrink: 0 }} />
      <span style={{ width: 100, color: "var(--muted-foreground)", flexShrink: 0 }}>{label}</span>
      <span style={{ color: link && value ? "#185FA5" : "var(--foreground)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value || "—"}</span>
    </div>
  );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--muted-foreground)", margin: "10px 0 4px" }}>{title}</div>
      {children}
    </div>
  );
}

// One click-to-edit profile field. In edit mode, fields with a known option list
// (Odoo selection / many2many) show a searchable checkbox dropdown with chips
// (Option 1); free-text fields fall back to a plain input. Inline save (✓) + undo.
function EditablePrefRow({
  label, value, changed, editing, rating, options, onOpen, onChange, onSave, onUndo,
}: {
  label: string; value: string; changed: boolean; editing: boolean; rating: boolean; options: string[];
  onOpen: () => void; onChange: (v: string) => void; onSave: () => void; onUndo: () => void;
}) {
  const [hover, setHover] = useState(false);
  const [search, setSearch] = useState("");
  const selected = value.split(",").map((s) => s.trim()).filter(Boolean);

  if (editing && options.length > 0) {
    const selSet = new Set(selected);
    const allOpts = [...new Set([...options, ...selected])];
    const filtered = allOpts.filter((o) => o.toLowerCase().includes(search.trim().toLowerCase()));
    const toggle = (o: string) => onChange((selSet.has(o) ? selected.filter((x) => x !== o) : [...selected, o]).join(", "));
    const chipBg = rating ? "#E1F5EE" : "#EEEDFE";
    const chipFg = rating ? "#0F6E56" : "#3C3489";
    return (
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "5px 8px", background: "#F7F8FA", borderRadius: 8, fontSize: 12.5 }}>
        <span style={{ width: 150, flexShrink: 0, color: "var(--muted-foreground)", paddingTop: 6 }}>{label}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
            <div style={{ flex: 1, minWidth: 0, border: "0.5px solid #4338CA", borderRadius: 6, padding: "5px 8px", boxShadow: "0 0 0 2px #EEEDFE", display: "flex", flexWrap: "wrap", gap: 5, alignItems: "center", background: "#fff" }}>
              {selected.length === 0 && <span style={{ color: "var(--muted-foreground)" }}>Select…</span>}
              {selected.map((v) => (
                <span key={v} style={{ fontSize: 11, background: chipBg, color: chipFg, borderRadius: 10, padding: "2px 8px", display: "inline-flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
                  {v}
                  <i className="ti ti-x" onClick={() => toggle(v)} style={{ fontSize: 11, cursor: "pointer" }} aria-hidden="true" />
                </span>
              ))}
            </div>
            <button onClick={onSave} aria-label="Save field" style={{ width: 30, height: 30, flexShrink: 0, background: "#0F6E56", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}><i className="ti ti-check" aria-hidden="true" /></button>
            <button onClick={onUndo} aria-label="Undo field" style={{ width: 30, height: 30, flexShrink: 0, background: "none", border: "0.5px solid #d7dbe3", borderRadius: 6, cursor: "pointer", color: "var(--muted-foreground)" }}><i className="ti ti-arrow-back-up" aria-hidden="true" /></button>
          </div>
          <div style={{ marginTop: 5, border: "0.5px solid var(--border)", borderRadius: 8, background: "#fff", padding: 5, maxWidth: 320 }}>
            <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" style={{ width: "100%", boxSizing: "border-box", height: 28, fontSize: 12, border: "0.5px solid var(--border)", borderRadius: 5, padding: "0 8px", marginBottom: 4 }} />
            <div style={{ maxHeight: 176, overflowY: "auto" }}>
              {filtered.length === 0 && <div style={{ fontSize: 11.5, color: "var(--muted-foreground)", padding: "4px 6px" }}>No matches.</div>}
              {filtered.map((o) => (
                <label key={o} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 6px", fontSize: 12, cursor: "pointer" }}>
                  <input type="checkbox" checked={selSet.has(o)} onChange={() => toggle(o)} style={{ width: 14, height: 14 }} />
                  <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{o}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (editing) {
    return (
      <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "5px 8px", background: "#F7F8FA", borderRadius: 8, fontSize: 12.5 }}>
        <span style={{ width: 150, flexShrink: 0, color: "var(--muted-foreground)" }}>{label}</span>
        <input
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") onSave(); if (e.key === "Escape") onUndo(); }}
          placeholder="Type a value…"
          style={{ flex: 1, minWidth: 0, height: 30, fontSize: 12, border: "0.5px solid #4338CA", borderRadius: 6, padding: "0 8px", boxShadow: "0 0 0 2px #EEEDFE" }}
        />
        <button onClick={onSave} aria-label="Save field" style={{ width: 30, height: 30, flexShrink: 0, background: "#0F6E56", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}><i className="ti ti-check" aria-hidden="true" /></button>
        <button onClick={onUndo} aria-label="Undo field" style={{ width: 30, height: 30, flexShrink: 0, background: "none", border: "0.5px solid #d7dbe3", borderRadius: 6, cursor: "pointer", color: "var(--muted-foreground)" }}><i className="ti ti-arrow-back-up" aria-hidden="true" /></button>
      </div>
    );
  }
  const values = value.split(",").map((s) => s.trim()).filter(Boolean);
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "5px 0", fontSize: 12.5 }}>
      <span style={{ width: 150, flexShrink: 0, color: "var(--muted-foreground)" }}>{label}</span>
      <span
        onClick={onOpen}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        title="Click to edit"
        style={{ flex: 1, minWidth: 0, cursor: "pointer", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 5, borderRadius: 6, padding: "2px 4px", margin: "-2px -4px", background: hover ? "#F1EFE8" : "transparent" }}
      >
        {values.length === 0 ? (
          <span style={{ color: "var(--muted-foreground)" }}>—</span>
        ) : values.length === 1 && values[0].length > 40 ? (
          <span style={{ color: "var(--foreground)" }}>{values[0]}</span>
        ) : values.map((v) => (
          <span key={v} style={{ fontSize: 11, background: rating ? "#E1F5EE" : "#EEEDFE", color: rating ? "#0F6E56" : "#3C3489", borderRadius: 12, padding: "2px 9px", whiteSpace: "nowrap" }}>{v}</span>
        ))}
        <i className="ti ti-pencil" aria-hidden="true" style={{ fontSize: 12.5, color: "var(--muted-foreground)", opacity: hover ? 1 : 0, marginLeft: 2 }} />
        {changed ? <span style={{ fontSize: 10, color: "#854F0B", background: "#FAEEDA", borderRadius: 10, padding: "1px 7px" }}>edited</span> : null}
      </span>
    </div>
  );
}

export function ContactProfileClient({ contact: initialContact, opportunities, staff, leadStaff, activity, isSuperAdmin = false, onePager = null }: { contact: Contact; opportunities: LinkedOpp[]; staff: Staff[]; leadStaff?: Staff[]; activity: Activity[]; isSuperAdmin?: boolean; onePager?: { slug: string | null; published: boolean; companyName: string | null } | null }) {
  const assignableStaff = leadStaff ?? staff;
  const router = useRouter();
  const [contact, setContact] = useState<Contact>(initialContact);
  const [note, setNote] = useState("");
  const [noteMsg, setNoteMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showTask, setShowTask] = useState(false);
  const [task, setTask] = useState({ title: "", taskType: "Call", dueDate: "", assigneeId: "" });
  const [savedNotes, setSavedNotes] = useState<string | null>(initialContact.note);
  const [editing, setEditing] = useState(false);
  // Self-contained editor for the structured "Additional details" fields.
  const [prefBusy, setPrefBusy] = useState(false);
  // Click-to-edit: values are staged in prefEdits (keyed by save-label);
  // prefOrig is the last-saved baseline for dirty detection + undo.
  const initialProfile = groupContactProfile(initialContact.extra, initialContact.membership);
  const seedPrefs = () => {
    const o: Record<string, string> = {};
    for (const s of initialProfile.sections) for (const f of s.fields) o[f.saveKey] = f.values.join(", ");
    return o;
  };
  const [prefEdits, setPrefEdits] = useState<Record<string, string>>(seedPrefs);
  const [prefOrig, setPrefOrig] = useState<Record<string, string>>(seedPrefs);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  // Sub-tab strip at the profile position: Profile · Note Log · Activity.
  const [profileSub, setProfileSub] = useState<"profile" | "notelog">("profile");
  // Option lists per profile field (Odoo selection / many2many) for the pickers.
  const [fieldOptions, setFieldOptions] = useState<Record<string, string[]>>({});
  useEffect(() => {
    let active = true;
    fetch("/api/sales/contacts/field-options")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (active && d?.options) setFieldOptions(d.options as Record<string, string[]>); })
      .catch(() => {});
    return () => { active = false; };
  }, []);
  // Read-view "Lead assign" control (super admin only) — saves assignees directly.
  const [leadOpen, setLeadOpen] = useState(false);
  const [leadSel, setLeadSel] = useState<string[]>(initialContact.assignee_ids ?? []);
  const [leadSearch, setLeadSearch] = useState("");
  const [leadSaving, setLeadSaving] = useState(false);
  const [leadMsg, setLeadMsg] = useState<string | null>(null);
  const [form, setForm] = useState({
    lead_status: initialContact.lead_status ?? "new",
    email: initialContact.email ?? "", company: initialContact.company ?? "",
    phone: initialContact.phone ?? "", phone2: initialContact.phone2 ?? "",
    website: initialContact.website ?? "", owner: initialContact.owner ?? "", owner_id: initialContact.owner_id ?? "",
    assignee_ids: initialContact.assignee_ids ?? [],
    membership: initialContact.membership ?? "", job_position: initialContact.job_position ?? "",
    lead_source: initialContact.lead_source ?? "", language: initialContact.language ?? "",
    street: initialContact.street ?? "", street2: initialContact.street2 ?? "",
    city: initialContact.city ?? "", state: initialContact.state ?? "", zip: initialContact.zip ?? "", country: initialContact.country ?? "",
    tags: initialContact.tags.join(", "),
  });
  const [section, setSection] = useState<"details" | "activity" | "onepager">("details");
  const [actFilter, setActFilter] = useState<"all" | "call" | "note" | "task" | "stage">("all");
  const [acts, setActs] = useState<Activity[]>(activity);
  const [call, setCall] = useState({ outcome: "connected", duration: "", notes: "" });

  async function logTouch(channel: "email" | "message") {
    try {
      await fetch(`/api/sales/contacts/${contact.id}/touch`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channel }) });
      const summary = channel === "email" ? "Email opened" : "Text message opened";
      setActs((p) => [{ id: `tmp-${Date.now()}`, kind: channel, summary, actor_name: "You", created_at: new Date().toISOString() }, ...p]);
    } catch { /* ignore */ }
  }

  async function logCall() {
    setBusy(true);
    try {
      const res = await fetch(`/api/sales/contacts/${contact.id}/call`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(call) });
      if (res.ok) {
        const label: Record<string, string> = { connected: "connected", voicemail: "voicemail", no_answer: "no answer", wrong_number: "wrong number" };
        const parts = [`Call — ${label[call.outcome]}`];
        if (call.duration) parts.push(call.duration);
        if (call.notes) parts.push(`"${call.notes.trim()}"`);
        setActs((p) => [{ id: `tmp-${Date.now()}`, kind: "call", summary: parts.join(" · "), actor_name: "You", created_at: new Date().toISOString() }, ...p]);
        setCall({ outcome: "connected", duration: "", notes: "" });
      }
    } finally { setBusy(false); }
  }

  async function saveEdit() {
    setBusy(true);
    try {
      const body = {
        lead_status: form.lead_status,
        email: form.email || null, company: form.company || null,
        phone: form.phone || null, phone2: form.phone2 || null,
        website: form.website || null, owner: form.owner || null, owner_id: form.owner_id || null,
        membership: form.membership || null, job_position: form.job_position || null,
        lead_source: form.lead_source || null, language: form.language || null,
        street: form.street || null, street2: form.street2 || null,
        city: form.city || null, state: form.state || null, zip: form.zip || null, country: form.country || null,
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      };
      const res = await fetch(`/api/sales/contacts/${contact.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (res.ok) { setContact({ ...contact, ...body }); setEditing(false); }
    } finally { setBusy(false); }
  }

  async function savePreferences() {
    setPrefBusy(true);
    try {
      const preferences: Record<string, string[]> = {};
      for (const [label, csv] of Object.entries(prefEdits)) {
        preferences[label] = csv.split(",").map((s) => s.trim()).filter(Boolean);
      }
      const res = await fetch(`/api/sales/contacts/${contact.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences }),
      });
      if (res.ok) {
        const newExtra = Object.entries(preferences)
          .map(([label, values]) => ({ label, values }))
          .filter((e) => e.values.length);
        setContact({ ...contact, extra: newExtra });
        setPrefOrig({ ...prefEdits });
        setEditingKey(null);
      }
    } finally {
      setPrefBusy(false);
    }
  }

  // The ✓ on a row saves just that field immediately (writes only its override),
  // then re-reads the profile so the grouping stays canonical and reseeds the
  // editor baseline. This is what makes a single click-to-edit actually persist.
  async function saveField(key: string) {
    setPrefBusy(true);
    try {
      const values = (prefEdits[key] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
      const res = await fetch(`/api/sales/contacts/${contact.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: { [key]: values } }),
      });
      if (!res.ok) return;
      const fresh = await fetch(`/api/sales/contacts/${contact.id}`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      if (fresh?.contact) {
        setContact(fresh.contact);
        const grouped = groupContactProfile(fresh.contact.extra, fresh.contact.membership);
        const o: Record<string, string> = {};
        for (const s of grouped.sections) for (const f of s.fields) o[f.saveKey] = f.values.join(", ");
        setPrefEdits(o);
        setPrefOrig(o);
      } else {
        setPrefOrig((p) => ({ ...p, [key]: prefEdits[key] ?? "" }));
      }
      setEditingKey(null);
    } finally {
      setPrefBusy(false);
    }
  }

  async function saveLeadAssign() {
    setLeadSaving(true); setLeadMsg(null);
    try {
      const res = await fetch(`/api/sales/contacts/${contact.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignee_ids: leadSel }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Save failed.");
      setContact({ ...contact, assignee_ids: leadSel });
      setLeadOpen(false);
    } catch (e) { setLeadMsg(e instanceof Error ? e.message : "Save failed."); } finally { setLeadSaving(false); }
  }

  async function saveNote() {
    if (!note.trim()) return;
    setBusy(true); setNoteMsg(null);
    try {
      const res = await fetch(`/api/sales/contacts/${contact.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ note }) });
      if (!res.ok) throw new Error((await res.json()).error ?? "Save failed.");
      setSavedNotes((prev) => (prev ? `${prev}\n[${new Date().toISOString().slice(0, 10)}] ${note}` : `[${new Date().toISOString().slice(0, 10)}] ${note}`));
      setNote(""); setNoteMsg("Saved.");
    } catch (e) { setNoteMsg(e instanceof Error ? e.message : "Save failed."); } finally { setBusy(false); }
  }
  async function createTask() {
    if (!task.title.trim()) return;
    setBusy(true);
    try {
      await fetch("/api/sales/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: task.title, taskType: task.taskType, dueDate: task.dueDate || null, assigneeId: task.assigneeId || null, contactCrmId: contact.id, contactName: contact.name }) });
      setShowTask(false); setTask({ title: "", taskType: "Call", dueDate: "", assigneeId: "" });
    } finally { setBusy(false); }
  }

  const address = [contact.street, contact.street2, contact.city, contact.state, contact.zip, contact.country].filter(Boolean).join(", ") || null;
  const pipelineCents = opportunities.reduce((a, o) => a + (o.value_cents ?? 0), 0);
  const openOpps = opportunities.filter((o) => o.status === "open").length;
  const lastActLabel = acts[0] ? actWhen(acts[0].created_at) : "—";
  const subtitle = [contact.job_position, contact.company, [contact.city, contact.country].filter(Boolean).join(", ") || null].filter(Boolean).join(" · ") || "—";

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, fontSize: 12, color: "var(--muted-foreground)" }}>
        <Link href="/admin/sales/contacts" style={{ color: "var(--muted-foreground)", textDecoration: "none" }}>← Contacts</Link>
        <span>/</span><span style={{ color: "var(--foreground)" }}>{contact.name}</span>
      </div>

      <div style={{ background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 12, overflow: "hidden" }}>
        {/* Redesigned header: identity + status + owner, actions, stat chips */}
        <div style={{ padding: "14px 16px", borderBottom: "0.5px solid #eef1f5" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
            <div style={{ width: 52, height: 52, borderRadius: "50%", background: "#E6F1FB", color: "#185FA5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, fontWeight: 600, flex: "0 0 auto" }}>{contact.name.slice(0, 2).toUpperCase()}</div>
            <div style={{ flex: "1 1 240px", minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 18, fontWeight: 600 }}>{contact.name}</span>
                {contact.lead_status ? <StatusPill status={contact.lead_status} /> : null}
              </div>
              <div style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 2 }}>{subtitle}</div>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {contact.phone
                ? <a href={`tel:${contact.phone.replace(/[^+\d]/g, "")}`} style={{ fontSize: 11.5, fontWeight: 600, color: "#fff", background: "#0F6E56", border: "none", borderRadius: 7, padding: "7px 13px", textDecoration: "none" }}><i className="ti ti-phone" aria-hidden="true" /> Call</a>
                : <span title="No phone number on this contact" style={{ ...outlineBtn, opacity: 0.5, cursor: "not-allowed" }}><i className="ti ti-phone" aria-hidden="true" /> Call</span>}
              {contact.email
                ? <a href={`/admin/inbox?compose=1&to=${encodeURIComponent(contact.email)}`} onClick={() => logTouch("email")} style={{ fontSize: 11.5, fontWeight: 600, color: "#4338CA", background: "#EEF2FF", border: "0.5px solid #C7D2FE", borderRadius: 7, padding: "7px 13px", textDecoration: "none" }}><i className="ti ti-mail" aria-hidden="true" /> Email</a>
                : <span title="No email on this contact" style={{ ...outlineBtn, opacity: 0.5, cursor: "not-allowed" }}><i className="ti ti-mail" aria-hidden="true" /> Email</span>}
              {contact.phone
                ? <a href={`sms:${contact.phone.replace(/[^+\d]/g, "")}`} onClick={() => logTouch("message")} style={{ fontSize: 11.5, fontWeight: 600, color: "#854F0B", background: "#FAEEDA", border: "0.5px solid #F4D9A0", borderRadius: 7, padding: "7px 13px", textDecoration: "none" }}><i className="ti ti-message" aria-hidden="true" /> Message</a>
                : <span title="No phone number on this contact" style={{ ...outlineBtn, opacity: 0.5, cursor: "not-allowed" }}><i className="ti ti-message" aria-hidden="true" /> Message</span>}
              {!editing && <button onClick={() => setEditing(true)} style={outlineBtn}><i className="ti ti-edit" aria-hidden="true" /> Edit</button>}
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 8, marginTop: 14 }}>
            <Chip label="Opportunities" value={opportunities.length} />
            <Chip label="Pipeline value" value={money(pipelineCents)} />
            <Chip label="Open opps" value={openOpps} />
            <Chip label="Last activity" value={lastActLabel} />
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 0, padding: "0 16px", borderBottom: "0.5px solid #eef1f5" }}>
          <button onClick={() => setSection("details")} style={{ fontSize: 12.5, fontWeight: section === "details" ? 600 : 400, color: section === "details" ? "var(--foreground)" : "var(--muted-foreground)", background: "none", border: "none", padding: "10px 14px", borderBottom: section === "details" ? "2px solid #2E78F5" : "2px solid transparent", cursor: "pointer" }}>Details</button>
          {onePager ? (
            <button onClick={() => setSection("onepager")} style={{ fontSize: 12.5, fontWeight: section === "onepager" ? 600 : 400, color: section === "onepager" ? "var(--foreground)" : "var(--muted-foreground)", background: "none", border: "none", padding: "10px 14px", borderBottom: section === "onepager" ? "2px solid #2E78F5" : "2px solid transparent", cursor: "pointer" }}>One pager</button>
          ) : null}
        </div>

        {section === "details" && (<>
        {/* Field grid */}
        {editing ? (
          <div style={{ padding: "14px 16px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 24px" }}>
              <div>
                <label style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Lead status</label>
                <select value={form.lead_status} onChange={(e) => setForm({ ...form, lead_status: e.target.value })} style={{ ...inp, width: "100%", marginTop: 4 }}>
                  {(LEAD_STATUSES.includes(form.lead_status) || !form.lead_status ? LEAD_STATUSES : [form.lead_status, ...LEAD_STATUSES]).map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              {isSuperAdmin && staff.length > 0 && (
                <div>
                  <label style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Lead owner <span style={{ color: "var(--muted-foreground)" }}>(super admin)</span></label>
                  <select value={form.owner_id} onChange={(e) => setForm({ ...form, owner_id: e.target.value })} style={{ ...inp, width: "100%", marginTop: 4 }}>
                    <option value="">Unassigned</option>
                    {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}
              {([
                ["email", "Email", "name@company.com"], ["company", "Company", ""],
                ["phone", "Phone", "+1 …"], ["phone2", "Phone 2", ""],
                ["website", "Website", "example.com"], ["owner", "Owner", ""],
                ["membership", "Membership", ""], ["job_position", "Job position", ""],
                ["lead_source", "Lead source", ""], ["language", "Language", ""],
              ] as const).map(([key, label, ph]) => (
                <div key={key}>
                  <label style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{label}</label>
                  <input value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} placeholder={ph} style={{ ...inp, width: "100%", marginTop: 4 }} />
                </div>
              ))}
            </div>

            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "0.5px solid #eef1f5" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted-foreground)", marginBottom: 8 }}>Address</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px 16px" }}>
                {([
                  ["street", "Street", "1 / -1"], ["street2", "Street 2", "1 / -1"],
                  ["city", "City", "auto"], ["state", "State", "auto"], ["zip", "ZIP", "auto"], ["country", "Country", "auto"],
                ] as const).map(([key, label, span]) => (
                  <div key={key} style={span === "1 / -1" ? { gridColumn: "1 / -1" } : undefined}>
                    <label style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{label}</label>
                    <input value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} style={{ ...inp, width: "100%", marginTop: 4 }} />
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <label style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Tags (comma-separated)</label>
              <input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} style={{ ...inp, width: "100%", marginTop: 4 }} />
            </div>

            <div style={{ marginTop: 12, display: "flex", gap: 6 }}>
              <button onClick={saveEdit} disabled={busy} style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: "#2E78F5", border: "none", borderRadius: 7, padding: "8px 16px", cursor: "pointer" }}>Save</button>
              <button onClick={() => setEditing(false)} style={{ ...outlineBtn, padding: "8px 16px" }}>Cancel</button>
              <span style={{ fontSize: 10.5, color: "var(--muted-foreground)", alignSelf: "center" }}>Edits save to your CRM mirror and persist across Odoo re-syncs.</span>
            </div>
          </div>
        ) : (
          <div style={{ padding: "6px 16px 14px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 28px" }}>
            <Section title="Contact">
              <Row icon="ti-mail" label="Email" value={contact.email} link />
              <Row icon="ti-phone" label="Phone" value={contact.phone} />
              <Row icon="ti-phone" label="Phone 2" value={contact.phone2} />
              <Row icon="ti-world" label="Website" value={contact.website} link />
              <Row icon="ti-language" label="Language" value={contact.language} />
            </Section>
            <Section title="Lead">
              <Row icon="ti-flag" label="Lead status" value={contact.lead_status} />
              <Row icon="ti-arrow-down-circle" label="Lead source" value={contact.lead_source} />
              {/* Lead assign — under Lead source. Editable by super admin only. */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "5px 0", fontSize: 12.5 }}>
                <i className="ti ti-users" aria-hidden="true" style={{ fontSize: 15, color: "var(--muted-foreground)", width: 18, flexShrink: 0, marginTop: 3 }} />
                <span style={{ width: 100, color: "var(--muted-foreground)", flexShrink: 0, marginTop: 3 }}>Lead assign</span>
                <div style={{ minWidth: 0, flex: 1, position: "relative" }}>
                  {isSuperAdmin ? (() => {
                    const chosen = staff.filter((s) => leadSel.includes(s.id));
                    const matches = assignableStaff.filter((s) => s.name.toLowerCase().includes(leadSearch.toLowerCase()));
                    return (
                      <>
                        <div onClick={() => setLeadOpen((v) => !v)} style={{ ...inp, width: "100%", minHeight: 30, display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap", cursor: "pointer", borderColor: leadOpen ? "#2E78F5" : undefined }}>
                          {chosen.length === 0 && <span style={{ color: "var(--muted-foreground)" }}>Assign members…</span>}
                          {chosen.map((s) => (
                            <span key={s.id} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, background: "#E6F1FB", color: "#185FA5", borderRadius: 20, padding: "1px 6px 1px 8px" }}>
                              {s.name}
                              <i className="ti ti-x" style={{ fontSize: 10, cursor: "pointer" }} aria-hidden="true" onClick={(e) => { e.stopPropagation(); setLeadSel((p) => p.filter((x) => x !== s.id)); }} />
                            </span>
                          ))}
                          <i className="ti ti-chevron-down" style={{ marginLeft: "auto", color: "var(--muted-foreground)" }} aria-hidden="true" />
                        </div>
                        {leadOpen && (
                          <>
                            <div onClick={() => setLeadOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 20 }} />
                            <div style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4, zIndex: 30, background: "#fff", border: "0.5px solid var(--border-strong, #cbd5e1)", borderRadius: 9, boxShadow: "0 10px 26px rgba(0,0,0,0.12)", overflow: "hidden" }}>
                              <div style={{ padding: "7px 9px", borderBottom: "0.5px solid #eef1f5" }}>
                                <input value={leadSearch} onChange={(e) => setLeadSearch(e.target.value)} autoFocus placeholder="Search members…" style={{ ...inp, width: "100%" }} />
                              </div>
                              <div style={{ maxHeight: 168, overflowY: "auto" }}>
                                {matches.length === 0 && <div style={{ fontSize: 12, color: "var(--muted-foreground)", padding: "8px 11px" }}>No members.</div>}
                                {matches.map((s) => {
                                  const on = leadSel.includes(s.id);
                                  const isOwner = contact.owner_id === s.id;
                                  return (
                                    <label key={s.id} title={isOwner ? "Already the owner" : undefined} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 11px", fontSize: 12.5, cursor: isOwner ? "not-allowed" : "pointer", opacity: isOwner ? 0.45 : 1 }}>
                                      <input type="checkbox" checked={on} disabled={isOwner} onChange={() => setLeadSel((p) => on ? p.filter((x) => x !== s.id) : [...p, s.id])} style={{ width: 14, height: 14 }} />
                                      <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</span>
                                    </label>
                                  );
                                })}
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 11px", borderTop: "0.5px solid #eef1f5" }}>
                                <button onClick={saveLeadAssign} disabled={leadSaving} style={{ fontSize: 11.5, fontWeight: 600, color: "#fff", background: "#2E78F5", border: "none", borderRadius: 7, padding: "5px 12px", cursor: "pointer", opacity: leadSaving ? 0.6 : 1 }}>{leadSaving ? "Saving…" : "Save"}</button>
                                <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{leadSel.length} selected</span>
                                {leadMsg && <span style={{ fontSize: 11, color: "#A32D2D" }}>{leadMsg}</span>}
                              </div>
                            </div>
                          </>
                        )}
                      </>
                    );
                  })() : (
                    <span style={{ color: contact.assignee_ids.length ? "var(--foreground)" : "var(--muted-foreground)" }}>
                      {contact.assignee_ids.map((id) => staff.find((s) => s.id === id)?.name).filter(Boolean).join(", ") || "—"}
                    </span>
                  )}
                </div>
              </div>
              {/* Owner + Source — moved here from the header, directly under Lead assign. */}
              <Row icon="ti-user-check" label="Owner" value={contact.owner} />
              <Row icon="ti-plug" label="Source" value={contact.source} />
              <Row icon="ti-id-badge" label="Membership" value={contact.membership} />
              <Row icon="ti-briefcase" label="Job position" value={contact.job_position} />
              <Row icon="ti-tag" label="Tags" value={contact.tags.length ? contact.tags.join(", ") : null} />
            </Section>
            <div style={{ gridColumn: "1 / -1" }}>
              <Section title="Address">
                <Row icon="ti-map-pin" label="Location" value={address} />
              </Section>
            </div>
            {(() => {
              const profile = groupContactProfile(contact.extra, contact.membership);
              if (profile.sections.length === 0) return null;
              return (
              <div style={{ gridColumn: "1 / -1" }}>
                <div>
                  {/* Founder/Investor Profile · Note Log · Activity strip */}
                  <div style={{ display: "flex", alignItems: "center", gap: 2, borderBottom: "0.5px solid #eef1f5", marginBottom: 10, flexWrap: "wrap" }}>
                    {([["profile", profile.title], ["notelog", "Note Log"]] as const).map(([k, label]) => (
                      <button key={k} onClick={() => setProfileSub(k)} style={{ background: "none", border: "none", borderBottom: profileSub === k ? "2px solid #4338CA" : "2px solid transparent", color: profileSub === k ? "#4338CA" : "var(--muted-foreground)", fontSize: 12.5, fontWeight: profileSub === k ? 600 : 400, padding: "8px 12px", cursor: "pointer", marginBottom: "-0.5px" }}>{label}</button>
                    ))}
                    <button onClick={() => setSection("activity")} style={{ background: "none", border: "none", borderBottom: "2px solid transparent", color: "var(--muted-foreground)", fontSize: 12.5, fontWeight: 400, padding: "8px 12px", cursor: "pointer", marginBottom: "-0.5px" }}>Activity{acts.length ? ` · ${acts.length}` : ""}</button>
                  </div>
                  {profileSub === "profile" && (<>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", marginBottom: 4, minHeight: 18 }}>
                    <span style={{ fontSize: 11, color: "var(--muted-foreground)", display: "flex", alignItems: "center", gap: 5 }}>
                      <i className="ti ti-click" aria-hidden="true" /> Click any field to edit
                    </span>
                  </div>
                  {profile.sections.map((sec) => {
                    const rating = sec.title.toLowerCase().includes("rating");
                    return (
                      <div key={sec.title} style={{ marginTop: 14 }}>
                        <p style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: "#4338CA", margin: "0 0 5px", paddingBottom: 4, borderBottom: "0.5px solid #eef1f5" }}>{sec.title}</p>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 28px" }}>
                          {sec.fields.map((f) => (
                            <EditablePrefRow
                              key={f.saveKey}
                              label={f.label}
                              rating={rating}
                              options={fieldOptions[f.saveKey] ?? []}
                              value={prefEdits[f.saveKey] ?? ""}
                              changed={(prefEdits[f.saveKey] ?? "") !== (prefOrig[f.saveKey] ?? "")}
                              editing={editingKey === f.saveKey}
                              onOpen={() => setEditingKey(f.saveKey)}
                              onChange={(v) => setPrefEdits((p) => ({ ...p, [f.saveKey]: v }))}
                              onSave={() => saveField(f.saveKey)}
                              onUndo={() => { setPrefEdits((p) => ({ ...p, [f.saveKey]: prefOrig[f.saveKey] ?? "" })); setEditingKey(null); }}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  {(() => {
                    const changedKeys = Object.keys(prefEdits).filter((k) => (prefEdits[k] ?? "") !== (prefOrig[k] ?? ""));
                    if (changedKeys.length === 0) return null;
                    return (
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, paddingTop: 12, borderTop: "0.5px solid #eef1f5" }}>
                        <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{changedKeys.length} unsaved change{changedKeys.length === 1 ? "" : "s"}</span>
                        <span style={{ marginLeft: "auto" }} />
                        <button onClick={() => { setPrefEdits({ ...prefOrig }); setEditingKey(null); }} disabled={prefBusy} style={{ fontSize: 12, padding: "6px 12px", border: "0.5px solid #d7dbe3", borderRadius: 6, background: "none", color: "var(--muted-foreground)", cursor: "pointer" }}>Undo all</button>
                        <button onClick={savePreferences} disabled={prefBusy} style={{ fontSize: 12, fontWeight: 600, padding: "6px 14px", border: "none", borderRadius: 6, background: "#0F6E56", color: "#fff", cursor: "pointer", opacity: prefBusy ? 0.5 : 1 }}>{prefBusy ? "Saving…" : "Save changes"}</button>
                      </div>
                    );
                  })()}
                  </>)}
                  {profileSub === "notelog" && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, paddingTop: 4 }}>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted-foreground)", marginBottom: 6 }}>Log a note</div>
                        <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add an internal note…" style={{ ...inp, width: "100%", minHeight: 56, resize: "vertical" }} />
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                          <button onClick={saveNote} disabled={busy || !note.trim()} style={{ fontSize: 11, fontWeight: 600, color: "#185FA5", background: "#E6F1FB", border: "0.5px solid #B5D4F4", borderRadius: 6, padding: "5px 12px", cursor: "pointer", opacity: busy || !note.trim() ? 0.5 : 1 }}>Save note</button>
                          {noteMsg && <span style={{ fontSize: 11, color: noteMsg === "Saved." ? "#0F6E56" : "#A32D2D" }}>{noteMsg}</span>}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted-foreground)", marginBottom: 6 }}>Notes</div>
                        <div style={{ fontSize: 11.5, color: "var(--muted-foreground)", whiteSpace: "pre-wrap", lineHeight: 1.6, background: "var(--muted)", borderRadius: 8, padding: 10, minHeight: 56 }}>{savedNotes || "No notes yet."}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              );
            })()}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", padding: "12px 16px", borderTop: "0.5px solid #eef1f5", borderBottom: "0.5px solid #eef1f5" }}>
          <Link href={`/admin/sales/contacts/${contact.id}/convert`} style={{ fontSize: 11.5, fontWeight: 600, color: "#fff", background: "#2E78F5", border: "none", borderRadius: 7, padding: "7px 13px", cursor: "pointer", textDecoration: "none" }}><i className="ti ti-arrow-right" aria-hidden="true" /> Convert to opportunity</Link>
          <button onClick={() => setShowTask((v) => !v)} style={outlineBtn}><i className="ti ti-calendar-plus" aria-hidden="true" /> Create task</button>
        </div>

        {showTask && (
          <div style={{ padding: "12px 16px", borderBottom: "0.5px solid #eef1f5", background: "#F5F9FF", display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1.2fr auto", gap: 8, alignItems: "center" }}>
            <input value={task.title} onChange={(e) => setTask({ ...task, title: e.target.value })} placeholder="Task title" autoFocus style={inp} />
            <select value={task.taskType} onChange={(e) => setTask({ ...task, taskType: e.target.value })} style={inp}>{["Call", "Email", "Demo", "Follow-up", "Proposal"].map((t) => <option key={t}>{t}</option>)}</select>
            <input type="date" value={task.dueDate} onChange={(e) => setTask({ ...task, dueDate: e.target.value })} style={inp} />
            <select value={task.assigneeId} onChange={(e) => setTask({ ...task, assigneeId: e.target.value })} style={inp}><option value="">Assign to me</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={createTask} disabled={busy || !task.title.trim()} style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: "#0F6E56", border: "none", borderRadius: 7, padding: "7px 12px", cursor: "pointer", opacity: busy || !task.title.trim() ? 0.5 : 1 }}>Add</button>
              <button onClick={() => setShowTask(false)} style={{ fontSize: 12, color: "var(--muted-foreground)", background: "none", border: "none", cursor: "pointer" }}>✕</button>
            </div>
          </div>
        )}

        {/* Log note + timeline — profile contacts use the Note Log strip above */}
        {groupContactProfile(contact.extra, contact.membership).sections.length === 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, padding: "14px 16px" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted-foreground)", marginBottom: 6 }}>Log a note</div>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add an internal note…" style={{ ...inp, width: "100%", minHeight: 56, resize: "vertical" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
              <button onClick={saveNote} disabled={busy || !note.trim()} style={{ fontSize: 11, fontWeight: 600, color: "#185FA5", background: "#E6F1FB", border: "0.5px solid #B5D4F4", borderRadius: 6, padding: "5px 12px", cursor: "pointer", opacity: busy || !note.trim() ? 0.5 : 1 }}>Save note</button>
              {noteMsg && <span style={{ fontSize: 11, color: noteMsg === "Saved." ? "#0F6E56" : "#A32D2D" }}>{noteMsg}</span>}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted-foreground)", marginBottom: 6 }}>Notes</div>
            <div style={{ fontSize: 11.5, color: "var(--muted-foreground)", whiteSpace: "pre-wrap", lineHeight: 1.6, background: "var(--muted)", borderRadius: 8, padding: 10, minHeight: 56 }}>{savedNotes || "No notes yet."}</div>
          </div>
        </div>
        )}

        </>)}

        {section === "onepager" && onePager && (
          <div style={{ padding: "14px 16px" }}>
            {onePager.slug && onePager.published ? (
              <div style={{ border: "0.5px solid #eef1f5", borderRadius: 10, overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--surface-1, #f7f8fa)", borderBottom: "0.5px solid #eef1f5", padding: "7px 12px" }}>
                  <span style={{ fontSize: 11.5, color: "var(--muted-foreground)" }}>One pager — what investors see</span>
                  <a href={`/f/${onePager.slug}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11.5, fontWeight: 600, color: "#2E78F5", textDecoration: "none" }}>Open ↗</a>
                </div>
                <iframe src={`/f/${onePager.slug}`} title="One pager" style={{ width: "100%", height: 620, border: "none" }} />
              </div>
            ) : (
              <p style={{ fontSize: 12.5, color: "var(--muted-foreground)", padding: "24px 0", textAlign: "center" }}>
                {onePager.companyName ? `${onePager.companyName} hasn't published a one-pager yet.` : "This contact has no published one-pager."}
              </p>
            )}
          </div>
        )}

        {section === "activity" && (
        <div style={{ padding: "14px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
            {([["all", "All"], ["call", "Calls"], ["note", "Notes"], ["task", "Tasks"], ["stage", "Stage changes"]] as const).map(([f, label]) => (
              <button key={f} onClick={() => setActFilter(f)} style={{ fontSize: 11, cursor: "pointer", border: "none", borderRadius: 14, padding: "3px 11px", background: actFilter === f ? "#2E78F5" : "var(--muted)", color: actFilter === f ? "#fff" : "var(--muted-foreground)" }}>{label}</button>
            ))}
          </div>

          {/* Log a call */}
          <div style={{ background: "#F5F9FF", borderRadius: 10, padding: 12, marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}><i className="ti ti-phone" aria-hidden="true" style={{ color: "#0F6E56" }} /><span style={{ fontSize: 12, fontWeight: 600 }}>Log a call</span><span style={{ fontSize: 10.5, color: "var(--muted-foreground)" }}>after your Nextiva call</span></div>
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.9fr 2fr auto", gap: 8, alignItems: "center" }}>
              <select value={call.outcome} onChange={(e) => setCall({ ...call, outcome: e.target.value })} style={inp}><option value="connected">Connected</option><option value="voicemail">Voicemail</option><option value="no_answer">No answer</option><option value="wrong_number">Wrong number</option></select>
              <input value={call.duration} onChange={(e) => setCall({ ...call, duration: e.target.value })} placeholder="Duration" style={inp} />
              <input value={call.notes} onChange={(e) => setCall({ ...call, notes: e.target.value })} placeholder="Call notes / outcome…" style={inp} />
              <button onClick={logCall} disabled={busy} style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: "#0F6E56", border: "none", borderRadius: 7, padding: "7px 13px", cursor: "pointer", opacity: busy ? 0.5 : 1 }}>Log</button>
            </div>
          </div>

          {(() => {
            const shown = acts.filter((a) => actFilter === "all" || (actFilter === "task" ? a.kind.startsWith("task") : actFilter === "stage" ? (a.kind === "stage_changed" || a.kind === "won" || a.kind === "lost") : actFilter === "note" ? (a.kind === "note" || a.kind === "opp_note") : a.kind === actFilter));
            if (shown.length === 0) return <div style={{ fontSize: 11.5, color: "var(--muted-foreground)" }}>No activity yet. Calls, notes, tasks, stage changes, and conversions appear here.</div>;
            return (
              <div style={{ position: "relative", paddingLeft: 26 }}>
                <div style={{ position: "absolute", left: 9, top: 4, bottom: 4, width: 1.5, background: "var(--border)" }} />
                {shown.map((a) => {
                  const ic = ACT_ICON[a.kind] ?? { icon: "ti-point", color: "#5F5E5A", bg: "#F1EFE8" };
                  return (
                    <div key={a.id} style={{ position: "relative", marginBottom: 14 }}>
                      <span style={{ position: "absolute", left: -24, top: 1, width: 18, height: 18, borderRadius: "50%", background: ic.bg, color: ic.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10 }}><i className={`ti ${ic.icon}`} aria-hidden="true" /></span>
                      <div style={{ fontSize: 12 }}>{a.summary}</div>
                      <div style={{ fontSize: 10.5, color: "var(--muted-foreground)" }}>{a.actor_name ?? "System"} · {actWhen(a.created_at)}</div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
        )}

        {/* Linked opportunities */}
        {section === "details" && opportunities.length > 0 && (
          <div style={{ padding: "0 16px 16px" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted-foreground)", marginBottom: 6 }}>Linked opportunities</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {opportunities.map((o) => (
                <button key={o.id} onClick={() => router.push(`/admin/sales/opportunities/${o.id}`)} style={{ textAlign: "left", background: "var(--muted)", border: "none", borderRadius: 8, padding: 10, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, fontWeight: 500 }}>{o.title}</span>
                  <span style={{ fontSize: 11, color: "#185FA5" }}>{money(o.value_cents)}{o.probability != null ? ` · ${o.probability}%` : ""}{o.stage_name ? ` · ${o.stage_name}` : ""}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
