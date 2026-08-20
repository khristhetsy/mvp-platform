"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FounderProfileMirror, type MirrorContact } from "./FounderProfileMirror";

type Stage = { id: string; name: string; sort_order: number; is_won: boolean };
type Opp = {
  id: string; title: string; contact_name: string | null; contact_email: string | null; contact_phone: string | null;
  contact_crm_id: string | null;
  stage_id: string | null; stage_name: string | null; value_cents: number | null;
  billing: "yearly" | "monthly"; probability: number | null; expected_close: string | null;
  priority: number; tags: string[]; source: string | null; lead_status: string | null;
  status: "open" | "won" | "lost" | "archived"; notes: string | null;
  lead_assignees: string[];
};

const money = (c: number | null) => (c == null ? "—" : `$${(c / 100).toLocaleString()}`);
function mrr(o: Pick<Opp, "value_cents" | "billing">): string {
  if (o.value_cents == null) return "—";
  const cents = o.billing === "monthly" ? o.value_cents : Math.round(o.value_cents / 12);
  return `$${Math.round(cents / 100).toLocaleString()}`;
}

const inp: React.CSSProperties = { fontSize: 12, padding: "7px 9px", borderRadius: 7, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--foreground)", boxSizing: "border-box" };
const cardBox: React.CSSProperties = { background: "var(--muted)", borderRadius: 8, padding: 11 };

type OTask = { id: string; title: string; task_type: string; due_date: string | null; status: string; assignee_name: string | null; source: "deal" | "contact" };
type ActivityItem = { id: string; kind: string; summary: string; actor_name: string | null; created_at: string };

const ACT_ICON: Record<string, { icon: string; color: string; bg: string }> = {
  note: { icon: "ti-note", color: "#4338CA", bg: "#EEF2FF" },
  opp_note: { icon: "ti-note", color: "#4338CA", bg: "#EEF2FF" },
  call: { icon: "ti-phone", color: "#0F6E56", bg: "#E1F5EE" },
  email: { icon: "ti-mail", color: "#185FA5", bg: "#E6F1FB" },
  email_draft: { icon: "ti-mail", color: "#185FA5", bg: "#E6F1FB" },
  message: { icon: "ti-message", color: "#854F0B", bg: "#FAEEDA" },
  task_created: { icon: "ti-checkbox", color: "#5F5E5A", bg: "#F1EFE8" },
  task_done: { icon: "ti-check", color: "#0F6E56", bg: "#E1F5EE" },
  stage_changed: { icon: "ti-arrow-right", color: "#185FA5", bg: "#E6F1FB" },
  won: { icon: "ti-trophy", color: "#0F6E56", bg: "#E1F5EE" },
  lost: { icon: "ti-x", color: "#A32D2D", bg: "#FCEBEB" },
  converted: { icon: "ti-user-check", color: "#0F6E56", bg: "#E1F5EE" },
  contact_edit: { icon: "ti-edit", color: "#5F5E5A", bg: "#F1EFE8" },
};

function actWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function OpportunityDetailClient({ initial, stages, founderContact = null, contactActivity = [], staff = [] }: { initial: Opp; stages: Stage[]; founderContact?: MirrorContact | null; contactActivity?: ActivityItem[]; staff?: { id: string; name: string }[] }) {
  const router = useRouter();
  const [o, setO] = useState<Opp>(initial);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState<"notes" | "activity" | "extra" | "founder" | "tasks">("notes");
  const [noteInput, setNoteInput] = useState("");
  const [oppTasks, setOppTasks] = useState<OTask[]>([]);
  const [tasksLoaded, setTasksLoaded] = useState(false);
  const [confirmTaskId, setConfirmTaskId] = useState<string | null>(null);
  const [taskDraft, setTaskDraft] = useState({ title: "", taskType: "Call", dueDate: "", assigneeId: "" });
  const [sequences, setSequences] = useState<{ id: string; name: string; status: string }[]>([]);
  const [enrollSeqId, setEnrollSeqId] = useState("");
  const [enrollMsg, setEnrollMsg] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/sales/sequences")
      .then((r) => (r.ok ? r.json() : { sequences: [] }))
      .then((d) => { if (active) setSequences(d.sequences ?? []); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  async function enrollSequence() {
    if (!enrollSeqId) return;
    setBusy(true);
    setEnrollMsg(null);
    try {
      const res = await fetch(`/api/sales/opportunities/${o.id}/enroll-sequence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sequenceId: enrollSeqId }),
      });
      const d = await res.json().catch(() => ({}));
      setEnrollMsg(res.ok ? "Enrolled in sequence" : (d.error ?? "Could not enroll"));
    } catch {
      setEnrollMsg("Could not enroll");
    } finally {
      setBusy(false);
    }
  }
  // Company name (from the linked contact) shown under the opportunity title. Its
  // profile is the CRM contact record — there's no standalone company page.
  const companyName = founderContact?.company?.trim() || null;

  async function loadTasks() {
    try {
      const reqs = [fetch(`/api/sales/tasks?scope=all&opportunityId=${o.id}`)];
      if (o.contact_crm_id) reqs.push(fetch(`/api/sales/tasks?scope=all&contactCrmId=${encodeURIComponent(o.contact_crm_id)}`));
      const results = await Promise.all(reqs);
      const jsons = await Promise.all(results.map((r) => (r.ok ? r.json() : Promise.resolve({ tasks: [] }))));
      const map = new Map<string, OTask>();
      for (const t of (jsons[0]?.tasks ?? [])) map.set(t.id, { ...t, source: "deal" });
      for (const t of (jsons[1]?.tasks ?? [])) if (!map.has(t.id)) map.set(t.id, { ...t, source: "contact" });
      setOppTasks([...map.values()]);
    } catch {
      setOppTasks([]);
    }
    setTasksLoaded(true);
  }
  function openTasks() {
    setTab("tasks");
    if (!tasksLoaded) void loadTasks();
  }
  async function createTask() {
    if (!taskDraft.title.trim()) return;
    setBusy(true);
    try {
      await fetch("/api/sales/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: taskDraft.title, taskType: taskDraft.taskType, dueDate: taskDraft.dueDate || null, assigneeId: taskDraft.assigneeId || null, opportunityId: o.id, contactCrmId: o.contact_crm_id, contactName: o.contact_name }),
      });
      setTaskDraft({ title: "", taskType: "Call", dueDate: "", assigneeId: "" });
      await loadTasks();
    } finally {
      setBusy(false);
    }
  }
  async function taskDone(id: string) {
    setBusy(true);
    try { await fetch(`/api/sales/tasks/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "done" }) }); await loadTasks(); }
    finally { setBusy(false); }
  }
  async function taskDelete(id: string) {
    setBusy(true);
    try { await fetch(`/api/sales/tasks/${id}`, { method: "DELETE" }); setConfirmTaskId(null); await loadTasks(); }
    finally { setBusy(false); }
  }

  async function saveNote() {
    const text = noteInput.trim();
    if (!text) return;
    const stamp = `[${new Date().toISOString().slice(0, 10)}] ${text}`;
    const next = o.notes ? `${o.notes}\n${stamp}` : stamp;
    await patch({ notes: next });
    setNoteInput("");
  }
  const [draft, setDraft] = useState({
    title: initial.title, value: initial.value_cents != null ? String(initial.value_cents / 100) : "",
    billing: initial.billing, probability: initial.probability != null ? String(initial.probability) : "",
    expected_close: initial.expected_close ?? "", source: initial.source ?? "", notes: initial.notes ?? "",
  });

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch(`/api/sales/opportunities/${o.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      // PATCH now returns the updated joined row — no second GET needed.
      const data = (await res.json().catch(() => ({}))) as { opportunity?: Opp };
      if (res.ok && data.opportunity) setO(data.opportunity);
    } finally { setBusy(false); }
  }
  async function saveEdit() {
    await patch({
      title: draft.title,
      valueCents: draft.value ? Math.round(Number(draft.value) * 100) : null,
      billing: draft.billing,
      probability: draft.probability ? Number(draft.probability) : null,
      expectedClose: draft.expected_close || null,
      source: draft.source || null,
      notes: draft.notes,
    });
    setEditing(false);
  }
  async function del() {
    if (!confirm("Delete this opportunity permanently?")) return;
    setBusy(true);
    await fetch(`/api/sales/opportunities/${o.id}`, { method: "DELETE" });
    router.push("/admin/sales/opportunities");
  }
  function logTouch(channel: "call" | "email" | "message") {
    void (async () => {
      await fetch(`/api/sales/opportunities/${o.id}/touch`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channel }) }).catch(() => {});
      // Also record it in Internal notes so the outreach is visible on the deal.
      const verb = channel === "call" ? "Called" : channel === "email" ? "Emailed" : "Texted";
      const target = channel === "email" ? o.contact_email : o.contact_phone;
      const stamp = `[${new Date().toISOString().slice(0, 10)}] ${verb}${target ? ` ${target}` : ""}`;
      const next = o.notes ? `${o.notes}\n${stamp}` : stamp;
      await patch({ notes: next });
    })();
  }

  const currentSort = stages.find((s) => s.id === o.stage_id)?.sort_order ?? -1;
  const wonStage = stages.find((s) => s.is_won);
  const nextStage = stages.find((s) => s.sort_order > currentSort && !s.is_won);
  const statusColor = o.status === "won" ? "#0F6E56" : o.status === "lost" ? "#A32D2D" : o.status === "archived" ? "#5F5E5A" : "#185FA5";

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, fontSize: 12, color: "var(--muted-foreground)" }}>
        <Link href="/admin/sales/opportunities" style={{ color: "var(--muted-foreground)", textDecoration: "none" }}>← Opportunities</Link>
        <span>/</span><span style={{ color: "var(--foreground)" }}>{o.title}</span>
      </div>

      <div style={{ background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 12, overflow: "hidden" }}>
        {/* Action bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", borderBottom: "0.5px solid #eef1f5", flexWrap: "wrap" }}>
          {wonStage && o.status === "open" && <button onClick={() => patch({ status: "won", stageId: wonStage.id })} disabled={busy} style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: "#0F6E56", border: "none", borderRadius: 7, padding: "7px 14px", cursor: "pointer" }}><i className="ti ti-check" aria-hidden="true" /> Won</button>}
          {o.status === "open" && <button onClick={() => patch({ status: "lost" })} disabled={busy} style={{ fontSize: 12, color: "#A32D2D", background: "transparent", border: "0.5px solid var(--border-strong, #cbd5e1)", borderRadius: 7, padding: "7px 14px", cursor: "pointer" }}>Lost</button>}
          {o.status !== "open" && <span style={{ fontSize: 11.5, fontWeight: 600, color: statusColor, background: "var(--muted)", borderRadius: 10, padding: "5px 12px" }}>{o.status.toUpperCase()}</span>}
          <div style={{ width: 8 }} />
          {o.contact_phone && <a href={`tel:${o.contact_phone.replace(/[^+\d]/g, "")}`} target="_blank" rel="noopener noreferrer" onClick={() => logTouch("call")} style={{ fontSize: 11.5, fontWeight: 600, color: "#fff", background: "#0F6E56", border: "none", borderRadius: 7, padding: "7px 12px", textDecoration: "none" }}><i className="ti ti-phone" aria-hidden="true" /> Call</a>}
          {o.contact_email && <a href={`/admin/inbox?compose=1&to=${encodeURIComponent(o.contact_email)}`} target="_blank" rel="noopener noreferrer" onClick={() => logTouch("email")} style={{ fontSize: 11.5, fontWeight: 600, color: "#4338CA", background: "#EEF2FF", border: "0.5px solid #C7D2FE", borderRadius: 7, padding: "7px 12px", textDecoration: "none" }}><i className="ti ti-mail" aria-hidden="true" /> Email</a>}
          {o.contact_phone && <a href={`sms:${o.contact_phone.replace(/[^+\d]/g, "")}`} target="_blank" rel="noopener noreferrer" onClick={() => logTouch("message")} style={{ fontSize: 11.5, fontWeight: 600, color: "#854F0B", background: "#FAEEDA", border: "0.5px solid #F4D9A0", borderRadius: 7, padding: "7px 12px", textDecoration: "none" }}><i className="ti ti-message" aria-hidden="true" /> Message</a>}
          {o.contact_email && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <select
                value={enrollSeqId}
                onChange={(e) => { setEnrollSeqId(e.target.value); setEnrollMsg(null); }}
                disabled={busy}
                title="Enroll this opportunity's contact into a marketing sequence"
                style={{ fontSize: 11.5, border: "0.5px solid var(--border-strong, #cbd5e1)", borderRadius: 7, padding: "6px 8px", maxWidth: 180, cursor: "pointer", background: "#fff" }}
              >
                <option value="">Enroll in sequence…</option>
                {sequences.map((sq) => <option key={sq.id} value={sq.id}>{sq.name}</option>)}
              </select>
              <button type="button" onClick={enrollSequence} disabled={busy || !enrollSeqId} style={{ fontSize: 12, fontWeight: 600, color: "#4338CA", background: "#EEF2FF", border: "0.5px solid #C7D2FE", borderRadius: 7, padding: "6px 11px", cursor: "pointer", opacity: !enrollSeqId ? 0.5 : 1 }}>Enroll</button>
              {enrollMsg && <span style={{ fontSize: 11, color: enrollMsg.startsWith("Enrolled") ? "#0F6E56" : "#A32D2D" }}>{enrollMsg}</span>}
            </span>
          )}
          <div style={{ flex: 1 }} />
          <button onClick={() => setEditing((v) => !v)} disabled={busy} style={{ fontSize: 12, color: "var(--muted-foreground)", background: "transparent", border: "0.5px solid var(--border-strong, #cbd5e1)", borderRadius: 7, padding: "7px 13px", cursor: "pointer" }}>{editing ? "Close edit" : "Edit"}</button>
          {nextStage && o.status === "open" && <button onClick={() => patch({ stageId: nextStage.id })} disabled={busy} style={{ fontSize: 12, color: "var(--muted-foreground)", background: "transparent", border: "0.5px solid var(--border-strong, #cbd5e1)", borderRadius: 7, padding: "7px 13px", cursor: "pointer" }}>Advance →</button>}
          <button onClick={del} disabled={busy} style={{ fontSize: 12, color: "#A32D2D", background: "transparent", border: "0.5px solid var(--border-strong, #cbd5e1)", borderRadius: 7, padding: "7px 13px", cursor: "pointer" }}>Delete</button>
        </div>

        {/* Stage bar */}
        <div style={{ display: "flex", padding: "12px 16px", borderBottom: "0.5px solid #eef1f5", overflowX: "auto" }}>
          {stages.map((s, i) => {
            const active = s.id === o.stage_id;
            const done = s.sort_order < currentSort;
            return (
              <button key={s.id} onClick={() => patch({ stageId: s.id })} disabled={busy}
                style={{ fontSize: 11, whiteSpace: "nowrap", cursor: "pointer", border: "none",
                  color: active ? "#fff" : done ? "#0F6E56" : "var(--muted-foreground)",
                  background: active ? "#2E78F5" : s.is_won ? "#E1F5EE" : "var(--muted)",
                  padding: "6px 14px", borderRadius: i === 0 ? "6px 0 0 6px" : i === stages.length - 1 ? "0 6px 6px 0" : 0,
                  borderLeft: i === 0 ? "none" : "0.5px solid #fff" }}>
                {s.name}
              </button>
            );
          })}
        </div>

        <div style={{ padding: 16 }}>
          {editing ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
              <div style={{ gridColumn: "1 / -1" }}><label style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Title</label><input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} style={{ ...inp, width: "100%", marginTop: 4 }} /></div>
              <div><label style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Value ($)</label><input value={draft.value} onChange={(e) => setDraft({ ...draft, value: e.target.value })} inputMode="decimal" style={{ ...inp, width: "100%", marginTop: 4 }} /></div>
              <div><label style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Billing</label><select value={draft.billing} onChange={(e) => setDraft({ ...draft, billing: e.target.value as "yearly" | "monthly" })} style={{ ...inp, width: "100%", marginTop: 4 }}><option value="yearly">Yearly</option><option value="monthly">Monthly</option></select></div>
              <div><label style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Probability (%)</label><input value={draft.probability} onChange={(e) => setDraft({ ...draft, probability: e.target.value })} inputMode="numeric" style={{ ...inp, width: "100%", marginTop: 4 }} /></div>
              <div><label style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Expected close</label><input type="date" value={draft.expected_close} onChange={(e) => setDraft({ ...draft, expected_close: e.target.value })} style={{ ...inp, width: "100%", marginTop: 4 }} /></div>
              <div style={{ gridColumn: "1 / -1" }}><label style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Source</label><input value={draft.source} onChange={(e) => setDraft({ ...draft, source: e.target.value })} style={{ ...inp, width: "100%", marginTop: 4 }} /></div>
              <div style={{ gridColumn: "1 / -1", display: "flex", gap: 6 }}>
                <button onClick={saveEdit} disabled={busy} style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: "#2E78F5", border: "none", borderRadius: 7, padding: "8px 16px", cursor: "pointer" }}>Save</button>
                <button onClick={() => setEditing(false)} style={{ fontSize: 12, color: "var(--muted-foreground)", background: "transparent", border: "0.5px solid var(--border-strong, #cbd5e1)", borderRadius: 7, padding: "8px 16px", cursor: "pointer" }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 18, fontWeight: 600 }}>{o.title}</div>
                  {companyName && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5, flexWrap: "wrap" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--muted-foreground)" }}>
                        <i className="ti ti-building" aria-hidden="true" style={{ fontSize: 14 }} />
                        <span style={{ fontWeight: 500, color: "var(--foreground)" }}>{companyName}</span>
                      </span>
                      {o.contact_crm_id && (
                        <button
                          onClick={() => router.push(`/admin/sales/contacts/${o.contact_crm_id}`)}
                          title="Open the company's profile"
                          style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, color: "#185FA5", background: "#E6F1FB", border: "none", borderRadius: 999, padding: "3px 9px", cursor: "pointer" }}
                        >
                          View company profile <i className="ti ti-external-link" aria-hidden="true" style={{ fontSize: 12 }} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 2, color: "#EF9F27", fontSize: 16, cursor: "pointer" }}>
                  {[1, 2, 3].map((n) => <span key={n} onClick={() => patch({ priority: o.priority === n ? 0 : n })} style={{ color: n <= o.priority ? "#EF9F27" : "var(--muted-foreground)" }}><i className="ti ti-star-filled" aria-hidden="true" /></span>)}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 16 }}>
                <div style={cardBox}><div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Deal value</div><div style={{ fontSize: 19, fontWeight: 600 }}>{money(o.value_cents)}<span style={{ fontSize: 11, color: "var(--muted-foreground)", fontWeight: 400 }}>/{o.billing === "monthly" ? "mo" : "yr"}</span></div></div>
                <div style={cardBox}><div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Expected MRR</div><div style={{ fontSize: 19, fontWeight: 600 }}>{mrr(o)}</div></div>
                <div style={cardBox}><div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Close probability</div><div style={{ fontSize: 19, fontWeight: 600, color: "#3B6D11" }}>{o.probability != null ? `${o.probability}%` : "—"}</div></div>
                <div style={cardBox}><div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Expected close</div><div style={{ fontSize: 15, fontWeight: 600, marginTop: 3 }}>{o.expected_close ?? "—"}</div></div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 24px", paddingTop: 12, borderTop: "0.5px solid #eef1f5" }}>
                {[
                  ["Contact", o.contact_name ?? "—"], ["Email", o.contact_email ?? "—"],
                  ["Stage", o.stage_name ?? "—"], ["Source", o.source ?? "—"],
                  ["Lead status", o.lead_status ?? "—"], ["Billing", o.billing === "monthly" ? "Monthly" : "Yearly"],
                  ["Lead assign", o.lead_assignees.length ? o.lead_assignees.join(", ") : "—"],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                    <span style={{ color: "var(--muted-foreground)" }}>{k}</span>
                    <span style={{ color: k === "Email" ? "#185FA5" : "var(--foreground)", fontWeight: k === "Contact" ? 500 : 400 }}>{v}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Notes / extra tabs */}
          <div style={{ display: "flex", gap: 0, borderBottom: "0.5px solid #eef1f5", margin: "16px 0 12px" }}>
            <button onClick={() => setTab("notes")} style={{ fontSize: 12, fontWeight: tab === "notes" ? 600 : 400, color: tab === "notes" ? "var(--foreground)" : "var(--muted-foreground)", background: "none", border: "none", padding: "8px 12px", borderBottom: tab === "notes" ? "2px solid #2E78F5" : "2px solid transparent", cursor: "pointer" }}>Internal notes</button>
            <button onClick={() => setTab("activity")} style={{ fontSize: 12, fontWeight: tab === "activity" ? 600 : 400, color: tab === "activity" ? "var(--foreground)" : "var(--muted-foreground)", background: "none", border: "none", padding: "8px 12px", borderBottom: tab === "activity" ? "2px solid #2E78F5" : "2px solid transparent", cursor: "pointer" }}>Activity{contactActivity.length ? ` · ${contactActivity.length}` : ""}</button>
            <button onClick={() => setTab("extra")} style={{ fontSize: 12, fontWeight: tab === "extra" ? 600 : 400, color: tab === "extra" ? "var(--foreground)" : "var(--muted-foreground)", background: "none", border: "none", padding: "8px 12px", borderBottom: tab === "extra" ? "2px solid #2E78F5" : "2px solid transparent", cursor: "pointer" }}>Extra info</button>
            {founderContact && (
              <button onClick={() => setTab("founder")} style={{ fontSize: 12, fontWeight: tab === "founder" ? 600 : 400, color: tab === "founder" ? "var(--foreground)" : "var(--muted-foreground)", background: "none", border: "none", padding: "8px 12px", borderBottom: tab === "founder" ? "2px solid #2E78F5" : "2px solid transparent", cursor: "pointer" }}>Founder Profile</button>
            )}
            <button onClick={openTasks} style={{ fontSize: 12, fontWeight: tab === "tasks" ? 600 : 400, color: tab === "tasks" ? "var(--foreground)" : "var(--muted-foreground)", background: "none", border: "none", padding: "8px 12px", borderBottom: tab === "tasks" ? "2px solid #2E78F5" : "2px solid transparent", cursor: "pointer" }}>Tasks{tasksLoaded && oppTasks.length ? ` · ${oppTasks.length}` : ""}</button>
          </div>
          {tab === "founder" && founderContact ? (
            <FounderProfileMirror contact={founderContact} />
          ) : tab === "tasks" ? (
            <div>
              <div style={{ fontSize: 11.5, color: "var(--muted-foreground)", marginBottom: 8 }}><i className="ti ti-link" aria-hidden="true" /> New tasks link to this opportunity{o.contact_name ? ` and ${o.contact_name}` : ""}. Shows the deal&rsquo;s and the contact&rsquo;s tasks.</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 96px 128px 130px", gap: 8, background: "#F5F9FF", border: "0.5px solid #eef1f5", borderRadius: 8, padding: 10 }}>
                <input value={taskDraft.title} onChange={(e) => setTaskDraft({ ...taskDraft, title: e.target.value })} placeholder="Task title" style={inp} />
                <select value={taskDraft.taskType} onChange={(e) => setTaskDraft({ ...taskDraft, taskType: e.target.value })} style={inp}>{["Call", "Email", "Demo", "Follow-up", "Proposal"].map((t) => <option key={t}>{t}</option>)}</select>
                <input type="date" value={taskDraft.dueDate} onChange={(e) => setTaskDraft({ ...taskDraft, dueDate: e.target.value })} style={inp} />
                <select value={taskDraft.assigneeId} onChange={(e) => setTaskDraft({ ...taskDraft, assigneeId: e.target.value })} style={inp}><option value="">Assign to me</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
                <div style={{ gridColumn: "1 / -1" }}>
                  <button onClick={createTask} disabled={busy || !taskDraft.title.trim()} style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: "#0F6E56", border: "none", borderRadius: 7, padding: "7px 14px", cursor: "pointer", opacity: busy || !taskDraft.title.trim() ? 0.5 : 1 }}>Add task</button>
                </div>
              </div>

              <div style={{ marginTop: 12, border: "0.5px solid #eef1f5", borderRadius: 8, overflow: "hidden" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 74px 84px 96px 66px 64px", gap: 8, padding: "8px 12px", background: "#F7F9FC", fontSize: 10, fontWeight: 600, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--muted-foreground)", borderBottom: "0.5px solid #eef1f5" }}>
                  <span>Task</span><span>Type</span><span>Due</span><span>Assignee</span><span>Status</span><span style={{ textAlign: "right" }}>Actions</span>
                </div>
                {!tasksLoaded ? (
                  <p style={{ padding: 16, textAlign: "center", fontSize: 12, color: "var(--muted-foreground)" }}>Loading…</p>
                ) : oppTasks.length === 0 ? (
                  <p style={{ padding: 16, textAlign: "center", fontSize: 12, color: "var(--muted-foreground)" }}>No tasks for this opportunity or contact yet.</p>
                ) : oppTasks.map((ct) => {
                  const cdone = ct.status === "done";
                  if (confirmTaskId === ct.id) {
                    return (
                      <div key={ct.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap", padding: "10px 12px", borderTop: "0.5px solid #eef1f5", background: "#FCEBEB" }}>
                        <span style={{ fontSize: 12, color: "#A32D2D" }}>Delete &ldquo;{ct.title}&rdquo;? This can&rsquo;t be undone.</span>
                        <span style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => taskDelete(ct.id)} disabled={busy} style={{ fontSize: 11.5, fontWeight: 600, color: "#fff", background: "#A32D2D", border: "none", borderRadius: 6, padding: "5px 12px", cursor: "pointer" }}>Delete</button>
                          <button onClick={() => setConfirmTaskId(null)} style={{ fontSize: 11.5, color: "var(--foreground)", background: "#fff", border: "0.5px solid #d7dbe3", borderRadius: 6, padding: "5px 12px", cursor: "pointer" }}>Cancel</button>
                        </span>
                      </div>
                    );
                  }
                  return (
                    <div key={ct.id} style={{ display: "grid", gridTemplateColumns: "1fr 74px 84px 96px 66px 64px", gap: 8, alignItems: "center", padding: "9px 12px", borderTop: "0.5px solid #eef1f5", fontSize: 12.5 }}>
                      <span style={{ minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        <span style={{ textDecoration: cdone ? "line-through" : "none", color: cdone ? "var(--muted-foreground)" : "var(--foreground)" }}>{ct.title}</span>
                        <span style={{ fontSize: 10, color: "var(--muted-foreground)" }}> · {ct.source}</span>
                      </span>
                      <span style={{ fontSize: 10.5, color: "#185FA5", background: "#E6F1FB", borderRadius: 8, padding: "2px 8px", justifySelf: "start" }}>{ct.task_type}</span>
                      <span style={{ fontSize: 11.5, color: "var(--muted-foreground)" }}>{ct.due_date ? ct.due_date.slice(5) : "—"}</span>
                      <span style={{ fontSize: 11.5, color: "var(--muted-foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ct.assignee_name ?? "—"}</span>
                      <span style={{ fontSize: 10.5, borderRadius: 999, padding: "2px 9px", justifySelf: "start", color: cdone ? "#0F6E56" : "#854F0B", background: cdone ? "#E1F5EE" : "#FAEEDA" }}>{cdone ? "Done" : "Open"}</span>
                      <span style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                        {!cdone && <button onClick={() => taskDone(ct.id)} disabled={busy} style={{ fontSize: 10.5, color: "#0F6E56", background: "none", border: "none", cursor: "pointer" }}><i className="ti ti-check" aria-hidden="true" /></button>}
                        <button onClick={() => setConfirmTaskId(ct.id)} disabled={busy} style={{ fontSize: 10.5, color: "#A32D2D", background: "none", border: "none", cursor: "pointer" }}>Delete</button>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : tab === "notes" ? (
            <div>
              <textarea value={noteInput} onChange={(e) => setNoteInput(e.target.value)} placeholder="Add an internal note…" style={{ ...inp, width: "100%", minHeight: 48, resize: "vertical" }} />
              <div style={{ margin: "6px 0 12px" }}>
                <button onClick={saveNote} disabled={busy || !noteInput.trim()} style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: "#2E78F5", border: "none", borderRadius: 7, padding: "7px 14px", cursor: "pointer", opacity: busy || !noteInput.trim() ? 0.5 : 1 }}>Save note</button>
              </div>
              <div style={{ fontSize: 12, color: "var(--muted-foreground)", background: "var(--muted)", borderRadius: 8, padding: 11, whiteSpace: "pre-wrap", lineHeight: 1.6, minHeight: 40 }}>{o.notes || "No notes yet."}</div>
            </div>
          ) : tab === "activity" ? (
            <div>
              <p style={{ fontSize: 11, color: "var(--muted-foreground)", margin: "0 0 12px" }}>Full note log and activity for this contact — shared across all their opportunities.</p>
              {contactActivity.length === 0 ? (
                <div style={{ fontSize: 11.5, color: "var(--muted-foreground)" }}>No activity yet. Calls, notes, emails, tasks, and stage changes appear here.</div>
              ) : (
                <div style={{ position: "relative", paddingLeft: 26 }}>
                  <div style={{ position: "absolute", left: 9, top: 4, bottom: 4, width: 1.5, background: "var(--border)" }} />
                  {contactActivity.map((a) => {
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
              )}
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 24px", fontSize: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--muted-foreground)" }}>Tags</span><span>{o.tags.length ? o.tags.join(", ") : "—"}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--muted-foreground)" }}>Priority</span><span>{o.priority ? <>{o.priority}<i className="ti ti-star-filled" aria-hidden="true" /></> : "—"}</span></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
