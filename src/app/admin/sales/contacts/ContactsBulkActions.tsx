"use client";

/**
 * Odoo-style selection bar + Actions menu for the Contacts list, and the panels each
 * action opens (Email, Lead assign, Set lead source, Create list, Export CSV).
 *
 * The parent owns *what* is selected (ticked ids, or "all matching" — the FilterSpec
 * the list is showing). This component owns everything about *acting* on it. A
 * "Select all" action sends `{ mode: "filter", params }` — the same `filter=` spec the
 * list ran — so the server resolves the identical set through search_contact_ids.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { MassEmailComposer } from "@/components/marketing/MassEmailComposer";

export type BulkTarget = { mode: "ids"; ids: string[] } | { mode: "filter"; params: string };

const LEAD_SOURCE_OPTS = ["LinkedIn", "Referral", "Website", "Event", "Conference", "Cold outreach", "Email campaign", "Partner", "Inbound", "Webinar", "Other"];
const LIST_DEPARTMENTS = ["Marketing", "Sales", "Investor Relations", "Administration", "Events"] as const;

const inp: React.CSSProperties = { fontSize: 12, padding: "7px 10px", borderRadius: 8, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--foreground)" };
const panel: React.CSSProperties = { marginTop: 10, background: "#fff", border: "0.5px solid var(--border-strong, #cbd5e1)", borderRadius: 10, padding: 12 };
const primary: React.CSSProperties = { fontSize: 12.5, fontWeight: 600, color: "#fff", background: "#2E78F5", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer" };
const secondary: React.CSSProperties = { fontSize: 12.5, color: "var(--muted-foreground)", background: "transparent", border: "0.5px solid var(--border-strong, #cbd5e1)", borderRadius: 8, padding: "8px 16px", cursor: "pointer" };

function Banner({ text, onClose, children }: { text: string; onClose: () => void; children?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#E1F5EE", border: "0.5px solid #A7E0CE", borderRadius: 10, padding: "10px 13px", marginBottom: 12 }}>
      <i className="ti ti-circle-check" style={{ color: "#0F6E56" }} aria-hidden="true" />
      <span style={{ fontSize: 12.5, color: "#0F6E56", fontWeight: 500 }}>{text}</span>
      {children}
      <button type="button" onClick={onClose} style={{ marginLeft: "auto", fontSize: 12, color: "var(--muted-foreground)", background: "none", border: "none", cursor: "pointer" }}><i className="ti ti-x" aria-hidden="true" /></button>
    </div>
  );
}

async function downloadCsvResponse(res: Response, fallbackName: string): Promise<string> {
  const blob = await res.blob();
  const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? fallbackName;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  return name;
}

type Props = {
  target: BulkTarget;
  /** How many contacts the target covers (ticked count, or the matching total). */
  count: number;
  selectAllMatching: boolean;
  matchingTotal: number;
  onSelectAll: () => void;
  onClear: () => void;
  /** Refetch the list after a write. */
  onChanged: () => void;
  can: { assign: boolean; list: boolean; edit: boolean; export: boolean };
};

export function ContactsBulkActions({ target, count, selectAllMatching, matchingTotal, onSelectAll, onClear, onChanged, can }: Props) {
  const [actionsOpen, setActionsOpen] = useState(false);
  const [actionResult, setActionResult] = useState<string | null>(null);
  const [exportBusy, setExportBusy] = useState(false);

  const [sourceOpen, setSourceOpen] = useState(false);
  const [sourceVal, setSourceVal] = useState<string>(LEAD_SOURCE_OPTS[0]);
  const [sourceBusy, setSourceBusy] = useState(false);
  const [sourceMsg, setSourceMsg] = useState<string | null>(null);

  const [members, setMembers] = useState<{ id: string; name: string }[]>([]);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignSel, setAssignSel] = useState<string[]>([]);
  const [assignBusy, setAssignBusy] = useState(false);
  const [assignMsg, setAssignMsg] = useState<string | null>(null);

  const [listOpen, setListOpen] = useState(false);
  const [listMode, setListMode] = useState<"new" | "existing">("new");
  const [listName, setListName] = useState("");
  const [listDept, setListDept] = useState<string>("Marketing");
  const [listDesc, setListDesc] = useState("");
  const [existingLists, setExistingLists] = useState<{ id: string; name: string; contact_count?: number }[]>([]);
  const [addToListId, setAddToListId] = useState("");
  const [listBusy, setListBusy] = useState(false);
  const [listMsg, setListMsg] = useState<string | null>(null);
  const [listResult, setListResult] = useState<string | null>(null);
  const [emailOpen, setEmailOpen] = useState(false);

  // Members for the mass-assign picker (super admin only).
  useEffect(() => {
    if (!can.assign) return;
    fetch("/api/sales/contacts/assignable-members").then((r) => (r.ok ? r.json() : null)).then((d) => { if (d?.members) setMembers(d.members); }).catch(() => {});
  }, [can.assign]);

  function closePanels() { setAssignOpen(false); setListOpen(false); setSourceOpen(false); setActionsOpen(false); }
  // Selection gone (cleared, or the filters changed) → nothing to act on; panels close.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- close panels when the selection empties
  useEffect(() => { if (count === 0) { closePanels(); setAssignMsg(null); setListMsg(null); setSourceMsg(null); } }, [count]);

  const noun = `contact${count === 1 ? "" : "s"}`;
  const n = count.toLocaleString();

  async function submitSetSource() {
    setSourceBusy(true); setSourceMsg(null);
    try {
      let done = 0, failed = 0;
      let afterId: string | undefined;
      // Server writes ≤1,500 per request and hands back a cursor; keep going until done.
      for (let pass = 0; pass < 40; pass++) {
        const res = await fetch("/api/sales/contacts/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "set_lead_source", value: sourceVal, afterId, ...target }) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Couldn't set the lead source.");
        done += data.count; failed += data.failed ?? 0;
        if (!data.nextCursor) break;
        afterId = data.nextCursor;
        setSourceMsg(`Working… ${done.toLocaleString()} done, ${data.remaining.toLocaleString()} to go`);
      }
      setActionResult(`Lead source set to “${sourceVal}” on ${done.toLocaleString()} contact${done === 1 ? "" : "s"}${failed ? ` — ${failed} failed` : ""}.`);
      onClear(); onChanged();
    } catch (e) { setSourceMsg(e instanceof Error ? e.message : "Couldn't set the lead source."); } finally { setSourceBusy(false); }
  }

  async function exportCsv() {
    setExportBusy(true); setActionsOpen(false);
    try {
      const res = await fetch("/api/sales/contacts/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "export", ...target }) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error ?? "Export failed."); }
      const name = await downloadCsvResponse(res, "contacts.csv");
      setActionResult(`Exported ${n} ${noun} to ${name}.`);
    } catch (e) { setActionResult(e instanceof Error ? e.message : "Export failed."); } finally { setExportBusy(false); }
  }

  function openListPanel() {
    setListOpen((v) => !v); setListMsg(null); setAssignOpen(false);
    if (existingLists.length === 0) {
      fetch("/api/marketing/lists").then((r) => (r.ok ? r.json() : [])).then((d) => setExistingLists(Array.isArray(d) ? d : [])).catch(() => {});
    }
  }
  async function submitCreateList() {
    const isNew = listMode === "new";
    if (isNew && !listName.trim()) { setListMsg("Give the list a name."); return; }
    if (!isNew && !addToListId) { setListMsg("Pick a list to add to."); return; }
    setListBusy(true); setListMsg(null);
    try {
      const dest = isNew ? { name: listName.trim(), department: listDept, description: listDesc.trim() || undefined } : { listId: addToListId };
      const res = await fetch("/api/marketing/lists/from-contacts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...target, ...dest }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't create the list.");
      setListResult(`${data.created ? "Created list" : "Updated list"} “${data.listName}” — ${data.added.toLocaleString()} contact${data.added === 1 ? "" : "s"} added${data.skippedNoEmail ? `, ${data.skippedNoEmail.toLocaleString()} skipped (no email)` : ""}.`);
      setListName(""); setListDesc(""); setAddToListId("");
      onClear();
      fetch("/api/marketing/lists").then((r) => (r.ok ? r.json() : [])).then((d) => setExistingLists(Array.isArray(d) ? d : [])).catch(() => {});
    } catch (e) { setListMsg(e instanceof Error ? e.message : "Couldn't create the list."); } finally { setListBusy(false); }
  }

  const assignNames = members.filter((m) => assignSel.includes(m.id)).map((m) => m.name);
  async function submitAssign() {
    if (assignSel.length === 0) { setAssignMsg("Pick at least one member."); return; }
    setAssignBusy(true); setAssignMsg(null);
    try {
      const res = await fetch("/api/sales/contacts/bulk-assign", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ memberIds: assignSel, ...target }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Assign failed.");
      setActionResult(`Added ${assignNames.join(", ")} to ${Number(data.count ?? count).toLocaleString()} contact${data.count === 1 ? "" : "s"}.`);
      onClear(); setAssignSel([]); onChanged();
    } catch (e) { setAssignMsg(e instanceof Error ? e.message : "Assign failed."); } finally { setAssignBusy(false); }
  }

  const actions = ([
    can.list ? { key: "email", icon: "ti-mail", label: "Email", run: () => { closePanels(); setEmailOpen(true); } } : null,
    can.assign ? { key: "assign", icon: "ti-user-plus", label: "Lead assign", run: () => { closePanels(); setAssignOpen(true); setAssignMsg(null); } } : null,
    can.edit ? { key: "source", icon: "ti-tag", label: "Set lead source", run: () => { closePanels(); setSourceOpen(true); setSourceMsg(null); } } : null,
    can.list ? { key: "list", icon: "ti-list-details", label: "Create list", run: () => { closePanels(); openListPanel(); } } : null,
    can.export ? { key: "export", icon: "ti-download", label: "Export CSV", run: () => void exportCsv() } : null,
  ] as Array<{ key: string; icon: string; label: string; run: () => void } | null>).filter((a): a is NonNullable<typeof a> => a !== null);

  return (
    <>
      {actionsOpen && <div onClick={() => setActionsOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 20 }} />}

      {emailOpen && (
        <MassEmailComposer source="contacts" selection={{ ...target, count }} onClose={() => setEmailOpen(false)} />
      )}

      {can.list && listResult && (
        <Banner text={listResult} onClose={() => setListResult(null)}>
          <Link href="/admin/marketing/lists" style={{ fontSize: 12, color: "#185FA5", textDecoration: "underline", marginLeft: 4 }}>View in Lists →</Link>
        </Banner>
      )}
      {actionResult && <Banner text={actionResult} onClose={() => setActionResult(null)} />}

      {count > 0 && (
        <div style={{ background: "#E6F1FB", border: "0.5px solid #B5D4F4", borderRadius: 10, padding: "8px 13px", marginBottom: 12 }}>
          {/* Odoo selection bar: "N selected → Select all M ×" then one Actions menu. */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12.5, color: "#0C447C", fontWeight: 600, background: "#B5D4F4", borderRadius: 7, padding: "4px 10px" }}>{selectAllMatching ? `All ${matchingTotal.toLocaleString()} selected` : `${n} selected`}</span>
            {!selectAllMatching && matchingTotal > count && (
              <button type="button" onClick={onSelectAll} style={{ fontSize: 12.5, fontWeight: 500, color: "#185FA5", background: "none", border: "none", cursor: "pointer", padding: 0, display: "inline-flex", alignItems: "center", gap: 4 }}><i className="ti ti-arrow-right" aria-hidden="true" /> Select all {matchingTotal.toLocaleString()}</button>
            )}
            <button type="button" onClick={onClear} aria-label="Clear selection" style={{ fontSize: 14, color: "#185FA5", background: "none", border: "none", cursor: "pointer", padding: 0, display: "inline-flex" }}><i className="ti ti-x" aria-hidden="true" /></button>
            <div style={{ marginLeft: "auto", position: "relative" }}>
              <button type="button" onClick={() => setActionsOpen((v) => !v)} disabled={exportBusy} style={{ fontSize: 12, fontWeight: 600, color: "var(--foreground)", background: "#fff", border: "0.5px solid var(--border-strong, #cbd5e1)", borderRadius: 7, padding: "6px 12px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
                <i className="ti ti-settings" aria-hidden="true" /> {exportBusy ? "Exporting…" : "Actions"} <i className="ti ti-chevron-down" style={{ fontSize: 12 }} aria-hidden="true" />
              </button>
              {actionsOpen && (
                <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 30, width: 220, background: "#fff", border: "0.5px solid var(--border-strong, #cbd5e1)", borderRadius: 10, boxShadow: "0 10px 28px rgba(0,0,0,0.14)", padding: "6px 0" }}>
                  <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--muted-foreground)", padding: "6px 13px 4px" }}>Selected contacts</div>
                  {actions.map((a) => (
                    <button type="button" key={a.key} onClick={a.run} style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 9, padding: "8px 13px", background: "none", border: "none", cursor: "pointer", fontSize: 12.5, color: "var(--foreground)" }}>
                      <i className={`ti ${a.icon}`} style={{ fontSize: 15, color: "var(--muted-foreground)" }} aria-hidden="true" />{a.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {can.edit && sourceOpen && (
            <div style={panel}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>Set lead source on {n} {noun}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <select value={sourceVal} onChange={(e) => setSourceVal(e.target.value)} style={{ ...inp, minWidth: 180 }}>
                  {LEAD_SOURCE_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
                <button type="button" onClick={submitSetSource} disabled={sourceBusy} style={{ ...primary, opacity: sourceBusy ? 0.55 : 1 }}>{sourceBusy ? "Applying…" : `Apply to ${n}`}</button>
                <button type="button" onClick={() => setSourceOpen(false)} style={secondary}>Cancel</button>
                {sourceMsg && <span style={{ fontSize: 11.5, color: sourceBusy ? "#185FA5" : "#A32D2D" }}>{sourceMsg}</span>}
              </div>
              <div style={{ fontSize: 11.5, color: "var(--muted-foreground)", marginTop: 8 }}>Replaces the current lead source. Kept on re-sync from Odoo.</div>
            </div>
          )}

          {can.list && listOpen && (
            <div style={panel}>
              <div style={{ display: "inline-flex", border: "0.5px solid var(--border)", borderRadius: 8, overflow: "hidden", marginBottom: 12 }}>
                {(["new", "existing"] as const).map((m) => (
                  <button type="button" key={m} onClick={() => { setListMode(m); setListMsg(null); }} style={{ fontSize: 11.5, fontWeight: listMode === m ? 600 : 400, color: listMode === m ? "#fff" : "var(--muted-foreground)", background: listMode === m ? "#2E78F5" : "transparent", border: "none", padding: "5px 13px", cursor: "pointer" }}>{m === "new" ? "New list" : "Add to existing"}</button>
                ))}
              </div>
              {listMode === "new" ? (
                <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 8, marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 4 }}>List name</div>
                    <input value={listName} onChange={(e) => setListName(e.target.value)} autoFocus placeholder="e.g. Investor outreach — Sept" style={{ ...inp, width: "100%", boxSizing: "border-box" }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 4 }}>Department</div>
                    <select value={listDept} onChange={(e) => setListDept(e.target.value)} style={{ ...inp, width: "100%", boxSizing: "border-box" }}>
                      {LIST_DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 4 }}>Description (optional)</div>
                    <input value={listDesc} onChange={(e) => setListDesc(e.target.value)} placeholder="What this segment is for…" style={{ ...inp, width: "100%", boxSizing: "border-box" }} />
                  </div>
                </div>
              ) : (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 4 }}>Add to list</div>
                  <select value={addToListId} onChange={(e) => setAddToListId(e.target.value)} style={{ ...inp, width: "100%", boxSizing: "border-box" }}>
                    <option value="">Choose a list…</option>
                    {existingLists.map((l) => <option key={l.id} value={l.id}>{l.name}{typeof l.contact_count === "number" ? ` (${l.contact_count})` : ""}</option>)}
                  </select>
                  {existingLists.length === 0 && <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 5 }}>No lists yet — switch to “New list”.</div>}
                </div>
              )}
              <div style={{ background: "var(--muted)", borderRadius: 8, padding: "8px 11px", fontSize: 11.5, color: "#185FA5", marginBottom: 10 }}>
                <i className="ti ti-info-circle" aria-hidden="true" /> Adds <b>{n}</b> selected {noun} to the list. Contacts without an email are skipped.
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button type="button" onClick={submitCreateList} disabled={listBusy || (listMode === "new" ? !listName.trim() : !addToListId)} style={{ ...primary, opacity: listBusy || (listMode === "new" ? !listName.trim() : !addToListId) ? 0.55 : 1 }}>{listBusy ? "Working…" : listMode === "new" ? `Create list · ${n}` : `Add ${n} to list`}</button>
                <button type="button" onClick={() => setListOpen(false)} style={secondary}>Cancel</button>
                {listMsg && <span style={{ fontSize: 11.5, color: "#A32D2D" }}>{listMsg}</span>}
              </div>
            </div>
          )}

          {can.assign && assignOpen && (
            <div style={panel}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>Add members to {n} {noun}</div>
              <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 5 }}>Members (lead-assignable only)</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10, maxHeight: 132, overflowY: "auto" }}>
                {members.length === 0 && <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>No assignable members configured.</span>}
                {members.map((m) => {
                  const on = assignSel.includes(m.id);
                  return (
                    <button type="button" key={m.id} onClick={() => setAssignSel((s) => on ? s.filter((x) => x !== m.id) : [...s, m.id])} style={{ fontSize: 11.5, fontWeight: on ? 600 : 400, color: on ? "#185FA5" : "var(--muted-foreground)", background: on ? "#E6F1FB" : "transparent", border: `0.5px solid ${on ? "#B5D4F4" : "var(--border)"}`, borderRadius: 16, padding: "4px 11px", cursor: "pointer" }}>{on ? <><i className="ti ti-check" aria-hidden="true" /> </> : "+ "}{m.name}</button>
                  );
                })}
              </div>
              <div style={{ background: "var(--muted)", borderRadius: 8, padding: "8px 11px", fontSize: 11.5, color: "#854F0B", marginBottom: 10 }}>
                <i className="ti ti-alert-triangle" aria-hidden="true" /> Adds {assignNames.length ? assignNames.join(", ") : "the selected members"} to <b>{n}</b> {noun}. Existing assignees are kept. Logged to the audit trail.
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button type="button" onClick={submitAssign} disabled={assignBusy || assignSel.length === 0} style={{ ...primary, opacity: assignBusy || assignSel.length === 0 ? 0.55 : 1 }}>{assignBusy ? "Assigning…" : `Add to ${n} ${noun}`}</button>
                <button type="button" onClick={() => setAssignOpen(false)} style={secondary}>Cancel</button>
                {assignMsg && <span style={{ fontSize: 11.5, color: "#A32D2D" }}>{assignMsg}</span>}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
