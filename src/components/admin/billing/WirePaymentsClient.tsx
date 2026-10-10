"use client";

import { useMemo, useState } from "react";
import { OdooSearchBar, EMPTY_SEARCH, type SearchState, type QuickFilter, type GroupOption } from "@/components/admin/OdooSearchBar";
import { SearchCount, Highlight, NoSearchMatches } from "@/components/ui/SearchStatus";
import { matchRows, type SearchField } from "@/lib/ui/live-search";
import {
  EMPTY_WIRE_INSTRUCTIONS, WIRE_COPY, WIRE_CYCLE_LABEL, WIRE_INSTRUCTION_FIELDS, WIRE_STATUS_LABEL, WIRE_STATUS_TONE,
  wireDatePT, wireInstructionsComplete, wireMoney, type WireInstructions, type WireStatus,
} from "@/lib/billing/wire-core";

/**
 * Admin, Billing, Wire payments. Every Premium wire invoice with its status;
 * staff mark wires received (activates Premium), send reminders, void, and
 * edit the wire instructions printed on every invoice. Requires manage_billing.
 */
export type AdminWireRow = {
  id: string;
  invoice_number: string;
  profile_id: string;
  billing_cycle: "monthly" | "quarterly";
  amount_cents: number;
  status: WireStatus;
  issued_at: string;
  due_at: string;
  received_at: string | null;
  reminder_sent_at: string | null;
  is_renewal: boolean;
  founderName: string | null;
  founderEmail: string | null;
  companyName: string | null;
  daysOverdue: number;
};

const navy = "#0A1A40";
const blue = "#1A6CE4";

const QUICK: QuickFilter[] = [
  { key: "awaiting", label: "Awaiting" },
  { key: "overdue", label: "Overdue" },
  { key: "received", label: "Received", sep: true },
  { key: "void", label: "Void" },
];
const GROUPS: GroupOption[] = [
  { id: "none", label: "No grouping" },
  { id: "status", label: "Status" },
];
const STATUS_ORDER: WireStatus[] = ["overdue", "awaiting", "received", "void"];

const SEARCH_FIELDS: SearchField<AdminWireRow>[] = [
  { label: "company", get: (r) => r.companyName },
  { label: "founder", get: (r) => r.founderName },
  { label: "email", get: (r) => r.founderEmail },
  { label: "invoice number", get: (r) => r.invoice_number },
  { label: "cycle", get: (r) => WIRE_CYCLE_LABEL[r.billing_cycle] },
  { label: "amount", get: (r) => wireMoney(r.amount_cents) },
  { label: "issued", get: (r) => wireDatePT(r.issued_at) },
  { label: "due", get: (r) => wireDatePT(r.due_at) },
  { label: "status", get: (r) => WIRE_STATUS_LABEL[r.status] },
];

function Pill({ status }: Readonly<{ status: WireStatus }>) {
  const t = WIRE_STATUS_TONE[status];
  return <span style={{ fontSize: 10.5, fontWeight: 600, background: t.bg, color: t.fg, borderRadius: 6, padding: "2px 8px" }}>{WIRE_STATUS_LABEL[status]}</span>;
}

type Action = "received" | "reminder" | "void";

export function WirePaymentsClient({ initialRows, initialInstructions }: Readonly<{ initialRows: AdminWireRow[]; initialInstructions: WireInstructions }>) {
  const [rows, setRows] = useState<AdminWireRow[]>(initialRows);
  const [search, setSearch] = useState<SearchState>({ ...EMPTY_SEARCH, groupBy: "none" });
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "good" | "bad" | "warn"; text: string } | null>(null);
  const [confirm, setConfirm] = useState<{ row: AdminWireRow; action: Action } | null>(null);
  const [instr, setInstr] = useState<WireInstructions>(initialInstructions);
  const [editing, setEditing] = useState(false);

  const filtered = useMemo(() => (search.quick.length ? rows.filter((r) => search.quick.includes(r.status)) : rows), [rows, search.quick]);
  const searched = useMemo(() => ({ ...matchRows(filtered, SEARCH_FIELDS, search.q), total: rows.length }), [filtered, search.q, rows.length]);
  const visible = searched.rows;
  const query = search.q;
  const grouped = useMemo(() => {
    if (search.groupBy !== "status") return [["", visible] as const];
    return STATUS_ORDER.map((s) => [WIRE_STATUS_LABEL[s], visible.filter((r) => r.status === s)] as const).filter(([, list]) => list.length > 0);
  }, [visible, search.groupBy]);

  async function run(row: AdminWireRow, action: Action) {
    setBusy(`${row.id}:${action}`);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/billing/wire/${row.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; warning?: string | null; emailed?: boolean; invoice?: { status: WireStatus; received_at: string | null; reminder_sent_at: string | null } } | null;
      if (!res.ok || !data?.ok) {
        setMessage({ tone: "bad", text: data?.error ?? "Action failed." });
        return;
      }
      if (data.invoice) {
        const inv = data.invoice;
        setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, status: inv.status, received_at: inv.received_at, reminder_sent_at: inv.reminder_sent_at, daysOverdue: inv.status === "received" || inv.status === "void" ? 0 : r.daysOverdue } : r)));
      }
      const who = row.companyName || row.founderName || row.founderEmail || "the founder";
      if (action === "received") {
        setMessage(
          data.warning
            ? { tone: "warn", text: `Marked received. Premium is active for ${who}. ${data.warning}` }
            : { tone: "good", text: `Marked received. Premium is active for ${who}${data.emailed ? " and the receipt was emailed" : "; the receipt email was not sent (no email, or email is off for this account)"}.` },
        );
      } else if (action === "reminder") {
        setMessage({ tone: "good", text: `Reminder sent to ${who}.` });
      } else {
        setMessage({ tone: "good", text: `${row.invoice_number} is void.` });
      }
    } catch {
      setMessage({ tone: "bad", text: "Network error. Please try again." });
    } finally {
      setBusy(null);
      setConfirm(null);
    }
  }

  const cell: React.CSSProperties = { padding: "10px 12px", fontSize: 12.5, verticalAlign: "middle" };
  const btn: React.CSSProperties = { fontSize: 11.5, padding: "4px 9px", borderRadius: 7, border: "0.5px solid #E4E8F0", background: "#fff", color: navy, cursor: "pointer", whiteSpace: "nowrap" };
  const instructionsReady = wireInstructionsComplete(instr);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ background: "#fff", border: "0.5px solid #E4E8F0", borderRadius: 12, overflow: "hidden" }}>
        {/* Card header: title left, count badge then actions right. */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderBottom: "0.5px solid #EEF1F5", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: navy }}>Wire payments</div>
            <div style={{ fontSize: 12, color: "#6B7690", marginTop: 2 }}>{WIRE_COPY.adminExplainer}</div>
          </div>
          <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 8 }}>
            {!instructionsReady ? (
              <span style={{ fontSize: 11, fontWeight: 600, background: "#FAEEDA", color: "#854F0B", borderRadius: 6, padding: "2px 8px" }}>Bank details missing</span>
            ) : null}
            <button type="button" onClick={() => setEditing(true)} style={{ ...btn, fontSize: 12.5, padding: "7px 12px", background: blue, color: "#fff", border: "none", fontWeight: 600 }}>
              <i className="ti ti-building-bank" aria-hidden="true" /> Wire instructions
            </button>
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderBottom: "0.5px solid #EEF1F5", flexWrap: "wrap" }}>
          <OdooSearchBar scope="admin-billing-wire" state={search} onChange={setSearch} quick={QUICK} fields={[]} groups={GROUPS} noGroupId="none" placeholder="Search wire invoices" width={440} />
          <span style={{ marginLeft: "auto" }}>
            <SearchCount result={{ ...searched, active: searched.active || filtered.length !== rows.length }} noun="invoices" />
          </span>
        </div>

        {message ? (
          <div style={{ padding: "8px 14px", fontSize: 12.5, background: message.tone === "bad" ? "#FCEBEB" : message.tone === "warn" ? "#FAEEDA" : "#E1F5EE", color: message.tone === "bad" ? "#A32D2D" : message.tone === "warn" ? "#854F0B" : "#0F6E56" }} role="status">
            {message.text}
          </div>
        ) : null}

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", minWidth: 900, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".04em", color: "#6B7690", background: "#F6F8FB" }}>
                <th style={{ ...cell, fontWeight: 500 }}>Company / founder</th>
                <th style={{ ...cell, fontWeight: 500 }}>Invoice</th>
                <th style={{ ...cell, fontWeight: 500 }}>Cycle</th>
                <th style={{ ...cell, fontWeight: 500 }}>Amount</th>
                <th style={{ ...cell, fontWeight: 500 }}>Issued</th>
                <th style={{ ...cell, fontWeight: 500 }}>Due (PT)</th>
                <th style={{ ...cell, fontWeight: 500 }}>Status</th>
                <th style={{ ...cell, fontWeight: 500, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: 12 }}>
                    {query.trim() ? (
                      <NoSearchMatches query={query} fields={SEARCH_FIELDS.map((f) => f.label)} onClear={() => setSearch({ ...search, q: "" })} />
                    ) : (
                      <span style={{ fontSize: 12.5, color: "#6B7690" }}>{rows.length ? "No invoices match these filters." : "No wire invoices yet. They appear here when a founder requests Premium."}</span>
                    )}
                  </td>
                </tr>
              ) : (
                grouped.map(([label, list]) => (
                  <GroupRows key={label || "all"} label={label} count={list.length}>
                    {list.map((r) => {
                      const open = r.status === "awaiting" || r.status === "overdue";
                      return (
                        <tr key={r.id} style={{ borderTop: "0.5px solid #F1F4F9" }}>
                          <td style={cell}>
                            <div style={{ fontWeight: 600, color: navy }}><Highlight text={r.companyName ?? r.founderName ?? "Unknown"} query={query} /></div>
                            <div style={{ fontSize: 11, color: "#6B7690" }}>
                              <Highlight text={r.companyName ? r.founderName ?? r.founderEmail ?? "" : r.founderEmail ?? ""} query={query} />
                            </div>
                          </td>
                          <td style={{ ...cell, fontFamily: "var(--font-mono, monospace)" }}>
                            <Highlight text={r.invoice_number} query={query} />
                            {r.is_renewal ? <div style={{ fontSize: 10.5, color: "#6B7690", fontFamily: "inherit" }}>Renewal</div> : null}
                          </td>
                          <td style={cell}><Highlight text={WIRE_CYCLE_LABEL[r.billing_cycle]} query={query} /></td>
                          <td style={cell}><Highlight text={wireMoney(r.amount_cents)} query={query} /></td>
                          <td style={cell}><Highlight text={wireDatePT(r.issued_at)} query={query} /></td>
                          <td style={cell}>
                            <Highlight text={wireDatePT(r.due_at)} query={query} />
                            {r.daysOverdue > 0 ? <div style={{ fontSize: 10.5, color: "#A32D2D" }}>{r.daysOverdue} day{r.daysOverdue === 1 ? "" : "s"} overdue</div> : null}
                          </td>
                          <td style={cell}>
                            <Pill status={r.status} />
                            {r.status === "received" && r.received_at ? <div style={{ fontSize: 10.5, color: "#6B7690", marginTop: 2 }}>{wireDatePT(r.received_at)}</div> : null}
                            {open && r.reminder_sent_at ? <div style={{ fontSize: 10.5, color: "#6B7690", marginTop: 2 }}>Reminded {wireDatePT(r.reminder_sent_at)}</div> : null}
                          </td>
                          <td style={{ ...cell, textAlign: "right" }}>
                            <span style={{ display: "inline-flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                              <a href={`/api/billing/wire-invoice/${r.id}/pdf`} target="_blank" rel="noopener noreferrer" style={{ ...btn, textDecoration: "none" }}>PDF</a>
                              {open ? (
                                <>
                                  <button type="button" style={btn} disabled={busy !== null} onClick={() => setConfirm({ row: r, action: "void" })}>Void</button>
                                  <button type="button" style={btn} disabled={busy !== null} onClick={() => void run(r, "reminder")}>
                                    {busy === `${r.id}:reminder` ? "Sending…" : "Send reminder"}
                                  </button>
                                  <button type="button" style={{ ...btn, background: blue, color: "#fff", border: "none", fontWeight: 600 }} disabled={busy !== null} onClick={() => setConfirm({ row: r, action: "received" })}>
                                    Mark wire received
                                  </button>
                                </>
                              ) : null}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </GroupRows>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {confirm ? (
        <Dialog title={confirm.action === "received" ? "Mark wire received?" : "Void this invoice?"} onClose={() => busy === null && setConfirm(null)}>
          <p style={{ fontSize: 13, color: "#3A4A63", lineHeight: 1.55, margin: 0 }}>
            {confirm.action === "received"
              ? `Confirm that ${wireMoney(confirm.row.amount_cents)} for ${confirm.row.invoice_number} arrived in the bank account. This activates Premium for ${confirm.row.companyName ?? confirm.row.founderName ?? "the founder"} and emails them a receipt.`
              : `${confirm.row.invoice_number} will no longer be payable. The founder can request a new invoice.`}
          </p>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 18 }}>
            <button type="button" style={{ ...btn, fontSize: 13, padding: "8px 14px" }} disabled={busy !== null} onClick={() => setConfirm(null)}>Cancel</button>
            <button
              type="button"
              style={{ ...btn, fontSize: 13, padding: "8px 14px", border: "none", fontWeight: 600, color: "#fff", background: confirm.action === "received" ? blue : "#A32D2D" }}
              disabled={busy !== null}
              onClick={() => void run(confirm.row, confirm.action)}
            >
              {busy ? "Working…" : confirm.action === "received" ? "Mark wire received" : "Void invoice"}
            </button>
          </div>
        </Dialog>
      ) : null}

      {editing ? (
        <InstructionsDialog
          value={instr}
          onClose={() => setEditing(false)}
          onSaved={(next) => {
            setInstr(next);
            setEditing(false);
            setMessage({ tone: "good", text: "Wire instructions saved. New invoices, emails and PDFs use them." });
          }}
        />
      ) : null}
    </div>
  );
}

function GroupRows({ label, count, children }: Readonly<{ label: string; count: number; children: React.ReactNode }>) {
  return (
    <>
      {label ? (
        <tr style={{ background: "#F6F8FB" }}>
          <td colSpan={8} style={{ padding: "7px 12px", fontSize: 11.5, fontWeight: 600, color: navy }}>
            {label} <span style={{ fontWeight: 400, color: "#6B7690" }}>· {count}</span>
          </td>
        </tr>
      ) : null}
      {children}
    </>
  );
}

function Dialog({ title, onClose, children }: Readonly<{ title: string; onClose: () => void; children: React.ReactNode }>) {
  return (
    <div role="dialog" aria-modal="true" aria-label={title} onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(12,35,64,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 480, maxWidth: "100%", background: "#fff", borderRadius: 14, padding: "18px 20px", boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: navy, marginBottom: 10 }}>{title}</div>
        {children}
      </div>
    </div>
  );
}

function InstructionsDialog({ value, onClose, onSaved }: Readonly<{ value: WireInstructions; onClose: () => void; onSaved: (v: WireInstructions) => void }>) {
  const [form, setForm] = useState<WireInstructions>({ ...EMPTY_WIRE_INSTRUCTIONS, ...value });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/billing/wire/instructions", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; instructions?: WireInstructions; error?: string } | null;
      if (!res.ok || !data?.instructions) {
        setError(data?.error ?? "Save failed.");
        return;
      }
      onSaved(data.instructions);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const input: React.CSSProperties = { width: "100%", fontSize: 13, padding: "8px 10px", borderRadius: 8, border: "1px solid #E4E8F0", boxSizing: "border-box" };
  return (
    <Dialog title="Wire instructions" onClose={() => !saving && onClose()}>
      <p style={{ fontSize: 12, color: "#6B7690", margin: "0 0 12px" }}>Printed on every Premium invoice, email and PDF. Founders see these only on their own invoices.</p>
      <div style={{ display: "grid", gap: 10 }}>
        {WIRE_INSTRUCTION_FIELDS.map((f) => (
          <label key={f.key} style={{ fontSize: 11.5, color: "#6B7690", display: "block" }}>
            {f.label}
            {f.key === "notes" || f.key === "bank_address" ? (
              <textarea rows={2} value={form[f.key]} onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))} style={{ ...input, marginTop: 4, resize: "vertical" }} />
            ) : (
              <input value={form[f.key]} onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))} style={{ ...input, marginTop: 4 }} autoComplete="off" />
            )}
          </label>
        ))}
      </div>
      {error ? <p role="alert" style={{ fontSize: 12, color: "#A32D2D", marginTop: 10 }}>{error}</p> : null}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
        <button type="button" onClick={onClose} disabled={saving} style={{ fontSize: 13, padding: "8px 14px", borderRadius: 8, border: "0.5px solid #E4E8F0", background: "#fff", color: navy, cursor: "pointer" }}>Cancel</button>
        <button type="button" onClick={() => void save()} disabled={saving} style={{ fontSize: 13, padding: "8px 14px", borderRadius: 8, border: "none", background: blue, color: "#fff", fontWeight: 600, cursor: "pointer" }}>{saving ? "Saving…" : "Save"}</button>
      </div>
    </Dialog>
  );
}
