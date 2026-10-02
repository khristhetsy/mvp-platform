"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SignaturePad } from "@/components/signatures/SignaturePad";
import type { ContractStatus } from "@/lib/contracts/types";
import { ContractEditor, loadEditorData, type EditorData } from "./ContractEditor";
import { api, BLUE, btn, Card, fmtDateTime, MUTED, NAVY, Notice, SectionLabel, StatusPill } from "./ui";

type Detail = EditorData & {
  doc: EditorData["doc"] & { status: ContractStatus; sent_at: string | null; expires_at: string | null; archived_at: string | null; has_pdf: boolean; has_executed: boolean; has_certificate: boolean; created_by: string };
  contact: { id: string; name: string; email: string | null; company: string | null };
  events: { kind: string; actor: string | null; detail: Record<string, unknown> | null; created_at: string }[];
  versions: { id: string; version: number; status: ContractStatus; sent_at: string | null }[];
  request: { open_count: number; last_opened_at: string | null; response_note: string | null } | null;
  packet: { recipient_email: string; sent_at: string; delivered: boolean } | null;
  can: { cancelOrArchive: boolean; delete: boolean };
};

const EVENT_LABEL: Record<string, string> = {
  sent: "Sent",
  delivered: "Email delivered",
  not_delivered: "Email not delivered",
  opened: "Opened by prospect",
  reminded: "Reminder sent",
  resent: "Resent",
  signed: "Signed by prospect",
  countersigned: "Countersigned",
  executed_copy_sent: "Executed copy and certificate emailed",
  executed_copy_not_sent: "Executed copy not emailed",
  declined: "Declined by prospect",
  changes_requested: "Changes requested by prospect",
  cancelled: "Signature request cancelled",
  expired: "Signing link expired",
  archived: "Archived",
  restored: "Restored",
};

export function ContractDocumentClient({ id, defaultSignerName }: { id: string; defaultSignerName: string }) {
  const router = useRouter();
  const [d, setD] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "error" | "warn"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [signing, setSigning] = useState(false);
  const [sig, setSig] = useState<string | null>(null);
  const [name, setName] = useState(defaultSignerName);
  const [title, setTitle] = useState("Managing Member");

  const [reloadKey, setReloadKey] = useState(0);
  const load = useCallback(() => setReloadKey((k) => k + 1), []);
  useEffect(() => {
    let alive = true;
    void loadEditorData(id).then((r) => {
      if (!alive) return;
      if (r.data) setD(r.data as unknown as Detail);
      else setError(r.error ?? "Could not load.");
    });
    return () => {
      alive = false;
    };
  }, [id, reloadKey]);

  async function act(action: string, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    const r = await api<{ delivered?: boolean; deleted?: boolean }>(`/api/admin/sales/contracts/${id}/action`, { method: "POST", body: JSON.stringify({ action }) });
    setBusy(false);
    if (!r.ok) return setMsg({ tone: "error", text: r.data.error ?? "Action failed." });
    if (r.data.deleted) return router.push("/admin/sales/contracts");
    setMsg(r.data.delivered === false ? { tone: "warn", text: "Recorded, but the email was not delivered." } : { tone: "ok", text: "Done." });
    void load();
  }

  async function newVersion() {
    setBusy(true);
    const r = await api<{ id: string }>(`/api/admin/sales/contracts/${id}/new-version`, { method: "POST" });
    setBusy(false);
    if (!r.ok) return setMsg({ tone: "error", text: r.data.error ?? "Could not create a new version." });
    router.push(`/admin/sales/contracts/${r.data.id}`);
  }

  async function countersign() {
    if (!sig) return;
    setBusy(true);
    const r = await api(`/api/admin/sales/contracts/${id}/countersign`, { method: "POST", body: JSON.stringify({ signature: sig, name, title }) });
    setBusy(false);
    if (!r.ok) return setMsg({ tone: "error", text: r.data.error ?? "Countersign failed." });
    setSigning(false);
    setSig(null);
    setMsg({ tone: "ok", text: "Countersigned. The executed copy and the signature certificate were sent to the prospect." });
    void load();
  }

  if (error) return <Notice tone="error">{error}</Notice>;
  if (!d) return <p style={{ fontSize: 12.5, color: MUTED }}>Loading…</p>;

  const s = d.doc.status;
  const pending = s === "sent" || s === "viewed";
  const canRevise = ["changes_requested", "declined", "cancelled", "expired"].includes(s);
  const base = `/api/admin/sales/contracts/${id}`;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, fontSize: 12, color: MUTED, flexWrap: "wrap" }}>
        <Link href="/admin/sales/contracts" style={{ color: MUTED, textDecoration: "none" }}>← Contracts</Link>
        <span>/</span>
        <Link href={`/admin/sales/contacts/${d.contact.id}`} style={{ color: NAVY, textDecoration: "none" }}>{d.contact.name}</Link>
        {d.contact.company ? <span>· {d.contact.company}</span> : null}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, color: NAVY, margin: 0 }}>{d.template.name}</h1>
        <StatusPill status={s} archived={Boolean(d.doc.archived_at)} />
        {d.versions.length > 1 ? (
          <select value={id} onChange={(e) => router.push(`/admin/sales/contracts/${e.target.value}`)} style={{ fontSize: 12, border: "0.5px solid #cbd5e1", borderRadius: 6, padding: "3px 6px" }} aria-label="Version">
            {d.versions.map((v) => (
              <option key={v.id} value={v.id}>v{v.version} · {v.status.replace(/_/g, " ")}</option>
            ))}
          </select>
        ) : (
          <span style={{ fontSize: 12, color: MUTED }}>v{d.doc.version}</span>
        )}
      </div>

      {msg ? <div style={{ marginBottom: 10 }}><Notice tone={msg.tone}>{msg.text}</Notice></div> : null}

      {!d.doc.locked ? (
        <>
          <Card style={{ overflow: "hidden" }}>
            <ContractEditor data={d} onSaved={() => undefined} />
          </Card>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
            {d.can.delete ? <button type="button" disabled={busy} onClick={() => void act("delete", "Delete this draft? This is logged.")} style={btn(false, true)}>Delete draft</button> : null}
            <Link href={`/admin/sales/contracts/send?contact=${d.contact.id}`} style={btn(true)}>Continue to send</Link>
          </div>
        </>
      ) : (
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div style={{ flex: "1.4 1 460px", minWidth: 0 }}>
            <Card style={{ overflow: "hidden" }}>
              <iframe title="Sent document" src={`${base}/pdf?kind=${d.doc.has_executed ? "executed" : "sent"}`} style={{ width: "100%", height: "72vh", border: "none", display: "block" }} />
            </Card>
          </div>
          <div style={{ flex: "1 1 300px", minWidth: 0 }}>
            <Card style={{ padding: "14px 16px" }}>
              <Row k="Sent to" v={d.packet?.recipient_email ?? "—"} />
              <Row k="Sent" v={fmtDateTime(d.doc.sent_at)} />
              <Row k="Opened" v={`${d.request?.open_count ?? 0}×${d.request?.last_opened_at ? ` · last ${fmtDateTime(d.request.last_opened_at)}` : ""}`} />
              {d.doc.expires_at ? <Row k="Link expires" v={fmtDateTime(d.doc.expires_at)} /> : null}
              {d.request?.response_note ? <Row k="Prospect note" v={`“${d.request.response_note}”`} /> : null}

              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
                {s === "awaiting_countersign" ? <button type="button" onClick={() => setSigning(true)} style={btn(true)}>Countersign</button> : null}
                {pending ? <button type="button" disabled={busy} onClick={() => void act("remind")} style={btn()}>Send reminder</button> : null}
                {pending ? <button type="button" disabled={busy} onClick={() => void act("resend")} style={btn()}>Resend</button> : null}
                {pending && d.can.cancelOrArchive ? <button type="button" disabled={busy} onClick={() => void act("cancel", "Withdraw this signature request? The prospect's link stops working.")} style={btn(false, true)}>Cancel request</button> : null}
                {canRevise ? <button type="button" disabled={busy} onClick={() => void newVersion()} style={btn(true)}>Edit into new version</button> : null}
                {!pending && d.can.cancelOrArchive && !d.doc.archived_at ? <button type="button" disabled={busy} onClick={() => void act("archive")} style={btn()}>Archive</button> : null}
                {d.doc.archived_at && d.can.cancelOrArchive ? <button type="button" disabled={busy} onClick={() => void act("restore")} style={btn()}>Restore</button> : null}
                {d.can.delete ? <button type="button" disabled={busy} onClick={() => void act("delete", "Delete this document? This is logged and cannot be undone.")} style={btn(false, true)}>Delete</button> : null}
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12, fontSize: 12.5 }}>
                {d.doc.has_pdf ? <a href={`${base}/pdf?kind=sent&download=1`} style={{ color: BLUE }}>Sent PDF</a> : null}
                <a href={`${base}/docx`} style={{ color: BLUE }}>Sent Word file</a>
                {d.doc.has_executed ? <a href={`${base}/pdf?kind=executed&download=1`} style={{ color: BLUE }}>Executed copy</a> : null}
                {d.doc.has_certificate ? <a href={`${base}/pdf?kind=certificate&download=1`} style={{ color: BLUE }}>Signature certificate</a> : null}
              </div>
            </Card>

            <SectionLabel>Activity</SectionLabel>
            <Card style={{ padding: "6px 16px" }}>
              {d.events.length === 0 ? <p style={{ fontSize: 12.5, color: MUTED }}>No activity yet.</p> : null}
              {d.events.map((e, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "8px 0", borderTop: i ? "0.5px solid #f2f5fa" : "none", fontSize: 12.5 }}>
                  <span style={{ color: NAVY }}>{EVENT_LABEL[e.kind] ?? e.kind}{e.actor && e.actor !== "system" ? <span style={{ color: MUTED }}> · {e.actor}</span> : null}</span>
                  <span style={{ color: MUTED, whiteSpace: "nowrap" }}>{fmtDateTime(e.created_at)}</span>
                </div>
              ))}
            </Card>
          </div>
        </div>
      )}

      {signing && !sig ? <SignaturePad signerName={name} onCancel={() => setSigning(false)} onApply={(url) => setSig(url)} /> : null}
      {signing && sig ? (
        <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, background: "rgba(10,26,64,.35)", display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "8vh", zIndex: 80, overflowY: "auto" }}>
          <div style={{ width: "min(540px, calc(100vw - 32px))", background: "#fff", borderRadius: 12, padding: 18 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: NAVY }}>Countersign {d.template.name}</div>
            <p style={{ fontSize: 12.5, color: MUTED, margin: "4px 0 12px", lineHeight: 1.6 }}>Your signature goes on every iCFO signature block in the document. The executed copy and the signature certificate are then emailed to {d.packet?.recipient_email ?? "the prospect"}.</p>
            <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
              <label style={{ flex: "1 1 200px", fontSize: 12 }}>Name<input value={name} onChange={(e) => setName(e.target.value)} style={inp} /></label>
              <label style={{ flex: "1 1 160px", fontSize: 12 }}>Title<input value={title} onChange={(e) => setTitle(e.target.value)} style={inp} /></label>
            </div>
            {sig ? (
              <div style={{ border: "0.5px solid #d5deea", borderRadius: 8, padding: 10, textAlign: "center" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={sig} alt="Your signature" style={{ maxHeight: 80, maxWidth: "100%" }} />
                <div><button type="button" onClick={() => setSig(null)} style={{ border: "none", background: "none", color: BLUE, cursor: "pointer", fontSize: 12 }}>Redo</button></div>
              </div>
            ) : null}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
              <button type="button" onClick={() => { setSigning(false); setSig(null); }} style={btn()}>Cancel</button>
              <button type="button" disabled={!sig || !name.trim() || busy} onClick={() => void countersign()} style={{ ...btn(true), opacity: !sig || !name.trim() || busy ? 0.5 : 1 }}>{busy ? "Countersigning…" : "Countersign and send executed copy"}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const inp = { display: "block", width: "100%", boxSizing: "border-box", marginTop: 4, border: "0.5px solid #cbd5e1", borderRadius: 7, padding: "7px 9px", fontSize: 13 } as const;

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: "flex", gap: 10, padding: "4px 0", fontSize: 12.5 }}>
      <span style={{ width: 96, flexShrink: 0, color: MUTED }}>{k}</span>
      <span style={{ color: NAVY, minWidth: 0, overflowWrap: "anywhere" }}>{v}</span>
    </div>
  );
}
