"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { PLATFORM_TZ, PLATFORM_TZ_LABEL } from "@/lib/time/platform-tz";
import { AGENT_IDLE_LINES, AGENT_OPTOUT_AFTER, AGENT_OPTOUT_LINES, IDLE_MS, isOptOut, replyPauseMs, typingMs } from "@/lib/chat-agents/presence";
import { formatSlotWhen, validEmail, type Slot } from "@/lib/jessica/flow";
import {
  FALLBACK_ASIDE,
  MICHAEL_BOOKING_NOTE,
  MICHAEL_DISCLAIMER,
  MICHAEL_NAME,
  MICHAEL_SLOT_MINUTES,
  MICHAEL_TITLE,
  SPARE_BRIDGES,
  timeOffer,
} from "@/lib/michael/config";
import { firstName, looksLikeName, topicOf } from "@/lib/michael/topics";

type Msg = { id: number; from: "michael" | "you"; text: string; href?: string; hrefLabel?: string };
type Extra = Pick<Msg, "href" | "hrefLabel">;
type Turn = { role: "user" | "assistant"; content: string };
type Mode = "CLOSE" | "QUALIFY" | "BREATHE" | "ASIDE" | "DONE";
type Chips = { options: string[]; main: boolean };
type Step = "stage" | "raise" | "timing" | "check";
type AiData = { ok?: boolean; lines?: string[]; bridge?: string; question?: string };

const WHAT = [
  ["I connect companies and investors, and I've done it for over 20 years.", "That means meetings, curated introductions, and business development beyond capital."],
  ["Mostly introductions that matter: the right investor to the right company, and the other way around.", "I also open up my business network when it helps a deal."],
  ["Think of me as the person who gets two sides into the same room, with the right context."],
];
const HOW = [
  ["It starts with understanding what you need. Then we assess readiness, identify the investors or companies that fit, and arrange the meetings.", "We follow up with the ones who show interest."],
  ["Three stages: a readiness rating, a curated match, and introductions with follow up. You bring the opportunity, we bring the relationships."],
  ["First a conversation about your goals, then a targeted shortlist, then the introductions themselves."],
];
const BACKGROUND = [
  ["I've spent over 20 years in corporate and business consulting, working with Wall Street firms and Fortune 100 companies.", "Investment banking, financial services, consumer products and more."],
  ["I'm a General Partner with iCFO Capital Newport Beach.", "Most of my career has been advising private equity firms, hedge funds, family offices and high net worth investors."],
  ["Twenty plus years of finding business and investment opportunities for investors and companies.", "Now I do it through iCFO Capital Newport Beach."],
];
const SERVICES = [
  ["I do four things: investor and company meetings, and curated capital and company introductions.", "Plus business development beyond capital partnerships, and business network connections."],
  ["Meetings with the right investors or companies, curated introductions, and business development beyond capital partnerships.", "I also open up my business network."],
];
const AI_LINES = [
  ["I'm an AI assistant for Michael, and I can help with whatever you need here.", "Would you like to speak with someone on the team?"],
  ["Yes, I'm Michael's AI assistant, and I'm here to help.", "Shall I arrange a conversation with the team?"],
  ["I'm Michael's AI assistant. The team is the human side of this.", "Would you like me to set you up with them?"],
];
const FEE_FIRST = [
  "There's no price list, and I won't pretend there is.",
  "The fee follows the work: what kind of capital, and how much preparation and outreach it takes to get you in front of the right investors.",
];
const FEE_AGAIN = [
  "I'd be guessing, and I don't guess with other people's money.",
  "Equity, debt, an SPV: each is a different amount of work, and the fee follows the work. Nothing is tied to what you raise.",
];

const STAGES = ["Pre revenue", "Under $1M a year", "$1M to $5M", "Over $5M"];
const RAISES = ["Under $1M", "$1M to $5M", "$5M to $20M", "Over $20M"];
const TIMINGS = ["Within 30 days", "A few months", "Not sure yet"];
const CHECKS = ["Under $250K", "$250K to $1M", "$1M to $5M", "$5M plus"];
const QS: Record<Step, string> = {
  stage: "What stage is the company at?",
  raise: "About how much are you looking to raise?",
  timing: "What is your timeline to close?",
  check: "What check size do you usually write?",
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const clean = (s: string) => s.replace(/[  ]/g, " ");

function fmt(slot: Slot, opts: Intl.DateTimeFormatOptions): string {
  return clean(new Intl.DateTimeFormat("en-US", { timeZone: PLATFORM_TZ, ...opts }).format(new Date(slot.start)));
}
const timeOf = (slot: Slot) => fmt(slot, { hour: "numeric", minute: "2-digit" });
const dayKey = (slot: Slot) => fmt(slot, { year: "numeric", month: "2-digit", day: "2-digit" });
/** "Wednesday 9:00 AM", or "Wed, Oct 21 9:00 AM" once it is more than six days out. */
function longLabel(slot: Slot): string {
  const far = new Date(slot.start).getTime() - Date.now() > 6 * 24 * 60 * 60 * 1000;
  return far ? `${fmt(slot, { weekday: "short", month: "short", day: "numeric" })} ${timeOf(slot)}` : `${fmt(slot, { weekday: "long" })} ${timeOf(slot)}`;
}
const chipLabel = (slot: Slot) => `${fmt(slot, { weekday: "short" })} ${fmt(slot, { day: "numeric" })}, ${timeOf(slot)}`;
const dayChipLabel = (slot: Slot) => fmt(slot, { weekday: "short", month: "short", day: "numeric" });

function groupDays(slots: Slot[]): Slot[][] {
  const sorted = [...slots].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  const map = new Map<string, Slot[]>();
  for (const s of sorted) {
    const k = dayKey(s);
    map.set(k, [...(map.get(k) ?? []), s]);
  }
  return [...map.values()];
}

/**
 * The Michael chat: Jessica 1.0's format (white box, photo beside the
 * messages, option chips, real calendar booking), written in Michael's own
 * voice. Unmatched questions go to /api/michael/reply; if that is unavailable
 * the page uses its written lines. Offers times twice, then stops pushing until
 * the visitor gives something new; a side answer is followed by the question it
 * interrupted.
 */
export function MichaelChat({ hostId, sourceTag }: { hostId: string; sourceTag: string | null }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [chips, setChips] = useState<Chips | null>(null);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const submitRef = useRef<(value: string) => boolean>(() => false);
  const chipRef = useRef<(label: string) => void>(() => undefined);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    // ── State ───────────────────────────────────────────────────────
    const sessionId = Math.random().toString(36).slice(2, 14);
    const said = new Set<string>();
    const turns: Turn[] = [];
    const d: { role?: string; stage?: string; raise?: string; timing?: string; check?: string; name?: string; email?: string; slot?: Slot } = {};
    const seen = { up: 0, com: 0, info: 0, fee: 0 };
    let nextId = 1;
    let busy = false;
    let exp: "name" | "name2" | "email" | null = null;
    let offered = 0;
    let closes = 0;
    let sinceNew = 2;
    let qstep: Step | null = null;
    let rs = 0;
    let booked = false;
    let slotsCache: { at: number; slots: Slot[] } | null = null;
    let chipCb: ((label: string) => void) | null = null;

    // ── Helpers ─────────────────────────────────────────────────────
    const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
    const fresh = (ws: readonly (readonly string[])[]): string[] => {
      for (const w of ws) if (!w.some((l) => said.has(key(l)))) return [...w];
      return [...ws[ws.length - 1]];
    };
    const fb = (bridge: string): string => fresh([[bridge], ...SPARE_BRIDGES.map((x) => [x])])[0];
    const addMsg = (from: Msg["from"], text: string, extra?: Extra) => setMsgs((m) => [...m, { id: nextId++, from, text, ...extra }]);

    // Like Johnny: never an instant reply, one "Are you still there?" after five quiet minutes,
    // and a full stop when the visitor asks to be removed.
    let visitorSpoke = false;
    let stopped = false;
    let idleAsked = false;
    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    const clearIdle = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = null;
    };
    const armIdle = () => {
      clearIdle();
      if (idleAsked || stopped || booked) return;
      idleTimer = setTimeout(() => {
        if (busy || stopped || booked) return;
        idleAsked = true;
        say([AGENT_IDLE_LINES[0]]);
      }, IDLE_MS);
    };
    const heard = () => {
      visitorSpoke = true;
      idleAsked = false;
      clearIdle();
    };

    const say = (lines: string[], done?: () => void, extra?: Extra) => {
      busy = true;
      clearIdle();
      lines.forEach((l) => said.add(key(l)));
      void (async () => {
        if (visitorSpoke) await sleep(replyPauseMs(Math.random()));
        for (let i = 0; i < lines.length; i++) {
          setTyping(true);
          await sleep(typingMs(lines[i].length, !visitorSpoke));
          setTyping(false);
          addMsg("michael", lines[i], i === lines.length - 1 ? extra : undefined);
          await sleep(150);
        }
        busy = false;
        armIdle();
        done?.();
      })();
    };
    const rep = (options: string[], cb: (label: string) => void, main = false) => {
      chipCb = cb;
      setChips({ options, main });
    };
    const clr = () => {
      chipCb = null;
      setChips(null);
    };
    const ch = (options: string[], cb: (label: string) => void) =>
      rep(options, (x) => {
        sinceNew = 0;
        cb(x);
      });

    const calendarLink = (): Extra => ({
      href: `/schedule/${hostId}${sourceTag ? `?src=${encodeURIComponent(sourceTag)}` : ""}`,
      hrefLabel: "Open the calendar",
    });

    // ── Data ────────────────────────────────────────────────────────
    const loadSlots = async (force = false): Promise<Slot[]> => {
      if (!force && slotsCache && Date.now() - slotsCache.at < 5 * 60 * 1000) return slotsCache.slots;
      try {
        const from = new Date(Date.now() + 2 * 60 * 60 * 1000);
        const to = new Date(from.getTime() + 21 * 24 * 60 * 60 * 1000);
        const url =
          `/api/scheduling/slots?host=${hostId}` +
          `&from=${encodeURIComponent(from.toISOString())}` +
          `&to=${encodeURIComponent(to.toISOString())}` +
          `&duration=${MICHAEL_SLOT_MINUTES}`;
        const res = await fetch(url);
        if (!res.ok) return [];
        const data = (await res.json()) as { slots?: Slot[] };
        const slots = Array.isArray(data.slots) ? data.slots : [];
        slotsCache = { at: Date.now(), slots };
        return slots;
      } catch {
        return [];
      }
    };

    const bookSlot = async (slot: Slot): Promise<{ ok: true; meetUrl: string | null } | { ok: false; retry: boolean; message: string }> => {
      try {
        const answers = [
          ["Raising or investing", d.role],
          ["Company stage", d.stage],
          ["Raise size", d.raise],
          ["Time to close", d.timing],
          ["Check size", d.check],
        ]
          .filter((r): r is [string, string] => Boolean(r[1]))
          .map(([label, value]) => ({ label, value: value.slice(0, 1000) }));
        const res = await fetch("/api/scheduling/book", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            hostId,
            startTime: slot.start,
            endTime: slot.end,
            timezone: PLATFORM_TZ,
            name: d.name ?? "Visitor",
            email: d.email,
            note: MICHAEL_BOOKING_NOTE,
            answers,
            sourceTag: sourceTag ?? undefined,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as { meetUrl?: string | null };
        if (res.ok) return { ok: true, meetUrl: data.meetUrl ?? null };
        if (res.status === 409) return { ok: false, retry: true, message: "That time was just taken." };
        if (res.status === 429) return { ok: false, retry: false, message: "There are a lot of requests from here right now. Please try again in a little while." };
        return { ok: false, retry: false, message: "Something went wrong on our side, and I couldn't book that." };
      } catch {
        return { ok: false, retry: false, message: "I lost the connection and couldn't book that." };
      }
    };

    // ── Booking steps ───────────────────────────────────────────────
    const book = async () => {
      const slot = d.slot;
      if (!slot || !d.email) return;
      busy = true;
      setTyping(true);
      const result = await bookSlot(slot);
      setTyping(false);
      busy = false;
      if (result.ok) {
        booked = true;
        say(
          [`Booked. ${formatSlotWhen(slot.start, PLATFORM_TZ, PLATFORM_TZ_LABEL)} with the team.`, `The invite is on its way to ${d.email}. Looking forward to it.`],
          undefined,
          result.meetUrl ? { href: result.meetUrl, hrefLabel: "Open the meeting link" } : undefined,
        );
        return;
      }
      if (result.retry) {
        d.slot = undefined;
        closes = 0;
        say([result.message], () => {
          void loadSlots(true).then(() => tm(""));
        });
        return;
      }
      say([result.message], undefined, calendarLink());
    };

    const ask = (what: "name" | "email") => {
      if (what === "name") {
        exp = "name";
        say(["Happy to set that up. May I have your name?"]);
      } else {
        exp = "email";
        say([`Thank you, ${d.name}. Where should I send the invite?`]);
      }
    };
    const pickSlot = (slot: Slot) => {
      d.slot = slot;
      if (d.name && d.email) void book();
      else ask(d.name ? "email" : "name");
    };

    const otherDay = (days: Slot[][]) => {
      const list = days.slice(0, 6);
      say(["Of course. Which day works best?"], () =>
        rep([...list.map((s) => dayChipLabel(s[0])), "Another time"], (x) => {
          if (x === "Another time") return anotherTime();
          const day = list.find((s) => dayChipLabel(s[0]) === x);
          if (!day) return anotherTime();
          const times = day.slice(0, 6);
          say(["And what time suits you?"], () =>
            rep([...times.map(timeOf), "Another day"], (t) => {
              if (t === "Another day") return otherDay(days);
              const slot = times.find((s) => timeOf(s) === t);
              if (slot) pickSlot(slot);
            }, true),
          );
        }),
      );
    };
    const anotherTime = () => say(["No problem. You can pick any open time on the calendar."], undefined, calendarLink());

    /** Offer two real open days, never "do you want a call". Offers stop after two until the visitor gives something new. */
    const tm = (lead: string) => {
      if (booked) return;
      if (closes >= 2 && sinceNew < 2) {
        sinceNew++;
        say([lead ? fb(lead) : "Anyway, I'm here. Ask me anything."]);
        return;
      }
      closes++;
      const variant = offered++;
      sinceNew = 0;
      const bridge = lead ? fb(lead) : "";
      void loadSlots().then((slots) => {
        const days = groupDays(slots);
        if (days.length === 0) {
          say([`${bridge ? `${bridge} ` : ""}The calendar is the quickest way to pick a time.`], undefined, calendarLink());
          return;
        }
        const a = days[0][0];
        const b = days.length > 1 ? days[1][0] : days[0].length > 1 ? days[0][days[0].length > 3 ? 3 : 1] : null;
        const line = b
          ? timeOffer(variant, longLabel(a), longLabel(b), fmt(a, { weekday: "long" }), fmt(b, { weekday: "long" }))
          : `${longLabel(a)} Pacific is open. Does that suit you?`;
        const options = b ? [a, b] : [a];
        say([`${bridge ? `${bridge} ` : ""}${line}`], () =>
          rep([...options.map(chipLabel), "Other day", "Another time"], (x) => {
            if (x === "Other day") return otherDay(days);
            if (x === "Another time") return anotherTime();
            const slot = options.find((s) => chipLabel(s) === x);
            if (slot) pickSlot(slot);
          }, true),
        );
      });
    };

    // ── Qualifying ──────────────────────────────────────────────────
    const qAsk = (step: Step, lead: string, options: string[], cb: (label: string) => void) => {
      qstep = step;
      const text = QS[step];
      say([lead ? `${lead}${/^(So|Now|Okay), $/.test(lead) ? lowerFirst(text) : text}` : text], () =>
        rep(options, (o) => {
          qstep = null;
          sinceNew = 0;
          cb(o);
        }, true),
      );
    };
    const qCheck = (lead: string) =>
      qAsk("check", lead, CHECKS, (o) => {
        d.check = o;
        s5();
      });
    const qTiming = (lead: string) =>
      qAsk("timing", lead, TIMINGS, (o) => {
        d.timing = o;
        s5();
      });
    const qRaise = (lead: string) =>
      qAsk("raise", lead, RAISES, (o) => {
        d.raise = o;
        qTiming("");
      });
    const qStage = (lead: string) =>
      qAsk("stage", lead, STAGES, (o) => {
        d.stage = o;
        qRaise(/^Pre/.test(o) ? "Early stage, noted. " : /^Over/.test(o) ? "Established, good. " : "Noted. ");
      });
    const resume = () => {
      const f = qstep ? { stage: qStage, raise: qRaise, timing: qTiming, check: qCheck }[qstep] : null;
      if (f) f(["So, ", "Now, ", "Okay, "][rs++ % 3]);
    };
    /** After a side answer: finish the question it interrupted, otherwise move toward the call. */
    const cr = (lead: string) => {
      if (qstep) {
        resume();
        return;
      }
      tm(lead);
    };
    const investing = () => /invest|evaluat/i.test(d.role ?? "");
    const s2 = () => {
      if (investing()) qCheck("Good. Most of my work with investors is bringing them opportunities that match their mandate. ");
      else qStage("Understood. A few quick questions will help me point you to the right people. ");
    };
    const s5 = () => {
      closes = 0;
      const line = investing()
        ? "That check size fits well with the opportunities we see. The best next step is a short conversation about what's in the pipeline."
        : `A raise of that size${d.timing && /30/.test(d.timing) ? ", on a tight timeline," : ""} is something I can work with. The best next step is a short conversation about the right introductions.`;
      say([line], () => tm(""));
    };
    const s1 = () =>
      say(["Hello, I'm Michael Lerma with iCFO Capital Newport Beach.", "What can I help you with today?"], () =>
        rep(["Raising capital", "Evaluating investments", "What do you offer?"], (o) => {
          d.role = o;
          if (/offer/.test(o)) {
            say(
              ["I connect companies and investors. I've been doing that for over 20 years.", "The work is meetings, curated introductions, and business development beyond capital.", "Are you raising, or investing?"],
              () =>
                rep(["Raising", "Investing"], (x) => {
                  d.role = x;
                  s2();
                }),
            );
          } else s2();
        }),
      );

    // ── AI for everything not written ───────────────────────────────
    const known = () =>
      [d.role && `Raising or investing: ${d.role}`, d.stage && `Stage: ${d.stage}`, d.raise && `Raise: ${d.raise}`, d.timing && `Timing: ${d.timing}`, d.check && `Check size: ${d.check}`]
        .filter(Boolean)
        .join("; ");

    const aiReply = (v: string) => {
      const mode: Mode = booked ? "DONE" : qstep ? "ASIDE" : closes >= 2 && sinceNew < 2 ? "BREATHE" : offered > 0 && sinceNew < 2 ? "QUALIFY" : "CLOSE";
      turns.push({ role: "user", content: v });
      if (turns.length > 12) turns.splice(0, turns.length - 12);
      busy = true;
      setTyping(true);
      void (async () => {
        let data: AiData | null = null;
        try {
          const res = await fetch("/api/michael/reply", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mode, known: known() || undefined, turns, sessionId }),
          });
          data = res.ok ? ((await res.json()) as AiData) : null;
        } catch {
          data = null;
        }
        setTyping(false);
        busy = false;
        let lines = (data?.ok && Array.isArray(data.lines) ? data.lines : []).map((l) => String(l).slice(0, 160)).filter(Boolean).slice(0, 2);
        if (lines.some((l) => said.has(key(l)))) lines = [];
        if (!lines.length) {
          turns.pop();
          say(fresh(FALLBACK_ASIDE), () => (mode === "DONE" ? undefined : cr("")));
          return;
        }
        const bridge = data?.bridge ? String(data.bridge).slice(0, 140) : "";
        const question = data?.question ? String(data.question).slice(0, 140) : "";
        turns.push({ role: "assistant", content: `${lines.join(" ")} ${bridge || question}`.trim() });
        if (mode === "DONE") return say(lines);
        if (mode === "ASIDE") return say(lines, resume);
        if (mode === "BREATHE") {
          sinceNew++;
          return say(question ? [...lines, question] : lines);
        }
        if (mode === "QUALIFY") {
          sinceNew = 2;
          return say([...lines, question || "Are you raising right now, or just exploring?"]);
        }
        say(lines, () => tm(bridge || "A quick call with the team is the easiest way to see if it fits."));
      })();
    };

    // ── Written answers ─────────────────────────────────────────────
    const ans = (v: string) => {
      const topic = topicOf(v);
      switch (topic) {
        case "ai":
          return say(fresh(AI_LINES), () =>
            rep(["Yes, please", "Keep chatting"], (o) => {
              if (/Yes/.test(o)) tm("Let's get you on the calendar.");
              else say(["Of course, I'm happy to continue.", "Are you raising right now, or exploring?"]);
            }, true),
          );
        case "license":
          return say(["No. We're an investor relations firm, not a broker dealer.", "We help companies with capital acquisition, and we don't sell securities."], () => cr("I can go through how it works on a quick call."));
        case "legit":
          sinceNew = 2;
          return say([
            "Fair to check. iCFO has been doing this for 16 years, with offices in La Jolla, Paris and Singapore, and 7,000 plus investor relationships built one at a time.",
            "If something specific went wrong, tell me and I'll look into it myself.",
          ]);
        case "fit":
          return say(["Fair, and you'd know your company better than I do.", "What's the part that doesn't fit: the stage, the investors, or the timing?"], () =>
            ch(["The stage", "The investors", "The timing"], (o) => {
              if (/stage/.test(o)) say(["We work from pre revenue up. The readiness rating is built for exactly that."], () => cr("Twenty minutes with the team tells you if it's real."));
              else if (/investors/.test(o)) say(["Then let's test it. The team can show you who fits your company."], () => cr("A short call is all it takes."));
              else say(["Timing we can work around. Nothing starts until you say so."], () => cr("Twenty minutes now saves you the scramble later."));
            }),
          );
        case "background":
          return say(fresh(BACKGROUND), () => cr("The best way to see how that applies to you is a quick call."));
        case "services":
          return say(fresh(SERVICES), () => cr("Tell me what you need on a quick call and we'll point you to the right one."));
        case "name":
          exp = "name2";
          return say(["I'm Michael Lerma, General Partner with iCFO Capital Newport Beach. I help connect companies and investors.", "And you are?"]);
        case "greeting":
          return say(["Hello. Are you raising capital, or evaluating investments?"], () =>
            rep(["Raising capital", "Evaluating investments"], (o) => {
              d.role = o;
              s2();
            }),
          );
        case "thanks":
          return say(["My pleasure."], () => cr("Let's get a time on the calendar."));
        case "what":
          return say(fresh(WHAT), () => cr("The quickest way to see if it fits is a short call."));
        case "how":
          return say(fresh(HOW), () => cr("It's easier to show than to describe."));
        case "location":
          return say(["I'm in Newport Beach, California. iCFO also has offices in Paris and Singapore, and we work with founders and investors everywhere."], () => cr("A call is the easiest way to meet the team."));
        case "experience":
          return say(["I have more than 20 years in consulting and finance, and iCFO has been at this for over 16.", "The relationships built over that time are the real asset."], () => cr("The team can explain what that means for you."));
        case "icapos":
          return say(["iCapOS is iCFO's software. It rates how capital ready a company is and matches it with investors whose mandate fits."], () => cr("A call shows how it would work on your company."));
        case "guarantee":
          return say(["No one can promise funding, and I'd be wary of anyone who does.", "What I can do is put you in front of the right people and stay on the follow up."], () => cr("The team can show you what that looks like."));
        case "spv":
          return say(["Yes, iCFO structures SPVs for specific deals: one vehicle, one cap table line, one close."], () => cr("The team can take you through it."));
        case "upfront": {
          if (seen.up++ || seen.fee) {
            return say(
              ["Understood, and I'll be straight with you: the fee follows the work, and the work depends on the capital you're after.", "Nothing is tied to money raised, and we lay out exactly what's due and when before anything starts."],
              () => cr("Fifteen minutes with the team settles the question."),
            );
          }
          return say(["That's reasonable. Nobody wants to commit before seeing the value.", "What matters more to you right now, the cost or who you'd be meeting?"], () =>
            ch(["The cost", "The people I'd meet", "Both"], (o) => {
              if (/cost/i.test(o)) say(["Understood. The fee follows the work, and the work depends on the kind of capital you're after. No number until we know both."], () => cr("The team can lay out exactly what that means for your situation."));
              else if (/people/i.test(o)) say(["That's the right priority. We match you on mandate, then follow up with the investors who show interest."], () => cr("It's easier to demonstrate than to explain."));
              else say(["Both are fair. Cost depends on the capital and the work, and the introductions are something we can show you live."], () => cr("Let's go through it together."));
            }),
          );
        }
        case "commission":
          seen.fee = 1;
          return say(
            seen.com++
              ? ["Same answer: no commission and no success fee. The fee covers the work, and it depends on the type of capital."]
              : ["There's no commission. iCFO is not a broker dealer, and nothing is tied to money raised.", "What we charge depends on the kind of capital and the work it takes to get you investor ready."],
            () => cr("The team can go through the structure on a short call."),
          );
        case "notnow":
          return say(["Understood, no pressure.", "What would be most useful for you to know?"], () =>
            ch(["The cost", "Who the investors are", "How it works"], (o) => {
              if (/cost/.test(o)) say(["No price list. The fee follows the work, and the work depends on the kind of capital you need."], () => cr("Give us the raise on a quick call and you get a real number, no commitment."));
              else if (/investors/.test(o)) say(["Angels, family offices, VCs and institutions, matched on mandate rather than mass mailed."], () => cr("A short call can show who fits your company."));
              else say(["We assess readiness, match you with the right investors, make the introductions, and follow up."], () => cr("Twenty minutes is enough to show you."));
            }),
          );
        case "board":
          return say(["That makes sense, it's a decision worth sharing. How long have you been raising?"], () =>
            ch(["Under 3 months", "3 to 6 months", "Over 6 months"], (o) =>
              say([/Under/.test(o) ? "Good timing to get clear answers early." : "That's a long stretch to carry alone."], () => cr("A 30 minute call gives you something concrete to take back to them.")),
            ),
          );
        case "info":
          if (seen.info++) return say(["The most direct route is the conversation itself. It gets you further than a document would."], () => cr("Twenty minutes with the team will cover it."));
          return say(["Glad to help. So I point you the right way, what has been the toughest part of raising so far?"], () =>
            ch(["Reaching the right investors", "Getting ready for investors", "Something else"], (o) =>
              say(
                [
                  /Reaching/.test(o)
                    ? "Then this is a good fit. Finding the right investors and following up is where we spend our time."
                    : /ready/.test(o)
                      ? "That's where we begin. We assess readiness and show you what to address first."
                      : "Good to know. The team can speak to that directly.",
                ],
                () => cr("Thirty minutes with the team will tell you more than a brochure."),
              ),
            ),
          );
        case "number":
          return say(["I understand. Any figure I gave now would be a guess, and you should get a real one."], () => cr("Fifteen minutes with the team gets you that."));
        case "budget":
          return say(["Understood, budget matters.", "The cost depends on the type of capital and the work involved, so it differs for every company."], () => cr("Let's see what it looks like for yours."));
        case "notinterested":
          return say(["No problem. If it helps, we do have investors active in your sector."], () => cr("Fifteen minutes is enough to see who they are."));
        case "fee": {
          const again = seen.fee;
          seen.fee = 1;
          return say(again ? FEE_AGAIN : FEE_FIRST, () => cr(again ? "Twenty minutes with the team settles it either way." : "Tell us the raise on a quick call and you get a real number."));
        }
        default:
          return aiReply(v);
      }
    };

    // ── Input ───────────────────────────────────────────────────────
    submitRef.current = (v: string) => {
      if (busy) return false;
      heard();
      clr();
      addMsg("you", v);
      if (stopped) {
        say([AGENT_OPTOUT_AFTER]);
        return true;
      }
      if (isOptOut(v)) {
        stopped = true;
        exp = null;
        say(AGENT_OPTOUT_LINES);
        return true;
      }
      if ((exp === "name" || exp === "name2") && !looksLikeName(v)) {
        exp = null;
        ans(v);
        return true;
      }
      if (exp === "name") {
        d.name = firstName(v);
        exp = null;
        if (d.slot && d.email) void book();
        else ask("email");
        return true;
      }
      if (exp === "name2") {
        d.name = firstName(v);
        exp = null;
        say([`Nice to meet you, ${d.name}. Are you raising capital, or evaluating investments?`], () =>
          rep(["Raising capital", "Evaluating investments"], (o) => {
            d.role = o;
            s2();
          }),
        );
        return true;
      }
      if (exp === "email") {
        if (!validEmail(v)) {
          say(["That email doesn't look right. Could you check it?"]);
          return true;
        }
        d.email = v;
        exp = null;
        void book();
        return true;
      }
      ans(v);
      return true;
    };
    chipRef.current = (label: string) => {
      const cb = chipCb;
      heard();
      clr();
      addMsg("you", label);
      cb?.(label);
    };

    void loadSlots();
    s1();
  }, [hostId, sourceTag]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs, typing, chips]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const value = draft.trim();
    if (!value) return;
    if (submitRef.current(value)) setDraft("");
  };

  return (
    <div
      role="region"
      aria-label={`Conversation with ${MICHAEL_NAME}`}
      className="flex h-[min(680px,calc(100dvh-3rem))] min-h-[440px] w-full max-w-[520px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
    >
      <div ref={scrollRef} aria-live="polite" className="flex flex-1 flex-col gap-1.5 overflow-y-auto px-4 pb-2 pt-5">
        {msgs.map((m, i) => {
          const first = i === 0 || msgs[i - 1].from !== m.from;
          const fromYou = m.from === "you";
          return (
            <div key={m.id} className={`relative shrink-0 pl-[52px] text-[15px] leading-snug text-slate-900 ${first ? "mt-4 min-h-[44px]" : ""} ${fromYou ? "ml-6" : ""}`}>
              {first ? (
                <>
                  {fromYou ? (
                    <div className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">You</div>
                  ) : (
                    <Image src="/michael.jpg" alt={MICHAEL_NAME} width={40} height={40} className="absolute left-0 top-0 h-10 w-10 rounded-full object-cover" />
                  )}
                  <div className="mb-0.5 text-[15px] font-semibold leading-tight">
                    {fromYou ? "You" : MICHAEL_NAME}
                    {fromYou ? null : <span className="block text-[13px] font-normal text-slate-500">{MICHAEL_TITLE}</span>}
                  </div>
                </>
              ) : null}
              <div className="break-words">{m.text}</div>
              {m.href && m.hrefLabel ? (
                m.href.startsWith("/") ? (
                  <Link href={m.href} className="mt-1 inline-block font-semibold text-[#1A6CE4] underline">
                    {m.hrefLabel}
                  </Link>
                ) : (
                  <a href={m.href} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block font-semibold text-[#1A6CE4] underline">
                    {m.hrefLabel}
                  </a>
                )
              ) : null}
            </div>
          );
        })}

        {typing ? (
          <div className="flex shrink-0 gap-1 py-2.5 pl-[52px]" aria-label="Michael is typing">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400" />
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400 [animation-delay:150ms]" />
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400 [animation-delay:300ms]" />
          </div>
        ) : null}

        {chips ? (
          <div className="mb-1.5 ml-[52px] mt-2.5 flex shrink-0 flex-wrap gap-2">
            {chips.options.map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => chipRef.current(o)}
                className={`min-h-[44px] rounded-full border px-4 py-2 text-sm font-semibold ${
                  chips.main ? "border-[#1A6CE4] bg-[#1A6CE4] text-white hover:bg-[#2E78F5]" : "border-[#0A66C2] bg-white text-[#0A66C2] hover:bg-[#EDF3F8]"
                }`}
              >
                {o}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="border-t border-slate-200 px-3.5 pb-2 pt-2.5">
        <form onSubmit={submit} className="flex gap-2">
          <label htmlFor="michael-input" className="sr-only">
            Reply to Michael
          </label>
          <input
            id="michael-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Reply to Michael…"
            autoComplete="off"
            className="h-[46px] min-w-0 flex-1 rounded-full border border-slate-300 bg-white px-[18px] text-[15px] text-slate-900 outline-none focus:border-[#1A6CE4] focus:ring-2 focus:ring-[#1A6CE4]/30"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            className="h-[46px] rounded-full bg-[#1A6CE4] px-5 text-sm font-semibold text-white hover:bg-[#2E78F5] disabled:bg-slate-200 disabled:text-slate-500"
          >
            Reply
          </button>
        </form>
        <p className="mt-2 text-center font-mono text-[10px] leading-snug text-slate-500">{MICHAEL_DISCLAIMER}</p>
      </div>
    </div>
  );
}
