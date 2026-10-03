"use client";

// Sales Hub › Send SPV Contracts for one prospect (build spec §4):
// Step 1 choose documents, Step 2 entity and editor, Step 3 cover email,
// Step 4 sent documents and tracking.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { applyEmailTokens, emailTokenValues, EMAIL_TOKENS_BASE } from "@/lib/contracts/email-tokens";
import { openFields } from "@/lib/contracts/fields";
import type { TemplateField } from "@/lib/contracts/types";
import { ContractEditor, loadEditorData, type EditorData, type EditorHandle } from "./ContractEditor";
import { TrackingTable } from "./TrackingTable";
import { api, BLUE, btn, Card, MUTED, NAVY, Notice, RenderNotice, SectionLabel } from "./ui";

type Template = { id: string; key: string; name: string; kind: string; subtype: string | null; version: number; usage: number; versions: number; master_filename: string };
type Contact = { id: string; name: string; email: string | null; company: string | null };
type Draft = { id: string; name: string; description: string | null; subject: string; body: string };
type OpenDoc = { id: string; templateId: string; name: string; kind: string };
type ListRow = { id: string; status: string; template_id: string; locked: boolean };

const TS_ORDER = ["convertible_note", "series_a", "safe"];

function fetchTemplates() {
  return api<{ templates: Template[]; renderConfigured: boolean; renderMessage?: string | null; renderFixHref?: string | null; missingMasters?: number }>("/api/admin/sales/contracts/templates");
}

export function SendFlowClient({ contact, isAdmin, senderName }: { contact: Contact; isAdmin: boolean; senderName: string | null }) {
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [renderConfigured, setRenderConfigured] = useState(true);
  const [renderFix, setRenderFix] = useState<{ message: string | null; href: string | null }>({ message: null, href: null });
  const [missingMasters, setMissingMasters] = useState(0);
  const [termSheet, setTermSheet] = useState<string | null>(null);
  const [extras, setExtras] = useState<Set<string>>(new Set());
  const [docs, setDocs] = useState<OpenDoc[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [editorData, setEditorData] = useState<Record<string, EditorData>>({});
  const [openCounts, setOpenCounts] = useState<Record<string, number>>({});
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ delivered: boolean; url: string } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [history, setHistory] = useState<{ name: string; versions: { version: number; status: string; filename: string; created_at: string; author: string | null }[] } | null>(null);
  const editorRef = useRef<EditorHandle>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const replaceTarget = useRef<string | null>(null);

  const applyTemplates = useCallback((r: Awaited<ReturnType<typeof fetchTemplates>>) => {
    if (!r.ok) return setError(r.data.error ?? "Could not load templates.");
    setTemplates(r.data.templates);
    setRenderConfigured(r.data.renderConfigured);
    setRenderFix({ message: r.data.renderMessage ?? null, href: r.data.renderFixHref ?? null });
    setMissingMasters(r.data.missingMasters ?? 0);
  }, []);
  const loadTemplates = useCallback(async () => applyTemplates(await fetchTemplates()), [applyTemplates]);
  useEffect(() => {
    let alive = true;
    void fetchTemplates().then((r) => alive && applyTemplates(r));
    return () => {
      alive = false;
    };
  }, [applyTemplates]);

  const termSheets = useMemo(() => (templates ?? []).filter((t) => t.kind === "term_sheet").sort((a, b) => TS_ORDER.indexOf(a.subtype ?? "") - TS_ORDER.indexOf(b.subtype ?? "")), [templates]);
  const others = useMemo(() => (templates ?? []).filter((t) => t.kind !== "term_sheet"), [templates]);

  async function install() {
    setBusy(true);
    const r = await api<{ installed: string[] }>("/api/admin/sales/contracts/templates/install", { method: "POST" });
    setBusy(false);
    if (!r.ok) return setError(r.data.error ?? "Install failed.");
    await loadTemplates();
  }

  async function replaceFile(file: File) {
    const id = replaceTarget.current;
    if (!id) return;
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/admin/sales/contracts/templates/${id}/replace`, { method: "POST", body: fd });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(j.error ?? "Replace failed.");
    await loadTemplates();
  }

  async function showHistory(id: string) {
    const r = await api<{ name: string; versions: { version: number; status: string; filename: string; created_at: string; author: string | null }[] }>(`/api/admin/sales/contracts/templates/${id}/history`);
    if (r.ok) setHistory(r.data);
  }

  /** Open editor: reuse this prospect's open drafts, otherwise duplicate the masters. */
  async function openEditor() {
    const chosen = [termSheet, ...extras].filter(Boolean) as string[];
    if (!chosen.length) return setError("Choose at least one document.");
    setBusy(true);
    setError(null);
    const list = await api<{ documents: ListRow[] }>(`/api/admin/sales/contracts?contactId=${contact.id}`);
    const drafts = (list.data.documents ?? []).filter((d) => d.status === "draft" && !d.locked);
    const reuse = new Map(drafts.map((d) => [d.template_id, d.id]));
    const missing = chosen.filter((t) => !reuse.has(t));
    if (missing.length) {
      const r = await api<{ documents: { id: string }[] }>("/api/admin/sales/contracts", { method: "POST", body: JSON.stringify({ contactId: contact.id, templateIds: missing }) });
      if (!r.ok) {
        setBusy(false);
        return setError(r.data.error ?? "Could not create the documents.");
      }
      missing.forEach((t, i) => reuse.set(t, r.data.documents[i].id));
    }
    const opened = chosen.map((t) => {
      const tpl = templates!.find((x) => x.id === t)!;
      return { id: reuse.get(t)!, templateId: t, name: tpl.name, kind: tpl.kind };
    });
    setDocs(opened);
    await Promise.all(opened.map((d) => loadDoc(d.id)));
    setActive(opened[0].id);
    setStep(2);
    setBusy(false);
  }

  async function loadDoc(id: string) {
    const r = await loadEditorData(id);
    if (r.data) {
      setEditorData((m) => ({ ...m, [id]: r.data! }));
      setOpenCounts((m) => ({ ...m, [id]: (r.data!.open as unknown[] | undefined)?.length ?? 0 }));
    } else setError(r.error ?? "Could not load a document.");
  }

  async function switchTab(id: string) {
    await editorRef.current?.flush();
    setActive(id);
  }

  async function toEmail() {
    await editorRef.current?.flush();
    setBusy(true);
    await Promise.all(docs.map((d) => loadDoc(d.id)));
    setBusy(false);
    setStep(3);
  }

  const onOpenChange = useCallback((n: number) => setOpenCounts((m) => (active ? { ...m, [active]: n } : m)), [active]);
  const totalOpen = docs.reduce((a, d) => a + (openCounts[d.id] ?? 0), 0);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, fontSize: 12, color: MUTED, flexWrap: "wrap" }}>
        <Link href="/admin/sales/contracts" style={{ color: MUTED, textDecoration: "none" }}>← Contracts</Link>
        <span>/</span>
        <Link href={`/admin/sales/contacts/${contact.id}`} style={{ color: NAVY, textDecoration: "none" }}>{contact.name}</Link>
        {contact.company ? <span>· {contact.company}</span> : null}
        <span style={{ background: "#e8f0fe", color: BLUE, fontSize: 11, padding: "2px 8px", borderRadius: 10 }}>SPV</span>
      </div>
      <h1 style={{ fontSize: 18, fontWeight: 600, color: NAVY, margin: "0 0 14px" }}>Send SPV contracts</h1>

      {error ? <div style={{ marginBottom: 10 }}><Notice tone="error">{error}</Notice></div> : null}
      {success ? (
        <div style={{ marginBottom: 10 }}>
          <Notice tone={success.delivered ? "ok" : "warn"}>
            {success.delivered ? `Sent to ${contact.email}. Tracking is below.` : <>The documents are ready for signature, but the email was not delivered. Send this link to {contact.email} yourself: <code style={{ userSelect: "all" }}>{success.url}</code></>}
          </Notice>
        </div>
      ) : null}
      {!renderConfigured ? (
        <div style={{ marginBottom: 10 }}>
          <RenderNotice message={renderFix.message} href={renderFix.href} />
        </div>
      ) : null}

      {/* STEP 1 */}
      <SectionLabel>Step 1 · Choose documents</SectionLabel>
      <Card style={{ padding: "16px 18px", opacity: step === 1 ? 1 : 0.92 }}>
        {templates === null ? <p style={{ fontSize: 12.5, color: MUTED }}>Loading…</p> : null}
        {templates && templates.length === 0 ? (
          isAdmin ? (
            <div>
              <p style={{ fontSize: 13, color: NAVY, margin: "0 0 10px" }}>No master templates are installed yet. Install the five masters from your BLANK Word files (three term sheets and two services agreements).</p>
              <button type="button" disabled={busy} onClick={() => void install()} style={btn(true)}>{busy ? "Installing…" : "Install masters"}</button>
            </div>
          ) : (
            <Notice tone="warn">No master templates are installed yet. Ask an admin to install them.</Notice>
          )
        ) : null}
        {templates && templates.length > 0 ? (
          <>
            <div style={sub}>Term sheet type · pick one</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {termSheets.map((t) => {
                const on = termSheet === t.id;
                return (
                  <div key={t.id} role="radio" aria-checked={on} tabIndex={0} onClick={() => setTermSheet(on ? null : t.id)} onKeyDown={(e) => e.key === " " && setTermSheet(on ? null : t.id)} style={{ flex: "1 1 200px", border: on ? `2px solid ${BLUE}` : "1px solid #d5deea", background: on ? "#f6f9ff" : "#fff", borderRadius: 9, padding: on ? "11px 13px" : "12px 14px", cursor: "pointer" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>{on ? "●" : "○"} {t.name.replace("Term Sheet, ", "")}</div>
                    <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>Master v{t.version} · used {t.usage} {t.usage === 1 ? "time" : "times"}</div>
                    <CardActions t={t} isAdmin={isAdmin} onReplace={() => { replaceTarget.current = t.id; fileRef.current?.click(); }} onHistory={() => void showHistory(t.id)} />
                  </div>
                );
              })}
            </div>
            <div style={{ borderTop: "0.5px solid #eef1f5", margin: "16px 0 12px" }} />
            <div style={sub}>Also include</div>
            {others.map((t) => (
              <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: NAVY, lineHeight: 2.1, flexWrap: "wrap" }}>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input type="checkbox" checked={extras.has(t.id)} onChange={(e) => setExtras((s) => { const n = new Set(s); if (e.target.checked) n.add(t.id); else n.delete(t.id); return n; })} />
                  {t.name} <span style={{ color: "#8a93a6", fontSize: 11 }}>v{t.version}</span>
                </label>
                <CardActions t={t} isAdmin={isAdmin} inline onReplace={() => { replaceTarget.current = t.id; fileRef.current?.click(); }} onHistory={() => void showHistory(t.id)} />
              </div>
            ))}
            {isAdmin && missingMasters > 0 ? (
              <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <Notice tone="info">{missingMasters === 1 ? "1 new master is" : `${missingMasters} new masters are`} available to install.</Notice>
                <button type="button" disabled={busy} onClick={() => void install()} style={btn()}>{busy ? "Installing…" : "Install"}</button>
              </div>
            ) : null}
            <div style={{ marginTop: 12, padding: "10px 12px", background: "#f6f8fc", borderRadius: 8, fontSize: 11.5, color: MUTED, lineHeight: 1.6 }}>
              <b>Open editor</b> makes an editable copy of each master for this prospect; the masters never change. {isAdmin ? <><b>Replace file</b> uploads a new Word version of a master for future sends; documents already sent keep their version.</> : null}
            </div>
            <div style={{ textAlign: "right", marginTop: 14 }}>
              <button type="button" disabled={busy || (!termSheet && !extras.size)} onClick={() => void openEditor()} style={{ ...btn(true), opacity: busy || (!termSheet && !extras.size) ? 0.5 : 1 }}>{busy && step === 1 ? "Opening…" : "Open editor"}</button>
            </div>
          </>
        ) : null}
        <input ref={fileRef} type="file" accept=".docx" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void replaceFile(f); }} />
      </Card>

      {/* STEP 2 */}
      {step >= 2 && docs.length ? (
        <>
          <SectionLabel>Step 2 · Entity, then edit content inside the locked layout</SectionLabel>
          <Card style={{ overflow: "hidden" }}>
            <div role="tablist" style={{ display: "flex", background: NAVY, padding: "0 14px", flexWrap: "wrap" }}>
              {docs.map((d) => {
                const on = d.id === active;
                const n = openCounts[d.id] ?? 0;
                return (
                  <button key={d.id} role="tab" aria-selected={on} type="button" onClick={() => void switchTab(d.id)} style={{ padding: "12px 16px", marginTop: 6, border: "none", borderRadius: "8px 8px 0 0", background: on ? "#fff" : "transparent", color: on ? NAVY : "#9fd0ff", fontSize: 13, fontWeight: on ? 700 : 500, cursor: "pointer" }}>
                    {d.name}
                    <span style={{ background: n ? (on ? "#fff4d6" : "#1e3a5f") : on ? "#e6f6ec" : "#1e3a5f", color: n ? (on ? "#8a6500" : "#9fd0ff") : on ? "#1a7f43" : "#9fd0ff", fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 9, marginLeft: 6 }}>{n ? `${n} open` : "ready"}</span>
                  </button>
                );
              })}
            </div>
            {active && editorData[active] ? <ContractEditor key={active} ref={editorRef} data={editorData[active]} onOpenChange={onOpenChange} /> : <p style={{ padding: 16, fontSize: 12.5, color: MUTED }}>Loading…</p>}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "11px 18px", background: totalOpen ? "#fffbe9" : "#e6f6ec", borderTop: "0.5px solid #f0e2b8", flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, color: totalOpen ? "#8a6500" : "#1a7f43" }}>
                {docs.map((d) => `${d.name}: ${openCounts[d.id] ? `${openCounts[d.id]} field${openCounts[d.id] === 1 ? "" : "s"} open` : "ready"}`).join(" · ")}
              </span>
              <button type="button" disabled={busy || totalOpen > 0} onClick={() => void toEmail()} style={{ ...btn(true), background: totalOpen ? "#c9d4e5" : BLUE }}>Next: choose email</button>
            </div>
          </Card>
        </>
      ) : null}

      {/* STEP 3 */}
      {step === 3 ? (
        <EmailStep
          contact={contact}
          senderName={senderName}
          docs={docs}
          editorData={editorData}
          renderConfigured={renderConfigured}
          onBack={() => setStep(2)}
          onSent={(r) => {
            setSuccess(r);
            setDocs([]);
            setEditorData({});
            setTermSheet(null);
            setExtras(new Set());
            setStep(1);
            setRefreshKey((k) => k + 1);
            void loadTemplates();
          }}
        />
      ) : null}

      {/* STEP 4 */}
      <SectionLabel>Step 4 · Sent documents, tracking and actions</SectionLabel>
      <TrackingTable contactId={contact.id} refreshKey={refreshKey} isAdmin={isAdmin} />
      <p style={{ fontSize: 12, color: "#8a93a6", margin: "8px 0 0", lineHeight: 1.6 }}>
        Opens count each visit to the signing page, with the time of the last one. Cancel withdraws a pending request. Archive hides a closed document without deleting it. Delete is admin only and logged.
      </p>

      {history ? (
        <div role="dialog" aria-modal="true" onClick={() => setHistory(null)} style={{ position: "fixed", inset: 0, background: "rgba(10,26,64,.35)", display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "12vh", zIndex: 80 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "min(520px, calc(100vw - 32px))", background: "#fff", borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: NAVY, marginBottom: 10 }}>{history.name} · history</div>
            {history.versions.map((v) => (
              <div key={v.version} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "8px 0", borderTop: "0.5px solid #f2f5fa", fontSize: 12.5 }}>
                <span style={{ color: NAVY }}><b>v{v.version}</b> {v.status === "active" ? "· current" : ""}<span style={{ display: "block", fontSize: 11, color: MUTED }}>{v.filename}</span></span>
                <span style={{ color: MUTED, textAlign: "right" }}>{new Date(v.created_at).toLocaleDateString()}<span style={{ display: "block", fontSize: 11 }}>{v.author ?? ""}</span></span>
              </div>
            ))}
            <div style={{ textAlign: "right", marginTop: 10 }}><button type="button" onClick={() => setHistory(null)} style={btn()}>Close</button></div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const sub = { fontSize: 11, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "#8a93a6", marginBottom: 10 } as const;

function CardActions({ t, isAdmin, inline, onReplace, onHistory }: { t: Template; isAdmin: boolean; inline?: boolean; onReplace: () => void; onHistory: () => void }) {
  const link = { border: "none", background: "none", padding: 0, fontSize: 11, color: BLUE, cursor: "pointer" } as const;
  return (
    <span onClick={(e) => e.stopPropagation()} style={{ display: inline ? "inline-flex" : "flex", gap: 8, marginTop: inline ? 0 : 8, fontSize: 11 }}>
      {isAdmin ? <button type="button" onClick={onReplace} style={link}>Replace file</button> : null}
      {isAdmin ? <span style={{ color: "#c8d0dc" }}>·</span> : null}
      <button type="button" onClick={onHistory} style={link}>History{t.versions > 1 ? ` (${t.versions})` : ""}</button>
    </span>
  );
}

function EmailStep({
  contact,
  senderName,
  docs,
  editorData,
  renderConfigured,
  onBack,
  onSent,
}: {
  contact: Contact;
  senderName: string | null;
  docs: OpenDoc[];
  editorData: Record<string, EditorData>;
  renderConfigured: boolean;
  onBack: () => void;
  onSent: (r: { delivered: boolean; url: string }) => void;
}) {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [attach, setAttach] = useState(true);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    void api<{ drafts: Draft[] }>("/api/admin/sales/contracts/email-drafts").then((r) => {
      const list = r.data.drafts ?? [];
      setDrafts(list);
      if (list[0]) pick(list[0]);
    });
  }, []);

  function pick(d: Draft) {
    setDraftId(d.id);
    setSubject(d.subject);
    setBody(d.body);
  }

  const tokenValues = useMemo(
    () =>
      emailTokenValues({
        contactName: contact.name,
        company: contact.company,
        senderName,
        documents: docs.map((d) => {
          const e = editorData[d.id];
          const entity = e?.entities.find((x) => x.id === e.doc.entity_id) ?? null;
          return { fields: e?.fields ?? [], values: e?.doc.field_values ?? {}, entityName: entity?.legal_name ?? null, title: d.name };
        }),
      }),
    [contact, docs, editorData, senderName],
  );
  const resolvedSubject = applyEmailTokens(subject, tokenValues);
  const resolvedBody = applyEmailTokens(body, tokenValues);
  const missing = [...new Set([...resolvedSubject.missing, ...resolvedBody.missing])].filter((m) => m !== "sender_name");
  const fieldTokens = useMemo(() => [...new Set(docs.flatMap((d) => (editorData[d.id]?.fields ?? []).map((f: TemplateField) => f.token)))], [docs, editorData]);
  const stillOpen = docs.some((d) => {
    const e = editorData[d.id];
    if (!e) return true;
    const entity = e.entities.find((x) => x.id === e.doc.entity_id) ?? null;
    return openFields(e.fields, e.doc.field_values, entity, Boolean(e.template.entity_match)).length > 0;
  });

  async function saveToLibrary() {
    const name = window.prompt("Name for this draft in the library", drafts.find((d) => d.id === draftId)?.name ? `${drafts.find((d) => d.id === draftId)!.name} (edited)` : "New draft");
    if (!name) return;
    const r = await api<{ draft: Draft }>("/api/admin/sales/contracts/email-drafts", { method: "POST", body: JSON.stringify({ name, description: null, subject, body }) });
    if (!r.ok) return setError(r.data.error ?? "Could not save.");
    setDrafts((d) => [...d, r.data.draft]);
    setDraftId(r.data.draft.id);
    setSaved(`Saved "${name}" to the library.`);
  }

  async function send() {
    setBusy(true);
    setError(null);
    const r = await api<{ delivered: boolean; url: string }>("/api/admin/sales/contracts/send", {
      method: "POST",
      body: JSON.stringify({ contactId: contact.id, documentIds: docs.map((d) => d.id), subject, body, emailDraftId: draftId, attachPdfs: attach }),
    });
    setBusy(false);
    if (!r.ok) return setError(r.data.error ?? "Send failed.");
    onSent({ delivered: r.data.delivered, url: r.data.url });
  }

  const blockedReason = !renderConfigured
    ? "Connect Google to make contract PDFs."
    : !contact.email
      ? "This contact has no email address."
      : stillOpen
        ? "Fill the open fields first."
        : missing.length
          ? `No value for ${missing.map((m) => `{{${m}}}`).join(", ")}.`
          : null;

  return (
    <>
      <SectionLabel>Step 3 · Choose and edit the cover email</SectionLabel>
      <Card style={{ overflow: "hidden" }}>
        <div style={{ display: "flex", flexWrap: "wrap" }}>
          <div style={{ flex: "0 0 225px", background: "#f6f8fc", borderRight: "0.5px solid #eef1f5", padding: "14px 0" }}>
            <div style={{ ...sub, padding: "0 16px" }}>Email drafts</div>
            {drafts.map((d) => (
              <button key={d.id} type="button" onClick={() => pick(d)} style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 16px", border: "none", borderLeft: d.id === draftId ? `3px solid ${BLUE}` : "3px solid transparent", background: d.id === draftId ? "#e8f0fe" : "transparent", cursor: "pointer" }}>
                <div style={{ fontSize: 13, fontWeight: d.id === draftId ? 700 : 500, color: d.id === draftId ? BLUE : NAVY }}>{d.name}</div>
                {d.description ? <div style={{ fontSize: 11, color: MUTED }}>{d.description}</div> : null}
              </button>
            ))}
            {!drafts.length ? <p style={{ padding: "0 16px", fontSize: 12, color: MUTED }}>No drafts yet. Write one here and save it to the library.</p> : null}
          </div>
          <div style={{ flex: "1 1 420px", padding: "16px 18px", minWidth: 0 }}>
            <div style={{ display: "flex", gap: 6, marginBottom: 8, fontSize: 12 }}>
              <button type="button" onClick={() => setPreview(false)} style={{ ...btn(!preview), padding: "4px 10px", fontSize: 11.5 }}>Edit</button>
              <button type="button" onClick={() => setPreview(true)} style={{ ...btn(preview), padding: "4px 10px", fontSize: 11.5 }}>Preview</button>
              <span style={{ marginLeft: "auto", color: MUTED, fontSize: 11 }}>To: {contact.email ?? "no email on file"}</span>
            </div>
            {preview ? (
              <div style={{ border: "0.5px solid #d5deea", borderRadius: 7, padding: "12px 14px", fontSize: 13, lineHeight: 1.7, color: "#1f2937", whiteSpace: "pre-wrap" }}>
                <div style={{ fontWeight: 700, marginBottom: 10 }}>{resolvedSubject.text}</div>
                {resolvedBody.text}
              </div>
            ) : (
              <>
                <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" style={{ width: "100%", boxSizing: "border-box", border: "0.5px solid #d5deea", borderRadius: 7, padding: "9px 12px", fontSize: 13, color: NAVY, marginBottom: 10 }} />
                <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={12} style={{ width: "100%", boxSizing: "border-box", border: `1px solid ${BLUE}`, borderRadius: 7, padding: "12px 14px", fontSize: 13, lineHeight: 1.7, color: "#3a4a63", fontFamily: "inherit" }} />
                <p style={{ fontSize: 11, color: MUTED, margin: "6px 0 0", lineHeight: 1.6 }}>
                  Tokens fill from the contact and from the documents, so the email cannot disagree with them: {[...EMAIL_TOKENS_BASE, ...fieldTokens].map((t) => `{{${t}}}`).join(" ")}. Edits apply to this send only.
                </p>
              </>
            )}
            <div style={{ marginTop: 12, padding: "10px 12px", background: "#f6f8fc", borderRadius: 7, fontSize: 12, color: "#3a4a63", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <label style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                <input type="checkbox" checked={attach} onChange={(e) => setAttach(e.target.checked)} /> <b>Attach PDFs:</b>
              </label>
              <span>{docs.map((d) => d.name).join(" · ")}</span>
            </div>
            {missing.length ? <div style={{ marginTop: 10 }}><Notice tone="warn">These tokens have no value for this send: {missing.map((m) => `{{${m}}}`).join(", ")}. Fill them in the documents or remove them from the email.</Notice></div> : null}
            {error ? <div style={{ marginTop: 10 }}><Notice tone="error">{error}</Notice></div> : null}
            {saved ? <div style={{ marginTop: 10 }}><Notice tone="ok">{saved}</Notice></div> : null}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
              <button type="button" onClick={onBack} style={btn()}>Back to editor</button>
              <button type="button" onClick={() => void saveToLibrary()} disabled={!subject.trim() || !body.trim()} style={btn()}>Save to library</button>
              <button type="button" disabled={busy || Boolean(blockedReason)} title={blockedReason ?? undefined} onClick={() => void send()} style={{ ...btn(true), opacity: busy || blockedReason ? 0.5 : 1 }}>
                {busy ? "Rendering and sending…" : "Send for signature"}
              </button>
            </div>
            {blockedReason ? <p style={{ fontSize: 11.5, color: "#8a6500", textAlign: "right", margin: "6px 0 0" }}>{blockedReason}</p> : null}
          </div>
        </div>
      </Card>
    </>
  );
}
