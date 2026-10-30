"use client";
import { formatPhone, telHref } from "@/lib/phone";

import { useState, useEffect } from "react";
import { OdooStageBar } from "@/components/ui/OdooStageBar";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FounderProfileMirror, type MirrorContact } from "./FounderProfileMirror";
import { SalesChatter } from "@/components/sales/SalesChatter";

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

// Gear menu rows (same look as the Contacts gear menu).
const menuItem: React.CSSProperties = { display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "8px 12px", fontSize: 12.5, color: "var(--foreground)", background: "none", border: "none", textAlign: "left", textDecoration: "none", cursor: "pointer" };
const menuIcon: React.CSSProperties = { fontSize: 15, width: 16, color: "var(--muted-foreground)" };
const menuHead: React.CSSProperties = { fontSize: 10, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--muted-foreground)", padding: "8px 12px 3px" };
const menuNote: React.CSSProperties = { marginLeft: "auto", paddingLeft: 8, fontSize: 11, color: "var(--muted-foreground)", maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
const menuOff: React.CSSProperties = { ...menuItem, color: "var(--muted-foreground)", cursor: "default", opacity: 0.6 };
const menuRule: React.CSSProperties = { borderTop: "0.5px solid #eef1f5", margin: "4px 0" };

const money = (c: number | null) => (c == null ? "—" : `$${(c / 100).toLocaleString()}`);
function mrr(o: Pick<Opp, "value_cents" | "billing">): string {
  if (o.value_cents == null) return "—";
  const cents = o.billing === "monthly" ? o.value_cents : Math.round(o.value_cents / 12);
  return `$${Math.round(cents / 100).toLocaleString()}`;
}

const inp: React.CSSProperties = { fontSize: 12, padding: "7px 9px", borderRadius: 7, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--foreground)", boxSizing: "border-box" };
const cardBox: React.CSSProperties = { background: "var(--muted)", borderRadius: 8, padding: 11 };

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
  const [menuOpen, setMenuOpen] = useState(false);
  // Esc closes the gear menu.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMenuOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);
  const [tab, setTab] = useState<"notes" | "activity" | "extra" | "founder">("notes");
  const [noteInput, setNoteInput] = useState("");
  const [sequences, setSequences] = useState<{ id: string; name: string; status: string }[]>([]);
  const [seqOpen, setSeqOpen] = useState(false);
  const [enrollMsg, setEnrollMsg] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/sales/sequences")
      .then((r) => (r.ok ? r.json() : { sequences: [] }))
      .then((d) => { if (active) setSequences(d.sequences ?? []); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  async function enrollSequence(sequenceId: string) {
    if (!sequenceId) return;
    setBusy(true);
    setEnrollMsg(null);
    try {
      const res = await fetch(`/api/sales/opportunities/${o.id}/enroll-sequence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sequenceId }),
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

  // The stage bar closes deals: Won marks the deal won, Loss marks it lost, and any
  // other stage reopens a closed deal.
  function stagePatch(s: Stage): Record<string, unknown> {
    if (s.is_won) return { stageId: s.id, status: "won" };
    if (/^los[st]$/i.test(s.name.trim())) return { stageId: s.id, status: "lost" };
    return o.status === "won" || o.status === "lost" ? { stageId: s.id, status: "open" } : { stageId: s.id };
  }

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch(`/api/sales/opportunities/${o.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      // PATCH now returns the updated joined row — no second GET needed.
      const data = (await res.json().catch(() => ({}))) as { opportunity?: Opp };
      if (res.ok && data.opportunity) setO(data.opportunity);
    } finally { setBusy(false); }
  }
  // Inline Deal value editor (amount + billing period).
  const [dvEditing, setDvEditing] = useState(false);
  const [dvAmount, setDvAmount] = useState("");
  const [dvBilling, setDvBilling] = useState<"yearly" | "monthly">("yearly");
  const [dvError, setDvError] = useState("");
  function dvStart() {
    setDvAmount(o.value_cents == null ? "" : String(o.value_cents / 100));
    setDvBilling(o.billing);
    setDvError("");
    setDvEditing(true);
  }
  // null = empty (clears the value), undefined = invalid, number = cents.
  function dvParse(): number | null | undefined {
    const t = dvAmount.replace(/[$,\s]/g, "");
    if (t === "") return null;
    const n = Number(t);
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : undefined;
  }
  async function dvSave() {
    const cents = dvParse();
    if (cents === undefined) { setDvError("Enter a valid amount"); return; }
    if (cents === o.value_cents && dvBilling === o.billing) { setDvEditing(false); return; }
    await patch({ valueCents: cents, billing: dvBilling });
    setDvEditing(false);
  }
  const dvParsed = dvEditing ? dvParse() : null;
  const dvPreviewMrr = dvParsed == null ? "—" : mrr({ value_cents: dvParsed, billing: dvBilling });

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
  const nextStage = stages.find((s) => s.sort_order > currentSort && !s.is_won);
  const statusColor = o.status === "won" ? "#0F6E56" : o.status === "lost" ? "#A32D2D" : o.status === "archived" ? "#5F5E5A" : "#185FA5";

  // Internal tab content (staff only): what used to be the strip under the chatter.
  const pill = (on: boolean): React.CSSProperties => ({ flexShrink: 0, whiteSpace: "nowrap", fontSize: 12, fontWeight: on ? 600 : 400, padding: "5px 12px", borderRadius: 999, cursor: "pointer", border: on ? "0.5px solid #E6F1FB" : "0.5px solid #d7dbe3", background: on ? "#E6F1FB" : "transparent", color: on ? "#185FA5" : "var(--muted-foreground)" });
  const internalPanel = (
    <div>
      <div style={{ display: "flex", gap: 6, overflowX: "auto", margin: "0 0 12px", paddingBottom: 2 }}>
        <button type="button" onClick={() => setTab("notes")} aria-pressed={tab === "notes"} style={pill(tab === "notes")}>Internal notes</button>
        <button type="button" onClick={() => setTab("activity")} aria-pressed={tab === "activity"} style={pill(tab === "activity")}>Activity{contactActivity.length ? ` · ${contactActivity.length}` : ""}</button>
        <button type="button" onClick={() => setTab("extra")} aria-pressed={tab === "extra"} style={pill(tab === "extra")}>Extra info</button>
        {founderContact && (
          <button type="button" onClick={() => setTab("founder")} aria-pressed={tab === "founder"} style={pill(tab === "founder")}>Founder profile</button>
        )}
      </div>
      {tab === "founder" && founderContact ? (
        <FounderProfileMirror contact={founderContact} />
      ) : tab === "notes" ? (
        <div>
          <textarea value={noteInput} onChange={(e) => setNoteInput(e.target.value)} placeholder="Add an internal note…" style={{ ...inp, width: "100%", minHeight: 48, resize: "vertical" }} />
          <div style={{ margin: "6px 0 12px" }}>
            <button type="button" onClick={saveNote} disabled={busy || !noteInput.trim()} style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: "#2E78F5", border: "none", borderRadius: 7, padding: "7px 14px", cursor: "pointer", opacity: busy || !noteInput.trim() ? 0.5 : 1 }}>Save note</button>
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
  );

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, fontSize: 12, color: "var(--muted-foreground)" }}>
        <Link href="/admin/sales/opportunities" style={{ color: "var(--muted-foreground)", textDecoration: "none" }}>← Opportunities</Link>
        <span>/</span><span style={{ color: "var(--foreground)" }}>{o.title}</span>
      </div>

      <div style={{ background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 12, overflow: "hidden" }}>
        {/* Gear menu (every action) + stage bar, one row */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: "0.5px solid #eef1f5", flexWrap: "wrap" }}>
          {o.status !== "open" && <span style={{ fontSize: 11.5, fontWeight: 600, color: statusColor, background: "var(--muted)", borderRadius: 10, padding: "5px 12px" }}>{o.status.toUpperCase()}</span>}
          <div style={{ position: "relative" }}>
            <button type="button" onClick={() => { setMenuOpen((v) => !v); setSeqOpen(false); }} aria-label="Actions" aria-haspopup="menu" aria-expanded={menuOpen} title="Actions"
              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 34, height: 32, border: "0.5px solid var(--border-strong, #cbd5e1)", borderRadius: 8, background: menuOpen ? "#EEF4FF" : "#fff", cursor: "pointer" }}>
              <i className="ti ti-settings" style={{ fontSize: 16 }} aria-hidden="true" />
            </button>
            {menuOpen && (
              <>
                <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
                <div role="menu" style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 50, width: 290, background: "#fff", border: "0.5px solid #cbd5e1", borderRadius: 10, boxShadow: "0 14px 30px rgba(0,0,0,.14)", padding: "4px 0" }}>
                  <div style={menuHead}>Contact</div>
                  {o.contact_phone
                    ? <a role="menuitem" href={telHref(o.contact_phone) ?? `tel:${o.contact_phone.replace(/[^+\d]/g, "")}`} target="_blank" rel="noopener noreferrer" onClick={() => { logTouch("call"); setMenuOpen(false); }} style={menuItem}><i className="ti ti-phone" style={menuIcon} aria-hidden="true" />Call<span style={menuNote}>{formatPhone(o.contact_phone)}</span></a>
                    : <span role="menuitem" aria-disabled="true" style={menuOff}><i className="ti ti-phone" style={menuIcon} aria-hidden="true" />Call<span style={menuNote}>needs phone</span></span>}
                  {o.contact_email
                    ? <a role="menuitem" href={`/admin/inbox?compose=1&to=${encodeURIComponent(o.contact_email)}`} target="_blank" rel="noopener noreferrer" onClick={() => setMenuOpen(false)} style={menuItem}><i className="ti ti-mail" style={menuIcon} aria-hidden="true" />Email<span style={menuNote}>{o.contact_email}</span></a>
                    : <span role="menuitem" aria-disabled="true" style={menuOff}><i className="ti ti-mail" style={menuIcon} aria-hidden="true" />Email<span style={menuNote}>needs email</span></span>}
                  {o.contact_phone
                    ? <a role="menuitem" href={`sms:${o.contact_phone.replace(/[^+\d]/g, "")}`} target="_blank" rel="noopener noreferrer" onClick={() => { logTouch("message"); setMenuOpen(false); }} style={menuItem}><i className="ti ti-message" style={menuIcon} aria-hidden="true" />Message</a>
                    : <span role="menuitem" aria-disabled="true" style={menuOff}><i className="ti ti-message" style={menuIcon} aria-hidden="true" />Message<span style={menuNote}>needs phone</span></span>}
                  {o.contact_crm_id && <Link role="menuitem" href={`/admin/sales/contracts/send?contact=${o.contact_crm_id}`} onClick={() => setMenuOpen(false)} style={menuItem}><i className="ti ti-signature" style={menuIcon} aria-hidden="true" />Contracts<span style={menuNote}>upload and send</span></Link>}
                  <div style={menuRule} />
                  <div style={menuHead}>Deal</div>
                  <button type="button" role="menuitem" onClick={() => { logTouch("call"); setMenuOpen(false); }} disabled={busy} title="Record a call you made (e.g. via your phone system)" style={menuItem}><i className="ti ti-phone-plus" style={menuIcon} aria-hidden="true" />Log call</button>
                  {nextStage && o.status === "open" && <button type="button" role="menuitem" onClick={() => { patch({ stageId: nextStage.id }); setMenuOpen(false); }} disabled={busy} style={menuItem}><i className="ti ti-arrow-right" style={menuIcon} aria-hidden="true" />Advance to {nextStage.name}</button>}
                  <button type="button" role="menuitem" onClick={() => { setEditing((v) => !v); setMenuOpen(false); }} disabled={busy} style={menuItem}><i className="ti ti-edit" style={menuIcon} aria-hidden="true" />{editing ? "Close edit" : "Edit"}</button>
                  {o.contact_email && (
                    <>
                      <button type="button" role="menuitem" aria-expanded={seqOpen} onClick={() => setSeqOpen((v) => !v)} disabled={busy} title="Enroll this opportunity's contact into a marketing sequence" style={menuItem}>
                        <i className="ti ti-player-play" style={menuIcon} aria-hidden="true" />Enroll in sequence
                        <i className={`ti ${seqOpen ? "ti-chevron-down" : "ti-chevron-right"}`} style={{ ...menuNote, fontSize: 14 }} aria-hidden="true" />
                      </button>
                      {seqOpen && (
                        <div style={{ maxHeight: 220, overflowY: "auto", background: "var(--muted)", margin: "0 8px 4px", borderRadius: 8, padding: "4px 0" }}>
                          {sequences.length === 0 && <div style={{ fontSize: 12, color: "var(--muted-foreground)", padding: "6px 12px" }}>No sequences yet</div>}
                          {sequences.map((sq) => (
                            <button key={sq.id} type="button" role="menuitem" disabled={busy} onClick={() => { setMenuOpen(false); setSeqOpen(false); void enrollSequence(sq.id); }} style={{ ...menuItem, padding: "6px 12px 6px 37px", fontSize: 12 }}>{sq.name}</button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                  <div style={menuRule} />
                  <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); del(); }} disabled={busy} style={{ ...menuItem, color: "#A32D2D" }}><i className="ti ti-trash" style={{ ...menuIcon, color: "#A32D2D" }} aria-hidden="true" />Delete</button>
                </div>
              </>
            )}
          </div>
          {enrollMsg && <span style={{ fontSize: 11, color: enrollMsg.startsWith("Enrolled") ? "#0F6E56" : "#A32D2D" }}>{enrollMsg}</span>}
          <OdooStageBar
            steps={stages.map((s) => ({ key: s.id, label: s.name }))}
            current={o.stage_id}
            onSelect={(id) => { const s = stages.find((x) => x.id === id); if (s) void patch(stagePatch(s)); }}
            disabled={busy}
          />
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
                <button type="button" onClick={saveEdit} disabled={busy} style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: "#2E78F5", border: "none", borderRadius: 7, padding: "8px 16px", cursor: "pointer" }}>Save</button>
                <button type="button" onClick={() => setEditing(false)} style={{ fontSize: 12, color: "var(--muted-foreground)", background: "transparent", border: "0.5px solid var(--border-strong, #cbd5e1)", borderRadius: 7, padding: "8px 16px", cursor: "pointer" }}>Cancel</button>
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
                        <button type="button"
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
                <div style={cardBox}>
                  <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Deal value</div>
                  {dvEditing ? (
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 3 }}>
                        <span style={{ fontSize: 15, fontWeight: 600 }}>$</span>
                        <input
                          autoFocus inputMode="decimal" aria-label="Deal value amount" value={dvAmount}
                          onChange={(e) => { setDvAmount(e.target.value); setDvError(""); }}
                          onKeyDown={(e) => { if (e.key === "Enter") void dvSave(); if (e.key === "Escape") setDvEditing(false); }}
                          style={{ ...inp, width: 96, fontSize: 15, fontWeight: 600, padding: "4px 7px" }}
                        />
                        <select aria-label="Billing period" value={dvBilling} onChange={(e) => setDvBilling(e.target.value as "yearly" | "monthly")} style={{ ...inp, padding: "4px 5px" }}>
                          <option value="yearly">/yr</option>
                          <option value="monthly">/mo</option>
                        </select>
                      </div>
                      {dvError
                        ? <div style={{ fontSize: 11, color: "#A32D2D", marginTop: 4 }}>{dvError}</div>
                        : <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 4 }}>Expected MRR becomes {dvPreviewMrr}</div>}
                      <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                        <button type="button" onClick={() => void dvSave()} disabled={busy} style={{ ...inp, cursor: "pointer", fontWeight: 600 }}>Save</button>
                        <button type="button" onClick={() => setDvEditing(false)} style={{ ...inp, cursor: "pointer" }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div
                      role="button" tabIndex={0} title="Edit deal value" onClick={dvStart}
                      onKeyDown={(ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); dvStart(); } }}
                      style={{ fontSize: 19, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "baseline", gap: 2 }}
                    >
                      {money(o.value_cents)}<span style={{ fontSize: 11, color: "var(--muted-foreground)", fontWeight: 400 }}>/{o.billing === "monthly" ? "mo" : "yr"}</span>
                      <i className="ti ti-pencil" aria-hidden="true" style={{ fontSize: 14, color: "var(--muted-foreground)", marginLeft: 6 }} />
                    </div>
                  )}
                </div>
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

          {/* Chatter — send message / log note / tasks / internal */}
          <div style={{ margin: "16px 0" }}>
            <SalesChatter opportunityId={o.id} contactCrmId={o.contact_crm_id} contactName={o.contact_name} contactEmail={o.contact_email} staff={staff}
              underlineTabs fullTasks notesLog internalPanel={internalPanel} />
          </div>
        </div>
      </div>
    </div>
  );
}
