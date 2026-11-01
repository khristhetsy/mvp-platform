"use client";

import { useRef, useState } from "react";
import type { TrainingDocument, TrainingExample, TrainingSettings, WordingUsed } from "@/lib/sales-ai/training-types";

export type TestOpportunity = { id: string; label: string };

type PreviewRow = { id: string; title: string; contactName: string | null; stage: string; result: "skipped" | "drafts" | "off"; matched: string[] };
type TestResult =
  | { skipped: { matched: string[]; notice: string } }
  | { skipped: null; subject: string; body: string; wording: WordingUsed; quotesFound: number; objection: string };

const BUILT_IN_WORDS = ["guarantee", "free", "risk free", "no credit card"];
const STAGES = ["Any stage", "New opportunity", "Qualified", "Meeting", "Proposal", "Negotiation"];
const TABS = [
  { key: "library", label: "Training library" },
  { key: "examples", label: "Example emails" },
  { key: "skip", label: "Skip rules" },
  { key: "test", label: "Test a draft" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const card: React.CSSProperties = { background: "var(--background)", border: "0.5px solid var(--border)", borderRadius: 10, marginBottom: 12 };
const head: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, padding: "11px 14px", borderBottom: "0.5px solid var(--border)", flexWrap: "wrap" };
const body: React.CSSProperties = { padding: 14 };
const muted: React.CSSProperties = { fontSize: 12, color: "var(--muted-foreground)" };
const label: React.CSSProperties = { display: "block", fontSize: 10.5, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--muted-foreground)", margin: "10px 0 4px" };
const input: React.CSSProperties = { width: "100%", fontSize: 13, padding: "7px 9px", borderRadius: 8, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--foreground)", fontFamily: "inherit" };
const primary: React.CSSProperties = { fontSize: 12.5, fontWeight: 500, padding: "7px 12px", borderRadius: 8, border: "none", cursor: "pointer", background: "#2E78F5", color: "#fff" };
const secondary: React.CSSProperties = { fontSize: 12.5, fontWeight: 500, padding: "7px 12px", borderRadius: 8, border: "0.5px solid var(--border)", cursor: "pointer", background: "var(--background)", color: "var(--foreground)" };
const th: React.CSSProperties = { textAlign: "left", fontSize: 10.5, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--muted-foreground)", padding: "6px 8px", borderBottom: "0.5px solid var(--border)", fontWeight: 600 };
const td: React.CSSProperties = { padding: "8px", borderBottom: "0.5px solid var(--border)", fontSize: 12.5, verticalAlign: "top" };

function Pill({ tone, children }: { tone: "good" | "warn" | "bad" | "info"; children: React.ReactNode }) {
  const c = { good: ["#ECFDF5", "#047857"], warn: ["#FFFBEB", "#B45309"], bad: ["#FEF2F2", "#B91C1C"], info: ["#EEF4FF", "#185FA5"] }[tone];
  return <span style={{ background: c[0], color: c[1], borderRadius: 999, padding: "2px 9px", fontSize: 11.5, fontWeight: 600, whiteSpace: "nowrap" }}>{children}</span>;
}

function Count({ children }: { children: React.ReactNode }) {
  return <span style={{ background: "#EEF4FF", color: "#185FA5", borderRadius: 999, padding: "2px 9px", fontSize: 11.5, fontWeight: 600 }}>{children}</span>;
}

/** A list of short phrases a person can add to and remove from. */
function ChipEditor({ values, onChange, placeholder, locked = [] }: { values: string[]; onChange: (v: string[]) => void; placeholder: string; locked?: string[] }) {
  const [text, setText] = useState("");
  const add = () => {
    const t = text.replace(/\s+/g, " ").trim();
    if (t.length < 2) return;
    if (![...locked, ...values].some((v) => v.toLowerCase() === t.toLowerCase())) onChange([...values, t]);
    setText("");
  };
  const chip: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, background: "var(--muted, #F1F5F9)", borderRadius: 999, padding: "3px 10px", fontSize: 12.5 };
  return (
    <div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {locked.map((w) => <span key={`l-${w}`} style={{ ...chip, color: "var(--muted-foreground)" }} title="Built in. Always on.">{w} · built in</span>)}
        {values.map((v) => (
          <span key={v} style={chip}>
            {v}
            <button type="button" aria-label={`Remove ${v}`} onClick={() => onChange(values.filter((x) => x !== v))} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--muted-foreground)", padding: 0, fontSize: 13 }}>×</button>
          </span>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} placeholder={placeholder} style={input} />
        <button type="button" onClick={add} style={secondary}>Add</button>
      </div>
    </div>
  );
}

const same = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

export function TrainingClient({
  initialSettings, initialDocuments, initialExamples, opportunities,
}: { initialSettings: TrainingSettings; initialDocuments: TrainingDocument[]; initialExamples: TrainingExample[]; opportunities: TestOpportunity[] }) {
  const [tab, setTab] = useState<TabKey>("library");
  const [saved, setSaved] = useState(initialSettings);
  const [settings, setSettings] = useState(initialSettings);
  const [docs, setDocs] = useState(initialDocuments);
  const [examples, setExamples] = useState(initialExamples);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [purpose, setPurpose] = useState("");

  const dirty =
    settings.refundLine !== saved.refundLine || !same(settings.blockedWords, saved.blockedWords) ||
    !same(settings.skipPhrases, saved.skipPhrases) || !same(settings.skipTags, saved.skipTags);

  const ok = (text: string) => setMsg({ tone: "ok", text });
  const err = (text: string) => setMsg({ tone: "err", text });

  async function saveSettings() {
    setBusy("save");
    setMsg(null);
    try {
      const res = await fetch("/api/sales/ai-training", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings) });
      const d = (await res.json().catch(() => ({}))) as { settings?: TrainingSettings; error?: string };
      if (res.ok && d.settings) {
        setSaved(d.settings);
        setSettings(d.settings);
        ok("Saved. New drafts use these rules.");
      } else err(d.error ?? "Could not save.");
    } catch {
      err("Could not reach the server.");
    }
    setBusy(null);
  }

  async function upload(file: File) {
    setBusy("upload");
    setMsg(null);
    const form = new FormData();
    form.append("file", file);
    if (purpose.trim()) form.append("purpose", purpose.trim());
    try {
      const res = await fetch("/api/sales/ai-training/documents", { method: "POST", body: form });
      const d = (await res.json().catch(() => ({}))) as { document?: TrainingDocument; message?: string; error?: string };
      if (res.ok && d.document) {
        setDocs((cur) => [d.document as TrainingDocument, ...cur]);
        setPurpose("");
        if (d.document.status === "trained") ok(d.message ?? "Trained.");
        else err(d.message ?? "No readable text found.");
      } else err(d.error ?? "Could not upload.");
    } catch {
      err("Could not reach the server.");
    }
    if (fileRef.current) fileRef.current.value = "";
    setBusy(null);
  }

  async function removeDoc(id: string) {
    setBusy(id);
    const res = await fetch(`/api/sales/ai-training/documents?id=${id}`, { method: "DELETE" }).catch(() => null);
    if (res?.ok) setDocs((cur) => cur.filter((d) => d.id !== id));
    else err("Could not remove the document.");
    setBusy(null);
  }

  // ---- examples
  const [kind, setKind] = useState<"send" | "never">("send");
  const [stage, setStage] = useState(STAGES[0]);
  const [exBody, setExBody] = useState("");
  const [exReason, setExReason] = useState("");

  async function addExample() {
    setBusy("example");
    setMsg(null);
    try {
      const res = await fetch("/api/sales/ai-training/examples", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, stageName: stage === STAGES[0] ? null : stage, body: exBody, reason: exReason || null }),
      });
      const d = (await res.json().catch(() => ({}))) as { example?: TrainingExample; error?: string };
      if (res.ok && d.example) {
        setExamples((cur) => [d.example as TrainingExample, ...cur]);
        setExBody("");
        setExReason("");
        ok("Example added. New drafts can use it.");
      } else err(d.error ?? "Could not save the example.");
    } catch {
      err("Could not reach the server.");
    }
    setBusy(null);
  }

  async function removeExample(id: string) {
    setBusy(id);
    const res = await fetch(`/api/sales/ai-training/examples?id=${id}`, { method: "DELETE" }).catch(() => null);
    if (res?.ok) setExamples((cur) => cur.filter((e) => e.id !== id));
    else err("Could not remove the example.");
    setBusy(null);
  }

  // ---- skip preview
  const [preview, setPreview] = useState<{ rows: PreviewRow[]; limit: number } | null>(null);
  async function runPreview() {
    setBusy("preview");
    setMsg(null);
    try {
      const res = await fetch("/api/sales/ai-training/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ skipPhrases: settings.skipPhrases, skipTags: settings.skipTags }) });
      const d = (await res.json().catch(() => ({}))) as { rows?: PreviewRow[]; limit?: number; error?: string };
      if (res.ok && d.rows) setPreview({ rows: d.rows, limit: d.limit ?? 15 });
      else err(d.error ?? "Could not run the preview.");
    } catch {
      err("Could not reach the server.");
    }
    setBusy(null);
  }

  // ---- test
  const [testId, setTestId] = useState(opportunities[0]?.id ?? "");
  const [test, setTest] = useState<TestResult | null>(null);
  async function runTest() {
    if (!testId) return;
    setBusy("test");
    setMsg(null);
    setTest(null);
    try {
      const res = await fetch("/api/sales/ai-training/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ opportunityId: testId }) });
      const d = (await res.json().catch(() => ({}))) as TestResult & { error?: string };
      if (res.ok) setTest(d);
      else err(d.error ?? "Could not make the test draft.");
    } catch {
      err("Could not reach the server.");
    }
    setBusy(null);
  }

  const saveButton = (
    <button type="button" disabled={!dirty || busy === "save"} onClick={() => void saveSettings()} style={{ ...primary, opacity: !dirty || busy === "save" ? 0.5 : 1 }}>
      {busy === "save" ? "Saving…" : "Save"}
    </button>
  );
  const unsaved = dirty ? <span style={{ ...muted, color: "#B45309" }}>Unsaved changes</span> : null;
  const trainedCount = docs.filter((d) => d.status === "trained").length;
  const sends = examples.filter((e) => e.kind === "send").length;

  return (
    <div style={{ maxWidth: 860 }}>
      <div style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>AI training</h2>
        <p style={{ margin: "4px 0 0", ...muted, fontSize: 12.5 }}>
          What the sales AI agent learns from when it drafts an email. It only drafts. Nothing is sent until you approve it on the opportunity. The chat agent keeps its own training in Admin &gt; AI Agent.
        </p>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }} role="tablist">
        {TABS.map((t, i) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
            style={{ fontSize: 12.5, padding: "6px 13px", borderRadius: 999, cursor: "pointer", border: "0.5px solid var(--border)", background: tab === t.key ? "#0A1A40" : "var(--background)", color: tab === t.key ? "#fff" : "var(--foreground)" }}>
            {i + 1}. {t.label}
          </button>
        ))}
      </div>

      {msg ? (
        <p role="status" style={{ margin: "0 0 12px", fontSize: 12.5, color: msg.tone === "ok" ? "#047857" : "#B91C1C" }}>{msg.text}</p>
      ) : null}

      {tab === "library" ? (
        <>
          <section style={card}>
            <div style={head}>
              <h3 style={{ margin: 0, fontSize: 14, flex: 1 }}>Training library</h3>
              <Count>{docs.length} document{docs.length === 1 ? "" : "s"}</Count>
              <button type="button" disabled={busy === "upload"} onClick={() => fileRef.current?.click()} style={{ ...primary, opacity: busy === "upload" ? 0.5 : 1 }}>
                {busy === "upload" ? "Uploading…" : "Upload PDF"}
              </button>
              <input ref={fileRef} type="file" accept="application/pdf,.pdf" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }} />
            </div>
            <div style={body}>
              <label style={{ ...label, marginTop: 0 }} htmlFor="purpose">Used for (optional, for the next upload)</label>
              <input id="purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="For example: closing questions" maxLength={80} style={input} />
              <p style={{ ...muted, margin: "6px 0 10px" }}>PDF only. Anything else is rejected with a message to export it as a PDF. Up to 10 documents.</p>
              {docs.length === 0 ? (
                <p style={{ ...muted, margin: 0 }}>No documents yet. Upload the closing questions, the founder brochure or your objection notes.</p>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead><tr><th style={th}>Document</th><th style={th}>Used for</th><th style={th}>Status</th><th style={th}>Added</th><th style={th}>Drafts that used it</th><th style={th} /></tr></thead>
                    <tbody>
                      {docs.map((d) => (
                        <tr key={d.id}>
                          <td style={td}>{d.fileName}</td>
                          <td style={td}>{d.purpose ?? <span style={muted}>Not set</span>}</td>
                          <td style={td}>{d.status === "trained" ? <Pill tone="good">Trained</Pill> : d.status === "failed" ? <Pill tone="bad">No readable text</Pill> : <Pill tone="warn">Processing</Pill>}</td>
                          <td style={td}>{new Date(d.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</td>
                          <td style={td}><span style={muted}>Not measured yet</span></td>
                          <td style={td}><button type="button" disabled={busy === d.id} onClick={() => void removeDoc(d.id)} style={secondary}>Remove</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p style={{ ...muted, margin: "8px 0 0" }}>&quot;Drafts that used it&quot; stays Not measured yet until each draft records which documents it drew on.</p>
            </div>
          </section>

          <section style={card}>
            <div style={head}>
              <h3 style={{ margin: 0, fontSize: 14, flex: 1 }}>Wording rules</h3>
              {unsaved}
              {saveButton}
            </div>
            <div style={body}>
              <label style={{ ...label, marginTop: 0 }}>Words the agent must never use</label>
              <ChipEditor values={settings.blockedWords} locked={BUILT_IN_WORDS} placeholder="Add a word or phrase" onChange={(v) => setSettings((s) => ({ ...s, blockedWords: v }))} />
              <p style={{ ...muted, margin: "6px 0 0" }}>The built in rules also block network figures, outcome promises, dashes and the old product name. You can add words, never remove these.</p>
              <label style={label} htmlFor="refund">Refund line (shown when the refund switch is on)</label>
              <textarea id="refund" value={settings.refundLine} onChange={(e) => setSettings((s) => ({ ...s, refundLine: e.target.value }))} rows={2} maxLength={200} style={{ ...input, resize: "vertical" }} />
              <p style={{ ...muted, margin: "6px 0 0" }}>Counsel review: not recorded yet. The refund line is checked against the same copy rules when you save.</p>
            </div>
          </section>
        </>
      ) : null}

      {tab === "examples" ? (
        <section style={card}>
          <div style={head}>
            <h3 style={{ margin: 0, fontSize: 14, flex: 1 }}>Example emails</h3>
            <Count>{sends} send, {examples.length - sends} never send</Count>
          </div>
          <div style={body}>
            {examples.length === 0 ? (
              <p style={{ ...muted, margin: 0 }}>No examples yet. Add a few emails you would send and a few you never would.</p>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {examples.map((e) => (
                  <div key={e.id} style={{ border: "0.5px solid var(--border)", borderLeft: `4px solid ${e.kind === "send" ? "#047857" : "#B91C1C"}`, borderRadius: 8, padding: 12 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}>
                      <Pill tone={e.kind === "send" ? "good" : "bad"}>{e.kind === "send" ? "Would send" : "Never send"}</Pill>
                      <span style={muted}>{e.stageName ?? "Any stage"}</span>
                      <span style={{ flex: 1 }} />
                      <button type="button" disabled={busy === e.id} onClick={() => void removeExample(e.id)} style={secondary}>Remove</button>
                    </div>
                    <p style={{ margin: 0, fontSize: 12.5, whiteSpace: "pre-line", lineHeight: 1.5 }}>{e.body}</p>
                    {e.reason ? <p style={{ margin: "6px 0 0", fontSize: 12, color: "#B91C1C" }}>Why: {e.reason}</p> : null}
                  </div>
                ))}
              </div>
            )}

            <label style={{ ...label, marginTop: 16 }}>New example</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <select value={kind} onChange={(e) => setKind(e.target.value as "send" | "never")} style={input} aria-label="Kind">
                <option value="send">Would send</option>
                <option value="never">Never send</option>
              </select>
              <select value={stage} onChange={(e) => setStage(e.target.value)} style={input} aria-label="Stage">
                {STAGES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <textarea value={exBody} onChange={(e) => setExBody(e.target.value)} placeholder="Paste the email" rows={6} maxLength={3000} style={{ ...input, marginTop: 8, resize: "vertical" }} />
            <input value={exReason} onChange={(e) => setExReason(e.target.value)} maxLength={200} placeholder={kind === "never" ? "Why (required): one line" : "Why (optional): one line"} style={{ ...input, marginTop: 8 }} />
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
              <button type="button" disabled={busy === "example" || exBody.trim().length < 20} onClick={() => void addExample()} style={{ ...primary, opacity: busy === "example" || exBody.trim().length < 20 ? 0.5 : 1 }}>Add example</button>
              <span style={muted}>Examples guide the wording. They never send anything by themselves.</span>
            </div>
          </div>
        </section>
      ) : null}

      {tab === "skip" ? (
        <section style={card}>
          <div style={head}>
            <h3 style={{ margin: 0, fontSize: 14, flex: 1 }}>Skip rules</h3>
            {unsaved}
            <button type="button" disabled={busy === "preview"} onClick={() => void runPreview()} style={secondary}>{busy === "preview" ? "Checking…" : "Preview"}</button>
            {saveButton}
          </div>
          <div style={body}>
            <p style={{ ...muted, margin: 0 }}>When an opportunity matches, the AI agent tab shows a notice instead of a draft: &quot;This looks like a deal conversation. Draft it yourself.&quot;</p>
            <label style={label}>Skip when the opportunity or its thread contains</label>
            <ChipEditor values={settings.skipPhrases} placeholder="Add a word or phrase" onChange={(v) => setSettings((s) => ({ ...s, skipPhrases: v }))} />
            <label style={label}>Skip these opportunity tags</label>
            <ChipEditor values={settings.skipTags} placeholder="Add a tag" onChange={(v) => setSettings((s) => ({ ...s, skipTags: v }))} />

            <label style={{ ...label, marginTop: 16 }}>Preview against your newest open opportunities</label>
            {!preview ? (
              <p style={{ ...muted, margin: 0 }}>Press Preview to see what these rules, as typed, would do. It changes nothing.</p>
            ) : (
              <>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr><th style={th}>Opportunity</th><th style={th}>Stage</th><th style={th}>Result</th><th style={th}>Matched on</th></tr></thead>
                  <tbody>
                    {preview.rows.map((r) => (
                      <tr key={r.id}>
                        <td style={td}>{r.title}{r.contactName ? <span style={muted}> · {r.contactName}</span> : null}</td>
                        <td style={td}>{r.stage}</td>
                        <td style={td}>{r.result === "skipped" ? <Pill tone="bad">Skipped</Pill> : r.result === "drafts" ? <Pill tone="good">Agent drafts</Pill> : <Pill tone="info">Agent off in this stage</Pill>}</td>
                        <td style={td}>{r.matched.length ? r.matched.join(", ") : <span style={muted}>No match</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p style={{ ...muted, margin: "8px 0 0" }}>Shows the newest {preview.limit} open opportunities. It reads titles, tags, notes and logged activity. Odoo messages are checked when a draft is made.</p>
              </>
            )}
          </div>
        </section>
      ) : null}

      {tab === "test" ? (
        <section style={card}>
          <div style={head}>
            <h3 style={{ margin: 0, fontSize: 14, flex: 1 }}>Test a draft</h3>
            <span style={muted}>Nothing is saved or sent</span>
            <button type="button" disabled={!testId || busy === "test"} onClick={() => void runTest()} style={{ ...primary, opacity: !testId || busy === "test" ? 0.5 : 1 }}>{busy === "test" ? "Working…" : "Make a test draft"}</button>
          </div>
          <div style={body}>
            {opportunities.length === 0 ? (
              <p style={{ ...muted, margin: 0 }}>No open opportunities to test on.</p>
            ) : (
              <>
                <label style={{ ...label, marginTop: 0 }} htmlFor="testopp">Opportunity</label>
                <select id="testopp" value={testId} onChange={(e) => { setTestId(e.target.value); setTest(null); }} style={input}>
                  {opportunities.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
              </>
            )}
            <p style={{ ...muted, margin: "8px 0 0" }}>
              Uses the saved rules, {trainedCount} trained document{trainedCount === 1 ? "" : "s"} and {examples.length} example{examples.length === 1 ? "" : "s"}.
            </p>

            {test && test.skipped ? (
              <div style={{ marginTop: 12, border: "0.5px solid var(--border)", borderLeft: "4px solid #B45309", borderRadius: 8, padding: 12 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{test.skipped.notice}</p>
                <p style={{ ...muted, margin: "4px 0 0" }}>It matched {test.skipped.matched.join(", ")}.</p>
              </div>
            ) : null}

            {test && !test.skipped ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12, marginTop: 12 }}>
                <div>
                  <Pill tone="info">What the agent used</Pill>
                  <p style={{ margin: "8px 0 0", fontSize: 12.5, lineHeight: 1.6, whiteSpace: "pre-line" }}>
                    {`Documents: ${test.wording.documents.length ? test.wording.documents.join(", ") : "none"}\nExamples: ${test.wording.examplesSend} would send, ${test.wording.examplesNever} never send\nQuotes: ${test.quotesFound} found in what the prospect wrote\nObjection: ${test.objection}\nWording: ${test.wording.mode === "guided" ? "written from the training" : `built in text${test.wording.fallbackReason ? ` (${test.wording.fallbackReason})` : ""}`}`}
                  </p>
                </div>
                <div>
                  <Pill tone="good">Test draft</Pill>
                  <p style={{ margin: "8px 0 4px", fontSize: 12.5, fontWeight: 600 }}>{test.subject}</p>
                  <div style={{ border: "0.5px solid var(--border)", borderLeft: "4px solid #047857", borderRadius: 8, padding: 12, fontSize: 12.5, whiteSpace: "pre-line", lineHeight: 1.5 }}>{test.body}</div>
                </div>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
