"use client";

// Sales Hub › Send SPV Contracts for one prospect (build spec §4):
// Step 1 choose documents, Step 2 entity and editor, Step 3 cover email,
// Step 4 sent documents and tracking.

import { useCallback, useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Copy, FilePenLine, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { applyEmailTokens, bestDraft, emailTokenValues, EMAIL_TOKENS_BASE, tokensIn, withTypedValues } from "@/lib/contracts/email-tokens";
import { linkedFieldValues, linkedValue, openFields } from "@/lib/contracts/fields";
import type { TemplateField } from "@/lib/contracts/types";
import { ContractEditor, loadEditorData, type EditorData, type EditorHandle, type FieldLink } from "./ContractEditor";
import { TrackingTable } from "./TrackingTable";
import { UploadContractModal } from "./UploadContractModal";
import { api, BLUE, btn, Card, MUTED, NAVY, Notice, SectionLabel } from "./ui";

type Template = { id: string; key: string; name: string; kind: string; subtype: string | null; version: number; usage: number; versions: number; master_filename: string };
type Contact = { id: string; name: string; email: string | null; company: string | null };
type Draft = { id: string; name: string; description: string | null; subject: string; body: string };
type OpenDoc = { id: string; templateId: string; name: string; kind: string };
type ListRow = { id: string; status: string; template_id: string | null; locked: boolean; source?: string; title?: string | null; signature_request_id?: string | null; version?: number; created_at?: string; updated_at?: string; template?: { name: string; kind: string } | null; entity?: { short_name: string; legal_name: string } | null };
/** A contract this contact already has in progress (an unsent draft made from a master). */
type InProgress = { id: string; templateId: string; name: string; entity: string | null; version: number; updatedAt: string; copyNo: number };
/** How Step 1 opens the editor: continue picked drafts, start fresh copies, or the default (reuse the latest draft per document). */
type OpenMode = { kind: "continue"; docByTemplate: Record<string, string> } | { kind: "new" } | { kind: "default" };
type Upload = { id: string; title: string; requestId: string | null };
/** Cover email as it stands in Step 3; saved with the send draft. */
type EmailState = { subject: string; body: string; attach: boolean; draftId: string | null; typed: Record<string, string> };
/** The saved, resumable send for this contact (contract_send_drafts). */
type SendDraft = { step: 1 | 2 | 3; term_sheet_id: string | null; extra_ids: string[]; upload_ids: string[]; unlinked: Record<string, string[]>; email: EmailState | null; updated_at: string };
type Selection = { termSheet: string | null; extras: string[]; uploads: string[] };

const SEND_AUTOSAVE_MS = 3000;
/** Saved times show in Pacific time, like every time in iCapOS. */
function fmtPt(iso: string): string {
  return `${new Date(iso).toLocaleString("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} PT`;
}

const TS_ORDER = ["convertible_note", "series_a", "safe"];

function fetchTemplates() {
  return api<{ templates: Template[]; renderConfigured: boolean; missingMasters?: number }>("/api/admin/sales/contracts/templates");
}

/** The sender's Google connection, for the Send from choice in the email step. */
export type GmailSender = { connected: boolean; canSend: boolean; email: string | null };

export function SendFlowClient({ contact, isAdmin, senderName, gmail, autoResume = false }: { contact: Contact; isAdmin: boolean; senderName: string | null; gmail: GmailSender; autoResume?: boolean }) {
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [renderConfigured, setRenderConfigured] = useState(true);
  const [missingMasters, setMissingMasters] = useState(0);
  const [termSheet, setTermSheet] = useState<string | null>(null);
  const [extras, setExtras] = useState<Set<string>>(new Set());
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [chosenUploads, setChosenUploads] = useState<Set<string>>(new Set());
  const [uploadOpen, setUploadOpen] = useState(false);
  const [docs, setDocs] = useState<OpenDoc[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [editorData, setEditorData] = useState<Record<string, EditorData>>({});
  const [openCounts, setOpenCounts] = useState<Record<string, number>>({});
  // Documents opened in this send session. Next stays locked until every tab was opened.
  const [reviewed, setReviewed] = useState<Set<string>>(new Set());
  // Linked fields the user overrode for this send, per document.
  const [unlinked, setUnlinked] = useState<Record<string, string[]>>({});
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ delivered: boolean; url: string; via: "gmail" | "icapos"; error?: string } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [history, setHistory] = useState<{ name: string; versions: { version: number; status: string; filename: string; created_at: string; author: string | null }[] } | null>(null);
  const editorRef = useRef<EditorHandle>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // Save draft / Resume: the saved send offered on arrival, the latest cover email, and when it last saved.
  const [savedSend, setSavedSend] = useState<SendDraft | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [email, setEmail] = useState<EmailState | null>(null);
  const autoResumed = useRef(false);
  const [uploadsLoaded, setUploadsLoaded] = useState(false);
  // Contracts in progress for this contact: offered as Continue selected or Create new contract.
  const [inProgress, setInProgress] = useState<InProgress[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [choiceMade, setChoiceMade] = useState(false);
  const [openMode, setOpenMode] = useState<OpenMode>({ kind: "default" });
  const replaceTarget = useRef<string | null>(null);

  const applyTemplates = useCallback((r: Awaited<ReturnType<typeof fetchTemplates>>) => {
    if (!r.ok) return setError(r.data.error ?? "Could not load templates.");
    setTemplates(r.data.templates);
    setRenderConfigured(r.data.renderConfigured);
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

  // This contact's saved send, offered as Resume or Start over.
  useEffect(() => {
    let alive = true;
    void api<{ draft: SendDraft | null }>(`/api/admin/sales/contracts/send-drafts?contactId=${contact.id}`).then((r) => {
      if (alive && r.ok && r.data.draft) setSavedSend(r.data.draft);
    });
    return () => {
      alive = false;
    };
  }, [contact.id]);

  // This contact's uploaded contracts that are still drafts.
  useEffect(() => {
    let alive = true;
    void api<{ documents: ListRow[] }>(`/api/admin/sales/contracts?contactId=${contact.id}`).then((r) => {
      if (!alive) return;
      const all = r.data.documents ?? [];
      const list = all.filter((d) => d.source === "upload" && d.status === "draft" && !d.locked);
      setUploads(list.map((d) => ({ id: d.id, title: d.title ?? "Contract", requestId: d.signature_request_id ?? null })));
      setUploadsLoaded(true);
      setChosenUploads((cur) => (cur.size ? cur : new Set(list.map((d) => d.id))));
      // Unsent drafts made from masters, newest edit first; copies of the same document are numbered by age.
      const fromMasters = all.filter((d) => d.status === "draft" && !d.locked && d.template_id && d.source !== "upload");
      const byAge = [...fromMasters].sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""));
      const seen: Record<string, number> = {};
      const copyNo: Record<string, number> = {};
      for (const d of byAge) copyNo[d.id] = seen[d.template_id as string] = (seen[d.template_id as string] ?? 0) + 1;
      const rows = fromMasters
        .map((d) => ({ id: d.id, templateId: d.template_id as string, name: d.template?.name ?? "Contract", entity: d.entity?.short_name ?? d.entity?.legal_name ?? null, version: d.version ?? 1, updatedAt: d.updated_at ?? d.created_at ?? "", copyNo: copyNo[d.id] }))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      setInProgress(rows);
      // Tick the latest draft of each document by default.
      setPicked((cur) => {
        if (cur.size) return cur;
        const latest = new Map<string, string>();
        for (const d of rows) if (!latest.has(d.templateId)) latest.set(d.templateId, d.id);
        return new Set(latest.values());
      });
    });
    return () => {
      alive = false;
    };
  }, [contact.id, refreshKey]);

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

  /** Open editor: continue the drafts picked, make fresh copies (Create new contract),
   *  or by default reuse this prospect's latest draft of each document and copy the masters for the rest. */
  async function openEditor(sel?: Selection, modeOverride?: OpenMode) {
    const mode = modeOverride ?? openMode;
    const chosen = (sel ? [sel.termSheet, ...sel.extras] : [termSheet, ...extras]).filter(Boolean) as string[];
    const ups = uploads.filter((u) => (sel ? sel.uploads.includes(u.id) : chosenUploads.has(u.id)));
    if (!chosen.length && !ups.length) return setError("Choose at least one document.");
    setBusy(true);
    setError(null);
    const list = await api<{ documents: ListRow[] }>(`/api/admin/sales/contracts?contactId=${contact.id}`);
    const drafts = (list.data.documents ?? []).filter((d) => d.status === "draft" && !d.locked && d.template_id);
    // The list is newest edit first; keep the first (latest) draft per document.
    const reuse = new Map<string, string>();
    if (mode.kind === "continue") {
      for (const [t, id] of Object.entries(mode.docByTemplate)) if (drafts.some((d) => d.id === id)) reuse.set(t, id);
    } else if (mode.kind === "default") {
      for (const d of drafts) if (!reuse.has(d.template_id as string)) reuse.set(d.template_id as string, d.id);
    }
    const missing = chosen.filter((t) => !reuse.has(t));
    if (missing.length) {
      const r = await api<{ documents: { id: string }[] }>("/api/admin/sales/contracts", { method: "POST", body: JSON.stringify({ contactId: contact.id, templateIds: missing }) });
      if (!r.ok) {
        setBusy(false);
        return setError(r.data.error ?? "Could not create the documents.");
      }
      missing.forEach((t, i) => reuse.set(t, r.data.documents[i].id));
    }
    // After Create new contract made the copies, going back and reopening keeps using them.
    if (mode.kind === "new") setOpenMode({ kind: "continue", docByTemplate: Object.fromEntries(reuse) });
    const opened = [
      ...chosen.map((t) => {
        const tpl = templates!.find((x) => x.id === t)!;
        return { id: reuse.get(t)!, templateId: t, name: tpl.name, kind: tpl.kind };
      }),
      ...ups.map((u) => ({ id: u.id, templateId: "", name: u.title, kind: "upload" })),
    ];
    setDocs(opened);
    setUnlinked({});
    await Promise.all(opened.map((d) => loadDoc(d.id)));
    setReviewed(new Set([opened[0].id]));
    setActive(opened[0].id);
    setStep(2);
    setBusy(false);
    return opened;
  }

  /** Resume the saved send: same documents (their saved values), unlinked fields, cover email and step. */
  async function resume() {
    const d = savedSend;
    if (!d || !templates || !uploadsLoaded) return;
    const known = new Set(templates.map((t) => t.id));
    const sel: Selection = {
      termSheet: d.term_sheet_id && known.has(d.term_sheet_id) ? d.term_sheet_id : null,
      extras: d.extra_ids.filter((id) => known.has(id)),
      uploads: d.upload_ids.filter((id) => uploads.some((u) => u.id === id)),
    };
    setSavedSend(null);
    if (!sel.termSheet && !sel.extras.length && !sel.uploads.length) return setError("The documents in the saved draft are no longer available. Choose documents to start again.");
    setTermSheet(sel.termSheet);
    setExtras(new Set(sel.extras));
    setChosenUploads(new Set(sel.uploads));
    setEmail(d.email);
    const opened = await openEditor(sel);
    if (!opened) return;
    setUnlinked(d.unlinked ?? {});
    setSavedAt(d.updated_at);
    // Step 3 was reached after every document was reviewed; go straight back to the email.
    if (d.step === 3) {
      setReviewed(new Set(opened.map((x) => x.id)));
      setStep(3);
    }
  }

  async function startOver() {
    setSavedSend(null);
    await api(`/api/admin/sales/contracts/send-drafts?contactId=${contact.id}`, { method: "DELETE" });
  }

  /** Tick a draft; only one draft per document can open at a time. */
  function togglePick(d: InProgress) {
    setPicked((cur) => {
      const next = new Set(cur);
      if (next.has(d.id)) next.delete(d.id);
      else {
        for (const o of inProgress) if (o.templateId === d.templateId) next.delete(o.id);
        next.add(d.id);
      }
      return next;
    });
  }

  /** Continue selected: open the ticked drafts with everything entered so far. */
  async function continuePicked() {
    if (!templates) return;
    const chosen = inProgress.filter((d) => picked.has(d.id));
    if (!chosen.length) return setError("Tick at least one contract to continue.");
    const kinds = new Map(templates.map((t) => [t.id, t.kind]));
    const ts = chosen.find((d) => kinds.get(d.templateId) === "term_sheet")?.templateId ?? null;
    const ex = chosen.filter((d) => kinds.get(d.templateId) !== "term_sheet").map((d) => d.templateId);
    const mode: OpenMode = { kind: "continue", docByTemplate: Object.fromEntries(chosen.map((d) => [d.templateId, d.id])) };
    setChoiceMade(true);
    setOpenMode(mode);
    setTermSheet(ts);
    setExtras(new Set(ex));
    await openEditor({ termSheet: ts, extras: ex, uploads: [...chosenUploads] }, mode);
  }

  /** Create new contract: pick documents in Step 1 and start fresh copies from the masters. */
  function createNew() {
    setChoiceMade(true);
    setOpenMode({ kind: "new" });
    setError(null);
  }

  // Opened from Contracts › Drafts (Resume): pick up the saved send as soon as the documents are known.
  const autoResumeNow = useEffectEvent(() => {
    void resume();
  });
  useEffect(() => {
    if (!autoResume || autoResumed.current || !savedSend || !templates || !uploadsLoaded) return;
    autoResumed.current = true;
    autoResumeNow();
  }, [autoResume, savedSend, templates, uploadsLoaded]);

  async function loadDoc(id: string): Promise<EditorData | null> {
    const r = await loadEditorData(id);
    if (r.data) {
      setEditorData((m) => ({ ...m, [id]: r.data! }));
      setOpenCounts((m) => ({ ...m, [id]: (r.data!.open as unknown[] | undefined)?.length ?? 0 }));
      return r.data;
    }
    setError(r.error ?? "Could not load a document.");
    return null;
  }

  /** Term sheet values a document's linked fields follow (Due Diligence valuation = term sheet valuation cap). */
  const linksFor = useCallback(
    (docId: string, data: Record<string, EditorData | null | undefined>): FieldLink[] => {
      const d = docs.find((x) => x.id === docId);
      const e = data[docId];
      if (!d || !e || d.kind === "term_sheet" || d.kind === "upload") return [];
      const sources = docs
        .filter((x) => x.kind === "term_sheet" && data[x.id])
        .map((x) => ({ fields: data[x.id]!.fields, values: data[x.id]!.doc.field_values }));
      const off = unlinked[docId] ?? [];
      return Object.entries(linkedFieldValues(e.fields, sources)).map(([token, value]) => ({ token, value, linked: !off.includes(token), source: "term sheet" }));
    },
    [docs, unlinked],
  );

  async function switchTab(id: string) {
    const leaving = active;
    await editorRef.current?.flush();
    // Reload the tab being left so its saved values show when it is opened again
    // and the other tabs read its latest values.
    if (leaving && docs.find((d) => d.id === leaving)?.kind !== "upload") await loadDoc(leaving);
    setReviewed((s) => new Set(s).add(id));
    setActive(id);
  }

  async function toEmail() {
    await editorRef.current?.flush();
    setBusy(true);
    const fresh = await Promise.all(docs.map((d) => loadDoc(d.id)));
    const data = Object.fromEntries(docs.map((d, i) => [d.id, fresh[i]]));
    // Linked fields on tabs that are not open follow the latest term sheet values.
    const changed: string[] = [];
    for (const d of docs) {
      const e = data[d.id];
      if (!e || e.doc.locked) continue;
      const next = { ...e.doc.field_values };
      let diff = false;
      for (const l of linksFor(d.id, data)) {
        const f = e.fields.find((x) => x.token === l.token);
        if (l.linked && linkedValue(l.token, next[l.token] ?? f?.default_value ?? "") !== l.value) {
          next[l.token] = l.value;
          diff = true;
        }
      }
      if (diff) {
        const r = await api(`/api/admin/sales/contracts/${d.id}`, { method: "PATCH", body: JSON.stringify({ field_values: next }) });
        if (r.ok) changed.push(d.id);
      }
    }
    if (changed.length) await Promise.all(changed.map((id) => loadDoc(id)));
    setBusy(false);
    setStep(3);
  }

  const onUnlink = useCallback((token: string) => setUnlinked((m) => (active ? { ...m, [active]: [...new Set([...(m[active] ?? []), token])] } : m)), [active]);
  const onRelink = useCallback((token: string) => setUnlinked((m) => (active ? { ...m, [active]: (m[active] ?? []).filter((t) => t !== token) } : m)), [active]);
  const activeLinks = useMemo(() => (active ? linksFor(active, editorData) : []), [active, editorData, linksFor]);

  const onOpenChange = useCallback((n: number) => setOpenCounts((m) => (active ? { ...m, [active]: n } : m)), [active]);
  const totalOpen = docs.reduce((a, d) => a + (openCounts[d.id] ?? 0), 0);
  const unopened = docs.filter((d) => !reviewed.has(d.id)).length;
  const blocked = totalOpen > 0 || unopened > 0;
  const tabStatus = (id: string) => {
    const n = openCounts[id] ?? 0;
    if (!reviewed.has(id)) return { short: "not opened", long: "open this tab to review", warn: true };
    if (n) return { short: `${n} open`, long: `${n} field${n === 1 ? "" : "s"} open`, warn: true };
    return { short: "reviewed", long: "reviewed", warn: false };
  };

  // Save draft: what is open now, the step, unlinked fields and the cover email. Only once the editor is open.
  const sendPayload = useMemo(() => {
    if (step < 2 || !docs.length) return null;
    return {
      contactId: contact.id,
      step,
      termSheetId: docs.find((d) => d.kind === "term_sheet")?.templateId ?? null,
      extraIds: docs.filter((d) => d.kind !== "term_sheet" && d.kind !== "upload").map((d) => d.templateId),
      uploadIds: docs.filter((d) => d.kind === "upload").map((d) => d.id),
      unlinked,
      email,
    };
  }, [contact.id, step, docs, unlinked, email]);

  const saveSend = useCallback(async () => {
    if (!sendPayload) return;
    const r = await api<{ updated_at: string }>("/api/admin/sales/contracts/send-drafts", { method: "PUT", body: JSON.stringify(sendPayload) });
    if (!r.ok) return setSaveError(r.data.error ?? "Draft not saved. Check your connection.");
    setSaveError(null);
    setSavedAt(r.data.updated_at);
  }, [sendPayload]);

  // Autosave 3 seconds after the last change.
  useEffect(() => {
    if (!sendPayload) return;
    const t = setTimeout(() => void saveSend(), SEND_AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [sendPayload, saveSend]);

  // Also save when the page is hidden or closed.
  const payloadRef = useRef(sendPayload);
  useLayoutEffect(() => {
    payloadRef.current = sendPayload;
  }, [sendPayload]);
  useEffect(() => {
    const flush = () => {
      if (!payloadRef.current) return;
      void fetch("/api/admin/sales/contracts/send-drafts", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payloadRef.current), keepalive: true }).catch(() => undefined);
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("beforeunload", flush);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, []);

  const onEmailChange = useCallback((e: EmailState) => setEmail(e), []);

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

      {step === 1 && !docs.length && (savedSend || (inProgress.length > 0 && !choiceMade)) ? (
        <div style={{ background: "#fff", border: "0.5px solid #dbe3ee", borderRadius: 12, padding: 14, marginBottom: 12 }}>
          {savedSend ? (
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", background: "#E6F1FB", border: "0.5px solid #B5D4F4", borderRadius: 12, padding: "12px 14px", marginBottom: inProgress.length && !choiceMade ? 10 : 0 }}>
          <FilePenLine size={20} color="#185FA5" aria-hidden="true" />
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#0C447C" }}>
              Saved draft for {contact.name} · Step {savedSend.step}, {savedSend.step === 3 ? "cover email" : savedSend.step === 2 ? "editing documents" : "choosing documents"}
            </div>
            <div style={{ fontSize: 12, color: "#185FA5", marginTop: 2 }}>
              {[savedSend.term_sheet_id, ...savedSend.extra_ids].map((id) => templates?.find((t) => t.id === id)?.name).filter(Boolean).concat(savedSend.upload_ids.map((id) => uploads.find((u) => u.id === id)?.title).filter(Boolean)).join(" · ") || "Documents"}
              {" · saved "}
              {fmtPt(savedSend.updated_at)}
            </div>
          </div>
          <button type="button" disabled={busy || templates === null || !uploadsLoaded} onClick={() => void resume()} style={{ ...btn(true), opacity: busy || templates === null || !uploadsLoaded ? 0.5 : 1 }}>{busy ? "Opening…" : "Resume"}</button>
          <button type="button" disabled={busy} onClick={() => void startOver()} style={btn()}>Start over</button>
        </div>
          ) : null}
          {inProgress.length > 0 && !choiceMade ? (
            <div>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 6 }}>
                <FilePenLine size={20} color={BLUE} aria-hidden="true" />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: NAVY }}>
                    {contact.name.split(" ")[0] || contact.name} has {inProgress.length} contract{inProgress.length === 1 ? "" : "s"} in progress
                  </div>
                  <div style={{ fontSize: 12, color: MUTED }}>Pick up where you left off, or start a new contract. Nothing is sent yet.</div>
                </div>
              </div>
              {inProgress.map((d) => (
                <label key={d.id} style={{ display: "grid", gridTemplateColumns: "22px minmax(0,1fr) auto", gap: 10, alignItems: "center", padding: "9px 0", borderTop: "0.5px solid #eef1f5", cursor: "pointer" }}>
                  <input type="checkbox" checked={picked.has(d.id)} onChange={() => togglePick(d)} aria-label={`Continue ${d.name}`} />
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: NAVY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {d.name}
                      {d.copyNo > 1 ? <span style={{ color: MUTED, fontWeight: 400 }}> #{d.copyNo}</span> : null}
                    </span>
                    <span style={{ display: "block", fontSize: 11.5, color: MUTED }}>
                      {[d.entity, `v${d.version}`, d.updatedAt ? `last edited ${fmtPt(d.updatedAt)}` : null].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span style={{ fontSize: 11, background: "#F3F5F8", color: "#5a6b87", borderRadius: 6, padding: "2px 8px" }}>Draft</span>
                </label>
              ))}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, borderTop: "0.5px solid #eef1f5", paddingTop: 12, marginTop: 2 }}>
                <button type="button" disabled={busy || templates === null || !uploadsLoaded || !picked.size} onClick={() => void continuePicked()} style={{ ...btn(true), opacity: busy || templates === null || !uploadsLoaded || !picked.size ? 0.5 : 1 }}>
                  {busy ? "Opening…" : `Continue selected (${picked.size})`}
                </button>
                <button type="button" disabled={busy} onClick={createNew} style={{ ...btn(), display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <Plus size={14} aria-hidden="true" /> Create new contract
                </button>
              </div>
              <div style={{ fontSize: 11.5, color: MUTED, marginTop: 8 }}>
                Continue opens the editor with everything you entered. Create new starts fresh copies from the masters; these drafts stay in Contracts until you delete or archive them.
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? <div style={{ marginBottom: 10 }}><Notice tone="error">{error}</Notice></div> : null}
      {success ? (
        <div style={{ marginBottom: 10 }}>
          <Notice tone={success.delivered ? "ok" : "warn"}>
            {success.delivered ? `Sent to ${contact.email}${success.via === "gmail" ? " from your Gmail" : ""}. Tracking is below.` : <>The documents are ready, but the email was not delivered{success.error ? ` (${success.error})` : ""}. Send this link to {contact.email} yourself: <code style={{ userSelect: "all" }}>{success.url}</code></>}
          </Notice>
        </div>
      ) : null}
      {!renderConfigured ? (
        <div style={{ marginBottom: 10 }}>
          <Notice tone="warn">PDF rendering is unavailable right now, so Preview, PDF and Send are off. Editing and saving still work.</Notice>
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
            <div style={{ borderTop: "0.5px solid #eef1f5", margin: "16px 0 12px" }} />
            <div style={{ ...sub, display: "flex", alignItems: "center", gap: 10 }}>
              Uploaded contracts
              <button type="button" onClick={() => setUploadOpen(true)} style={{ border: "0.5px solid #B5D4F4", background: "#fff", color: "#185FA5", borderRadius: 7, padding: "3px 10px", fontSize: 11.5, fontWeight: 600, cursor: "pointer", textTransform: "none", letterSpacing: 0 }}>Upload</button>
            </div>
            {uploads.length ? (
              uploads.map((u) => (
                <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: NAVY, lineHeight: 2.1, flexWrap: "wrap" }}>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                    <input type="checkbox" checked={chosenUploads.has(u.id)} onChange={(e) => setChosenUploads((s) => { const n = new Set(s); if (e.target.checked) n.add(u.id); else n.delete(u.id); return n; })} />
                    {u.title} <span style={{ fontSize: 9.5, fontWeight: 700, background: "#FCEBEB", color: "#A32D2D", borderRadius: 4, padding: "1px 5px" }}>PDF</span>
                  </label>
                  {u.requestId ? <Link href={`/admin/signatures/${u.requestId}?contract=${u.id}`} style={{ fontSize: 11, color: BLUE }}>Place signatures</Link> : null}
                  <Link href={`/admin/sales/contracts/${u.id}`} style={{ fontSize: 11, color: BLUE }}>Open</Link>
                </div>
              ))
            ) : (
              <p style={{ fontSize: 12, color: MUTED, margin: 0 }}>None yet. Upload a finished contract PDF to send it with or without a template.</p>
            )}
            <div style={{ marginTop: 12, padding: "10px 12px", background: "#f6f8fc", borderRadius: 8, fontSize: 11.5, color: MUTED, lineHeight: 1.6 }}>
              <b>Open editor</b> makes an editable copy of each master for this prospect; the masters never change. {isAdmin ? <><b>Replace file</b> uploads a new Word version of a master for future sends; documents already sent keep their version.</> : null}
            </div>
            <div style={{ textAlign: "right", marginTop: 14 }}>
              <button type="button" disabled={busy || (!termSheet && !extras.size && !chosenUploads.size)} onClick={() => void openEditor()} style={{ ...btn(true), opacity: busy || (!termSheet && !extras.size && !chosenUploads.size) ? 0.5 : 1 }}>{busy && step === 1 ? "Opening…" : !termSheet && !extras.size ? "Continue" : "Open editor"}</button>
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
                const st = tabStatus(d.id);
                return (
                  <button key={d.id} role="tab" aria-selected={on} type="button" onClick={() => void switchTab(d.id)} style={{ padding: "12px 16px", marginTop: 6, border: "none", borderRadius: "8px 8px 0 0", background: on ? "#fff" : "transparent", color: on ? NAVY : "#9fd0ff", fontSize: 13, fontWeight: on ? 700 : 500, cursor: "pointer" }}>
                    {d.name}
                    <span style={{ background: st.warn ? "#fff4d6" : on ? "#e6f6ec" : "#1e3a5f", color: st.warn ? "#8a6500" : on ? "#1a7f43" : "#9fd0ff", fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 9, marginLeft: 6 }}>{st.short}</span>
                  </button>
                );
              })}
            </div>
            {active && docs.find((d) => d.id === active)?.kind === "upload" ? (
              <UploadedPanel doc={docs.find((d) => d.id === active)!} requestId={uploads.find((u) => u.id === active)?.requestId ?? null} />
            ) : active && editorData[active] ? (
              <ContractEditor key={active} ref={editorRef} data={editorData[active]} onOpenChange={onOpenChange} links={activeLinks} onUnlink={onUnlink} onRelink={onRelink} />
            ) : (
              <p style={{ padding: 16, fontSize: 12.5, color: MUTED }}>Loading…</p>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "11px 18px", background: blocked ? "#fffbe9" : "#e6f6ec", borderTop: "0.5px solid #f0e2b8", flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, color: blocked ? "#8a6500" : "#1a7f43" }}>
                {docs.map((d) => `${d.name}: ${tabStatus(d.id).long}`).join(" · ")}
              </span>
              <button type="button" disabled={busy || blocked} onClick={() => void toEmail()} style={{ ...btn(true), background: blocked ? "#c9d4e5" : BLUE }}>Next: choose email</button>
            </div>
          </Card>
        </>
      ) : null}

      {/* STEP 3 */}
      {step === 3 ? (
        <EmailStep
          contact={contact}
          senderName={senderName}
          gmail={gmail}
          docs={docs}
          editorData={editorData}
          renderConfigured={renderConfigured}
          initialEmail={email}
          onEmailChange={onEmailChange}
          onSaveDraft={saveSend}
          savedAt={savedAt}
          saveError={saveError}
          onBack={() => setStep(2)}
          onSent={(r) => {
            setSuccess(r);
            setEmail(null);
            setSavedAt(null);
            setDocs([]);
            setEditorData({});
            setTermSheet(null);
            setExtras(new Set());
            setChosenUploads(new Set());
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

      {uploadOpen ? <UploadContractModal contact={contact} onClose={() => setUploadOpen(false)} /> : null}

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

/** Step 2 for an uploaded contract: the PDF as it will be sent, and where to adjust its boxes. */
function UploadedPanel({ doc, requestId }: { doc: OpenDoc; requestId: string | null }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderBottom: "0.5px solid #eef1f5", flexWrap: "wrap" }}>
        <span style={{ fontSize: 12.5, color: MUTED }}>Uploaded contract · sent exactly as uploaded</span>
        <span style={{ flex: 1 }} />
        {requestId ? <Link href={`/admin/signatures/${requestId}?contract=${doc.id}`} style={btn()}>Edit signature boxes</Link> : null}
      </div>
      <iframe title={doc.name} src={`/api/admin/sales/contracts/${doc.id}/pdf?kind=preview`} style={{ width: "100%", height: "65vh", border: "none", display: "block" }} />
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
  gmail,
  docs,
  editorData,
  renderConfigured,
  initialEmail,
  onEmailChange,
  onSaveDraft,
  savedAt,
  saveError,
  onBack,
  onSent,
}: {
  contact: Contact;
  senderName: string | null;
  gmail: GmailSender;
  docs: OpenDoc[];
  editorData: Record<string, EditorData>;
  renderConfigured: boolean;
  /** The cover email from a saved draft or from before Back to editor; used once, on open. */
  initialEmail: EmailState | null;
  onEmailChange: (e: EmailState) => void;
  onSaveDraft: () => Promise<void>;
  savedAt: string | null;
  saveError: string | null;
  onBack: () => void;
  onSent: (r: { delivered: boolean; url: string; via: "gmail" | "icapos"; error?: string }) => void;
}) {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [draftId, setDraftId] = useState<string | null>(initialEmail?.draftId ?? null);
  const [subject, setSubject] = useState(initialEmail?.subject ?? "");
  const [body, setBody] = useState(initialEmail?.body ?? "");
  const [attach, setAttach] = useState(initialEmail?.attach ?? true);
  const [savingDraft, setSavingDraft] = useState(false);
  const resumed = useRef(Boolean(initialEmail));
  // Send from: Gmail is preselected when the sender's Google account can send.
  const [via, setVia] = useState<"gmail" | "icapos">(gmail.canSend ? "gmail" : "icapos");
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState<"sign" | "review">("sign");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [typed, setTyped] = useState<Record<string, string>>(initialEmail?.typed ?? {});
  // Library draft being created or edited (id null = new), and the draft awaiting delete confirmation.
  const [editing, setEditing] = useState<{ id: string | null; name: string; description: string; subject: string; body: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [draftBusy, setDraftBusy] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);

  function startEdit(d: Draft | null, copy = false) {
    setDraftError(null);
    setConfirmDelete(null);
    setEditing(
      d
        ? { id: copy ? null : d.id, name: copy ? `${d.name} (copy)` : d.name, description: d.description ?? "", subject: d.subject, body: d.body }
        : { id: null, name: "", description: "", subject: "", body: "" },
    );
  }

  async function saveDraft() {
    if (!editing) return;
    if (!editing.name.trim() || !editing.subject.trim() || !editing.body.trim()) return setDraftError("Give the draft a name, subject and body.");
    setDraftBusy(true);
    setDraftError(null);
    const payload = JSON.stringify({ name: editing.name, description: editing.description.trim() || null, subject: editing.subject, body: editing.body });
    const r = editing.id
      ? await api<{ draft: Draft }>(`/api/admin/sales/contracts/email-drafts/${editing.id}`, { method: "PATCH", body: payload })
      : await api<{ draft: Draft }>("/api/admin/sales/contracts/email-drafts", { method: "POST", body: payload });
    setDraftBusy(false);
    if (!r.ok) return setDraftError(r.data.error ?? "Could not save the draft.");
    const saved = r.data.draft;
    setDrafts((list) => (editing.id ? list.map((x) => (x.id === saved.id ? saved : x)) : [...list, saved]));
    if (!editing.id || editing.id === draftId) pick(saved);
    setSaved(`Saved "${saved.name}" to the library.`);
    setEditing(null);
  }

  async function removeDraft(id: string) {
    setDraftBusy(true);
    const r = await api(`/api/admin/sales/contracts/email-drafts/${id}`, { method: "DELETE" });
    setDraftBusy(false);
    setConfirmDelete(null);
    if (!r.ok) return setError((r.data as { error?: string }).error ?? "Could not remove the draft.");
    const rest = drafts.filter((x) => x.id !== id);
    setDrafts(rest);
    if (editing?.id === id) setEditing(null);
    if (draftId === id) {
      if (rest[0]) pick(rest[0]);
      else setDraftId(null);
    }
  }

  function pick(d: Draft) {
    setDraftId(d.id);
    setSubject(d.subject);
    setBody(d.body);
  }

  const baseValues = useMemo(
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
  const tokenValues = useMemo(() => withTypedValues(baseValues, typed), [baseValues, typed]);

  // Start from the draft these documents fill best, so its values carry over.
  const baseRef = useRef(baseValues);
  useLayoutEffect(() => {
    baseRef.current = baseValues;
  }, [baseValues]);
  useEffect(() => {
    let alive = true;
    void api<{ drafts: Draft[] }>("/api/admin/sales/contracts/email-drafts").then((r) => {
      if (!alive) return;
      const list = r.data.drafts ?? [];
      setDrafts(list);
      // A resumed email keeps its own subject and body.
      if (resumed.current) return;
      const first = bestDraft(list, baseRef.current) ?? list[0];
      if (first) {
        setDraftId(first.id);
        setSubject(first.subject);
        setBody(first.body);
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  // Keep the parent's copy current so Save draft and autosave hold this email.
  useEffect(() => {
    if (!subject && !body) return;
    onEmailChange({ subject, body, attach, draftId, typed });
  }, [subject, body, attach, draftId, typed, onEmailChange]);

  async function saveDraftNow() {
    setSavingDraft(true);
    await onSaveDraft();
    setSavingDraft(false);
  }

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

  async function send(signature = true) {
    setSending(signature ? "sign" : "review");
    setBusy(true);
    setError(null);
    const r = await api<{ delivered: boolean; url: string; deliveryError?: string }>("/api/admin/sales/contracts/send", {
      method: "POST",
      body: JSON.stringify({ contactId: contact.id, documentIds: docs.map((d) => d.id), subject, body, emailDraftId: draftId, attachPdfs: signature ? attach : true, signature, via, typedValues: Object.fromEntries(Object.entries(typed).filter(([k, v]) => v.trim() && !baseValues[k])) }),
    });
    setBusy(false);
    if (!r.ok) return setError(r.data.error ?? "Send failed.");
    onSent({ delivered: r.data.delivered, url: r.data.url, via, error: r.data.deliveryError });
  }

  const blockedReason = !renderConfigured
    ? "PDF rendering is not configured."
    : !contact.email
      ? "This contact has no email address."
      : stillOpen
        ? "Fill the open fields first."
        : missing.length
          ? `Fill ${missing.length === 1 ? "the value" : `${missing.length} values`} under "Values in this email".`
          : null;
  const used = tokensIn(`${subject}\n${body}`).filter((t) => t !== "sender_name" || baseValues.sender_name);
  const CONTACT_TOKENS = new Set(["first_name", "full_name", "company", "sender_name"]);

  return (
    <>
      <SectionLabel>Step 3 · Choose and edit the cover email</SectionLabel>
      <Card style={{ overflow: "hidden" }}>
        <div style={{ display: "flex", flexWrap: "wrap" }}>
          <div style={{ flex: "0 0 225px", background: "#f6f8fc", borderRight: "0.5px solid #eef1f5", padding: "14px 0" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 12px 0 16px" }}>
              <span style={sub}>Email drafts</span>
              <button type="button" onClick={() => startEdit(null)} style={{ display: "inline-flex", alignItems: "center", gap: 3, border: "none", background: "none", color: BLUE, fontSize: 12, fontWeight: 600, cursor: "pointer", padding: "2px 4px" }}>
                <Plus size={13} aria-hidden="true" /> New draft
              </button>
            </div>
            {drafts.map((d) => {
              const on = d.id === draftId;
              const isEditing = editing?.id === d.id;
              return (
                <div key={d.id} style={{ display: "flex", alignItems: "flex-start", gap: 4, padding: "10px 10px 10px 13px", borderLeft: on || isEditing ? `3px solid ${BLUE}` : "3px solid transparent", background: on || isEditing ? "#e8f0fe" : "transparent" }}>
                  <button type="button" onClick={() => { setEditing(null); pick(d); }} style={{ flex: 1, minWidth: 0, textAlign: "left", border: "none", background: "none", padding: 0, cursor: "pointer" }}>
                    <div style={{ fontSize: 13, fontWeight: on ? 700 : 500, color: on ? BLUE : NAVY }}>{d.name}</div>
                    {d.description ? <div style={{ fontSize: 11, color: MUTED }}>{d.description}</div> : null}
                  </button>
                  {confirmDelete === d.id ? (
                    <span style={{ fontSize: 11, color: "#A32D2D", whiteSpace: "nowrap" }}>
                      Remove?{" "}
                      <button type="button" disabled={draftBusy} onClick={() => void removeDraft(d.id)} style={{ ...iconBtn, color: "#A32D2D", fontWeight: 700 }}>Yes</button>
                      <button type="button" onClick={() => setConfirmDelete(null)} style={iconBtn}>No</button>
                    </span>
                  ) : (
                    <span style={{ display: "inline-flex", gap: 2, flexShrink: 0 }}>
                      <button type="button" title="Edit draft" aria-label={`Edit ${d.name}`} onClick={() => startEdit(d)} style={iconBtn}><Pencil size={13} /></button>
                      <button type="button" title="Duplicate draft" aria-label={`Duplicate ${d.name}`} onClick={() => startEdit(d, true)} style={iconBtn}><Copy size={13} /></button>
                      <button type="button" title="Remove draft" aria-label={`Remove ${d.name}`} onClick={() => setConfirmDelete(d.id)} style={iconBtn}><Trash2 size={13} /></button>
                    </span>
                  )}
                </div>
              );
            })}
            {editing && !editing.id ? (
              <div style={{ padding: "10px 16px", borderLeft: `3px solid ${BLUE}`, background: "#e8f0fe", fontSize: 13, fontWeight: 700, color: BLUE }}>{editing.name.trim() || "New draft"}</div>
            ) : null}
            {!drafts.length && !editing ? <p style={{ padding: "0 16px", fontSize: 12, color: MUTED }}>No drafts yet. Use New draft to add one.</p> : null}
          </div>
          <div style={{ flex: "1 1 420px", padding: "16px 18px", minWidth: 0 }}>
            {editing ? (
              <div>
                <div style={{ fontSize: 12, color: MUTED, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                  <Pencil size={13} aria-hidden="true" /> {editing.id ? "Editing draft in the library" : "New draft for the library"}
                </div>
                <label style={draftLabel}>Name</label>
                <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Proposal 3" style={draftInput} />
                <label style={draftLabel}>Description</label>
                <input value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} placeholder="SAFE, single entity" style={draftInput} />
                <label style={draftLabel}>Subject</label>
                <input value={editing.subject} onChange={(e) => setEditing({ ...editing, subject: e.target.value })} placeholder="Proposal for {{company}}" style={draftInput} />
                <label style={draftLabel}>Body</label>
                <textarea value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} rows={12} style={{ ...draftInput, border: `1px solid ${BLUE}`, lineHeight: 1.7, fontFamily: "inherit" }} />
                <p style={{ fontSize: 11, color: MUTED, margin: "0 0 10px", lineHeight: 1.6 }}>
                  Tokens you can use: {[...EMAIL_TOKENS_BASE, ...fieldTokens].map((t) => `{{${t}}}`).join(" ")}. Saving updates the library for future sends.
                </p>
                {draftError ? <div style={{ marginBottom: 10 }}><Notice tone="error">{draftError}</Notice></div> : null}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
                  <button type="button" onClick={() => setEditing(null)} style={btn()}>Cancel</button>
                  <button type="button" disabled={draftBusy} onClick={() => void saveDraft()} style={{ ...btn(true), opacity: draftBusy ? 0.5 : 1 }}>{draftBusy ? "Saving…" : "Save draft"}</button>
                </div>
              </div>
            ) : (
            <>
            <div style={{ display: "flex", gap: 6, marginBottom: 8, fontSize: 12 }}>
              <button type="button" onClick={() => setPreview(false)} style={{ ...btn(!preview), padding: "4px 10px", fontSize: 11.5 }}>Edit</button>
              <button type="button" onClick={() => setPreview(true)} style={{ ...btn(preview), padding: "4px 10px", fontSize: 11.5 }}>Preview</button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, border: `1.5px solid ${BLUE}`, background: "#f6f9ff", borderRadius: 10, padding: "10px 12px", marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: MUTED }}>To</span>
              <span style={{ width: 32, height: 32, borderRadius: "50%", background: "#185FA5", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
                {contact.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("")}
              </span>
              <span style={{ minWidth: 0, fontSize: 12.5, lineHeight: 1.5 }}>
                <b style={{ color: NAVY }}>{contact.name}</b>
                <span style={{ display: "block", color: contact.email ? MUTED : "#A32D2D", overflowWrap: "anywhere" }}>
                  {[contact.email ?? "No email on file", contact.company].filter(Boolean).join(" · ")}
                </span>
              </span>
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
            <SendFrom gmail={gmail} via={via} onChange={setVia} />
            {used.length ? (
              <div style={{ marginTop: 12, border: "0.5px solid #e2e6ed", borderRadius: 8, padding: "10px 12px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "#8a93a6", marginBottom: 8 }}>Values in this email</div>
                <div style={{ display: "grid", gridTemplateColumns: "minmax(110px,170px) 1fr auto", gap: "6px 10px", alignItems: "center", fontSize: 12.5 }}>
                  {used.map((tok) => {
                    const fromDocs = baseValues[tok];
                    return [
                      <span key={`${tok}-l`} style={{ color: "#3a4a63" }}>{tok.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())}</span>,
                      fromDocs ? (
                        <span key={`${tok}-v`} style={{ color: NAVY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fromDocs}</span>
                      ) : (
                        <input key={`${tok}-v`} value={typed[tok] ?? ""} onChange={(e) => setTyped((m) => ({ ...m, [tok]: e.target.value }))} placeholder="Type the value for this email" style={{ border: `1px solid ${typed[tok]?.trim() ? "#cbd5e1" : "#E0A800"}`, background: typed[tok]?.trim() ? "#fff" : "#FFF8E1", borderRadius: 6, padding: "5px 8px", fontSize: 12.5 }} />
                      ),
                      <span key={`${tok}-s`} style={{ fontSize: 10.5, fontWeight: 600, color: fromDocs ? "#1a7f43" : "#854F0B" }}>{fromDocs ? (CONTACT_TOKENS.has(tok) ? "contact" : "documents") : "fill here"}</span>,
                    ];
                  })}
                </div>
                {!missing.length ? <div style={{ marginTop: 8, fontSize: 12, color: "#1a7f43" }}>Nothing missing.</div> : null}
              </div>
            ) : null}
            {error ? <div style={{ marginTop: 10 }}><Notice tone="error">{error}</Notice></div> : null}
            {saved ? <div style={{ marginTop: 10 }}><Notice tone="ok">{saved}</Notice></div> : null}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
              <button type="button" onClick={onBack} style={btn()}>Back to editor</button>
              <button type="button" disabled={savingDraft || busy} onClick={() => void saveDraftNow()} title="Save where you are; Resume picks it up later" style={{ ...btn(), display: "inline-flex", alignItems: "center", gap: 5, opacity: savingDraft ? 0.6 : 1 }}>
                <Save size={14} aria-hidden="true" />
                {savingDraft ? "Saving…" : "Save draft"}
              </button>
              <button type="button" onClick={() => void saveToLibrary()} disabled={!subject.trim() || !body.trim()} style={btn()}>Save to library</button>
              <button type="button" disabled={busy || Boolean(blockedReason)} title={blockedReason ?? "Email the PDFs for review. No signature request, no signing link."} onClick={() => void send(false)} style={{ ...btn(), border: `2px solid ${BLUE}`, color: BLUE, opacity: busy || blockedReason ? 0.5 : 1 }}>
                {busy && sending === "review" ? "Rendering and sending…" : "Send"}
              </button>
              <button type="button" disabled={busy || Boolean(blockedReason)} title={blockedReason ?? undefined} onClick={() => void send()} style={{ ...btn(true), opacity: busy || blockedReason ? 0.5 : 1 }}>
                {busy && sending === "sign" ? "Rendering and sending…" : "Send for signature"}
              </button>
            </div>
            {saveError ? (
              <p style={{ fontSize: 11.5, color: "#A32D2D", textAlign: "right", margin: "6px 0 0" }}>{saveError}</p>
            ) : savedAt ? (
              <p style={{ fontSize: 11.5, color: "#1a7f43", textAlign: "right", margin: "6px 0 0" }}>Draft saved {fmtPt(savedAt)} · also saves on its own as you type and when you leave</p>
            ) : null}
            {!blockedReason ? <p style={{ fontSize: 11.5, color: MUTED, textAlign: "right", margin: "6px 0 0" }}>{via === "gmail" ? "Both buttons send through your Gmail. Signing reminders and the signed copy still come from iCapOS mail." : "Send emails the PDFs for review, always attached. No signature request, no signing link."}</p> : null}
            {blockedReason ? <p style={{ fontSize: 11.5, color: "#8a6500", textAlign: "right", margin: "6px 0 0" }}>{blockedReason}</p> : null}
            </>
            )}
          </div>
        </div>
      </Card>
    </>
  );
}

/** Send from: the sender's Gmail (when connected with send permission) or iCapOS mail. */
function SendFrom({ gmail, via, onChange }: { gmail: GmailSender; via: "gmail" | "icapos"; onChange: (v: "gmail" | "icapos") => void }) {
  const box = (on: boolean): React.CSSProperties => ({
    flex: "1 1 220px", minWidth: 0, display: "flex", gap: 10, alignItems: "flex-start", textAlign: "left", cursor: "pointer", background: "#fff",
    border: on ? `2px solid ${BLUE}` : "0.5px solid #d5deea", borderRadius: 8, padding: on ? "9px 11px" : "10.5px 12.5px",
  });
  const dot = (on: boolean) => (
    <span style={{ width: 14, height: 14, borderRadius: "50%", border: `1.5px solid ${on ? BLUE : "#9aa6b8"}`, marginTop: 2, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {on ? <span style={{ width: 7, height: 7, borderRadius: "50%", background: BLUE }} /> : null}
    </span>
  );
  const returnTo = typeof window !== "undefined" ? `${window.location.pathname}${window.location.search}` : "/admin/sales/contracts";
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "#8a93a6", marginBottom: 8 }}>Send from</div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {gmail.canSend ? (
          <button type="button" onClick={() => onChange("gmail")} aria-pressed={via === "gmail"} style={box(via === "gmail")}>
            {dot(via === "gmail")}
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: NAVY }}><i className="ti ti-brand-gmail" aria-hidden="true" /> Gmail</span>
              <span style={{ display: "block", fontSize: 12, color: MUTED, overflow: "hidden", textOverflow: "ellipsis" }}>{gmail.email ?? "Your Google account"}</span>
              <span style={{ display: "inline-block", marginTop: 4, fontSize: 10.5, fontWeight: 600, padding: "1px 7px", borderRadius: 6, background: "#EAF3DE", color: "#3B6D11" }}>Connected</span>
            </span>
          </button>
        ) : (
          <div style={{ ...box(false), cursor: "default" }}>
            {dot(false)}
            <span>
              <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: NAVY }}><i className="ti ti-brand-gmail" aria-hidden="true" /> Gmail</span>
              <span style={{ display: "block", fontSize: 12, color: MUTED, marginBottom: 6 }}>{gmail.connected ? "Send permission not granted" : "Not connected"}</span>
              <a href={`/api/integrations/google/connect?returnTo=${encodeURIComponent(returnTo)}`} style={{ ...btn(), display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, textDecoration: "none" }}>
                {gmail.connected ? "Reconnect Google" : "Connect Google"} <i className="ti ti-external-link" aria-hidden="true" />
              </a>
            </span>
          </div>
        )}
        <button type="button" onClick={() => onChange("icapos")} aria-pressed={via === "icapos"} style={box(via === "icapos")}>
          {dot(via === "icapos")}
          <span>
            <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: NAVY }}><i className="ti ti-mail" aria-hidden="true" /> iCapOS mail</span>
            <span style={{ display: "block", fontSize: 12, color: MUTED }}>Current system sender</span>
          </span>
        </button>
      </div>
      <p style={{ fontSize: 11.5, color: MUTED, margin: "8px 0 0", lineHeight: 1.6 }}>
        {via === "gmail"
          ? "Sends from your Gmail account. The email and PDFs appear in your Gmail Sent folder, and replies come back to your inbox in the same thread."
          : "Sends through the iCapOS mail service. Nothing appears in your Gmail Sent folder."}
      </p>
    </div>
  );
}

const iconBtn = { border: "none", background: "none", color: "#5a6b87", cursor: "pointer", padding: "2px 4px", fontSize: 11, display: "inline-flex", alignItems: "center" } as const;
const draftLabel = { display: "block", fontSize: 11.5, fontWeight: 600, color: "#3a4a63", marginBottom: 4 } as const;
const draftInput = { width: "100%", boxSizing: "border-box", border: "0.5px solid #d5deea", borderRadius: 7, padding: "9px 12px", fontSize: 13, color: NAVY, marginBottom: 10 } as const;
