"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SignaturePad } from "@/components/signatures/SignaturePad";
import { CONTRACT_TYPE_LABEL, type ContractStatus, type ContractType } from "@/lib/contracts/types";
import { ContractEditor, loadEditorData, type EditorData } from "./ContractEditor";
import { RecipientPicker } from "./RecipientPicker";
import { api, BLUE, btn, Card, fmtDateTime, MUTED, NAVY, Notice, SectionLabel, StatusPill } from "./ui";

type Detail = EditorData & {
  doc: EditorData["doc"] & { status: ContractStatus; sent_at: string | null; expires_at: string | null; archived_at: string | null; has_pdf: boolean; has_executed: boolean; has_certificate: boolean; created_by: string; source?: "template" | "upload"; signature_request_id?: string | null; countersign_count?: number; page_count?: number | null; contract_type?: ContractType | null; has_recipient?: boolean };
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
  saved_to_drive: "Saved to Google Drive",
  drive_save_failed: "Google Drive save failed",
  uploaded: "Uploaded",
  recipient_chosen: "Recipient chosen",
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
  const [choosing, setChoosing] = useState(false);
  const [drive, setDrive] = useState<{ configured: boolean; connected: boolean; canSave: boolean; email: string | null; root: string } | null>(null);
  const [toDrive, setToDrive] = useState(true);
  const [driveLink, setDriveLink] = useState<string | null>(null);

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
    const saveToDrive = Boolean(drive?.canSave && toDrive);
    const r = await api<{ drive?: { saved: boolean; folderUrl?: string; error?: string } | null }>(`/api/admin/sales/contracts/${id}/countersign`, { method: "POST", body: JSON.stringify({ signature: sig, name, title, saveToDrive }) });
    setBusy(false);
    if (!r.ok) return setMsg({ tone: "error", text: r.data.error ?? "Countersign failed." });
    setSigning(false);
    setSig(null);
    const dr = r.data.drive;
    setDriveLink(dr?.saved && dr.folderUrl ? dr.folderUrl : null);
    if (dr && !dr.saved) setMsg({ tone: "warn", text: `Countersigned. The executed copy and the signature certificate were sent to the prospect. Saving to Google Drive failed: ${dr.error ?? "unknown error"}.` });
    else setMsg({ tone: "ok", text: dr?.saved ? "Countersigned. The executed copy and the signature certificate were sent to the prospect and saved to Google Drive." : "Countersigned. The executed copy and the signature certificate were sent to the prospect." });
    void load();
  }

  useEffect(() => {
    if (!signing || drive) return;
    let alive = true;
    void api<{ configured: boolean; connected: boolean; canSave: boolean; email: string | null; root: string }>("/api/admin/sales/contracts/drive").then((r) => {
      if (alive && r.ok) setDrive(r.data);
    });
    return () => {
      alive = false;
    };
  }, [signing, drive]);

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
        {d.doc.has_recipient === false ? (
          <span>Recipient not chosen</span>
        ) : (
          <>
            <Link href={`/admin/sales/contacts/${d.contact.id}`} style={{ color: NAVY, textDecoration: "none" }}>{d.contact.name}</Link>
            {d.contact.company ? <span>· {d.contact.company}</span> : null}
          </>
        )}
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

      {msg ? (
        <div style={{ marginBottom: 10 }}>
          <Notice tone={msg.tone}>
            {msg.text}
            {driveLink ? <> <a href={driveLink} target="_blank" rel="noreferrer" style={{ color: "inherit", textDecoration: "underline" }}>Open in Drive</a></> : null}
          </Notice>
        </div>
      ) : null}

      {!d.doc.locked ? (
        <>
          <Card style={{ overflow: "hidden" }}>
            {d.doc.source === "upload" ? (
              <UploadedDraft d={d} />
            ) : (
              <ContractEditor data={d} onSaved={() => undefined} />
            )}
          </Card>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
            {d.can.delete ? <button type="button" disabled={busy} onClick={() => void act("delete", "Delete this draft? This is logged.")} style={btn(false, true)}>Delete draft</button> : null}
            {d.doc.has_recipient === false ? (
              <button type="button" disabled={(d.doc.countersign_count ?? 0) === 0} title={(d.doc.countersign_count ?? 0) === 0 ? "Place the signature boxes first" : undefined} onClick={() => setChoosing(true)} style={{ ...btn(true), opacity: (d.doc.countersign_count ?? 0) === 0 ? 0.5 : 1 }}>Next: choose recipient</button>
            ) : (
              <Link href={`/admin/sales/contracts/send?contact=${d.contact.id}`} style={btn(true)}>Continue to send</Link>
            )}
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
                  <span style={{ color: NAVY }}>
                    {EVENT_LABEL[e.kind] ?? e.kind}
                    {e.kind === "saved_to_drive" && typeof e.detail?.path === "string" ? (
                      <span style={{ color: MUTED }}>
                        {" · "}
                        {typeof e.detail?.url === "string" ? <a href={e.detail.url} target="_blank" rel="noreferrer" style={{ color: BLUE }}>{e.detail.path}</a> : e.detail.path}
                      </span>
                    ) : null}
                    {e.actor && e.actor !== "system" ? <span style={{ color: MUTED }}> · {e.actor}</span> : null}
                  </span>
                  <span style={{ color: MUTED, whiteSpace: "nowrap" }}>{fmtDateTime(e.created_at)}</span>
                </div>
              ))}
            </Card>
          </div>
        </div>
      )}

      {choosing ? <RecipientPicker docId={id} onClose={() => setChoosing(false)} /> : null}
      {signing && !sig ? <SignaturePad signerName={name} onCancel={() => setSigning(false)} onApply={(url) => setSig(url)} /> : null}
      {signing && sig ? (
        <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, background: "rgba(10,26,64,.35)", display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "8vh", zIndex: 80, overflowY: "auto" }}>
          <div style={{ width: "min(540px, calc(100vw - 32px))", background: "#fff", borderRadius: 12, padding: 18 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: NAVY }}>Countersign {d.template.name}</div>
            <p style={{ fontSize: 12.5, color: MUTED, margin: "4px 0 12px", lineHeight: 1.6 }}>Your signature goes on every iCFO signature block in the document. The executed copy and the signature certificate are then emailed to {d.packet?.recipient_email ?? "the prospect"}{drive?.canSave && toDrive ? " and saved to your Google Drive" : ""}.</p>
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
            <div style={{ marginTop: 12, border: "1.5px solid #B5D4F4", background: "#f6f9ff", borderRadius: 10, padding: "10px 12px", fontSize: 12.5 }}>
              {!drive ? (
                <span style={{ color: MUTED }}>Checking Google Drive…</span>
              ) : drive.canSave ? (
                <>
                  <label style={{ display: "flex", gap: 9, alignItems: "flex-start", fontWeight: 600, color: NAVY, cursor: "pointer" }}>
                    <input type="checkbox" checked={toDrive} onChange={(e) => setToDrive(e.target.checked)} style={{ marginTop: 2 }} />
                    Save executed copy to Google Drive
                  </label>
                  <div style={{ margin: "6px 0 0 24px", color: "#185FA5", lineHeight: 1.6 }}>
                    My Drive › {drive.root} › {d.contact.company ?? d.contact.name}
                    <div style={{ color: MUTED }}>{drive.email}</div>
                  </div>
                </>
              ) : drive.configured ? (
                <span style={{ color: "#3a4a63", lineHeight: 1.6 }}>
                  <b>Save to Google Drive:</b> {drive.connected ? "your Google connection doesn't include Drive yet." : "Google isn't connected."}{" "}
                  <a href={`/api/integrations/google/connect?drive=1&returnTo=${encodeURIComponent(`/admin/sales/contracts/${id}`)}`} style={{ color: BLUE }}>{drive.connected ? "Add Drive access" : "Connect Google Drive"}</a>
                  <span style={{ display: "block", color: MUTED }}>iCapOS only sees the files it saves there. You can countersign without it.</span>
                </span>
              ) : (
                <span style={{ color: MUTED }}>Google isn&apos;t set up for this workspace, so Drive saving is off.</span>
              )}
            </div>
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

/** An uploaded contract before send: the PDF as uploaded, and its signature boxes. */
function UploadedDraft({ d }: { d: Detail }) {
  const place = d.doc.signature_request_id ? `/admin/signatures/${d.doc.signature_request_id}?contract=${d.doc.id}` : null;
  const ready = (d.doc.countersign_count ?? 0) > 0;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: "0.5px solid #eef1f5", flexWrap: "wrap" }}>
        <span style={{ fontSize: 9.5, fontWeight: 700, background: "#FCEBEB", color: "#A32D2D", borderRadius: 4, padding: "1px 5px" }}>PDF</span>
        <span style={{ fontSize: 12.5, color: MUTED }}>{d.doc.contract_type ? `${CONTRACT_TYPE_LABEL[d.doc.contract_type]} · ` : ""}Uploaded contract{d.doc.page_count ? ` · ${d.doc.page_count} pages` : ""} · sent exactly as uploaded</span>
        <span style={{ flex: 1 }} />
        {place ? <Link href={place} style={btn(!ready)}>{ready ? "Edit signature boxes" : "Place signature boxes"}</Link> : null}
      </div>
      {!ready ? <div style={{ padding: "10px 16px 0" }}><Notice tone="warn">Place the prospect&apos;s signature box and your countersignature box before sending.</Notice></div> : null}
      <iframe title="Contract PDF" src={`/api/admin/sales/contracts/${d.doc.id}/pdf?kind=preview`} style={{ width: "100%", height: "70vh", border: "none", display: "block" }} />
    </div>
  );
}
