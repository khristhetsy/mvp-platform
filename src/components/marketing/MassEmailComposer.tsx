"use client";

import { useEffect, useMemo, useState } from "react";

export type SelectionPayload = { mode: "ids" | "filter"; ids?: string[]; params?: string; group?: string; count: number };
type Template = { id: string; name: string; subject: string; html_body: string; department: string | null };
type Sequence = { id: string; name: string; steps?: { id: string }[] };

const GMAIL_LIMIT = 450;
const inp: React.CSSProperties = { fontSize: 12.5, padding: "7px 9px", borderRadius: 8, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--foreground)" };

/**
 * Mass-email / sequence-enroll composer used from the Contacts and Opportunities
 * selection bars. Sends through /api/marketing/mass-email (iCapOS campaign engine or
 * Gmail), with template picker, merge-preview, send-test, and sequence enroll.
 */
export function MassEmailComposer({ source, selection, defaultEmail, onClose }: {
  source: "contacts" | "opportunities"; selection: SelectionPayload; defaultEmail?: string; onClose: () => void;
}) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [mode, setMode] = useState<"once" | "sequence">("once");
  const [channel, setChannel] = useState<"icapos" | "gmail">("icapos");
  const [templateId, setTemplateId] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("");
  const [sequenceId, setSequenceId] = useState("");
  const [testEmail, setTestEmail] = useState(defaultEmail ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/marketing/templates").then((r) => (r.ok ? r.json() : { templates: [] })).then((d) => setTemplates(d.templates ?? d ?? [])).catch(() => {});
    fetch("/api/marketing/sequences").then((r) => (r.ok ? r.json() : [])).then((d) => setSequences(Array.isArray(d) ? d : d.sequences ?? [])).catch(() => {});
  }, []);

  const grouped = useMemo(() => {
    const m = new Map<string, Template[]>();
    for (const t of templates) { const k = t.department || "Other"; (m.get(k) ?? m.set(k, []).get(k)!).push(t); }
    return [...m.entries()];
  }, [templates]);

  function pickTemplate(id: string) {
    setTemplateId(id);
    const t = templates.find((x) => x.id === id);
    if (t) { setSubject(t.subject); setHtml(t.html_body); }
  }

  const count = selection.count;
  const gmailOver = channel === "gmail" && mode === "once" && count > GMAIL_LIMIT;
  const base = () => ({ source, mode: selection.mode, ids: selection.ids, params: selection.params, group: selection.group });

  async function post(body: Record<string, unknown>) {
    return fetch("/api/marketing/mass-email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...base(), ...body }) });
  }
  async function sendTest() {
    setBusy(true); setMsg(null);
    try {
      const r = await post({ action: "test", channel, templateId: templateId || null, subject: subject || null, html: html || null, testEmail });
      const j = await r.json();
      setMsg(r.ok ? `✓ Test sent to ${j.to}` : (j.error ?? "Test failed."));
    } finally { setBusy(false); }
  }
  async function doSend() {
    if (mode === "sequence") return doEnroll();
    setBusy(true); setMsg(null);
    try {
      const r = await post({ action: "send", channel, templateId: templateId || null, subject: subject || null, html: html || null });
      const j = await r.json();
      if (!r.ok) { setMsg(j.error ?? "Send failed."); return; }
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
          <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Email {count.toLocaleString()} contact{count === 1 ? "" : "s"}</p>
          <button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--muted-foreground)" }}>✕</button>
        </div>

        {result ? (
          <div style={{ padding: 14, textAlign: "center" }}>
            <p style={{ fontSize: 13, color: "#0F6E56", fontWeight: 500, margin: "0 0 4px" }}>✓ {result}</p>
            <p style={{ fontSize: 11.5, color: "var(--muted-foreground)", margin: "0 0 12px" }}>Results appear in Marketing → Analytics.</p>
            <button onClick={onClose} style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: "#2E78F5", border: "none", borderRadius: 8, padding: "8px 18px", cursor: "pointer" }}>Done</button>
          </div>
        ) : (
          <>
            {/* mode */}
            <div style={{ display: "inline-flex", border: "0.5px solid #cdd9ec", borderRadius: 9, overflow: "hidden", marginBottom: 12 }}>
              <button onClick={() => setMode("once")} style={chip(mode === "once")}>Send once</button>
              <button onClick={() => setMode("sequence")} style={chip(mode === "sequence")}>Enroll in sequence</button>
            </div>

            {mode === "once" ? (
              <>
                {/* channel */}
                <p style={{ fontSize: 10.5, color: "var(--muted-foreground)", margin: "0 0 5px" }}>SEND WITH</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: gmailOver ? 6 : 12 }}>
                  <button onClick={() => setChannel("icapos")} style={{ textAlign: "left", border: channel === "icapos" ? "1.5px solid #2E78F5" : "0.5px solid var(--border)", background: channel === "icapos" ? "#F5F9FF" : "transparent", borderRadius: 9, padding: "8px 10px", cursor: "pointer" }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: channel === "icapos" ? "#185FA5" : "var(--foreground)" }}>{channel === "icapos" ? "✓ " : ""}iCapOS Email</div>
                    <div style={{ fontSize: 10.5, color: "var(--muted-foreground)", marginTop: 2 }}>Large, tracked, unsubscribe-safe.</div>
                  </button>
                  <button onClick={() => setChannel("gmail")} style={{ textAlign: "left", border: channel === "gmail" ? "1.5px solid #4285F4" : "0.5px solid var(--border)", background: channel === "gmail" ? "#F3F7FE" : "transparent", borderRadius: 9, padding: "8px 10px", cursor: "pointer" }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: channel === "gmail" ? "#1A56C4" : "var(--foreground)" }}>{channel === "gmail" ? "✓ " : ""}Google (Gmail)</div>
                    <div style={{ fontSize: 10.5, color: "var(--muted-foreground)", marginTop: 2 }}>From your inbox. Small batches.</div>
                  </button>
                </div>
                {gmailOver && (
                  <p style={{ fontSize: 11.5, color: "#8A5A00", background: "#FBF3E0", border: "0.5px solid #F0DFB0", borderRadius: 8, padding: "9px 11px", margin: "0 0 12px" }}>
                    ⚠ {count.toLocaleString()} exceeds Gmail&rsquo;s daily limit (~{GMAIL_LIMIT}). <button onClick={() => setChannel("icapos")} style={{ border: "none", background: "none", color: "#185FA5", textDecoration: "underline", cursor: "pointer", padding: 0, fontSize: 11.5 }}>Use iCapOS instead</button> or reduce the selection.
                  </p>
                )}

                {/* template */}
                <p style={{ fontSize: 10.5, color: "var(--muted-foreground)", margin: "0 0 3px" }}>Template</p>
                <select value={templateId} onChange={(e) => pickTemplate(e.target.value)} style={{ ...inp, width: "100%", boxSizing: "border-box", marginBottom: 10 }}>
                  <option value="">Write without a template…</option>
                  {grouped.map(([dept, ts]) => (
                    <optgroup key={dept} label={dept}>
                      {ts.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </optgroup>
                  ))}
                </select>

                <p style={{ fontSize: 10.5, color: "var(--muted-foreground)", margin: "0 0 3px" }}>Subject</p>
                <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject… ({{first_name}}, {{company}})" style={{ ...inp, width: "100%", boxSizing: "border-box", marginBottom: 10 }} />
                <p style={{ fontSize: 10.5, color: "var(--muted-foreground)", margin: "0 0 3px" }}>Body (HTML) · merge: {"{{first_name}}"} {"{{company}}"}</p>
                <textarea value={html} onChange={(e) => setHtml(e.target.value)} rows={6} placeholder="<p>Hi {{first_name}},</p>…" style={{ ...inp, width: "100%", boxSizing: "border-box", fontFamily: "var(--font-mono)", resize: "vertical", marginBottom: 10 }} />

                {/* send test */}
                <div style={{ border: "0.5px dashed #B5D4F4", background: "#F5F9FF", borderRadius: 9, padding: "9px 10px", marginBottom: 12, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: "#185FA5" }}>Send test to</span>
                  <input value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="you@example.com" style={{ ...inp, flex: 1, minWidth: 140, background: "#fff" }} />
                  <button onClick={sendTest} disabled={busy} style={{ background: "#fff", color: "#185FA5", border: "0.5px solid #B5D4F4", borderRadius: 7, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Send test</button>
                </div>
              </>
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

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{msg ?? "Unsubscribed + no-email skipped automatically."}</span>
              <button onClick={doSend} disabled={busy || gmailOver} style={{ fontSize: 12.5, fontWeight: 600, color: "#fff", background: gmailOver ? "#9aa1ab" : "#2E78F5", border: "none", borderRadius: 8, padding: "8px 18px", cursor: gmailOver ? "not-allowed" : "pointer", opacity: busy ? 0.6 : 1 }}>
                {busy ? "Working…" : mode === "sequence" ? `Enroll · ${count.toLocaleString()}` : `Send · ${count.toLocaleString()}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
