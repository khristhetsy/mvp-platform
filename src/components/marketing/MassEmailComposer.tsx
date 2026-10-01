"use client";

import { useEffect, useState, type ReactNode } from "react";
import { TemplatePicker } from "@/components/marketing/TemplatePicker";
import { OdooPager } from "@/components/admin/OdooPager";

export type SelectionPayload = { mode: "ids" | "filter"; ids?: string[]; params?: string; group?: string; count: number };
type Template = { id: string; name: string; subject: string; html_body: string; department: string | null };
type Sequence = { id: string; name: string; steps?: { id: string }[] };

const GMAIL_LIMIT = 450;
/** Fills {{key}} tags the caller knows; unknown tags are left for the server. */
function fillTags(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{\s*([a-zA-Z_]+)\s*\}\}/g, (m, k: string) => (k in vars ? vars[k] : m));
}
export type PreviewRecipient = { label: string; first_name: string; company: string };
type Attachment = { name: string; path: string; size: number; content_type: string | null };

const MAX_TOTAL = 10 * 1024 * 1024;
/** Vercel caps a request body at 4.5 MB, so one upload stays under that. */
const MAX_FILE = 4 * 1024 * 1024;
const mb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const escHtml = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The "View the one-pager" button, placed before </body> when the template is a full document. */
function addOnePager(html: string, op: { url: string; label: string }): string {
  const block = `<div style="text-align:center;margin:24px 0;"><a href="${escHtml(op.url)}" style="display:inline-block;background:#4338CA;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:600;text-decoration:none;padding:11px 22px;border-radius:6px;">View the ${escHtml(op.label)} one-pager</a></div>`;
  const i = html.toLowerCase().lastIndexOf("</body>");
  return i >= 0 ? html.slice(0, i) + block + html.slice(i) : html + block;
}

/** Link buttons (term sheet, data room) placed before </body>, the same way as the one-pager. */
function addLinkButtons(html: string, buttons: Array<{ label: string; url: string }>): string {
  if (!buttons.length) return html;
  const block = `<div style="text-align:center;margin:18px 0;">${buttons.map((b) => `<a href="${escHtml(b.url)}" style="display:inline-block;margin:4px 6px;background:#ffffff;color:#4338CA;border:1.5px solid #4338CA;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:600;text-decoration:none;padding:10px 20px;border-radius:6px;">${escHtml(b.label)}</a>`).join("")}</div>`;
  const i = html.toLowerCase().lastIndexOf("</body>");
  return i >= 0 ? html.slice(0, i) + block + html.slice(i) : html + block;
}

/** A link the caller can add to the email (a term sheet, a data room); made just before the send by `resolveShares`. */
export type ShareOption = { key: string; icon: string; title: string; detail: ReactNode; buttonLabel: string; badge?: string | null; ready: boolean; control?: ReactNode };

const inp: React.CSSProperties = { fontSize: 12.5, padding: "7px 9px", borderRadius: 8, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--foreground)" };

/**
 * Mass-email / sequence-enroll composer used from the Contacts and Opportunities
 * selection bars. Sends through /api/marketing/mass-email (iCapOS campaign engine or
 * Gmail), with template picker, merge-preview, send-test, and sequence enroll.
 *
 * Optional, for other record types (the IR task Matching tab): `noun` names the
 * recipients, `extraMerge` fills record-level tags ({{founder_name}} …) before sending,
 * `previewAs` adds a rendered Preview / HTML toggle filled for each recipient,
 * `renderSequence` replaces the Enroll in sequence panel, `onSent` reports a send,
 * `defaultDepartment` opens that group in the template picker first, `onePager` adds the
 * founder one-pager row (null = not published), `allowAttachments` adds file attachments,
 * `notice` shows above the attachments, `shares` adds link rows (term sheet, data room) that
 * `resolveShares` turns into real per-recipient links right before a send or test.
 * Without them it behaves exactly as before.
 */
export function MassEmailComposer({ source, selection, defaultEmail, onClose, noun = "contact", extraMerge, previewAs, initialMode = "once", renderSequence, onSent, defaultDepartment, onePager, allowAttachments = false, notice, shares, resolveShares }: {
  source: "contacts" | "opportunities"; selection: SelectionPayload; defaultEmail?: string; onClose: () => void;
  noun?: string; extraMerge?: Record<string, string>; previewAs?: PreviewRecipient[]; initialMode?: "once" | "sequence";
  renderSequence?: (done: (message: string) => void) => ReactNode; onSent?: (sent: number) => void; defaultDepartment?: string;
  onePager?: { url: string; label: string } | null; allowAttachments?: boolean;
  notice?: ReactNode; shares?: ShareOption[];
  resolveShares?: (keys: string[], ctx: { testEmail?: string }) => Promise<{ buttons: Array<{ label: string; url: string }> } | { error: string }>;
}) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [mode, setMode] = useState<"once" | "sequence">(initialMode);
  const [view, setView] = useState<"preview" | "html">(previewAs?.length ? "preview" : "html");
  const [previewIdx, setPreviewIdx] = useState(0);
  const [channel, setChannel] = useState<"icapos" | "gmail">("icapos");
  const [templateId, setTemplateId] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("");
  const [sequenceId, setSequenceId] = useState("");
  const [testEmail, setTestEmail] = useState(defaultEmail ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [fullView, setFullView] = useState(false);
  const [includeOnePager, setIncludeOnePager] = useState(true);
  const [files, setFiles] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [fileErr, setFileErr] = useState<string | null>(null);
  const [sharePicked, setSharePicked] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/marketing/templates").then((r) => (r.ok ? r.json() : { templates: [] })).then((d) => setTemplates(d.templates ?? d ?? [])).catch(() => {});
    fetch("/api/marketing/sequences").then((r) => (r.ok ? r.json() : [])).then((d) => setSequences(Array.isArray(d) ? d : d.sequences ?? [])).catch(() => {});
  }, []);

  function pickTemplate(id: string, list: Template[] = templates) {
    setTemplateId(id);
    const t = list.find((x) => x.id === id);
    if (t) { setSubject(t.subject); setHtml(t.html_body); }
  }

  const withExtra = (t: string) => (extraMerge ? fillTags(t, extraMerge) : t);
  /** The body as it goes out: record-level tags filled, plus the one-pager button when ticked. */
  const outgoing = () => { const b = withExtra(html); return b.trim() && onePager && includeOnePager ? addOnePager(b, onePager) : b; };
  const pickedShares = (shares ?? []).filter((o) => o.ready && sharePicked.has(o.key));
  /** The body with real share links made for this send, or null (and a message) when they couldn't be made. */
  async function finalBody(testTo?: string): Promise<string | null> {
    const b = outgoing();
    if (!b.trim() || !pickedShares.length || !resolveShares) return b;
    const r = await resolveShares(pickedShares.map((o) => o.key), { testEmail: testTo });
    if ("error" in r) { setMsg(r.error); return null; }
    return addLinkButtons(b, r.buttons);
  }
  const usedBytes = files.reduce((n, f) => n + f.size, 0);
  async function addFiles(list: FileList | null) {
    if (!list?.length) return;
    setFileErr(null); setUploading(true);
    let total = usedBytes;
    try {
      for (const f of Array.from(list)) {
        if (f.size > MAX_FILE) { setFileErr(`${f.name} is over 4 MB. Share it as a link instead.`); continue; }
        if (total + f.size > MAX_TOTAL) { setFileErr("Attachments are limited to 10 MB in total."); break; }
        const fd = new FormData(); fd.append("file", f);
        const r = await fetch("/api/email/attachments", { method: "POST", body: fd });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j.attachment) { setFileErr(j.error ?? `Couldn't upload ${f.name}.`); continue; }
        total += f.size;
        setFiles((xs) => [...xs, { ...(j.attachment as Attachment), name: f.name }]);
      }
    } finally { setUploading(false); }
  }
  const who = previewAs?.[Math.min(previewIdx, (previewAs?.length ?? 1) - 1)];
  const previewDoc = who ? `<!doctype html><html><body style="margin:0;padding:12px 14px;font:13px/1.6 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1f2937">${fillTags(addLinkButtons(outgoing(), html.trim() ? pickedShares.map((o) => ({ label: o.buttonLabel, url: "#" })) : []), { first_name: who.first_name, company: who.company })}</body></html>` : "";
  const count = selection.count;
  const gmailOver = channel === "gmail" && mode === "once" && count > GMAIL_LIMIT;
  const base = () => ({ source, mode: selection.mode, ids: selection.ids, params: selection.params, group: selection.group });

  async function post(body: Record<string, unknown>) {
    const extra = body.action !== "sequence" && files.length ? { attachments: files } : {};
    return fetch("/api/marketing/mass-email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...base(), ...extra, ...body }) });
  }
  async function sendTest() {
    setBusy(true); setMsg(null);
    try {
      const body = await finalBody(testEmail.trim() || undefined);
      if (body === null) return;
      const r = await post({ action: "test", channel, templateId: templateId || null, subject: withExtra(subject) || null, html: body || null, testEmail });
      const j = await r.json();
      setMsg(r.ok ? `✓ Test sent to ${j.to}` : (j.error ?? "Test failed."));
    } finally { setBusy(false); }
  }
  async function doSend() {
    if (mode === "sequence") return doEnroll();
    setBusy(true); setMsg(null);
    try {
      const body = await finalBody();
      if (body === null) return;
      const r = await post({ action: "send", channel, templateId: templateId || null, subject: withExtra(subject) || null, html: body || null });
      const j = await r.json();
      if (!r.ok) { setMsg(j.error ?? "Send failed."); return; }
      onSent?.(j.sent ?? 0);
      setResult(`Sent ${j.sent ?? 0}${j.failed ? `, ${j.failed} failed` : ""}${j.skipped ? `, ${j.skipped} skipped` : ""}${j.skippedNoEmail ? `, ${j.skippedNoEmail} no-email` : ""}.`);
    } finally { setBusy(false); }
  }
  async function doEnroll() {
    if (!sequenceId) { setMsg("Pick a sequence."); return; }
    setBusy(true); setMsg(null);
    try {
      const r = await post({ action: "sequence", sequenceId });
      const j = await r.json();
      if (!r.ok) { setMsg(j.error ?? "Enroll failed."); return; }
      setResult(`Enrolled ${j.enrolled ?? 0} contact${j.enrolled === 1 ? "" : "s"}${j.skippedNoEmail ? `, ${j.skippedNoEmail} no-email` : ""}.`);
    } finally { setBusy(false); }
  }

  const chip = (active: boolean): React.CSSProperties => ({ fontSize: 12.5, fontWeight: active ? 600 : 400, color: active ? "#fff" : "var(--muted-foreground)", background: active ? "#2E78F5" : "transparent", border: "none", padding: "6px 13px", cursor: "pointer" });

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 70, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--background, #fff)", borderRadius: 12, padding: 16, width: 560, maxWidth: "100%", maxHeight: "90vh", overflow: "auto", boxShadow: "0 20px 48px rgba(0,0,0,.2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Email {count.toLocaleString()} {noun}{count === 1 ? "" : "s"}</p>
          <button type="button" onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--muted-foreground)" }}>✕</button>
        </div>

        {result ? (
          <div style={{ padding: 14, textAlign: "center" }}>
            <p style={{ fontSize: 13, color: "#0F6E56", fontWeight: 500, margin: "0 0 4px" }}>✓ {result}</p>
            <p style={{ fontSize: 11.5, color: "var(--muted-foreground)", margin: "0 0 12px" }}>Results appear in Marketing → Analytics.</p>
            <button type="button" onClick={onClose} style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: "#2E78F5", border: "none", borderRadius: 8, padding: "8px 18px", cursor: "pointer" }}>Done</button>
          </div>
        ) : (
          <>
            {/* mode */}
            <div style={{ display: "inline-flex", border: "0.5px solid #cdd9ec", borderRadius: 9, overflow: "hidden", marginBottom: 12 }}>
              <button type="button" onClick={() => setMode("once")} style={chip(mode === "once")}>Send once</button>
              <button type="button" onClick={() => setMode("sequence")} style={chip(mode === "sequence")}>Enroll in sequence</button>
            </div>

            {mode === "once" ? (
              <>
                {/* channel */}
                <p style={{ fontSize: 10.5, color: "var(--muted-foreground)", margin: "0 0 5px" }}>SEND WITH</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: gmailOver ? 6 : 12 }}>
                  <button type="button" onClick={() => setChannel("icapos")} style={{ textAlign: "left", border: channel === "icapos" ? "1.5px solid #2E78F5" : "0.5px solid var(--border)", background: channel === "icapos" ? "#F5F9FF" : "transparent", borderRadius: 9, padding: "8px 10px", cursor: "pointer" }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: channel === "icapos" ? "#185FA5" : "var(--foreground)" }}>{channel === "icapos" ? "✓ " : ""}iCapOS Email</div>
                    <div style={{ fontSize: 10.5, color: "var(--muted-foreground)", marginTop: 2 }}>Large, tracked, unsubscribe-safe.</div>
                  </button>
                  <button type="button" onClick={() => setChannel("gmail")} style={{ textAlign: "left", border: channel === "gmail" ? "1.5px solid #4285F4" : "0.5px solid var(--border)", background: channel === "gmail" ? "#F3F7FE" : "transparent", borderRadius: 9, padding: "8px 10px", cursor: "pointer" }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: channel === "gmail" ? "#1A56C4" : "var(--foreground)" }}>{channel === "gmail" ? "✓ " : ""}Google (Gmail)</div>
                    <div style={{ fontSize: 10.5, color: "var(--muted-foreground)", marginTop: 2 }}>From your inbox. Small batches.</div>
                  </button>
                </div>
                {gmailOver && (
                  <p style={{ fontSize: 11.5, color: "#8A5A00", background: "#FBF3E0", border: "0.5px solid #F0DFB0", borderRadius: 8, padding: "9px 11px", margin: "0 0 12px" }}>
                    ⚠ {count.toLocaleString()} exceeds Gmail&rsquo;s daily limit (~{GMAIL_LIMIT}). <button type="button" onClick={() => setChannel("icapos")} style={{ border: "none", background: "none", color: "#185FA5", textDecoration: "underline", cursor: "pointer", padding: 0, fontSize: 11.5 }}>Use iCapOS instead</button> or reduce the selection.
                  </p>
                )}

                {/* template */}
                <p style={{ fontSize: 10.5, color: "var(--muted-foreground)", margin: "0 0 3px" }}>Template</p>
                <TemplatePicker templates={templates} value={templateId} onPick={(id) => pickTemplate(id)} defaultDepartment={defaultDepartment}
                  mergeTags={["first_name", "company", ...Object.keys(extraMerge ?? {})]}
                  onCreated={(t) => { const next = [t, ...templates]; setTemplates(next); pickTemplate(t.id, next); }} />

                <p style={{ fontSize: 10.5, color: "var(--muted-foreground)", margin: "0 0 3px" }}>Subject</p>
                <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject… ({{first_name}}, {{company}})" style={{ ...inp, width: "100%", boxSizing: "border-box", marginBottom: 10 }} />
                {previewAs?.length ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 0 4px" }}>
                    <p style={{ fontSize: 10.5, color: "var(--muted-foreground)", margin: 0 }}>Body</p>
                    <button type="button" onClick={() => setFullView(true)} disabled={!html.trim()} style={{ marginLeft: "auto", fontSize: 11.5, padding: "3px 10px", border: "0.5px solid #cdd9ec", borderRadius: 7, background: "transparent", cursor: html.trim() ? "pointer" : "default", color: "var(--muted-foreground)" }}>
                      <i className="ti ti-arrows-maximize" aria-hidden="true" /> Expand
                    </button>
                    <div style={{ display: "inline-flex", border: "0.5px solid #cdd9ec", borderRadius: 7, overflow: "hidden" }}>
                      {(["preview", "html"] as const).map((v) => <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} style={{ fontSize: 11.5, padding: "3px 10px", border: "none", cursor: "pointer", background: view === v ? "#E6F1FB" : "transparent", color: view === v ? "#0C447C" : "var(--muted-foreground)", fontWeight: view === v ? 600 : 400 }}>{v === "preview" ? "Preview" : "HTML"}</button>)}
                    </div>
                  </div>
                ) : <p style={{ fontSize: 10.5, color: "var(--muted-foreground)", margin: "0 0 3px" }}>Body (HTML) · merge: {"{{first_name}}"} {"{{company}}"}</p>}
                {previewAs?.length && view === "preview" ? (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--muted-foreground)", margin: "0 0 4px" }}>
                      Previewing as <b style={{ color: "var(--foreground)", fontWeight: 600 }}>{who?.label}</b>
                      {previewAs.length > 1 ? <>
                        <OdooPager label={`${Math.min(previewIdx, previewAs.length - 1) + 1} / ${previewAs.length}`}
                          prev={{ onClick: () => setPreviewIdx((i) => (i - 1 + previewAs.length) % previewAs.length), title: "Previous recipient" }}
                          next={{ onClick: () => setPreviewIdx((i) => (i + 1) % previewAs.length), title: "Next recipient" }} />
                      </> : null}
                      <button type="button" onClick={() => setView("html")} style={{ marginLeft: "auto", border: "none", background: "none", cursor: "pointer", color: "#185FA5", fontSize: 11, padding: 0 }}>Edit HTML</button>
                    </div>
                    {html.trim()
                      ? <iframe title="Email preview" sandbox="" srcDoc={previewDoc} style={{ width: "100%", height: 260, border: "0.5px solid var(--border)", borderRadius: 8, background: "#fff", marginBottom: 4 }} />
                      : <div style={{ border: "0.5px dashed var(--border)", borderRadius: 8, padding: "28px 12px", textAlign: "center", fontSize: 12, color: "var(--muted-foreground)", marginBottom: 4 }}>Pick a template, or <button type="button" onClick={() => setView("html")} style={{ border: "none", background: "none", color: "#185FA5", cursor: "pointer", padding: 0, fontSize: 12 }}>write the HTML</button>.</div>}
                  </>
                ) : (
                  <textarea value={html} onChange={(e) => setHtml(e.target.value)} rows={previewAs?.length ? 10 : 6} placeholder="<p>Hi {{first_name}},</p>…" style={{ ...inp, width: "100%", boxSizing: "border-box", fontFamily: "var(--font-mono)", resize: "vertical", marginBottom: previewAs?.length ? 4 : 10 }} />
                )}
                {previewAs?.length ? <p style={{ fontSize: 10.5, color: "var(--muted-foreground)", margin: "0 0 10px" }}>Merge: {["first_name", "company", ...Object.keys(extraMerge ?? {})].map((k) => `{{${k}}}`).join(" ")}</p> : null}

                {onePager !== undefined || allowAttachments || shares?.length ? (
                  <div style={{ marginBottom: 12 }}>
                    <p style={{ fontSize: 10.5, color: "var(--muted-foreground)", margin: "0 0 4px" }}>Attachments</p>
                    {notice}
                    {onePager !== undefined ? (
                      <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", border: onePager && includeOnePager ? "1px solid #B5D4F4" : "0.5px solid var(--border)", borderRadius: 8, marginBottom: 6, cursor: onePager ? "pointer" : "default", opacity: onePager ? 1 : 0.7 }}>
                        <input type="checkbox" checked={!!onePager && includeOnePager} disabled={!onePager} onChange={(e) => setIncludeOnePager(e.target.checked)} />
                        <i className="ti ti-file-text" aria-hidden="true" style={{ fontSize: 17, color: "#185FA5" }} />
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ display: "block", fontSize: 12.5, fontWeight: 600 }}>{onePager ? `${onePager.label} one-pager` : "Founder one-pager"}</span>
                          <span style={{ display: "block", fontSize: 10.5, color: "var(--muted-foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{onePager ? `Adds a "View the one-pager" button · ${onePager.url.replace(/^https?:\/\//, "")}` : "Not published yet, so there's no page to link."}</span>
                        </span>
                        {onePager ? <span style={{ fontSize: 10.5, padding: "2px 8px", borderRadius: 6, background: "#E6F1FB", color: "#0C447C" }}>Published</span> : null}
                      </label>
                    ) : null}
                    {(shares ?? []).map((o) => {
                      const on = o.ready && sharePicked.has(o.key);
                      return (
                        <div key={o.key} style={{ padding: "7px 10px", border: on ? "1px solid #B5D4F4" : "0.5px solid var(--border)", borderRadius: 8, marginBottom: 6 }}>
                          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: o.ready ? "pointer" : "default" }}>
                            <input type="checkbox" checked={on} disabled={!o.ready} onChange={(e) => setSharePicked((cur) => { const n = new Set(cur); if (e.target.checked) n.add(o.key); else n.delete(o.key); return n; })} />
                            <i className={`ti ${o.icon}`} aria-hidden="true" style={{ fontSize: 17, color: "#185FA5" }} />
                            <span style={{ flex: 1, minWidth: 0 }}>
                              <span style={{ display: "block", fontSize: 12.5, fontWeight: 600 }}>{o.title}</span>
                              <span style={{ display: "block", fontSize: 10.5, color: "var(--muted-foreground)" }}>{o.detail}</span>
                            </span>
                            {o.badge ? <span style={{ fontSize: 10.5, padding: "2px 8px", borderRadius: 6, background: "#E1F5EE", color: "#085041", whiteSpace: "nowrap" }}>{o.badge}</span> : null}
                          </label>
                          {o.control ? <div style={{ marginTop: 6, paddingLeft: 24 }}>{o.control}</div> : null}
                        </div>
                      );
                    })}
                    {allowAttachments ? (
                      <>
                        {files.map((f) => (
                          <div key={f.path} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", border: "0.5px solid var(--border)", borderRadius: 8, marginBottom: 6, fontSize: 12.5 }}>
                            <i className="ti ti-paperclip" aria-hidden="true" style={{ color: "var(--muted-foreground)" }} />
                            <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name} <span style={{ color: "var(--muted-foreground)", fontSize: 11 }}>· {mb(f.size)}</span></span>
                            <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles((xs) => xs.filter((x) => x.path !== f.path))} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--muted-foreground)" }}><i className="ti ti-x" aria-hidden="true" /></button>
                          </div>
                        ))}
                        <label onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); void addFiles(e.dataTransfer.files); }}
                          style={{ display: "block", border: "0.5px dashed var(--border)", borderRadius: 8, padding: "9px 10px", textAlign: "center", fontSize: 12, color: "var(--muted-foreground)", cursor: "pointer" }}>
                          <input type="file" multiple hidden onChange={(e) => { void addFiles(e.target.files); e.target.value = ""; }} />
                          <i className="ti ti-paperclip" aria-hidden="true" /> {uploading ? "Uploading…" : <>Drop files or <span style={{ color: "#185FA5" }}>browse</span> · up to 4 MB each, 10 MB total</>}
                        </label>
                        <p style={{ fontSize: 10.5, color: fileErr ? "#A32D2D" : "var(--muted-foreground)", margin: "4px 0 0" }}>{fileErr ?? (files.length ? `${mb(usedBytes)} of 10 MB used` : "")}</p>
                      </>
                    ) : null}
                  </div>
                ) : null}

                {/* send test */}
                <div style={{ border: "0.5px dashed #B5D4F4", background: "#F5F9FF", borderRadius: 9, padding: "9px 10px", marginBottom: 12, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: "#185FA5" }}>Send test to</span>
                  <input value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="you@example.com" style={{ ...inp, flex: 1, minWidth: 140, background: "#fff" }} />
                  <button type="button" onClick={sendTest} disabled={busy} style={{ background: "#fff", color: "#185FA5", border: "0.5px solid #B5D4F4", borderRadius: 7, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Send test</button>
                </div>
              </>
            ) : renderSequence ? (
              <>{renderSequence((m) => setResult(m))}</>
            ) : (
              <>
                <p style={{ fontSize: 10.5, color: "var(--muted-foreground)", margin: "0 0 3px" }}>Sequence <span style={{ color: "var(--muted-foreground)" }}>· iCapOS, tracked</span></p>
                <select value={sequenceId} onChange={(e) => setSequenceId(e.target.value)} style={{ ...inp, width: "100%", boxSizing: "border-box", marginBottom: 8 }}>
                  <option value="">Choose a sequence…</option>
                  {sequences.map((s) => <option key={s.id} value={s.id}>{s.name}{s.steps ? ` · ${s.steps.length} steps` : ""}</option>)}
                </select>
                <p style={{ fontSize: 11.5, color: "var(--muted-foreground)", background: "var(--muted)", borderRadius: 8, padding: "8px 11px", margin: "0 0 12px", lineHeight: 1.5 }}>
                  Enrolls the selection at step 1; steps follow their delays &amp; conditions. Already-enrolled, unsubscribed &amp; no-email are skipped. A reply or a sold/lost opportunity stops the drip.
                </p>
              </>
            )}

            {mode === "sequence" && renderSequence ? null : <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{msg ?? "Unsubscribed + no-email skipped automatically."}</span>
              <button type="button" onClick={doSend} disabled={busy || gmailOver} style={{ fontSize: 12.5, fontWeight: 600, color: "#fff", background: gmailOver ? "#9aa1ab" : "#2E78F5", border: "none", borderRadius: 8, padding: "8px 18px", cursor: gmailOver ? "not-allowed" : "pointer", opacity: busy ? 0.6 : 1 }}>
                {busy ? "Working…" : mode === "sequence" ? `Enroll · ${count.toLocaleString()}` : `Send · ${count.toLocaleString()}`}
              </button>
            </div>}
          </>
        )}
      </div>
      {fullView && who ? (
        <FullView doc={previewDoc} title={templates.find((t) => t.id === templateId)?.name ?? (subject || "Email")} who={who.label}
          idx={Math.min(previewIdx, (previewAs?.length ?? 1) - 1)} total={previewAs?.length ?? 1} files={files.map((f) => f.name)}
          onStep={(d) => setPreviewIdx((i) => (i + d + (previewAs?.length ?? 1)) % (previewAs?.length ?? 1))} onClose={() => setFullView(false)} />
      ) : null}
    </div>
  );
}

/** The whole email at full height (no inner scrollbar), desktop or mobile width, stepping through recipients. */
function FullView({ doc, title, who, idx, total, files, onStep, onClose }: {
  doc: string; title: string; who: string; idx: number; total: number; files: string[]; onStep: (d: number) => void; onClose: () => void;
}) {
  const [width, setWidth] = useState<"desktop" | "mobile">("desktop");
  const [height, setHeight] = useState(600);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);
  const btn = (active = false): React.CSSProperties => ({ fontSize: 12, padding: "4px 10px", borderRadius: 7, border: "0.5px solid #cdd9ec", cursor: "pointer", background: active ? "#E6F1FB" : "transparent", color: active ? "#0C447C" : "var(--muted-foreground)" });
  return (
    <div onClick={(e) => { e.stopPropagation(); onClose(); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 80, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--background, #fff)", borderRadius: 12, width: "min(1100px, 96vw)", height: "94vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 48px rgba(0,0,0,.25)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderBottom: "0.5px solid var(--border)", flexWrap: "wrap" }}>
          <p style={{ fontSize: 13.5, fontWeight: 600, margin: 0 }}>{title} <span style={{ fontWeight: 400, color: "var(--muted-foreground)" }}>· as {who}</span></p>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
            {total > 1 ? <>
              <OdooPager label={`${idx + 1} / ${total}`}
                prev={{ onClick: () => onStep(-1), title: "Previous recipient" }}
                next={{ onClick: () => onStep(1), title: "Next recipient" }} />
            </> : null}
            <button type="button" aria-pressed={width === "desktop"} onClick={() => setWidth("desktop")} style={btn(width === "desktop")}><i className="ti ti-device-desktop" aria-hidden="true" /> Desktop</button>
            <button type="button" aria-pressed={width === "mobile"} onClick={() => setWidth("mobile")} style={btn(width === "mobile")}><i className="ti ti-device-mobile" aria-hidden="true" /> Mobile</button>
            <button type="button" onClick={onClose} style={btn()}><i className="ti ti-arrows-minimize" aria-hidden="true" /> Close</button>
          </div>
        </div>
        <div style={{ flex: 1, overflow: "auto", background: "var(--muted)", padding: 16 }}>
          {/* allow-same-origin (no scripts) so the frame can be measured and shown at full height. */}
          <iframe key={`${width}:${doc.length}:${who}`} title="Full email preview" sandbox="allow-same-origin" srcDoc={doc}
            onLoad={(e) => { const d = e.currentTarget.contentDocument; if (d) setHeight(Math.max(d.documentElement.scrollHeight, d.body?.scrollHeight ?? 0) + 4); }}
            style={{ display: "block", margin: "0 auto", width: width === "mobile" ? 390 : "100%", maxWidth: 900, height, border: "0.5px solid var(--border)", borderRadius: 8, background: "#fff" }} />
        </div>
        {files.length ? <p style={{ fontSize: 11.5, color: "var(--muted-foreground)", margin: 0, padding: "8px 14px", borderTop: "0.5px solid var(--border)" }}><i className="ti ti-paperclip" aria-hidden="true" /> {files.join(", ")}</p> : null}
      </div>
    </div>
  );
}
