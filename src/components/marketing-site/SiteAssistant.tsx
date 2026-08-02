"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Floating iCapOS assistant (spec §5, §7, §11). Calls the secured /api/ai proxy
 * with task "assistant" — never a client-supplied prompt. Opens from its own FAB
 * or when the nav "Ask AI" button dispatches the `icapos:open-assistant` event.
 * Conversation stream is role="log" + aria-live="polite"; results are role="status".
 * Fails gracefully on rate limits / errors.
 */

type Msg = { role: "user" | "assistant"; content: string };

const GREETING =
  "Hi — I can explain how matching works, what's in each plan, how the readiness rating is scored, or what happens at an iCFO event. What would you like to know?";
const STARTERS = [
  "How does it work?",
  "Can I book a demo?",
  "Do you guarantee I'll raise money?",
];

export function SiteAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [chips, setChips] = useState<string[]>(STARTERS);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const sessionId = useRef<string>("");

  useEffect(() => {
    if (!sessionId.current) sessionId.current = crypto.randomUUID();
    const openHandler = () => setOpen(true);
    window.addEventListener("icapos:open-assistant", openHandler);
    return () => window.removeEventListener("icapos:open-assistant", openHandler);
  }, []);

  useEffect(() => {
    if (open && logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [messages, open]);

  async function send(text: string) {
    const clean = text.trim();
    if (!clean || busy) return;
    const next: Msg[] = [...messages, { role: "user", content: clean }];
    setMessages(next);
    setChips([]);
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-ai-session": sessionId.current },
        body: JSON.stringify({ task: "assistant", messages: next, context: { sessionId: sessionId.current } }),
      });
      if (res.status === 429) {
        const d = await res.json().catch(() => null);
        setNote(d?.error ?? "You've hit the request limit — please try again shortly.");
        setBusy(false);
        return;
      }
      const data = (await res.json().catch(() => null)) as { ok?: boolean; data?: { say?: string; chips?: string[] } } | null;
      const say = data?.data?.say;
      if (data?.ok && say) {
        setMessages((m) => [...m, { role: "assistant", content: say }]);
        setChips(Array.isArray(data.data?.chips) ? data.data!.chips!.slice(0, 4) : []);
      } else {
        setNote("Sorry — I couldn't answer that just now. Please try again.");
      }
    } catch {
      setNote("Network trouble reaching the assistant. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open the iCapOS assistant"
          className="fixed bottom-5 right-5 z-40 rounded-full bg-site-blue px-5 py-3 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-site-blue-hi"
        >
          Ask AI
        </button>
      ) : (
        <div className="fixed bottom-5 right-5 z-50 flex h-[min(560px,80vh)] w-[min(380px,92vw)] flex-col overflow-hidden rounded-2xl border border-site-line bg-white shadow-2xl">
          <div className="flex items-center justify-between bg-site-navy px-4 py-3 text-white">
            <div>
              <div className="text-sm font-semibold">iCapOS assistant</div>
              <div className="font-site-mono text-[10px] text-white/50">Answers about the platform, plans and events</div>
            </div>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("icapos:open-demo"))} className="rounded-md bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white transition-colors hover:bg-white/20">Book a demo</button>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close assistant" className="text-white/70 hover:text-white">✕</button>
            </div>
          </div>

          <div ref={logRef} role="log" aria-live="polite" className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            <div className="rounded-xl bg-site-paper px-3 py-2.5 text-[13px] leading-6 text-site-ink">{GREETING}</div>
            {messages.length === 0 && chips.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {chips.map((c) => (<button key={c} type="button" onClick={() => send(c)} className="rounded-full border border-site-line bg-white px-3 py-1 text-[12px] text-site-ink transition-colors hover:border-site-blue-hi hover:text-site-blue-hi">{c}</button>))}
              </div>
            ) : null}
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "ml-auto max-w-[85%] rounded-xl bg-site-blue px-3 py-2 text-[13px] leading-6 text-white" : "max-w-[90%] rounded-xl bg-site-paper px-3 py-2.5 text-[13px] leading-6 text-site-ink"}>{m.content}</div>
            ))}
            {busy ? <div className="font-site-mono text-[11px] text-site-muted" role="status">Thinking…</div> : null}
            {note ? <div className="rounded-xl bg-site-amber/10 px-3 py-2 text-[12px] text-site-amber" role="status">{note}</div> : null}
          </div>

          {messages.length > 0 && chips.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 px-4 pb-2">
              {chips.map((c) => (<button key={c} type="button" onClick={() => send(c)} className="rounded-full border border-site-line bg-white px-3 py-1 text-[12px] text-site-ink transition-colors hover:border-site-blue-hi hover:text-site-blue-hi">{c}</button>))}
            </div>
          ) : null}

          <form
            onSubmit={(e) => { e.preventDefault(); const input = e.currentTarget.elements.namedItem("q") as HTMLInputElement; send(input.value); input.value = ""; }}
            className="flex gap-2 border-t border-site-line p-3"
          >
            <input name="q" autoComplete="off" placeholder="Ask a question" className="flex-1 rounded-lg border border-site-line px-3 py-2 text-sm text-site-ink outline-none focus:border-site-blue-hi" />
            <button type="submit" disabled={busy} className="rounded-lg bg-site-blue px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-site-blue-hi disabled:opacity-60">Send</button>
          </form>
          <p className="px-3 pb-3 font-site-mono text-[10px] leading-4 text-site-muted/70">Informational only — not investment advice, and iCapOS never offers or sells securities. Answers may be imperfect.</p>
        </div>
      )}
    </>
  );
}
