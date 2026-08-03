"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * AI-first mode (spec §8) — a full-screen conversational shell. Opens by default
 * on the home page AND on /events (context-aware greeting, prompts, and a live
 * next-event card), and anywhere via the `icapos:open-ai-first` event. Uses the
 * guardrailed `assistant` task; renders the returned `card` enum as a routing
 * card. Never promises funding; output is server-validated + guardrailed.
 */

type Msg = { role: "user" | "assistant"; content: string };
type Card = "none" | "readiness" | "pricing" | "demo" | "events" | "match" | "founders" | "investors";
type Ctx = "home" | "events";

export type NextEvent = {
  title: string;
  city: string | null;
  starts_at: string | null;
  kind: string | null;
  registration_open: boolean | null;
} | null;

const INTRO: Record<Ctx, { title: string; sub: string; placeholder: string }> = {
  home: {
    title: "What are you trying to do?",
    sub: "Tell me whether you're raising or investing and I'll take you to the right place. Nothing here offers or sells securities.",
    placeholder: "Type what you're trying to do…",
  },
  events: {
    title: "What would you like to know about our events?",
    sub: "Ask about the next expo, how to register, or presenting to investors. iCFO events are free to attend.",
    placeholder: "Ask about iCFO events…",
  },
};

const OPENERS: Record<Ctx, string[]> = {
  home: [
    "I'm a founder raising a seed round",
    "I'm an investor looking for climate deals",
    "How does it work?",
    "Can I book a demo?",
  ],
  events: [
    "When's the next expo?",
    "How do I register?",
    "Can my company present?",
    "Where are events held?",
  ],
};

const CARD_META: Record<Exclude<Card, "none">, { title: string; body: string; href?: string; cta: string; demo?: boolean }> = {
  readiness: { title: "Capital Readiness Rating", body: "Free, structured, and scored across five dimensions investors screen on.", href: "/readiness", cta: "Open the rating" },
  pricing: { title: "Plans & pricing", body: "Two self-serve plans. The readiness rating is free with no card.", href: "/pricing", cta: "See pricing" },
  demo: { title: "Book a 30-minute demo", body: "Optional walkthrough — everything is self-serve without one.", cta: "Book a demo", demo: true },
  events: { title: "iCFO events", body: "Expos and conferences where matched founders meet investors in person.", href: "/events", cta: "See events" },
  match: { title: "How matching works", body: "Mandate-based fit scoring over rated companies — set yours and watch the list rebuild.", href: "/investors", cta: "Explore matching" },
  founders: { title: "For founders", body: "iCapOS rates readiness, builds your matched list, and distributes your materials.", href: "/founders", cta: "For founders" },
  investors: { title: "For investors", body: "Rated deal flow at a volume you set — free accounts, your mandate, your cap.", href: "/investors", cta: "For investors" },
};

function contextFor(pathname: string): Ctx {
  return pathname === "/events" || pathname.startsWith("/events/") ? "events" : "home";
}
function isAutoOpen(pathname: string): boolean {
  return pathname === "/" || contextFor(pathname) === "events";
}
function fmtEventDate(iso: string | null): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat(undefined, { month: "long", day: "numeric", year: "numeric" }).format(new Date(iso));
}

export function AiFirstMode({ nextEvent = null }: { nextEvent?: NextEvent }) {
  const pathname = usePathname() ?? "/";
  const ctx = contextFor(pathname);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [chips, setChips] = useState<string[]>([]); // AI follow-up chips (openers come from ctx)
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

  // Open by default on "/" and "/events" unless ?pages=1 or the visitor already
  // chose to browse this context this session. Full page is server-rendered
  // beneath, so crawlers and no-JS visitors are unaffected (§10).
  useEffect(() => {
    if (!isAutoOpen(pathname)) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("pages") === "1") return;
    if (sessionStorage.getItem(`icapos-aifirst-dismissed:${ctx}`) === "1") return;
    const id = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(id);
  }, [pathname, ctx]);

  /** Dismiss AI-first: remember for the session per context and, where it
   *  auto-opens, reflect it in the URL (?pages=1). pushState is guarded (§15). */
  function close() {
    setOpen(false);
    try { sessionStorage.setItem(`icapos-aifirst-dismissed:${ctx}`, "1"); } catch { /* ignore */ }
    if (isAutoOpen(pathname)) {
      try {
        const url = new URL(window.location.href);
        url.searchParams.set("pages", "1");
        window.history.pushState(null, "", url);
      } catch { /* origin-less frame — ignore */ }
    }
  }

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
        body: JSON.stringify({ task: "assistant", messages: next, context: { sessionId: sessionId.current, page: ctx } }),
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

  // When closed, a persistent bottom-right launcher reopens the full-screen mode.
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open AI mode"
        className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-site-blue px-5 py-3 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-site-blue-hi"
      >
        <span aria-hidden="true">✦</span> AI Mode
      </button>
    );
  }

  const meta = card !== "none" ? CARD_META[card] : null;
  const empty = messages.length === 0;
  const intro = INTRO[ctx];

  const openerRow = (
    <div className="flex flex-wrap justify-center gap-2">
      {OPENERS[ctx].map((c) => (
        <button key={c} type="button" onClick={() => send(c)} className="rounded-full border border-white/15 bg-white/[0.04] px-3.5 py-1.5 text-[13px] text-white/85 transition-colors hover:border-site-blue-lt hover:text-white">{c}</button>
      ))}
    </div>
  );

  const inputForm = (
    <>
      <form onSubmit={(e) => { e.preventDefault(); const input = e.currentTarget.elements.namedItem("q") as HTMLInputElement; send(input.value); input.value = ""; }} className="flex gap-2">
        <input name="q" autoFocus autoComplete="off" placeholder={intro.placeholder} className="flex-1 rounded-xl border border-white/15 bg-white/[0.06] px-4 py-3 text-sm text-white placeholder-white/40 outline-none focus:border-site-blue-lt" />
        <button type="submit" disabled={busy} className="rounded-xl bg-site-blue px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-site-blue-hi disabled:opacity-60">Send</button>
      </form>
      <p className={`mt-3 font-site-mono text-[10px] leading-4 text-white/40 ${empty ? "text-center" : ""}`}>iCapOS does not offer or sell securities, provide investment advice, or process transactions. Answers are informational and may be imperfect.</p>
    </>
  );

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-gradient-to-b from-site-navy via-site-navy-2 to-site-navy-3 text-white" role="dialog" aria-modal="true" aria-label="AI-first mode">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-6 py-5">
        <div className="font-site-display text-lg font-extrabold tracking-tight">iCap<span className="text-site-blue-lt">OS</span> <span className="ml-2 align-middle font-site-mono text-[11px] font-medium uppercase tracking-wider text-white/50">AI mode{ctx === "events" ? " · events" : ""}</span></div>
        <button type="button" onClick={close} className="rounded-lg border border-white/20 px-3 py-1.5 text-sm font-medium text-white/80 transition-colors hover:border-white/40 hover:text-white">Browse the site instead</button>
      </div>

      {empty ? (
        <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-7 px-6 pb-10">
          <div className="text-center">
            <h2 className="font-site-display text-3xl font-extrabold tracking-tight sm:text-4xl">{intro.title}</h2>
            <p className="mx-auto mt-3 max-w-md text-white/65">{intro.sub}</p>
          </div>

          {ctx === "events" && nextEvent ? (
            <div className="w-full rounded-2xl border border-site-blue-lt/35 bg-site-blue/15 px-5 py-4 text-left">
              <div className="flex items-center justify-between gap-3">
                <div className="font-site-mono text-[10px] uppercase tracking-[0.12em] text-site-blue-lt">Next event{nextEvent.registration_open ? " · registration open" : ""}</div>
                {nextEvent.kind ? <span className="rounded-full bg-site-amber/15 px-2.5 py-0.5 font-site-mono text-[10px] capitalize text-site-amber">{nextEvent.kind}</span> : null}
              </div>
              <div className="mt-2 text-lg font-medium text-white">{nextEvent.title}</div>
              {nextEvent.starts_at || nextEvent.city ? (
                <div className="mt-0.5 text-[13px] text-white/60">{[fmtEventDate(nextEvent.starts_at), nextEvent.city].filter(Boolean).join(" · ")}</div>
              ) : null}
              <Link href="/events" target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-site-blue px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-site-blue-hi">Register <span aria-hidden="true">↗</span></Link>
            </div>
          ) : null}

          {openerRow}
          <div className="w-full">{inputForm}</div>
        </div>
      ) : (
        <>
          <div ref={logRef} role="log" aria-live="polite" className="mx-auto w-full max-w-3xl flex-1 space-y-4 overflow-y-auto px-6 pb-4">
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
                  <Link href={meta.href!} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-site-blue px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-site-blue-hi">{meta.cta} <span aria-hidden="true">↗</span></Link>
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
            {inputForm}
          </div>
        </>
      )}
    </div>
  );
}
