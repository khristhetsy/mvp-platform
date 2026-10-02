"use client";

// Step 4: sent documents for one prospect, with open tracking, status and the
// row menu (open, download, resend, reminder, cancel, archive, delete).

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { ContractStatus } from "@/lib/contracts/types";
import { api, fmtDate, fmtDateTime, MUTED, NAVY, Notice, StatusPill } from "./ui";

type Row = {
  id: string;
  version: number;
  status: ContractStatus;
  sent_at: string | null;
  archived_at: string | null;
  created_by: string;
  mine: boolean;
  template: { name: string } | null;
  entity: { short_name: string } | null;
  request: { open_count: number; last_opened_at: string | null } | null;
};
type Event = { kind: string; actor: string | null; created_at: string };

const EVENT_LABEL: Record<string, string> = {
  sent: "Sent",
  delivered: "Delivered",
  not_delivered: "Email not delivered",
  opened: "Opened",
  reminded: "Reminder sent",
  resent: "Resent",
  signed: "Signed by prospect",
  countersigned: "Countersigned",
  executed_copy_sent: "Executed copy sent",
  executed_copy_not_sent: "Executed copy not emailed",
  declined: "Declined",
  changes_requested: "Changes requested",
  cancelled: "Cancelled",
  expired: "Expired",
  archived: "Archived",
  restored: "Restored",
};

export function TrackingTable({ contactId, refreshKey, isAdmin }: { contactId: string; refreshKey: number; isAdmin: boolean }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [menu, setMenu] = useState<{ id: string; top: number; right: number } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [eventsState, setEvents] = useState<{ id: string; list: Event[] } | null>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [archived, setArchived] = useState(false);

  const [reloadKey, setReloadKey] = useState(0);
  const load = useCallback(() => setReloadKey((k) => k + 1), []);
  useEffect(() => {
    let alive = true;
    void api<{ documents: Row[] }>(`/api/admin/sales/contracts?contactId=${contactId}${archived ? "&archived=1" : ""}`).then((r) => {
      if (!alive) return;
      setLoading(false);
      const list = (r.data.documents ?? []).filter((d) => d.sent_at || d.status !== "draft");
      setRows(list);
      setSelected((cur) => cur ?? list[0]?.id ?? null);
    });
    return () => {
      alive = false;
    };
  }, [contactId, archived, refreshKey, reloadKey]);

  useEffect(() => {
    if (!selected) return;
    let alive = true;
    void api<{ events: Event[] }>(`/api/admin/sales/contracts/${selected}`).then((r) => alive && setEvents({ id: selected, list: r.data.events ?? [] }));
    return () => {
      alive = false;
    };
  }, [selected, refreshKey, reloadKey]);

  async function act(id: string, action: string) {
    setMenu(null);
    if (action === "delete" && !window.confirm("Delete this document? This is logged and cannot be undone.")) return;
    if (action === "cancel" && !window.confirm("Withdraw this signature request? The prospect's link stops working.")) return;
    const r = await api<{ delivered?: boolean }>(`/api/admin/sales/contracts/${id}/action`, { method: "POST", body: JSON.stringify({ action }) });
    if (!r.ok) setMsg({ tone: "error", text: r.data.error ?? "Action failed." });
    else if ((action === "remind" || action === "resend") && r.data.delivered === false) setMsg({ tone: "error", text: "Recorded, but the email was not delivered. Check the email settings." });
    else setMsg({ tone: "ok", text: { remind: "Reminder sent.", resend: "Resent.", cancel: "Signature request cancelled.", archive: "Archived.", restore: "Restored.", delete: "Deleted." }[action] ?? "Done." });
    void load();
  }

  const sel = rows.find((r) => r.id === selected);
  const events = eventsState && eventsState.id === selected ? eventsState.list : [];
  const grid = "minmax(200px,2fr) minmax(130px,1.3fr) 54px 70px minmax(110px,1fr) 150px 34px";
  return (
    <div style={{ background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 12, overflow: "visible" }}>
      <div style={{ overflowX: "auto" }}>
        <div style={{ minWidth: 760 }}>
          <div style={{ display: "grid", gridTemplateColumns: grid, padding: "9px 16px", background: "#f6f8fc", fontSize: 10.5, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "#8a93a6", borderRadius: "12px 12px 0 0" }}>
            <span>Document</span><span>Entity</span><span>Ver.</span><span>Sent</span><span>Opened</span><span>Status</span><span />
          </div>
          {loading ? <p style={{ padding: 16, fontSize: 12.5, color: MUTED }}>Loading…</p> : null}
          {!loading && rows.length === 0 ? <p style={{ padding: 16, fontSize: 12.5, color: MUTED }}>Nothing sent to this contact yet.</p> : null}
          {rows.map((r) => (
            <div key={r.id} onClick={() => setSelected(r.id)} style={{ display: "grid", gridTemplateColumns: grid, alignItems: "center", padding: "11px 16px", borderTop: "0.5px solid #f2f5fa", fontSize: 12.5, color: NAVY, background: r.id === selected ? "#f6f9ff" : undefined, cursor: "pointer", position: "relative" }}>
              <span style={{ fontWeight: 600 }}>{r.template?.name}</span>
              <span style={{ color: MUTED, fontSize: 12 }}>{r.entity?.short_name ?? "—"}</span>
              <span style={{ color: MUTED }}>v{r.version}</span>
              <span style={{ color: MUTED }}>{fmtDate(r.sent_at)}</span>
              <span style={{ color: r.request?.open_count ? "#1a7f43" : MUTED, fontSize: 12 }}>{`${r.request?.open_count ?? 0}×${r.request?.last_opened_at ? ` · ${fmtDate(r.request.last_opened_at)}` : ""}`}</span>
              <span><StatusPill status={r.status} archived={Boolean(r.archived_at)} /></span>
              <span style={{ textAlign: "right" }}>
                <button type="button" aria-label="Actions" onClick={(e) => {
                  e.stopPropagation();
                  const rect = e.currentTarget.getBoundingClientRect();
                  setMenu(menu?.id === r.id ? null : { id: r.id, top: rect.bottom + 4, right: window.innerWidth - rect.right });
                }} style={{ border: "none", background: "none", cursor: "pointer", color: MUTED, fontSize: 16 }}>⋮</button>
              </span>
              {menu?.id === r.id ? <RowMenu r={r} isAdmin={isAdmin} at={menu} onAct={(a) => void act(r.id, a)} onClose={() => setMenu(null)} /> : null}
            </div>
          ))}
        </div>
      </div>
      <div style={{ padding: "10px 16px 14px" }}>
        {msg ? <div style={{ marginBottom: 8 }}><Notice tone={msg.tone}>{msg.text}</Notice></div> : null}
        {sel ? (
          <div style={{ padding: "10px 13px", background: "#f6f8fc", borderRadius: 8, fontSize: 12.5, color: "#3a4a63", lineHeight: 1.7 }}>
            <b>Activity, {sel.template?.name}:</b>{" "}
            {events.length ? events.map((e) => `${EVENT_LABEL[e.kind] ?? e.kind} ${fmtDateTime(e.created_at)}`).join(" · ") : "No activity yet."}
          </div>
        ) : null}
        <label style={{ display: "inline-flex", gap: 6, alignItems: "center", marginTop: 8, fontSize: 12, color: MUTED }}>
          <input type="checkbox" checked={archived} onChange={(e) => setArchived(e.target.checked)} /> Show archived
        </label>
      </div>
    </div>
  );
}

function RowMenu({ r, isAdmin, at, onAct, onClose }: { r: Row; isAdmin: boolean; at: { top: number; right: number }; onAct: (a: string) => void; onClose: () => void }) {
  const pending = r.status === "sent" || r.status === "viewed";
  const canManage = isAdmin || r.mine;
  const item = (label: string, onClick: () => void, opts: { danger?: boolean; sep?: boolean } = {}) => (
    <button type="button" onClick={(e) => { e.stopPropagation(); onClick(); }} style={{ display: "block", width: "100%", textAlign: "left", padding: "9px 14px", border: "none", borderTop: opts.sep ? "0.5px solid #f2f5fa" : "none", background: "#fff", fontSize: 12.5, color: opts.danger ? "#A32D2D" : NAVY, cursor: "pointer" }}>{label}</button>
  );
  return (
    <>
      <div onClick={(e) => { e.stopPropagation(); onClose(); }} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
      <div onClick={(e) => e.stopPropagation()} style={{ position: "fixed", right: at.right, top: at.top, zIndex: 41, width: 220, background: "#fff", border: "0.5px solid #d5deea", borderRadius: 9, boxShadow: "0 6px 18px rgba(12,35,64,.14)", overflow: "hidden" }}>
        <Link href={`/admin/sales/contracts/${r.id}`} style={{ display: "block", padding: "9px 14px", fontSize: 12.5, color: NAVY, textDecoration: "none" }}>Open to view</Link>
        <a href={`/api/admin/sales/contracts/${r.id}/pdf?kind=${r.status === "signed" ? "executed" : "sent"}&download=1`} style={{ display: "block", padding: "9px 14px", fontSize: 12.5, color: NAVY, textDecoration: "none" }}>Download PDF</a>
        {pending ? item("Resend", () => onAct("resend"), { sep: true }) : null}
        {pending ? item("Send reminder", () => onAct("remind")) : null}
        {pending && canManage ? item("Cancel signature request", () => onAct("cancel"), { sep: true }) : null}
        {!pending && canManage && !r.archived_at ? item("Archive", () => onAct("archive"), { sep: true }) : null}
        {r.archived_at && canManage ? item("Restore", () => onAct("restore"), { sep: true }) : null}
        {isAdmin ? item("Delete", () => onAct("delete"), { danger: true, sep: true }) : null}
      </div>
    </>
  );
}
