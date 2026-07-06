"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Facts = { open: number; won: number; pipelineValueUsd: number; wonValueUsd: number; stalled: { title: string; days: number }[]; byStage: { stage: string; count: number }[] };
type Msg = { role: "user" | "assistant"; content: string };
const QUICK = ["What should I focus on today?", "Which deals are at risk?", "How do I move stalled opps?"];

export function SalesAdvisor() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/sales/assistant");
      if (!res.ok) return;
      const data = await res.json();
      const f = data.status as Facts;
      const line = `You have ${f.open} open opportunit${f.open === 1 ? "y" : "ies"} worth $${f.pipelineValueUsd.toLocaleString()}${f.stalled.length ? `, and ${f.stalled.length} stalled 14+ days` : ""}.`;
      setSummary(line);
      setMessages([{ role: "assistant", content: `${line} Ask me where to focus.` }]);
    } catch { /* ignore */ }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- load status on mount
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, open]);

  async function send(text: string) {
    const msg = text.trim();
    if (!msg || sending) return;
    setInput("");
    const history = messages;
    setMessages((p) => [...p, { role: "user", content: msg }]);
    setSending(true);
    try {
      const res = await fetch("/api/sales/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: msg, history }) });
      const data = await res.json();
      setMessages((p) => [...p, { role: "assistant", content: data.reply ?? data.error ?? "No response." }]);
    } catch { setMessages((p) => [...p, { role: "assistant", content: "Something went wrong." }]); }
    finally { setSending(false); }
  }

  return (
    <>
      {/* Collapsed card */}
      <button onClick={() => setOpen(true)} style={{ textAlign: "left", background: "#EEF2FF", border: "0.5px solid #C7D2FE", borderRadius: 12, padding: 16, cursor: "pointer", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 26, height: 26, borderRadius: 8, background: "#fff", color: "#4338CA", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><i className="ti ti-sparkles" aria-hidden="true" /></span>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#3730A3" }}>AI sales advisor</div>
        </div>
        <div style={{ fontSize: 12, color: "#4338CA", marginTop: 10, lineHeight: 1.5 }}>{summary ?? "Suggests your next best actions — grounded in your live pipeline."}</div>
        <div style={{ fontSize: 11.5, fontWeight: 600, color: "#3730A3", marginTop: 10 }}>Open advisor <i className="ti ti-arrow-up-right" aria-hidden="true" /></div>
      </button>

      {/* Popup */}
      {open && (
        <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, background: "#fff", borderRadius: 12, overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: "80vh" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", borderBottom: "0.5px solid #e2e6ed" }}>
              <span style={{ width: 24, height: 24, borderRadius: 6, background: "#EEF2FF", color: "#4338CA", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><i className="ti ti-sparkles" aria-hidden="true" /></span>
              <div style={{ fontSize: 13, fontWeight: 500 }}>AI sales advisor</div>
              <span style={{ marginLeft: "auto", fontSize: 10.5, color: "#0F6E56", background: "#E1F5EE", borderRadius: 8, padding: "2px 8px" }}>grounded in your data</span>
              <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)", fontSize: 16, marginLeft: 4 }}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
              {messages.map((m, i) => (
                <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                  <div style={{ maxWidth: "88%", fontSize: 12.5, lineHeight: 1.55, borderRadius: m.role === "user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px", background: m.role === "user" ? "#E6F1FB" : "var(--muted)", color: m.role === "user" ? "#0C447C" : "var(--foreground)", padding: "9px 12px", whiteSpace: "pre-wrap" }}>{m.content}</div>
                </div>
              ))}
              {sending && <div style={{ fontSize: 11.5, color: "var(--muted-foreground)" }}>Thinking…</div>}
              <div ref={bottomRef} />
            </div>
            <div style={{ padding: "0 16px 12px" }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "10px 0" }}>
                {QUICK.map((q) => <button key={q} onClick={() => send(q)} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "0.5px solid var(--border)", background: "transparent", color: "var(--muted-foreground)", cursor: "pointer" }}>{q}</button>)}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send(input)} placeholder="Ask about your pipeline…" style={{ flex: 1, fontSize: 12.5, padding: "8px 12px", borderRadius: 8, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--foreground)" }} />
                <button onClick={() => send(input)} disabled={sending || !input.trim()} style={{ fontSize: 12.5, padding: "8px 15px", borderRadius: 8, border: "none", background: "#2E78F5", color: "#fff", cursor: "pointer", opacity: sending || !input.trim() ? 0.5 : 1 }}>Send</button>
              </div>
              <div style={{ fontSize: 10.5, color: "var(--muted-foreground)", marginTop: 8 }}>Suggests — you decide. Nothing sends automatically.</div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
