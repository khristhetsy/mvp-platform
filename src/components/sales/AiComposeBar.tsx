"use client";

import { useState } from "react";

type Tone = "warm" | "concise" | "formal";
const TONES: { id: Tone; label: string; action: string }[] = [
  { id: "warm", label: "Warm", action: "friendly" },
  { id: "concise", label: "Concise", action: "shorten" },
  { id: "formal", label: "Formal", action: "formal" },
];

type Suggestion = { body: string; subject: string | null; mode: "draft" | "rewrite" };

/**
 * AI draft and Rewrite for a plain message composer. Suggestions are shown in a
 * card and only replace the body when the user picks "Use this" (nothing is ever
 * sent or overwritten automatically). Calls the existing /api/email/ai-compose.
 */
export function AiComposeBar({ body, subject, to, contactName, onUseBody, onUseSubject }: {
  body: string;
  subject: string;
  to: string | null | undefined;
  contactName?: string | null;
  onUseBody: (text: string) => void;
  onUseSubject: (text: string) => void;
}) {
  const [tone, setTone] = useState<Tone | null>(null);
  const [askDraft, setAskDraft] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState<"draft" | "rewrite" | null>(null);
  const [sug, setSug] = useState<Suggestion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [last, setLast] = useState<{ mode: "draft" | "rewrite" } | null>(null);

  const recipient = [contactName?.trim(), to ? `<${to}>` : ""].filter(Boolean).join(" ") || undefined;

  async function run(mode: "draft" | "rewrite", nextTone: Tone | null = tone) {
    if (mode === "rewrite" && !body.trim()) { setError("Write a message first, then rewrite it."); return; }
    if (mode === "draft" && !prompt.trim()) { setError("Say what the message should cover."); return; }
    setBusy(mode); setError(null);
    try {
      const action = nextTone ? TONES.find((t) => t.id === nextTone)?.action : "polish";
      const res = await fetch("/api/email/ai-compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          action,
          instruction: mode === "draft" ? `${prompt.trim()}${nextTone ? ` Tone: ${nextTone}.` : ""}` : undefined,
          currentText: body.trim() || undefined,
          subject: subject.trim() || undefined,
          to: recipient,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(typeof data.error === "string" ? data.error : "AI is unavailable right now."); return; }
      if (typeof data.body !== "string" || !data.body.trim()) { setError("AI returned nothing. Try again."); return; }
      setSug({ body: data.body.trim(), subject: typeof data.subject === "string" && data.subject ? data.subject : null, mode });
      setLast({ mode });
      setAskDraft(false);
    } catch {
      setError("AI is unavailable right now.");
    } finally {
      setBusy(null);
    }
  }

  function pickTone(t: Tone) {
    const next = tone === t ? null : t;
    setTone(next);
    // Changing tone with a suggestion open re-runs it in the new tone.
    if (sug && last) void run(last.mode, next);
  }

  function useIt() {
    if (!sug) return;
    onUseBody(sug.body);
    if (sug.mode === "draft" && sug.subject && !subject.trim()) onUseSubject(sug.subject);
    setSug(null);
  }

  const chip: React.CSSProperties = { fontSize: 12, padding: "4px 10px", borderRadius: 8, border: "0.5px solid #d7dbe3", background: "#fff", color: "#2C2C2A", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5 };
  const aiChip: React.CSSProperties = { ...chip, background: "#E6F1FB", color: "#185FA5", borderColor: "#B5D4F4" };
  const toneChip = (on: boolean): React.CSSProperties => ({ fontSize: 11.5, padding: "2px 10px", borderRadius: 999, border: "0.5px solid #d7dbe3", background: on ? "#2C2C2A" : "#fff", color: on ? "#fff" : "#5F5E5A", cursor: "pointer" });
  const disabled = busy !== null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <button type="button" disabled={disabled} onClick={() => { setAskDraft((v) => !v); setError(null); }} style={{ ...aiChip, opacity: disabled ? 0.6 : 1 }}>
          <i className="ti ti-sparkles" aria-hidden="true" /> AI draft
        </button>
        <button type="button" disabled={disabled} onClick={() => void run("rewrite")} style={{ ...aiChip, opacity: disabled ? 0.6 : 1 }}>
          <i className={`ti ${busy === "rewrite" ? "ti-loader-2" : "ti-wand"}`} aria-hidden="true" /> {busy === "rewrite" ? "Rewriting…" : "Rewrite"}
        </button>
        <span style={{ width: 1, height: 16, background: "#d7dbe3" }} />
        <span style={{ fontSize: 11.5, color: "#5F5E5A" }}>Tone</span>
        {TONES.map((t) => (
          <button key={t.id} type="button" aria-pressed={tone === t.id} disabled={disabled} onClick={() => pickTone(t.id)} style={toneChip(tone === t.id)}>{t.label}</button>
        ))}
      </div>

      {askDraft && (
        <div style={{ display: "flex", gap: 6 }}>
          <input
            autoFocus
            value={prompt}
            onChange={(e) => { setPrompt(e.target.value); setError(null); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void run("draft"); } }}
            placeholder="Follow up after today's call, send the Basic plan link"
            aria-label="What should the message say"
            style={{ flex: 1, fontSize: 12.5, padding: "7px 10px", borderRadius: 8, border: "0.5px solid #B5D4F4", boxSizing: "border-box" }}
          />
          <button type="button" disabled={disabled} onClick={() => void run("draft")} style={{ ...aiChip, opacity: disabled ? 0.6 : 1 }}>
            {busy === "draft" ? "Drafting…" : "Draft"}
          </button>
        </div>
      )}

      {error && <div role="alert" style={{ fontSize: 12, color: "#A32D2D" }}>{error}</div>}

      {sug && (
        <div style={{ border: "0.5px solid #85B7EB", borderRadius: 8, padding: "10px 12px", background: "#fff" }}>
          <div style={{ fontSize: 11.5, color: "#185FA5", display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
            <i className="ti ti-sparkles" aria-hidden="true" /> AI suggestion{tone ? ` · ${TONES.find((t) => t.id === tone)?.label}` : ""}
          </div>
          {sug.mode === "draft" && sug.subject && !subject.trim() && (
            <div style={{ fontSize: 12, color: "#5F5E5A", marginBottom: 4 }}>Subject: {sug.subject}</div>
          )}
          <div style={{ fontSize: 12.5, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{sug.body}</div>
          <div style={{ display: "flex", gap: 6, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button type="button" onClick={useIt} style={{ ...chip, background: "#2C2C2A", color: "#fff", borderColor: "#2C2C2A" }}><i className="ti ti-check" aria-hidden="true" /> Use this</button>
            <button type="button" disabled={disabled} onClick={() => last && void run(last.mode)} style={chip}><i className="ti ti-refresh" aria-hidden="true" /> {busy ? "Working…" : "Regenerate"}</button>
            <button type="button" onClick={() => setSug(null)} style={chip}><i className="ti ti-arrow-back-up" aria-hidden="true" /> Keep mine</button>
          </div>
        </div>
      )}
    </div>
  );
}
