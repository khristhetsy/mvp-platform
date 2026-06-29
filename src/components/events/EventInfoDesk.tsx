"use client";

import { useRef, useState } from "react";
import { Sparkles, X, Send } from "lucide-react";

type Msg = { role: "user" | "assistant"; content: string };

const QUICK = [
  "What's next on the agenda?",
  "Where do I go?",
  "Who should I meet?",
  "How do I earn badges?",
];

/** Floating "Info Desk" launcher that opens the event AI assistant. Present on
 *  every venue page so attendees can ask without leaving where they are. */
export function EventInfoDesk({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Hi! I'm your event guide. Ask me where to go, what's next, or who you should meet." },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    const history = messages.filter((m) => m.content);
    setMessages((prev) => [...prev, { role: "user", content: message }]);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch(`/api/events/${slug}/assistant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history: history.slice(-8) }),
      });
      const json = await res.json();
      const reply = typeof json.reply === "string" ? json.reply : "I couldn't answer that just now.";
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "I couldn't reach the assistant — try the Lobby or Agenda." }]);
    } finally {
      setBusy(false);
      requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: "smooth" }));
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-[90] flex items-center gap-2 rounded-full px-4 py-3 text-sm font-medium text-white shadow-lg"
        style={{ background: "#0c2340" }}
      >
        <Sparkles className="h-4 w-4" style={{ color: "#5DCAA5" }} aria-hidden />
        Info Desk
      </button>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 z-[90] flex h-[460px] w-[min(360px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-white shadow-2xl">
      <div className="flex items-center justify-between px-4 py-3" style={{ background: "#0c2340" }}>
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "#16294a", color: "#5DCAA5" }}>
            <Sparkles className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-medium text-white">Event Assistant</p>
            <p className="text-[11px]" style={{ color: "#8e9bb0" }}>Info &amp; Help Desk</p>
          </div>
        </div>
        <button onClick={() => setOpen(false)} aria-label="Close" className="text-white/70 hover:text-white">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 space-y-2.5 overflow-y-auto px-3.5 py-3">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
              m.role === "user"
                ? "ml-auto rounded-br-sm bg-[var(--navy)] text-white"
                : "mr-auto rounded-bl-sm bg-[var(--surface-sunken)] text-[var(--text-primary)]"
            }`}
          >
            {m.content}
          </div>
        ))}
        {busy && <div className="mr-auto rounded-2xl bg-[var(--surface-sunken)] px-3 py-2 text-sm text-[var(--text-muted)]">…</div>}
        <div ref={endRef} />
      </div>

      {messages.length <= 1 && (
        <div className="flex flex-wrap gap-1.5 px-3.5 pb-2">
          {QUICK.map((q) => (
            <button
              key={q}
              onClick={() => send(q)}
              className="rounded-full border border-[var(--border-subtle)] px-2.5 py-1 text-xs text-[var(--text-secondary)] hover:bg-slate-50"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2 border-t border-[var(--border-subtle)] p-2.5">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send(input)}
          placeholder="Ask anything about the event…"
          maxLength={500}
          className="flex-1 rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-sm"
        />
        <button
          onClick={() => send(input)}
          disabled={!input.trim() || busy}
          aria-label="Send"
          className="rounded-lg px-3 text-white disabled:opacity-50"
          style={{ background: "#0c2340" }}
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
