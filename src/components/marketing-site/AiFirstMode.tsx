"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * AI-first mode (spec §8) — a full-screen conversational shell, context-aware per
 * page. Auto-opens on "/" and "/events"; opens on-click anywhere else, tailored
 * to the page you're on. Bottom line is signup: a persistent "Get started" button
 * (→ /auth/sign-up) stays visible in every context. Uses the guardrailed
 * `assistant` task; never promises funding.
 */

type Msg = { role: "user" | "assistant"; content: string };
type Card = "none" | "readiness" | "pricing" | "demo" | "events" | "match" | "founders" | "investors";
type Ctx = "home" | "events" | "founders" | "investors" | "pricing" | "readiness" | "about";

export type NextEvent = {
  title: string;
  city: string | null;
  starts_at: string | null;
  kind: string | null;
  registration_open: boolean | null;
} | null;

type CtxConfig = { label: string; title: string; sub: string; placeholder: string; openers: string[] };

const SIGNUP = "/auth/sign-up";

const CONTEXTS: Record<Ctx, CtxConfig> = {
  home: {
    label: "",
    title: "What are you trying to do?",
    sub: "Tell me whether you're raising or investing and I'll take you to the right place. Nothing here offers or sells securities.",
    placeholder: "Type what you're trying to do…",
    openers: ["I'm a founder raising a seed round", "I'm an investor looking for climate deals", "How does it work?", "How do I get started?"],
  },
  events: {
    label: "events",
    title: "What would you like to know about our events?",
    sub: "Ask about the next expo, how to register, or presenting to investors. iCFO events are free to attend.",
    placeholder: "Ask about iCFO events…",
    openers: ["When's the next expo?", "How do I register?", "Can my company present?", "How do I attend as an investor?", "How do I become a panelist?"],
  },
  founders: {
    label: "founders",
    title: "What do you want to sort out for your raise?",
    sub: "Ask how readiness, matching, and distribution work — then start free. No polished deck required, and nothing here offers or sells securities.",
    placeholder: "Ask about getting investor-ready…",
    openers: ["How does iCapOS work for founders?", "How do you build my investor list?", "How is my CRR scored?", "How do I get started?"],
  },
  investors: {
    label: "investors",
    title: "Looking for better-fit deal flow?",
    sub: "Ask how mandates, matching, and the volume cap work. Free investor accounts — nothing here offers or sells securities.",
    placeholder: "Ask about deal flow and mandates…",
    openers: ["How does matching work?", "How do I set my mandate?", "What's the volume cap?", "How do I get started?"],
  },
  pricing: {
    label: "pricing",
    title: "Which plan fits your raise?",
    sub: "Ask what's included or how self-serve works. The readiness rating is free — you only choose a plan when you're ready to distribute.",
    placeholder: "Ask about plans and what's included…",
    openers: ["What's the difference between the plans?", "Is it really self-serve?", "Can I book a demo?", "How do I get started?"],
  },
  readiness: {
    label: "readiness",
    title: "Want to know where you stand?",
    sub: "Ask what the rating measures and how to run it. It's free, and it's what iCapOS produces — not what it requires.",
    placeholder: "Ask about the readiness rating…",
    openers: ["What does the rating measure?", "How is it scored?", "How long does it take?", "How do I get started?"],
  },
  about: {
    label: "about",
    title: "Want to know who's behind iCapOS?",
    sub: "Ask about the iCFO network, the conference series, and sixteen years of investor relations. Nothing here offers or sells securities.",
    placeholder: "Ask about iCapOS and iCFO…",
    openers: ["What is the iCFO network?", "How do the conferences work?", "How does iCapOS make money?", "How do I get started?"],
  },
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
  if (pathname === "/events" || pathname.startsWith("/events/")) return "events";
  if (pathname.startsWith("/founders")) return "founders";
  if (pathname.startsWith("/investors")) return "investors";
  if (pathname.startsWith("/pricing")) return "pricing";
  if (pathname.startsWith("/readiness")) return "readiness";
  if (pathname.startsWith("/about")) return "about";
  return "home";
}
function isAutoOpen(pathname: string): boolean {
  return pathname === "/" || pathname === "/events" || pathname.startsWith("/events/");
}
function fmtEventDate(iso: string | null): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat(undefined, { month: "long", day: "numeric", year: "numeric" }).format(new Date(iso));
}

export function AiFirstMode({ nextEvent = null }: { nextEvent?: NextEvent }) {
  const pathname = usePathname() ?? "/";
  const ctx = contextFor(pathname);
  const cfg = CONTEXTS[ctx];
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

  // Auto-open only on "/" and "/events" (per-context dismissal + ?pages=1).
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

  const openerRow = (
    <div className="flex flex-wrap justify-center gap-2">
      {cfg.openers.map((c) => (
        <button key={c} type="button" onClick={() => send(c)} className="rounded-full border border-white/15 bg-white/[0.04] px-3.5 py-1.5 text-[13px] text-white/85 transition-colors hover:border-site-blue-lt hover:text-white">{c}</button>
      ))}
    </div>
  );

  const inputForm = (
    <>
      <form onSubmit={(e) => { e.preventDefault(); const input = e.currentTarget.elements.namedItem("q") as HTMLInputElement; send(input.value); input.value = ""; }} className="flex gap-2">
        <input name="q" autoFocus autoComplete="off" placeholder={cfg.placeholder} className="flex-1 rounded-xl border border-white/15 bg-white/[0.06] px-4 py-3 text-sm text-white placeholder-white/40 outline-none focus:border-site-blue-lt" />
        <button type="submit" disabled={busy} className="rounded-xl bg-site-blue px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-site-blue-hi disabled:opacity-60">Send</button>
      </form>
      <p className={`mt-3 font-site-mono text-[10px] leading-4 text-white/40 ${empty ? "text-center" : ""}`}>iCapOS does not offer or sell securities, provide investment advice, or process transactions. Answers are informational and may be imperfect.</p>
    </>
  );

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-gradient-to-b from-site-navy via-site-navy-2 to-site-navy-3 text-white" role="dialog" aria-modal="true" aria-label="AI-first mode">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-6 py-4">
        <div className="font-site-display text-lg font-extrabold tracking-tight">iCap<span className="text-site-blue-lt">OS</span> <span className="ml-2 align-middle font-site-mono text-[11px] font-medium uppercase tracking-wider text-white/50">AI mode{cfg.label ? ` · ${cfg.label}` : ""}</span></div>
        <div className="flex items-center gap-2">
          {/* Persistent signup CTA — visible in every context, all session (goal: signup). */}
          <Link href={SIGNUP} className="rounded-lg bg-site-blue px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-site-blue-hi">Get started</Link>
          <button type="button" onClick={close} className="rounded-lg border border-white/20 px-3 py-2 text-sm font-medium text-white/80 transition-colors hover:border-white/40 hover:text-white">Browse the site instead</button>
        </div>
      </div>

      {empty ? (
        <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-7 px-6 pb-10">
          <div className="text-center">
            <h2 className="font-site-display text-3xl font-extrabold tracking-tight sm:text-4xl">{cfg.title}</h2>
            <p className="mx-auto mt-3 max-w-md text-white/65">{cfg.sub}</p>
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
