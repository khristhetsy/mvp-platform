"use client";

// AI Operations Assistant — grounded co-pilot for a record. Shows the computed
// status/checklist (reliable, not AI) plus a Claude chat grounded on the same facts.

import { useCallback, useEffect, useRef, useState } from "react";

type Facts = {
  name: string; percent: number; overdueDays: number; pastDue: boolean;
  steps: { id: string; title: string; completed: boolean }[]; openTasks: string[];
};
type Msg = { role: "user" | "assistant"; content: string };

const QUICK = ["What's the fastest way to unblock this?", "Draft a reminder to the founder", "What should I check next?"];

export function OperationsAssistant({ entityType, entityId }: { entityType: string; entityId: string }) {
  const [facts, setFacts] = useState<Facts | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/operations/assistant?entityType=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(entityId)}`);
      if (!res.ok) return;
      const data = await res.json();
      const f = data.status as Facts;
      setFacts(f);
      const next = f.steps.find((s) => !s.completed);
      setMessages([{ role: "assistant", content: `${f.name} is ${f.percent}% onboarded${f.pastDue ? ` and ${f.overdueDays} days past SLA` : ""}. ${next ? `Next step: ${next.title}.` : "All onboarding steps look done."} Ask me how to move it forward.` }]);
    } catch { /* ignore */ }
  }, [entityType, entityId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- load grounded status on mount
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function send(text: string) {
    const msg = text.trim();
    if (!msg || sending) return;
    setInput("");
    const history = messages;
    setMessages((prev) => [...prev, { role: "user", content: msg }]);
    setSending(true);
    try {
      const res = await fetch("/api/operations/assistant", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityType, entityId, message: msg, history }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply ?? data.error ?? "No response." }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Something went wrong — try again." }]);
    } finally { setSending(false); }
  }

  return (
    <div style={{ border: "0.5px solid var(--border)", borderRadius: 8, overflow: "hidden", background: "#fff", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: "0.5px solid var(--border)" }}>
        <span style={{ width: 22, height: 22, borderRadius: "50%", background: "#2E78F5", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700 }}>AI</span>
        <span style={{ fontSize: 12, fontWeight: 600 }}>Operations assistant</span>
        {facts && <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 700, color: facts.pastDue ? "#A32D2D" : "#0F6E56", background: facts.pastDue ? "#FCEBEB" : "#ECFDF5", borderRadius: 10, padding: "2px 8px" }}>{facts.percent}% · {facts.pastDue ? `${facts.overdueDays}d past SLA` : "on track"}</span>}
      </div>

      {facts && (
        <div style={{ padding: "8px 12px", borderBottom: "0.5px solid var(--border)", display: "flex", flexWrap: "wrap", gap: 6 }}>
          {facts.steps.map((s) => (
            <span key={s.id} style={{ fontSize: 10, display: "inline-flex", alignItems: "center", gap: 3, color: s.completed ? "#0F6E56" : "var(--muted-foreground)" }}>
              <span>{s.completed ? "✓" : "○"}</span>{s.title}
            </span>
          ))}
        </div>
      )}

      <div style={{ maxHeight: 220, overflowY: "auto", padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={{ maxWidth: "85%", fontSize: 12, lineHeight: 1.5, borderRadius: m.role === "user" ? "10px 10px 2px 10px" : "10px 10px 10px 2px", background: m.role === "user" ? "#EEF2FF" : "var(--muted)", color: m.role === "user" ? "#26215C" : "var(--foreground)", padding: "8px 11px" }}>{m.content}</div>
          </div>
        ))}
        {sending && <div style={{ fontSize: 11.5, color: "var(--muted-foreground)" }}>Thinking…</div>}
        <div ref={bottomRef} />
      </div>

      <div style={{ padding: "0 12px 10px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
          {QUICK.map((q) => <button key={q} onClick={() => send(q)} style={{ fontSize: 10.5, padding: "3px 8px", borderRadius: 6, border: "0.5px solid var(--border)", background: "transparent", color: "var(--muted-foreground)", cursor: "pointer" }}>{q}</button>)}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send(input)} placeholder="Ask the assistant…"
            style={{ flex: 1, fontSize: 12, padding: "7px 10px", borderRadius: 8, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--foreground)" }} />
          <button onClick={() => send(input)} disabled={sending || !input.trim()} style={{ fontSize: 12, padding: "7px 13px", borderRadius: 8, border: "none", background: "#2E78F5", color: "#fff", cursor: "pointer", opacity: sending || !input.trim() ? 0.5 : 1 }}>Send</button>
        </div>
      </div>
    </div>
  );
}
