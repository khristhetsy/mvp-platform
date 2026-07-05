"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Facts = { open: number; won: number; pipelineValueUsd: number; wonValueUsd: number; stalled: { title: string; days: number }[]; byStage: { stage: string; count: number }[] };
type Msg = { role: "user" | "assistant"; content: string };
const QUICK = ["What should I focus on today?", "Which deals are at risk?", "How do I move stalled opps?"];

export function SalesAdvisor() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/sales/assistant");
      if (!res.ok) return;
      const data = await res.json();
      const f = data.status as Facts;
      setMessages([{ role: "assistant", content: `You have ${f.open} open opportunit${f.open === 1 ? "y" : "ies"} worth $${f.pipelineValueUsd.toLocaleString()}${f.stalled.length ? `, and ${f.stalled.length} stalled 14+ days` : ""}. Ask me where to focus.` }]);
    } catch { /* ignore */ }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- load status on mount
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

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
    <div style={{ background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 12, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", borderBottom: "0.5px solid #e2e6ed" }}>
        <span style={{ width: 26, height: 26, borderRadius: "50%", background: "#2E78F5", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700 }}>AI</span>
        <div><div style={{ fontSize: 13, fontWeight: 500 }}>Sales advisor</div><div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Suggests next actions · you decide</div></div>
      </div>
      <div style={{ maxHeight: 260, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={{ maxWidth: "88%", fontSize: 12.5, lineHeight: 1.55, borderRadius: m.role === "user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px", background: m.role === "user" ? "#EEF2FF" : "var(--muted)", color: m.role === "user" ? "#26215C" : "var(--foreground)", padding: "9px 12px" }}>{m.content}</div>
          </div>
        ))}
        {sending && <div style={{ fontSize: 11.5, color: "var(--muted-foreground)" }}>Thinking…</div>}
        <div ref={bottomRef} />
      </div>
      <div style={{ padding: "0 16px 12px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
          {QUICK.map((q) => <button key={q} onClick={() => send(q)} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "0.5px solid var(--border)", background: "transparent", color: "var(--muted-foreground)", cursor: "pointer" }}>{q}</button>)}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send(input)} placeholder="Ask the sales advisor…" style={{ flex: 1, fontSize: 12.5, padding: "8px 12px", borderRadius: 8, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--foreground)" }} />
          <button onClick={() => send(input)} disabled={sending || !input.trim()} style={{ fontSize: 12.5, padding: "8px 15px", borderRadius: 8, border: "none", background: "#2E78F5", color: "#fff", cursor: "pointer", opacity: sending || !input.trim() ? 0.5 : 1 }}>Send</button>
        </div>
      </div>
    </div>
  );
}
