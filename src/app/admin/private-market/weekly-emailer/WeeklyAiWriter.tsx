"use client";

// Weekly emailer, AI Agent card: pick a writer (the default assistant or a live
// AI Agent), tick the real facts it may use, and get 3 options for the subject,
// preheader or note. Nothing changes in the email until "Use this" is clicked.

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { DEFAULT_WRITER_NAME, REWRITES, TARGETS, TONES, type FactKey, type FactOption, type RewriteAction, type Target, type Tone } from "@/lib/private-market/weekly-ai";
import type { WriterOption } from "@/lib/private-market/weekly-ai-server";
import type { Audience } from "@/lib/private-market/weekly-email";

type Styles = {
  card: React.CSSProperties;
  h: React.CSSProperties;
  lab: React.CSSProperties;
  inp: React.CSSProperties;
  seg: (on: boolean) => React.CSSProperties;
};

type Props = {
  audience: Audience;
  writers: WriterOption[];
  facts: FactOption[];
  styles: Styles;
  /** Characters of the note currently selected, and the selected words. */
  selection: { start: number; end: number; text: string };
  signOff: string | null;
  onSignOff: (name: string | null) => void;
  onUse: (target: Target, text: string) => void;
  onReplaceSelection: (start: number, end: number, text: string) => void;
};

const TARGET_LABEL: Record<Target, string> = { subject: "Subject line", preheader: "Preheader", note: "Note" };
const TONE_LABEL: Record<Tone, string> = { friendly: "Friendly", formal: "Formal", persuasive: "Persuasive" };
const REWRITE_LABEL: Record<RewriteAction, string> = { formal: "Formal", friendly: "Friendly", persuasive: "Persuasive", shorten: "Shorten", expand: "Expand", polish: "Polish" };

export function WeeklyAiWriter({ audience, writers, facts, styles, selection, signOff, onSignOff, onUse, onReplaceSelection }: Props) {
  const { card, h, lab, inp, seg } = styles;
  const [writerId, setWriterId] = useState<string>("default");
  const [target, setTarget] = useState<Target>("subject");
  const [tone, setTone] = useState<Tone>("friendly");
  const [extra, setExtra] = useState("");
  const [picked, setPicked] = useState<FactKey[]>(() => facts.filter((f) => f.defaultOn).map((f) => f.key));
  const [options, setOptions] = useState<string[]>([]);
  const [writtenBy, setWrittenBy] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const writer = writers.find((w) => w.id === writerId) ?? null;
  const writerName = writer ? writer.name : DEFAULT_WRITER_NAME;
  const wordCount = selection.text.trim() ? selection.text.trim().split(/\s+/).length : 0;

  // Keep the sign off in step with the chosen writer while the switch is on.
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    if (signOff !== null && signOff !== writerName) onSignOff(writerName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [writerName]);

  const blurb = !writer
    ? ["Writes only from the facts you tick", "Keeps {rating}, {band} and {approved} merge fields intact", "The same writer used in Compose"]
    : writer.speaksAsCompany
      ? ["Speaks as this company", "Uses its saved profile and knowledge", "Still limited to the facts you tick"]
      : ["Writes in this agent's saved voice", "Uses its saved profile and knowledge", "Still limited to the facts you tick"];
  const note = !writer
    ? "Uses the iCapOS email writing assistant already in Compose."
    : writer.speaksAsCompany
      ? `Writes as ${writer.name}. It will talk about that company, so use it only when the email is about them.`
      : `Writes as ${writer.name}, using that agent's saved profile and knowledge. Best fit for a platform wide email.`;

  async function call(body: Record<string, unknown>): Promise<{ options: string[]; writer: string }> {
    const res = await fetch("/api/admin/private-market/weekly-emailer/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audience, agentId: writerId === "default" ? null : writerId, ...body }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "The writer failed. Try again.");
    return data;
  }

  async function generate() {
    setBusy(true); setErr(null);
    try {
      const r = await call({ action: "write", target, tone, factKeys: picked, extra });
      setOptions(r.options); setWrittenBy(r.writer);
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed."); setOptions([]); }
    finally { setBusy(false); }
  }

  async function rewrite(action: RewriteAction) {
    if (!selection.text.trim()) return;
    setBusy(true); setErr(null);
    try {
      const r = await call({ action: "rewrite", rewrite: action, text: selection.text });
      onReplaceSelection(selection.start, selection.end, r.options[0]);
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed."); }
    finally { setBusy(false); }
  }

  const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "AI";

  return (
    <div style={card}>
      <p style={h}>AI Agent</p>
      <p style={{ margin: "0 0 10px", fontSize: 12.5, color: "var(--muted-foreground)", lineHeight: 1.5 }}>
        Drafts the subject line, preheader or note from this week&apos;s real numbers. It can only use the facts you tick, and it never invents a figure.
      </p>

      <label style={lab}>Select agent</label>
      <div role="radiogroup" aria-label="Select agent" style={{ display: "grid", gap: 6, marginBottom: 12 }}>
        {[{ id: "default", name: "iCapOS email writing assistant", sub: "Default · writes in the iCapOS voice from the facts you tick", badge: null as string | null, ok: true },
          ...writers.map((w) => ({ id: w.id, name: w.name, sub: w.selectable ? `${w.kind} · Live · uses its own profile and knowledge` : `${w.kind} · ${w.status === "paused" ? "Paused agents" : "Draft agents"} cannot write emails until they are live`, badge: w.status.toUpperCase(), ok: w.selectable }))].map((o) => (
          <label key={o.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", border: `0.5px solid ${writerId === o.id ? "#1d4ed8" : "#e2e6ed"}`, borderRadius: 10, padding: "9px 12px", cursor: o.ok ? "pointer" : "not-allowed", background: writerId === o.id ? "#eef3ff" : "#fff", opacity: o.ok ? 1 : 0.55 }}>
            <input type="radio" name="weekly-writer" disabled={!o.ok} checked={writerId === o.id} onChange={() => { setWriterId(o.id); setOptions([]); setErr(null); }} style={{ marginTop: 3 }} />
            <span style={{ flex: 1 }}>
              <b style={{ display: "block", fontSize: 13 }}>{o.name}</b>
              <span style={{ display: "block", fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>{o.sub}</span>
            </span>
            {o.badge && <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: ".08em", padding: "3px 7px", borderRadius: 99, background: o.badge === "LIVE" ? "#dcfce7" : "#eef2fa", color: o.badge === "LIVE" ? "#166534" : "#4a5878" }}>{o.badge}</span>}
          </label>
        ))}
      </div>

      <div style={{ border: "0.5px solid #c9d6f5", background: "#f7f9ff", borderRadius: 12, padding: "12px 14px", margin: "0 0 12px" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div aria-hidden style={{ width: 36, height: 36, borderRadius: "50%", background: "#1d4ed8", color: "#fff", display: "grid", placeItems: "center", fontSize: 13, fontWeight: 700 }}>{writer ? initials(writer.name) : "iC"}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{writer ? writer.name : "iCapOS email writing assistant"}</div>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{writer ? `${writer.kind} · ${writer.name}` : "Built in · Default"}</div>
          </div>
          <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: ".08em", padding: "3px 7px", borderRadius: 99, background: writer ? "#dcfce7" : "#eef2fa", color: writer ? "#166534" : "#4a5878" }}>{writer ? "LIVE" : "DEFAULT"}</span>
        </div>
        <p style={{ margin: "10px 0 6px", fontSize: 12.5, lineHeight: 1.5 }}>{note}</p>
        <ul style={{ margin: "0 0 8px", paddingLeft: 18, fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.6 }}>{blurb.map((b) => <li key={b}>{b}</li>)}</ul>
        <Link href="/admin/ai-agent" style={{ fontSize: 12, color: "#1d4ed8", fontWeight: 600, textDecoration: "none" }}>Open in AI Agents to view or edit this agent</Link>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, margin: "0 0 12px" }}>
        <div>
          <div style={{ fontSize: 13 }}>Sign the note with this agent</div>
          <div style={{ fontSize: 11.5, color: "var(--muted-foreground)" }}>Off by default. When on, the note ends with a sign off line in the email.</div>
        </div>
        <input type="checkbox" aria-label="Sign the note with this agent" checked={signOff !== null} onChange={(e) => onSignOff(e.target.checked ? writerName : null)} />
      </div>

      <label style={lab}>Write the</label>
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {TARGETS.map((t) => <button key={t} type="button" style={seg(t === target)} onClick={() => { setTarget(t); setOptions([]); }}>{TARGET_LABEL[t]}</button>)}
      </div>

      <label style={lab}>Use these facts <span style={{ fontWeight: 400 }}>live data</span></label>
      <div style={{ marginBottom: 12 }}>
        {facts.map((f) => (
          <label key={f.key} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13, padding: "3px 0" }}>
            <input type="checkbox" style={{ marginTop: 3 }} checked={picked.includes(f.key)} onChange={(e) => setPicked(e.target.checked ? [...picked, f.key] : picked.filter((k) => k !== f.key))} />
            <span><b>{f.label}</b>{f.key === "recipient" ? "" : <span style={{ color: "var(--muted-foreground)" }}>: {f.text}</span>}</span>
          </label>
        ))}
      </div>

      <label style={lab}>Tone</label>
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {TONES.map((t) => <button key={t} type="button" style={seg(t === tone)} onClick={() => setTone(t)}>{TONE_LABEL[t]}</button>)}
      </div>

      <label style={lab}>Anything else to say <span style={{ fontWeight: 400 }}>optional</span></label>
      <input style={inp} maxLength={300} value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="For example: mention the investor event on 20 Nov" />

      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12, flexWrap: "wrap" }}>
        <button type="button" disabled={busy || picked.length === 0} onClick={generate} style={{ fontSize: 13, fontWeight: 600, padding: "8px 14px", borderRadius: 8, border: "none", background: "#1d4ed8", color: "#fff", cursor: busy || picked.length === 0 ? "default" : "pointer", opacity: busy || picked.length === 0 ? 0.5 : 1 }}>
          {busy ? "Writing" : "Generate 3 options"}
        </button>
        {writtenBy && options.length > 0 && <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Written by {writtenBy}. Pick one to use.</span>}
      </div>
      {err && <p role="alert" style={{ margin: "8px 0 0", fontSize: 12.5, color: "#b42318" }}>{err}</p>}

      {options.length > 0 && (
        <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
          {options.map((o) => (
            <div key={o} style={{ border: "0.5px solid #e2e6ed", borderRadius: 10, padding: "10px 12px", background: "#fff" }}>
              <div style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{o}</div>
              <button type="button" style={{ ...seg(false), marginTop: 8 }} onClick={() => onUse(target, o)}>Use this</button>
            </div>
          ))}
        </div>
      )}

      <div style={{ borderTop: "0.5px solid #e2e6ed", marginTop: 14, paddingTop: 12 }}>
        <label style={lab}>Rewrite a selection in the note <span style={{ fontWeight: 400 }}>select words in &quot;Note&quot;, then pick an action</span></label>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {REWRITES.map((r) => <button key={r} type="button" disabled={busy || wordCount === 0} style={{ ...seg(false), opacity: wordCount === 0 ? 0.5 : 1 }} onClick={() => rewrite(r)}>{REWRITE_LABEL[r]}</button>)}
        </div>
        <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--muted-foreground)" }}>{wordCount ? `${wordCount} ${wordCount === 1 ? "word" : "words"} selected.` : "Nothing selected. Select text in the note above."}</p>
      </div>
      <p style={{ margin: "10px 0 0", fontSize: 11.5, color: "var(--muted-foreground)" }}>Nothing is sent or changed until you click Use this.</p>
    </div>
  );
}
