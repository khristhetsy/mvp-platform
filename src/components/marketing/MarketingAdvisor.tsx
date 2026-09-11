"use client";

import { useState } from "react";

/**
 * AI Marketing Advisor for the Marketing dashboard. Reuses /api/marketing/cmo-chat
 * (which grounds itself in live 30-day email metrics). The funnel summary is passed in
 * the prompt so advice reflects where leads are stuck, not just deliverability.
 */
export function MarketingAdvisor({ funnelSummary }: { funnelSummary?: string }) {
  const [advice, setAdvice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  async function ask(question?: string) {
    setBusy(true);
    const message = question
      ?? `My lead funnel right now: ${funnelSummary ?? "unknown"}. Based on this and my live email metrics, what is the single highest-leverage thing to do next? Answer in 2–3 sentences.`;
    try {
      const res = await fetch("/api/marketing/cmo-chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const d = await res.json().catch(() => ({}));
      setAdvice(d.reply ?? d.error ?? "No suggestion available.");
    } catch { setAdvice("Couldn't reach the advisor."); }
    setBusy(false);
  }

  return (
    <div style={{ border: "0.5px solid #D6C9F5", background: "#F3EEFE", borderRadius: 12, padding: "10px 12px", marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 9 }}>
        <span style={{ width: 22, height: 22, borderRadius: "50%", background: "#6D28D9", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, flex: "none" }}>✦</span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#5B21B6" }}>AI Marketing Advisor</span>
            {!advice && !busy && <button type="button" onClick={() => { setOpen(true); void ask(); }} style={{ fontSize: 11.5, fontWeight: 500, color: "#6D28D9", background: "none", border: "none", cursor: "pointer" }}>Advise me →</button>}
            {busy && <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Thinking…</span>}
          </div>
          {advice
            ? <p style={{ margin: "4px 0 0", fontSize: 12, lineHeight: 1.5, color: "var(--foreground)" }}>{advice}</p>
            : <p style={{ margin: "2px 0 0", fontSize: 11.5, color: "var(--muted-foreground)" }}>Grounded in your live funnel and email metrics.</p>}
          {open ? (
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && q.trim()) void ask(q.trim()); }}
                placeholder="Ask a question…" style={{ flex: 1, minWidth: 0, fontSize: 12, padding: "6px 9px", borderRadius: 7, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--foreground)" }} />
              <button type="button" disabled={busy || !q.trim()} onClick={() => void ask(q.trim())} style={{ fontSize: 11.5, fontWeight: 500, color: "#fff", background: "#6D28D9", border: "none", borderRadius: 7, padding: "6px 12px", cursor: "pointer", opacity: busy || !q.trim() ? 0.5 : 1 }}>Ask</button>
            </div>
          ) : advice ? <button type="button" onClick={() => setOpen(true)} style={{ marginTop: 6, fontSize: 11, color: "#6D28D9", background: "none", border: "none", cursor: "pointer" }}>Ask a follow-up…</button> : null}
        </div>
      </div>
    </div>
  );
}
