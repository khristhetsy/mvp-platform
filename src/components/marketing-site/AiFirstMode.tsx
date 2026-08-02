"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * AI-first mode (spec §8). A full-screen conversational shell the visitor can use
 * instead of clicking through the site. Opens on the `icapos:open-ai-first` event.
 * Uses the same guardrailed `assistant` task, but renders the returned `card`
 * enum as a routing card so answers lead somewhere concrete. Never promises
 * funding; the model output is server-validated + guardrailed before it arrives.
 */

type Msg = { role: "user" | "assistant"; content: string };
type Card = "none" | "readiness" | "pricing" | "demo" | "events" | "match" | "founders" | "investors";

const OPENERS = [
  "I'm a founder raising a seed round",
  "I'm an investor looking for climate deals",
  "How does the readiness rating work?",
  "What do the two plans cost?",
  "Can I book a demo?",
];

// card enum → a concrete next step.
const CARD_META: Record<Exclude<Card, "none">, { title: string; body: string; href?: string; cta: string; demo?: boolean }> = {
  readiness: { title: "Capital Readiness Rating", body: "Free, structured, and scored across five dimensions investors screen on.", href: "/readiness", cta: "Open the rating" },
  pricing: { title: "Plans & pricing", body: "Two self-serve plans. The readiness rating is free with no card.", href: "/pricing", cta: "See pricing" },
  demo: { title: "Book a 30-minute demo", body: "Optional walkthrough — everything is self-serve without one.", cta: "Book a demo", demo: true },
  events: { title: "iCFO events", body: "Expos and conferences where matched founders meet investors in person.", href: "/events", cta: "See events" },
  match: { title: "How matching works", body: "Mandate-based fit scoring over rated companies — set yours and watch the list rebuild.", href: "/investors", cta: "Explore matching" },
  founders: { title: "For founders", body: "iCapOS rates readiness, builds your matched list, and distributes your materials.", href: "/founders", cta: "For founders" },
  investors: { title: "For investors", body: "Rated deal flow at a volume you set — free accounts, your mandate, your cap.", href: "/investors", cta: "For investors" },
};

export function AiFirstMode() {
  const pathname = usePathname() ?? "/";
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [chips, setChips] = useState<string[]>(OPENERS);
  const [card, setCard] = useState<Card>("none");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const sessionId = useRef<string>("");

  useEffect(() => {
    if (!sessionId.current) sessionId.current = crypto.randomUUID();
    const openHandler = () => setOpen(true);
    window.addEventListener("icapos:open-ai-first", openHandler);
    return () => window.removeEventListener("icapos:open-ai-first", openHandler);
  }, []);

  // Open by default at "/" unless ?pages=1 or the visitor already chose to browse
  // this session (§3). The full home is server-rendered beneath, so crawlers and
  // no-JS visitors are unaffected (§10).
  useEffect(() => {
    if (pathname !== "/") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("pages") === "1") return;
    if (sessionStorage.getItem("icapos-aifirst-dismissed") === "1") return;
    const id = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(id);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", onKey); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [messages, card]);

  /** Dismiss AI-first: remember the choice for the session and, on home, reflect
   *  it in the URL (?pages=1) so reloads/deep-links go straight to the pages.
   *  pushState is guarded (§15) so origin-less/sandboxed frames don't throw. */
  function close() {
    setOpen(false);
    try { sessionStorage.setItem("icapos-aifirst-dismissed", "1"); } catch { /* ignore */ }
    if (pathname === "/") {
      try {
        const url = new URL(window.location.href);
        url.searchParams.set("pages", "1");
        window.history.pushState(null, "", url);
      } catch { /* origin-less frame — ignore */ }
    }
  }

  async function send(text: string) {
    const clean = text.trim();
    if (!clean || busy) return;
    const next: Msg[] = [...messages, { role: "user", content: clean }];
    setMessages(next);
    setChips([]);
    setCard("none");
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
        return;
      }
      const data = (await res.json().catch(() => null)) as { ok?: boolean; data?: { say?: string; card?: Card; chips?: string[] } } | null;
      const say = data?.data?.say;
      if (data?.ok && say) {
        setMessages((m) => [...m, { role: "assistant", content: say }]);
        setChips(Array.isArray(data.data?.chips) ? data.data!.chips!.slice(0, 5) : []);
        setCard((data.data?.card as Card) ?? "none");
      } else {
        setNote("Sorry — I couldn't answer that just now. Please try again.");
      }
    } catch {
      setNote("Network trouble reaching the assistant. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;
  const meta = card !== "none" ? CARD_META[card] : null;

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-gradient-to-b from-site-navy via-site-navy-2 to-site-navy-3 text-white" role="dialog" aria-modal="true" aria-label="AI-first mode">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-6 py-5">
        <div className="font-site-display text-lg font-extrabold tracking-tight">iCap<span className="text-site-blue-lt">OS</span> <span className="ml-2 align-middle font-site-mono text-[11px] font-medium uppercase tracking-wider text-white/50">AI mode</span></div>
        <button type="button" onClick={close} className="rounded-lg border border-white/20 px-3 py-1.5 text-sm font-medium text-white/80 transition-colors hover:border-white/40 hover:text-white">Browse the site instead</button>
      </div>

      <div ref={logRef} role="log" aria-live="polite" className="mx-auto w-full max-w-3xl flex-1 space-y-4 overflow-y-auto px-6 pb-4">
        {messages.length === 0 ? (
          <div className="pt-6 text-center">
            <h2 className="font-site-display text-3xl font-extrabold tracking-tight sm:text-4xl">What are you trying to do?</h2>
            <p className="mx-auto mt-3 max-w-md text-white/65">Tell me whether you&apos;re raising or investing and I&apos;ll take you to the right place. Nothing here offers or sells securities.</p>
          </div>
        ) : null}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "ml-auto max-w-[85%] rounded-2xl bg-site-blue px-4 py-2.5 text-[14px] leading-6 text-white" : "max-w-[90%] rounded-2xl bg-white/[0.06] px-4 py-3 text-[14px] leading-7 text-white/90"}>{m.content}</div>
        ))}
        {busy ? <div className="font-site-mono text-[12px] text-white/50" role="status">Thinking…</div> : null}
        {note ? <div className="rounded-xl bg-site-amber/15 px-4 py-2.5 text-[13px] text-site-amber" role="status">{note}</div> : null}

        {meta ? (
          <div className="rounded-2xl border border-site-blue-lt/25 bg-site-blue/10 p-5" role="status">
            <div className="font-site-display text-lg font-bold">{meta.title}</div>
            <p className="mt-1 text-[14px] leading-6 text-white/75">{meta.body}</p>
            {meta.demo ? (
              <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("icapos:open-demo"))} className="mt-4 inline-block rounded-lg bg-site-blue px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-site-blue-hi">{meta.cta}</button>
            ) : (
              <Link href={meta.href!} onClick={close} className="mt-4 inline-block rounded-lg bg-site-blue px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-site-blue-hi">{meta.cta} →</Link>
            )}
          </div>
        ) : null}
      </div>

      <div className="mx-auto w-full max-w-3xl px-6 pb-6">
        {chips.length > 0 ? (
          <div className="mb-3 flex flex-wrap gap-2">
            {chips.map((c) => (<button key={c} type="button" onClick={() => send(c)} className="rounded-full border border-white/15 bg-white/[0.04] px-3.5 py-1.5 text-[13px] text-white/85 transition-colors hover:border-site-blue-lt hover:text-white">{c}</button>))}
          </div>
        ) : null}
        <form onSubmit={(e) => { e.preventDefault(); const input = e.currentTarget.elements.namedItem("q") as HTMLInputElement; send(input.value); input.value = ""; }} className="flex gap-2">
          <input name="q" autoFocus autoComplete="off" placeholder="Type what you're trying to do…" className="flex-1 rounded-xl border border-white/15 bg-white/[0.06] px-4 py-3 text-sm text-white placeholder-white/40 outline-none focus:border-site-blue-lt" />
          <button type="submit" disabled={busy} className="rounded-xl bg-site-blue px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-site-blue-hi disabled:opacity-60">Send</button>
        </form>
        <p className="mt-3 font-site-mono text-[10px] leading-4 text-white/40">iCapOS does not offer or sell securities, provide investment advice, or process transactions. Answers are informational and may be imperfect.</p>
      </div>
    </div>
  );
}
