"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Mail, ListPlus, Send, Pencil } from "lucide-react";
import type { MarketingContact } from "@/lib/marketing/types";

type NamedRef = { id: string; name: string };
type Ev = { id: string; event_type: string; occurred_at: string; campaign_name: string | null; sequence_name: string | null };

const EVENT_COLOR: Record<string, { bg: string; color: string }> = {
  sent: { bg: "#F1EFE8", color: "#5F5E5A" }, delivered: { bg: "#E1F5EE", color: "#0F6E56" },
  opened: { bg: "#E6F1FB", color: "#185FA5" }, clicked: { bg: "#EEEDFE", color: "#1A6CE4" },
  bounced: { bg: "#FAEEDA", color: "#854F0B" }, unsubscribed: { bg: "#FCEBEB", color: "#A32D2D" }, spam_complaint: { bg: "#FCEBEB", color: "#A32D2D" },
};
const inp: React.CSSProperties = { fontSize: 12, padding: "7px 9px", borderRadius: 7, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--foreground)", boxSizing: "border-box", width: "100%" };
const outlineBtn: React.CSSProperties = { fontSize: 11.5, color: "var(--muted-foreground)", background: "transparent", border: "0.5px solid var(--border-strong, #cbd5e1)", borderRadius: 7, padding: "7px 13px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5 };

function when(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
function ago(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return days <= 0 ? "today" : days === 1 ? "1 day ago" : `${days} days ago`;
}

function Field({ k, v, link }: { k: string; v: React.ReactNode; link?: boolean }) {
  return (
    <div style={{ display: "flex", fontSize: 11.5, alignItems: "center" }}>
      <span style={{ width: 110, color: "var(--muted-foreground)", flexShrink: 0 }}>{k}</span>
      <span style={{ color: link ? "#185FA5" : "var(--foreground)" }}>{v || "—"}</span>
    </div>
  );
}

export function MarketingContactProfile({ contact: initial, memberLists, allLists, sequences, unsubscribed }: {
  contact: MarketingContact & { created_at?: string }; memberLists: NamedRef[]; allLists: NamedRef[]; sequences: NamedRef[]; unsubscribed: { unsubscribed_at: string } | null;
}) {
  const [contact, setContact] = useState(initial);
  const [lists, setLists] = useState<NamedRef[]>(memberLists);
  const [events, setEvents] = useState<Ev[]>([]);
  const [section, setSection] = useState<"details" | "activity">("details");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ first_name: initial.first_name ?? "", last_name: initial.last_name ?? "", company: initial.company ?? "", title: initial.title ?? "", source: initial.source ?? "" });
  const [tagEdit, setTagEdit] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [addMode, setAddMode] = useState<null | "list" | "seq">(null);
  const [addId, setAddId] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [nowMs] = useState(() => Date.now());

  const load = useCallback(async () => {
    try { const res = await fetch(`/api/marketing/contacts/${initial.id}/activity`); if (res.ok) { const d = await res.json(); setEvents(d.events ?? []); } } catch { /* ignore */ }
  }, [initial.id]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch email activity on mount
  useEffect(() => { void load(); }, [load]);

  const stats = useMemo(() => {
    const sent = events.filter((e) => e.event_type === "sent" || e.event_type === "delivered").length;
    const opened = events.filter((e) => e.event_type === "opened");
    const clicked = events.filter((e) => e.event_type === "clicked").length;
    const lastOpen = opened[0]?.occurred_at ?? null;
    return { sent, opened: opened.length, clicked, lastOpen };
  }, [events]);

  const engagement = unsubscribed ? { t: "Unsubscribed", c: "#A32D2D", bg: "#FCEBEB" }
    : stats.lastOpen && (nowMs - new Date(stats.lastOpen).getTime()) < 14 * 86400000 ? { t: "Warm", c: "#0F6E56", bg: "#E1F5EE" }
    : stats.opened > 0 ? { t: "Cool", c: "#185FA5", bg: "#E6F1FB" } : { t: "Cold", c: "#5F5E5A", bg: "#F1EFE8" };

  const displayName = [contact.first_name, contact.last_name].filter(Boolean).join(" ") || contact.email;
  const initials = ((contact.first_name?.[0] ?? "") + (contact.last_name?.[0] ?? "")).toUpperCase() || contact.email[0].toUpperCase();
  const tags = contact.tags ?? [];

  async function patch(body: Record<string, unknown>) {
    const res = await fetch(`/api/marketing/contacts/${contact.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return res.ok;
  }
  async function saveEdit() {
    setBusy(true);
    try { if (await patch(form)) { setContact({ ...contact, ...form }); setEditing(false); } } finally { setBusy(false); }
  }
  async function saveTags(next: string[]) { setContact({ ...contact, tags: next }); await patch({ tags: next }); }
  function addTag(t: string) { const clean = t.trim().toLowerCase().replace(/\s+/g, "-"); if (!clean || tags.includes(clean)) return; void saveTags([...tags, clean]); setTagInput(""); }
  function removeTag(t: string) { void saveTags(tags.filter((x) => x !== t)); }

  async function doAdd() {
    if (!addId) return;
    setBusy(true); setMsg(null);
    try {
      if (addMode === "list") {
        const res = await fetch(`/api/marketing/lists/${addId}/contacts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contact_ids: [contact.id] }) });
        if (res.ok) { const l = allLists.find((x) => x.id === addId); if (l && !lists.some((x) => x.id === l.id)) setLists([...lists, l]); setMsg("Added to list."); }
      } else {
        const res = await fetch(`/api/marketing/contacts/${contact.id}/enroll`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sequence_id: addId }) });
        if (res.ok) setMsg("Enrolled in sequence.");
      }
      setAddMode(null); setAddId("");
    } finally { setBusy(false); }
  }

  const statCard = (label: string, value: React.ReactNode) => (
    <div style={{ background: "var(--muted)", borderRadius: 8, padding: "10px 12px" }}>
      <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 500, marginTop: 2 }}>{value}</div>
    </div>
  );

  return (
    <div style={{ padding: 24, maxWidth: 1000 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, fontSize: 12, color: "var(--muted-foreground)" }}>
        <Link href="/admin/marketing/contacts" style={{ color: "var(--muted-foreground)", textDecoration: "none" }}>← Contacts</Link>
        <span>/</span><span style={{ color: "var(--foreground)" }}>{displayName}</span>
      </div>

      <div style={{ background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 12, overflow: "hidden" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: "0.5px solid #eef1f5", flexWrap: "wrap" }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#EEEDFE", color: "#1A6CE4", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 600 }}>{initials}</div>
          <div style={{ flex: 1, minWidth: 160 }}>
            <div style={{ fontSize: 16, fontWeight: 600 }}>{displayName}</div>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{[contact.title, contact.company].filter(Boolean).join(" · ") || contact.email}</div>
          </div>
          <div style={{ textAlign: "center", border: "0.5px solid var(--border)", borderRadius: 8, padding: "6px 12px" }}>
            <div style={{ fontSize: 10, color: "var(--muted-foreground)" }}>Engagement</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: engagement.c }}>{engagement.t}</div>
          </div>
          <Link href={`/admin/inbox?to=${encodeURIComponent(contact.email)}`} style={{ fontSize: 11.5, fontWeight: 600, color: "#fff", background: "#2E78F5", border: "none", borderRadius: 7, padding: "7px 13px", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 5 }}><Mail size={13} /> Send email</Link>
          <button onClick={() => { setAddMode("list"); setAddId(""); setMsg(null); }} style={outlineBtn}><ListPlus size={13} /> Add to list</button>
          <button onClick={() => { setAddMode("seq"); setAddId(""); setMsg(null); }} style={outlineBtn}><Send size={13} /> Add to sequence</button>
          {!editing && <button onClick={() => setEditing(true)} style={outlineBtn}><Pencil size={13} /> Edit</button>}
        </div>

        {/* Add-to bar */}
        {addMode && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", background: "#F5F9FF", borderBottom: "0.5px solid #eef1f5", flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: "#185FA5", fontWeight: 500 }}>{addMode === "list" ? "Add to list" : "Add to sequence"}</span>
            <select value={addId} onChange={(e) => setAddId(e.target.value)} style={{ ...inp, width: "auto", minWidth: 200 }}>
              <option value="">Choose…</option>
              {(addMode === "list" ? allLists : sequences).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
            <button onClick={doAdd} disabled={!addId || busy} style={{ fontSize: 11.5, fontWeight: 600, color: "#fff", background: "#2E78F5", border: "none", borderRadius: 7, padding: "7px 13px", cursor: "pointer", opacity: !addId || busy ? 0.5 : 1 }}>Add</button>
            <button onClick={() => setAddMode(null)} style={{ fontSize: 11.5, color: "var(--muted-foreground)", background: "none", border: "none", cursor: "pointer" }}>Cancel</button>
            {msg && <span style={{ fontSize: 11.5, color: "#0F6E56" }}>{msg}</span>}
          </div>
        )}
        {msg && !addMode && <div style={{ padding: "8px 16px", fontSize: 11.5, color: "#0F6E56", borderBottom: "0.5px solid #eef1f5" }}>{msg}</div>}

        {/* Tabs */}
        <div style={{ display: "flex", padding: "0 16px", borderBottom: "0.5px solid #eef1f5" }}>
          {(["details", "activity"] as const).map((s) => (
            <button key={s} onClick={() => setSection(s)} style={{ fontSize: 12.5, fontWeight: section === s ? 600 : 400, color: section === s ? "var(--foreground)" : "var(--muted-foreground)", background: "none", border: "none", padding: "10px 14px", borderBottom: section === s ? "2px solid #2E78F5" : "2px solid transparent", cursor: "pointer", textTransform: "capitalize" }}>{s === "activity" ? `Activity${events.length ? ` · ${events.length}` : ""}` : "Details"}</button>
          ))}
        </div>

        {section === "details" && (
          <>
            {/* Stat cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, padding: "14px 16px", borderBottom: "0.5px solid #eef1f5" }}>
              {statCard("Sent", stats.sent)}
              {statCard("Opened", stats.opened)}
              {statCard("Clicked", stats.clicked)}
              {statCard("Last open", stats.lastOpen ? <span style={{ fontSize: 14 }}>{ago(stats.lastOpen)}</span> : "—")}
            </div>

            {/* Details grid */}
            {editing ? (
              <div style={{ padding: "14px 16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 24px" }}>
                {([["first_name", "First name"], ["last_name", "Last name"], ["company", "Company"], ["title", "Title"], ["source", "Source"]] as const).map(([k, label]) => (
                  <div key={k}><label style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{label}</label><input value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} style={{ ...inp, marginTop: 4 }} /></div>
                ))}
                <div style={{ gridColumn: "1 / -1", display: "flex", gap: 6 }}>
                  <button onClick={saveEdit} disabled={busy} style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: "#2E78F5", border: "none", borderRadius: 7, padding: "8px 16px", cursor: "pointer" }}>Save</button>
                  <button onClick={() => setEditing(false)} style={{ ...outlineBtn, padding: "8px 16px" }}>Cancel</button>
                </div>
              </div>
            ) : (
              <div style={{ padding: "14px 16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 28px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <Field k="Company" v={contact.company} />
                  <Field k="Title" v={contact.title} />
                  <Field k="Source" v={contact.source ? <span style={{ fontSize: 10, color: "#5F5E5A", background: "#F1EFE8", borderRadius: 10, padding: "2px 8px" }}>{contact.source}</span> : null} />
                  <Field k="Created" v={contact.created_at ? when(contact.created_at) : null} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <Field k="Email" v={contact.email} link />
                  <Field k="Status" v={unsubscribed ? <span style={{ fontSize: 10, color: "#A32D2D", background: "#FCEBEB", borderRadius: 10, padding: "2px 8px" }}>Unsubscribed</span> : <span style={{ fontSize: 10, color: "#0F6E56", background: "#E1F5EE", borderRadius: 10, padding: "2px 8px" }}>Subscribed</span>} />
                  <Field k="Lists" v={lists.length ? <span style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>{lists.map((l) => <span key={l.id} style={{ fontSize: 10, color: "#0C447C", background: "#E6F1FB", borderRadius: 10, padding: "2px 8px" }}>{l.name}</span>)}</span> : null} />
                  <div style={{ display: "flex", fontSize: 11.5, alignItems: "flex-start" }}>
                    <span style={{ width: 110, color: "var(--muted-foreground)", flexShrink: 0, paddingTop: 2 }}>Tags</span>
                    <span style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
                      {tags.map((t) => <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, padding: "2px 6px", borderRadius: 12, background: "#EEEDFE", color: "#1A6CE4", fontWeight: 500 }}>{t}{tagEdit && <button onClick={() => removeTag(t)} style={{ background: "none", border: "none", cursor: "pointer", color: "#1A6CE4", padding: 0, fontSize: 11 }}>×</button>}</span>)}
                      {tagEdit ? (
                        <input autoFocus value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(tagInput); } if (e.key === "Escape") setTagEdit(false); }} onBlur={() => setTagEdit(false)} placeholder="add tag…" style={{ fontSize: 10, width: 72, border: "1px solid #2E78F5", borderRadius: 8, padding: "2px 5px", outline: "none", background: "var(--input)" }} />
                      ) : (
                        <button onClick={() => { setTagEdit(true); setTagInput(""); }} style={{ fontSize: 10, padding: "2px 6px", borderRadius: 12, border: "1px dashed var(--border)", background: "transparent", color: "var(--muted-foreground)", cursor: "pointer" }}>+ tag</button>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {section === "activity" && (
          <div style={{ padding: "14px 16px" }}>
            {events.length === 0 ? <div style={{ fontSize: 12.5, color: "var(--muted-foreground)" }}>No email events yet. Sends, opens, and clicks appear here.</div> : (
              <div style={{ position: "relative", paddingLeft: 26 }}>
                <div style={{ position: "absolute", left: 9, top: 4, bottom: 4, width: 1.5, background: "var(--border)" }} />
                {events.map((e) => {
                  const ec = EVENT_COLOR[e.event_type] ?? { bg: "#F1EFE8", color: "#5F5E5A" };
                  return (
                    <div key={e.id} style={{ position: "relative", marginBottom: 14 }}>
                      <span style={{ position: "absolute", left: -24, top: 1, width: 18, height: 18, borderRadius: "50%", background: ec.bg, color: ec.color, fontSize: 9, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center" }}>{e.event_type[0].toUpperCase()}</span>
                      <div style={{ fontSize: 12, textTransform: "capitalize" }}>{e.event_type.replace(/_/g, " ")}{(e.campaign_name || e.sequence_name) ? ` · ${e.campaign_name ?? e.sequence_name}` : ""}</div>
                      <div style={{ fontSize: 10.5, color: "var(--muted-foreground)" }}>{new Date(e.occurred_at).toLocaleString()}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
