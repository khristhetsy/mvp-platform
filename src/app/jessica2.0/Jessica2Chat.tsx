"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { PLATFORM_TZ, PLATFORM_TZ_LABEL } from "@/lib/time/platform-tz";
import { JESSICA_DISCLAIMER } from "@/lib/jessica/config";
import { formatSlotWhen, parseAiReply, questionKey, validEmail, type JessicaAiReply, type Slot } from "@/lib/jessica/flow";
import type { PublicMatch, PublicMatchResponse } from "@/lib/fit/public-match";
import {
  FALLBACK_ASIDE,
  JESSICA2_BOOKING_NOTE,
  JESSICA2_SLOT_MINUTES,
  MATCH_QUESTIONS,
  timesLine,
} from "@/lib/jessica2/config";
import {
  bareNumber,
  checkOf,
  coveredBy,
  declinesTimes,
  fitAnswersFor,
  industryOf,
  isSideTalk,
  nameFromEmail,
  raiseOf,
  roleOf,
  slotsFor,
  stageOf,
  timeRequestOf,
  timingOf,
  validPhone,
  yesNo,
  zonedParts,
  type Industry,
  type Jessica2Profile,
  type Stage,
} from "@/lib/jessica2/parse";

type Msg = { id: number; from: "jessica" | "you"; text: string; href?: string; hrefLabel?: string; matches?: PublicMatch[] };
type Extra = Pick<Msg, "href" | "hrefLabel" | "matches">;
type Turn = { role: "user" | "assistant"; content: string };
type Mode = "CLOSE" | "QUALIFY" | "DONE" | "ASIDE" | "BREATHE";
/** What a scripted answer asks for next when Jessica isn't in the middle of a question. */
type Outcome = { bridge?: string; match?: boolean; quiet?: boolean };
type BookResult = { ok: true; meetUrl: string | null } | { ok: false; retry: boolean; message: string };

const WHAT = [
  ["We get founders in front of the right investors.", "We rate how ready you are, match you with investors whose mandate fits, and follow up with them for you."],
  ["Short version: readiness, the right investors, and follow up. We do the heavy lifting on all three."],
  ["We find the investors who actually fit your company and put you in front of them. Everything else supports that."],
];
const HOW = [
  ["Three steps. We rate how ready you are, match you with the right investors from a network built over 16 years, and get your materials in front of them.", "Then we follow up with the ones who show interest."],
  ["Rate, match, outreach. You bring the company, we bring the investors and the follow up."],
  ["It starts with a readiness check, then a matched investor list, then we run the outreach with you."],
];
const COST = [
  ["It depends on the type of capital, and how much work we have to do."],
  ["Same honest answer: it depends on the type of capital, and how much work we have to do.", "Nothing is tied to money raised, and the team lays out what's due before anything starts."],
  ["It really does depend on the type of capital and the work involved. Khris puts a real number on it once he knows your raise."],
];
const AI_LINES = [
  ["I'm an AI assistant for Jessica, and there's nothing here I can't help you with.", "Would you like someone from our team to talk with you?"],
  ["Still an AI assistant for Jessica, still here for whatever you need.", "Want me to get someone from the team on with you?"],
];

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** "Tuesday 9:00 AM", or "Tue, Oct 20 at 9:00 AM" once it's more than six days out. */
function slotLabel(slot: Slot): string {
  const when = new Date(slot.start);
  const far = when.getTime() - Date.now() > 6 * 24 * 60 * 60 * 1000;
  const day = new Intl.DateTimeFormat("en-US", far ? { timeZone: PLATFORM_TZ, weekday: "short", month: "short", day: "numeric" } : { timeZone: PLATFORM_TZ, weekday: "long" }).format(when);
  const time = new Intl.DateTimeFormat("en-US", { timeZone: PLATFORM_TZ, hour: "numeric", minute: "2-digit" }).format(when);
  return `${day}${far ? " at" : ""} ${time}`.replace(/[  ]/g, " ");
}
function timeOnly(slot: Slot): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: PLATFORM_TZ, hour: "numeric", minute: "2-digit" }).format(new Date(slot.start)).replace(/[  ]/g, " ");
}
function dayOnly(slot: Slot): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: PLATFORM_TZ, weekday: "long" }).format(new Date(slot.start));
}
function orList(items: string[]): string {
  return items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} or ${items[items.length - 1]}`;
}

const STAGE_SAID: Record<Stage, string> = {
  "Pre revenue": "pre revenue",
  "Under $1M a year": "under $1M a year in revenue",
  "$1M to $5M a year": "$1M to $5M a year in revenue",
  "Over $5M a year": "over $5M a year in revenue",
};

/**
 * Jessica 2.0: a marketer reaching out. A typed conversation (no option
 * buttons): she reads what the visitor writes, asks one thing at a time, shows
 * the /fit investor match in the chat, then books 20 minutes with Khris on the
 * real calendar (/api/scheduling/slots and /book). Questions asked in the middle
 * of hers are answered first, then she picks the thread back up.
 */
export function Jessica2Chat({ hostId, sourceTag }: { hostId: string; sourceTag: string | null }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const submitRef = useRef<(value: string) => boolean>(() => false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let busy = false;
    let booked = false;
    let nextId = 1;
    let waiter: ((value: string) => void) | null = null;
    const p: Jessica2Profile = {};
    const said = new Set<string>();
    const used = new Map<string, number>();
    const turns: Turn[] = [];
    const sessionId = Math.random().toString(36).slice(2, 14);
    let offered = 0; // time offers made, for wording
    let closes = 0; // pushes toward a call
    let sinceNew = 0;
    let matched = false;
    let matchOffers = 0;
    let timeLoop = false;
    let email = "";
    let phone = "";
    let slotsCache: { at: number; slots: Slot[] } | null = null;
    let sectorsCache: string[] | null = null;

    const push = (from: Msg["from"], text: string, extra?: Extra) => {
      const id = nextId++;
      setMsgs((list) => [...list, { id, from, text, ...extra }]);
    };

    const say = async (lines: string[], extra?: Extra) => {
      busy = true;
      lines.forEach((l) => said.add(questionKey(l)));
      for (let i = 0; i < lines.length; i++) {
        if (cancelled) return;
        setTyping(true);
        await sleep(350 + Math.min(lines[i].length * 12, 700));
        if (cancelled) return;
        setTyping(false);
        push("jessica", lines[i], i === lines.length - 1 ? extra : undefined);
        await sleep(150);
      }
      busy = false;
    };

    const textIn = () =>
      new Promise<string>((resolve) => {
        waiter = resolve;
      });

    /** Never the same words twice: the first wording none of whose lines has been said. */
    const fresh = (wordings: string[][]): string[] => wordings.find((w) => !w.some((l) => said.has(questionKey(l)))) ?? wordings[wordings.length - 1];
    const count = (id: string) => {
      const n = used.get(id) ?? 0;
      used.set(id, n + 1);
      return n;
    };

    const known = () =>
      [
        p.role && `Raising or investing: ${p.role}`,
        p.stage && `Stage: ${p.stage}`,
        p.industry && `Industry: ${p.industry.label}`,
        p.raise && `Raise: ${p.raise}`,
        p.timing && `Timing: ${p.timing}`,
        p.check && `Check size: ${p.check}`,
        matched && "Already shown their investor match",
      ]
        .filter(Boolean)
        .join("; ");

    const askAi = async (text: string, mode: Mode): Promise<JessicaAiReply | null> => {
      turns.push({ role: "user", content: text.slice(0, 600) });
      if (turns.length > 12) turns.splice(0, turns.length - 12);
      const call = async (): Promise<JessicaAiReply | null> => {
        try {
          const res = await fetch("/api/jessica2/reply", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mode, known: known() || undefined, turns, sessionId }),
          });
          if (!res.ok) return null;
          return parseAiReply(await res.json());
        } catch {
          return null;
        }
      };
      setTyping(true);
      let reply = await call();
      if (reply && reply.lines.some((l) => said.has(questionKey(l)))) {
        turns.push({ role: "assistant", content: reply.lines.join(" ") });
        turns.push({ role: "user", content: "(You already said that word for word. Say it differently.)" });
        reply = await call();
        if (reply && reply.lines.some((l) => said.has(questionKey(l)))) reply = null;
      }
      setTyping(false);
      if (reply) turns.push({ role: "assistant", content: [...reply.lines, reply.bridge || reply.question].join(" ").trim() });
      else turns.pop();
      return reply;
    };

    // ── Data ────────────────────────────────────────────────────────
    const loadSlots = async (force = false): Promise<Slot[] | null> => {
      if (!force && slotsCache && Date.now() - slotsCache.at < 5 * 60 * 1000) return slotsCache.slots;
      try {
        const from = new Date(Date.now() + 2 * 60 * 60 * 1000);
        const to = new Date(from.getTime() + 21 * 24 * 60 * 60 * 1000);
        const url =
          `/api/scheduling/slots?host=${hostId}` +
          `&from=${encodeURIComponent(from.toISOString())}` +
          `&to=${encodeURIComponent(to.toISOString())}` +
          `&duration=${JESSICA2_SLOT_MINUTES}`;
        const res = await fetch(url);
        if (!res.ok) return null;
        const data = (await res.json()) as { slots?: Slot[] };
        const slots = Array.isArray(data.slots) ? data.slots : [];
        slotsCache = { at: Date.now(), slots };
        return slots;
      } catch {
        return null;
      }
    };

    const loadSectors = async (): Promise<string[]> => {
      if (sectorsCache) return sectorsCache;
      try {
        const res = await fetch("/api/fit/sectors");
        const data = res.ok ? ((await res.json()) as { sectors?: string[] }) : null;
        sectorsCache = Array.isArray(data?.sectors) ? data.sectors : [];
      } catch {
        sectorsCache = [];
      }
      return sectorsCache;
    };

    const runMatch = async (): Promise<PublicMatchResponse | null> => {
      const answers = fitAnswersFor(p, await loadSectors());
      if (!answers) return null;
      try {
        const res = await fetch("/api/fit/match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...answers, variant: "v2" }),
        });
        if (!res.ok) return null;
        const data = (await res.json()) as Partial<PublicMatchResponse>;
        return Array.isArray(data.top) ? (data as PublicMatchResponse) : null;
      } catch {
        return null;
      }
    };

    const book = async (slot: Slot): Promise<BookResult> => {
      try {
        const answers = [
          ["Raising or investing", p.role],
          ["Company stage", p.stage],
          ["Industry", p.industryText ?? p.industry?.label],
          ["Raise size", p.raise],
          ["Time to close", p.timing],
          ["Check size", p.check],
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
            name: nameFromEmail(email),
            email,
            phone: phone || undefined,
            note: JESSICA2_BOOKING_NOTE,
            answers,
            sourceTag: sourceTag ?? undefined,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as { meetUrl?: string | null };
        if (res.ok) return { ok: true, meetUrl: data.meetUrl ?? null };
        if (res.status === 409) return { ok: false, retry: true, message: "That time was just taken." };
        if (res.status === 429) return { ok: false, retry: false, message: "Lots of requests from here right now. Try again in a little while." };
        return { ok: false, retry: false, message: "Something went wrong on my end, and I couldn't book that." };
      } catch {
        return { ok: false, retry: false, message: "I lost the connection and couldn't book that." };
      }
    };

    const calendarLink = (): Extra => ({
      href: `/schedule/${hostId}${sourceTag ? `?src=${encodeURIComponent(sourceTag)}` : ""}`,
      hrefLabel: "Open the calendar",
    });

    // ── Scripted answers ────────────────────────────────────────────
    /**
     * Answers that are written, not generated: fees, objections, trust, the AI
     * question. `aside` means Jessica is in the middle of a question of her own:
     * answer in a line and never ask a follow up, she resumes right after.
     */
    const scripted = async (raw: string, aside: boolean): Promise<Outcome | null> => {
      const l = raw.toLowerCase().replace(/’/g, "'");

      if (/\b(bot|robot|chatgpt|automated|real person|actual person|human)\b|are you (an? )?(ai|a\.i\.)\b/.test(l)) {
        const lines = fresh(AI_LINES);
        if (aside) {
          await say([lines[0]]);
          return { quiet: true };
        }
        await say(lines);
        const answer = await textIn();
        if (yesNo(answer) === "yes" || /\b(yes|please|sure|team)\b/i.test(answer)) {
          sinceNew = 0;
          return { bridge: "Let's get you on Khris's calendar." };
        }
        if (yesNo(answer) === "no") {
          sinceNew = 2;
          await say(["No problem, I've got you."]);
          return { quiet: true };
        }
        await idle(answer);
        return { quiet: true };
      }
      if (/(your|ur) name|who am i (talking|chatting|speaking)|who (is|are) (this|you)\b/.test(l)) {
        await say(fresh([["I'm Jessica, with iCFO Capital Global."], ["Jessica, with the iCFO team."]]));
        return { bridge: "Khris, our founder, takes the first call himself." };
      }
      if (/\bbroker|dealer\b|finra|registered/.test(l)) {
        await say(
          fresh([
            ["Not a broker, no. We're not a broker dealer, investment adviser or funding portal.", "We get companies ready and in front of the right investors."],
            ["No. Nothing we do is tied to selling securities.", "We're the readiness and introductions side of a raise."],
          ]),
        );
        return { bridge: "Khris can walk you through exactly how we work." };
      }
      if (/(don'?t|do not|won'?t|will not|never|not going to|refuse to) (want to )?pay|no (upfront|up front) fees?|not paying/.test(l)) {
        used.set("fee", (used.get("fee") ?? 0) + 1);
        if (aside || count("upfront") > 0) {
          await say(
            fresh([
              ["That's fair, nobody wants to pay before they see the value.", "It depends on the type of capital, and how much work we have to do, and nothing is tied to money raised."],
              ["Understood. Nothing we charge is tied to money raised.", "The team lays out exactly what's due and when before anything starts."],
              ["I hear you. It depends on the capital and the work, and you see it all before you commit to anything."],
            ]),
          );
          return { bridge: "Fifteen minutes with Khris settles it either way." };
        }
        await say(["That's fair, nobody wants to pay before they see the value.", "What matters more to you here: the cost, or getting in front of the right investors?"]);
        const answer = (await textIn()).toLowerCase();
        sinceNew = 0;
        if (/investor/.test(answer) && !/cost|fee|money|price/.test(answer)) {
          await say(["That's the right thing to focus on. We match you with investors whose mandate fits, then follow up with the ones who show interest."]);
          return { match: true, bridge: "It's easier to show you than to explain." };
        }
        if (/both/.test(answer)) {
          await say(["Both make sense. The cost depends on the capital and the work involved; the investor side I can show you."]);
          return { match: true, bridge: "Let's look at it together." };
        }
        await say(["Understood. It depends on the type of capital, and how much work we have to do."]);
        return { bridge: "Khris walks you through exactly what that looks like for your raise." };
      }
      if (/commission|success fee|finder'?s? fee|cut of/.test(l)) {
        used.set("fee", (used.get("fee") ?? 0) + 1);
        await say(
          fresh([
            ["No commission. We're not a broker dealer, and nothing we charge is tied to money raised.", "What we charge depends on the type of capital, and how much work we have to do."],
            ["Same answer: no commission and no success fee. The fee is for the work, and it depends on the type of capital."],
          ]),
        );
        return { bridge: "Khris walks you through the structure on a quick call." };
      }
      if (/scam|legit|fake|rip ?off|dropped the ball|waste of time|didn'?t deliver|never delivered/.test(l)) {
        await say([
          "Fair to check. We've been doing this for 16 years, with offices in La Jolla, Paris and Singapore, and 7,000 plus investor relationships built one at a time.",
          ...(aside ? [] : ["If something specific went wrong, tell me and I'll get it in front of Khris myself."]),
        ]);
        sinceNew = 2;
        return { quiet: true };
      }
      if (/guarantee|promise|will (we|i) get funded|sure (we|i) (get|raise)/.test(l)) {
        await say(["Nobody can promise a raise, and anyone who does is someone to avoid. What we do promise is the right investors in front of you and real follow up."]);
        return { bridge: "Khris can show you what that looks like." };
      }
      if (/what do you do|what does icfo|what do you guys do|what (is|does) (your|the) (company|firm)|who are you guys/.test(l)) {
        await say(fresh(WHAT));
        return { match: true, bridge: "Easiest way to see if it fits is twenty minutes with Khris." };
      }
      if (/how does (it|this|that) work|how do you (work|do it)|what'?s the process|what are the steps/.test(l)) {
        await say(fresh(HOW));
        return { match: true, bridge: "Twenty minutes with Khris and you'll see it on your own company." };
      }
      if (/show (me )?(the |a |my )?match|match(ed)? investors|who (are|would be) the investors|which investors|see (the )?investors/.test(l)) {
        return { match: true, bridge: "Khris can tell you who's realistic for your raise." };
      }
      if (/not interested|no thanks|not for (me|us)\b/.test(l)) {
        const ind = p.industry && p.industry.chips.length ? p.industry.label : "your space";
        await say([`No problem at all. One thing before you go: we have investors already active in ${ind}.`]);
        return { match: true, bridge: "It's worth twenty minutes to see who they are." };
      }
      if (/not a fit|doesn'?t fit|not (the )?right fit/.test(l)) {
        await say(["Fair, and you'd know your company better than I do."]);
        if (aside) return { quiet: true };
        await say(["What's the part that doesn't fit: the stage, the investors, or the timing?"]);
        const answer = (await textIn()).toLowerCase();
        sinceNew = 0;
        if (/stage/.test(answer)) {
          await say(["We work from pre revenue up. The readiness rating is built for exactly that."]);
          return { bridge: "Twenty minutes with Khris tells you if it's real." };
        }
        if (/investor/.test(answer)) {
          await say(["Then let's test it right here."]);
          return { match: true, bridge: "Khris can tell you who's realistic." };
        }
        await say(["Timing we can work around. Nothing starts until you say so."]);
        return { bridge: "Twenty minutes now saves you the scramble later." };
      }
      if (/don'?t want to (schedule|book)|not (ready|yet)\b|no meeting|not now|maybe later|just (looking|browsing)/.test(l)) {
        await say(["No problem, no pressure."]);
        if (aside) return { quiet: true };
        sinceNew = 2;
        await say(["So I'm useful anyway: what would you want to know first, the cost, the investors, or how it works?"]);
        const answer = await textIn();
        sinceNew = 0;
        if (/invest/i.test(answer)) {
          await say(["Angels, family offices, VCs and institutions, in a network built over 16 years. We match on mandate, not a mass list."]);
          return { match: true, quiet: true };
        }
        if (/cost|fee|price|money/i.test(answer)) {
          await say(fresh(COST));
          return { quiet: true };
        }
        await say(fresh(HOW));
        return { quiet: true };
      }
      if (/\b(board|my team|partners?|co-?founders?|think about it|talk it over|discuss)\b/.test(l)) {
        await say(["Of course, that's a decision worth making together."]);
        return { bridge: "A call with Khris gives you something concrete to bring to them." };
      }
      if (/send (me |us )?(some |more |your |the )?(info|information|details|deck|material)|email me|more info/.test(l)) {
        await say(
          fresh([
            ["Happy to. The team sends material after a short call, so it fits your raise instead of a generic PDF."],
            ["Straight answer: there's no generic deck. The team sends what fits after twenty minutes with Khris."],
          ]),
        );
        return { bridge: "Twenty minutes tells you more than any PDF." };
      }
      if (/give me a number|ball ?park|straight answer|just tell me/.test(l)) {
        await say(["I hear you. Any number I gave you now would be a guess, and you deserve a real one."]);
        return { bridge: "Fifteen minutes with Khris gets you exactly that." };
      }
      if (/no budget|can'?t afford|too expensive|don'?t have (the )?(money|budget)/.test(l)) {
        await say(["Understood, budget matters.", "What we do depends on the type of capital and the work involved, so the starting point looks different for every company."]);
        return { bridge: "Let's find out what yours looks like." };
      }
      if (/\b(cost|costs|price|pricing|fees?|how much|charge|charges|upfront|up front|retainer)\b/.test(l)) {
        const n = count("fee");
        await say(n === 0 ? COST[0] : fresh(COST.slice(1)));
        return { match: true, bridge: n === 0 ? "Khris puts a real number on it once he knows your raise, no commitment needed." : "Twenty minutes with Khris settles it either way." };
      }
      if (/where (are you|is icfo|are you guys) (based|located)|what city|\boffices?\b/.test(l)) {
        await say(["We're based in La Jolla, California, with offices in Paris and Singapore. We work with founders and investors everywhere."]);
        return { bridge: "Easiest way to meet the team is a quick call." };
      }
      if (/how long|since when|track record|how many years/.test(l)) {
        await say(["Over 16 years, and the investor network was built over that time, so they're relationships, not a list."]);
        return { bridge: "Khris can tell you what that means for your raise." };
      }
      if (/\bspv\b/.test(l)) {
        await say(["Yes, we set up SPVs for specific deals: one vehicle, one line on your cap table, one close."]);
        return { bridge: "Khris can walk you through it." };
      }
      if (/^(thanks|thank you|thx|cheers)\b/.test(l)) {
        await say([booked ? "You're welcome. Talk soon." : "You're welcome."]);
        return { quiet: booked || aside };
      }
      if (/^(hi|hello|hey|bonjour)\b/.test(l) && l.length < 20) {
        await say(["Hi there."]);
        return { quiet: true };
      }
      return null;
    };

    /** Something said in the middle of one of Jessica's questions: answer it in a line or two. */
    const aside = async (raw: string) => {
      const out = await scripted(raw, true);
      if (out || cancelled) return;
      const reply = await askAi(raw, "ASIDE");
      await say(reply ? reply.lines : FALLBACK_ASIDE);
    };

    // ── Asking ──────────────────────────────────────────────────────
    /**
     * Ask one question and read the typed answer. Side talk is answered first
     * and the question comes back in new words. A bare number is checked
     * ("1 million?"), never guessed.
     */
    const askFor = async <T,>(question: string, parse: (text: string) => T | null, opts: { money?: boolean; again: string; hint: string }): Promise<T> => {
      await say([question]);
      let misses = 0;
      while (!cancelled) {
        const raw = await textIn();
        if (isSideTalk(raw)) {
          await aside(raw);
          await say(fresh([[`Back to you: ${lowerFirst(opts.again)}`], [`Anyway, ${lowerFirst(opts.again)}`], [opts.again]]));
          continue;
        }
        const value = parse(raw);
        if (value !== null) {
          sinceNew = 0;
          return value;
        }
        const n = opts.money ? bareNumber(raw) : null;
        if (n) {
          await say([fresh([[`Just to be sure: ${n} million?`], [`${n} million, right?`]])[0]]);
          const check = await textIn();
          const confirmed = yesNo(check) === "yes" ? parse(`${n}m`) : parse(check);
          if (confirmed !== null) {
            sinceNew = 0;
            return confirmed;
          }
          await say([opts.hint]);
          continue;
        }
        if (raw.trim().split(/\s+/).length > 6) {
          await aside(raw);
          await say([opts.again]);
          continue;
        }
        misses++;
        await say([misses > 1 ? opts.again : opts.hint]);
      }
      return new Promise<T>(() => {});
    };

    const askIndustry = (question: string, again: string) =>
      askFor<{ industry: Industry; text: string }>(
        question,
        (t) => {
          const found = industryOf(t);
          if (found) return { industry: found, text: t.trim() };
          if (/generalist|everything|any(thing)?\b|all sectors|agnostic/i.test(t)) return { industry: { label: "a generalist mandate", chips: [] }, text: t.trim() };
          const words = t.trim().split(/\s+/);
          return words.length <= 5 && t.trim().length >= 2 && !/^\d/.test(t.trim()) ? { industry: { label: t.trim().toLowerCase(), chips: [] }, text: t.trim() } : null;
        },
        { again, hint: "Just the industry is fine. Software, healthcare, energy, consumer, something else?" },
      );

    // ── The match ───────────────────────────────────────────────────
    const canMatch = () => !booked && !matched && !timeLoop && p.role === "Raising" && Boolean(p.stage && p.raise && p.industry) && matchOffers < 2;

    const showMatch = async () => {
      matched = true;
      await say(["Give me a second."]);
      setTyping(true);
      const [result] = await Promise.all([runMatch(), sleep(1200)]);
      setTyping(false);
      if (cancelled) return;
      if (!result || result.top.length === 0) {
        await say(["Your exact profile is thin in our network today, so I won't show you a weak list.", "Khris looks wider on the call; that's what it's for."]);
        await offerTimes("Twenty minutes, and he'll tell you who's realistic.");
        return;
      }
      const top = result.top.slice(0, 5);
      const who = p.industry && p.industry.chips.length ? p.industry.label : "your profile";
      push("jessica", `${top.length === 1 ? "One investor" : `${top.length} investors`} in our network who fit ${who} at your stage. Firms only here; the people come with the intro.`, { matches: top });
      said.add(questionKey("match"));
      await sleep(900);
      await say(["Get a warm intro, not a cold email."]);
      await offerTimes("Khris, our founder, takes the first call and makes the intros himself.");
    };

    const offerMatch = async () => {
      matchOffers++;
      await say([MATCH_QUESTIONS[(matchOffers - 1) % MATCH_QUESTIONS.length]]);
      const raw = await textIn();
      const yn = yesNo(raw);
      if (yn === "yes" || /\b(show|match|see)\b/i.test(raw)) {
        await showMatch();
        return;
      }
      if (yn === "no") {
        sinceNew = 2;
        await say(["No problem. Ask me anything, it's here when you want it."]);
        return;
      }
      await idle(raw);
    };

    // ── Times and booking ───────────────────────────────────────────
    const firstTwoDays = (slots: Slot[]): Slot[] => {
      const out: Slot[] = [];
      const days = new Set<string>();
      for (const s of [...slots].sort((a, b) => Date.parse(a.start) - Date.parse(b.start))) {
        const key = zonedParts(s.start, PLATFORM_TZ).dayKey;
        if (days.has(key)) continue;
        days.add(key);
        out.push(s);
        if (out.length === 2) break;
      }
      return out;
    };

    const timesFor = (opts: Slot[]) => timesLine(slotLabel(opts[0]), opts[1] ? slotLabel(opts[1]) : null, offered++);

    /** One of the times on offer, by day, time or "the first one". Null when it isn't clearly one of them. */
    const chooseFrom = (raw: string, opts: Slot[]): Slot | null => {
      const l = raw.toLowerCase();
      if (/can'?t|cannot|\bnot\b|\bno\b|neither|don'?t/.test(l)) return null;
      if (/\b(first|1st|former|earlier)\b/.test(l)) return opts[0] ?? null;
      if (/\b(second|2nd|latter|later one|last)\b/.test(l)) return opts[1] ?? null;
      const req = timeRequestOf(raw);
      if (!req) return opts.length === 1 && yesNo(raw) === "yes" ? opts[0] : null;
      const hits = opts.filter((o) => {
        const z = zonedParts(o.start, PLATFORM_TZ);
        return (req.weekday === undefined || z.weekday === req.weekday) && (req.minutes === undefined || z.minutes === req.minutes) && (req.minutes !== undefined || req.weekday !== undefined);
      });
      return hits.length === 1 ? hits[0] : null;
    };

    const offerTimes = async (lead: string) => {
      if (booked || timeLoop || cancelled) return;
      if (closes >= 2 && sinceNew < 2) {
        sinceNew++;
        return;
      }
      closes++;
      sinceNew = 0;
      const slots = await loadSlots();
      if (cancelled) return;
      if (!slots || slots.length === 0) {
        await say([`${lead} Pick any time that works for you here.`], calendarLink());
        return;
      }
      const opts = firstTwoDays(slots);
      await say([`${lead} ${timesFor(opts)}`]);
      await pickTime(opts, slots);
    };

    const pickTime = async (start: Slot[], slots: Slot[]) => {
      timeLoop = true;
      let opts = start;
      let quietNoted = false;
      while (!cancelled) {
        const raw = await textIn();
        const hit = chooseFrom(raw, opts);
        if (hit) {
          timeLoop = false;
          await contact(hit, false);
          return;
        }
        const req = isSideTalk(raw) ? null : timeRequestOf(raw);
        // "2pm" right after "Friday I have ..." means 2 PM that Friday.
        if (req && req.weekday === undefined && !req.tomorrow && opts.length && opts.every((o) => dayOnly(o) === dayOnly(opts[0]))) {
          req.weekday = zonedParts(opts[0].start, PLATFORM_TZ).weekday;
        }
        if (req) {
          const found = slotsFor(req, slots, PLATFORM_TZ);
          if (found.kind === "exact") {
            timeLoop = false;
            await say([`${slotLabel(found.slot)} Pacific. Yours, I'll hold it.`]);
            await contact(found.slot, true);
            return;
          }
          if (found.kind === "options") {
            opts = found.slots;
            const asked = req.weekday !== undefined ? ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][req.weekday] : "That day";
            if (found.full) await say([`${asked} is full. Closest I have is ${orList(opts.map(slotLabel))} Pacific.`]);
            else if (opts.every((o) => dayOnly(o) === dayOnly(opts[0]))) await say([`${dayOnly(opts[0])} I have ${orList(opts.map(timeOnly))} Pacific. Which one?`]);
            else await say([`I have ${orList(opts.map(slotLabel))} Pacific. Which one?`]);
            continue;
          }
          timeLoop = false;
          await say(["The calendar is full for the next few weeks. Pick anything that opens up here."], calendarLink());
          return;
        }
        if (declinesTimes(raw) || yesNo(raw) === "no") {
          await say([fresh([["No problem. Tell me a day and time that suits you, Pacific, and I'll hold it."], ["Sure. What day and time works for you, Pacific?"]])[0]]);
          continue;
        }
        if (isSideTalk(raw) || raw.trim().split(/\s+/).length > 5) {
          await aside(raw);
          if (closes < 3) {
            closes++;
            await say([timesFor(opts)]);
          } else if (!quietNoted) {
            quietNoted = true;
            await say(["Whenever you're ready, tell me a day that works."]);
          }
          continue;
        }
        await say([fresh([[`Which works better, ${orList(opts.map(slotLabel))}?`], ["Which one should I hold for you?"]])[0]]);
      }
    };

    const contact = async (slot: Slot, held: boolean) => {
      if (!email) {
        await say([held ? "What's the best email for the invite?" : `Holding ${slotLabel(slot)} Pacific. What's the best email for the invite?`]);
        while (!cancelled) {
          const raw = (await textIn()).trim();
          const found = raw.match(/[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]{2,}/)?.[0] ?? raw;
          if (validEmail(found)) {
            email = found;
            break;
          }
          if (isSideTalk(raw)) {
            await aside(raw);
            await say(["And the email for the invite?"]);
            continue;
          }
          await say(["That email doesn't look right. Can you type it again?"]);
        }
        await say(["And a phone number, in case Khris needs to reach you."]);
        let tries = 0;
        while (!cancelled) {
          const raw = (await textIn()).trim();
          if (validPhone(raw)) {
            phone = raw;
            break;
          }
          if (/^(no|skip|rather not|prefer not|n\/a|none)\b/i.test(raw)) break;
          if (isSideTalk(raw)) {
            await aside(raw);
            await say(["And the best number for you?"]);
            continue;
          }
          if (++tries >= 2) break;
          await say(["That doesn't look like a full number. Country code and all, please."]);
        }
      }

      setTyping(true);
      const result = await book(slot);
      setTyping(false);
      if (cancelled) return;
      if (result.ok) {
        booked = true;
        await say(
          [
            `Booked: ${formatSlotWhen(slot.start, PLATFORM_TZ, PLATFORM_TZ_LABEL)}, ${JESSICA2_SLOT_MINUTES} minutes with Khris.`,
            `Invite is on its way to ${email}${phone ? ", and Khris has your number" : ""}. Talk soon.`,
          ],
          result.meetUrl ? { href: result.meetUrl, hrefLabel: "Join Google Meet" } : undefined,
        );
        return;
      }
      await say([result.message]);
      if (!result.retry) {
        await say(["You can pick a time directly here."], calendarLink());
        return;
      }
      const fresher = await loadSlots(true);
      if (!fresher || fresher.length === 0) {
        await say(["Pick anything that works for you here."], calendarLink());
        return;
      }
      const opts = firstTwoDays(fresher);
      await say([`Here's what's open now: ${timesFor(opts)}`]);
      await pickTime(opts, fresher);
    };

    // ── Free conversation ───────────────────────────────────────────
    const afterSide = async (out: Outcome) => {
      if (booked || cancelled) return;
      if (out.match && canMatch()) {
        await offerMatch();
        return;
      }
      if (out.quiet) return;
      if (canMatch()) {
        await offerMatch();
        return;
      }
      await offerTimes(out.bridge ?? "Easiest next step is twenty minutes with Khris.");
    };

    /** Anything typed when Jessica isn't waiting on an answer. */
    const idle = async (raw: string): Promise<void> => {
      if (/show (me )?(the |a |my )?match|see (the )?investors|which investors/i.test(raw) && canMatch()) {
        await showMatch();
        return;
      }
      const out = await scripted(raw, false);
      if (cancelled) return;
      if (out) {
        await afterSide(out);
        return;
      }
      const mode: Mode = booked ? "DONE" : closes >= 2 && sinceNew < 2 ? "BREATHE" : offered > 0 && sinceNew < 2 ? "QUALIFY" : "CLOSE";
      const reply = await askAi(raw, mode);
      if (cancelled) return;
      const lines = reply ? reply.lines : FALLBACK_ASIDE;
      if (mode === "DONE") {
        await say(lines);
        return;
      }
      if (mode === "BREATHE") {
        sinceNew++;
        await say(reply?.question ? [...lines, reply.question] : lines);
        return;
      }
      if (mode === "QUALIFY") {
        sinceNew = 2;
        await say([...lines, reply?.question || "Are you raising right now, or just looking?"]);
        return;
      }
      await say(lines);
      await afterSide({ bridge: reply?.bridge || undefined });
    };

    submitRef.current = (value) => {
      if (busy || cancelled) return false;
      push("you", value);
      if (waiter) {
        const resolve = waiter;
        waiter = null;
        resolve(value);
        return true;
      }
      void idle(value);
      return true;
    };

    // ── The conversation ────────────────────────────────────────────
    const founder = async () => {
      let stage = await askFor<Stage | "revenue">("You're in the right place. What stage is the company at? Pre revenue, or already making money?", stageOf, {
        money: true,
        again: "What stage is the company at?",
        hint: "Roughly is fine: pre revenue, under $1M a year, or more?",
      });
      if (stage === "revenue") {
        stage = await askFor<Stage>(
          "Good. Roughly how much a year?",
          (t) => {
            const s = stageOf(t);
            return s && s !== "revenue" ? s : null;
          },
          { money: true, again: "Roughly how much revenue a year?", hint: "A rough number is fine, like 500K or 2M." },
        );
      }
      p.stage = stage;
      const stageBeat = stage === "Pre revenue" ? "Early. That's the hardest raise, and the most fun one." : stage === "Over $5M a year" ? "Solid. You've done the hard part." : "Okay, real revenue. That changes the conversation with investors.";

      const ind = await askIndustry(`${stageBeat} Which industry are you in?`, "Which industry are you in?");
      p.industry = ind.industry;
      p.industryText = ind.text;
      const covered = coveredBy(ind.industry, await loadSectors());
      const indBeat = covered ? `Good, we have investors active in ${ind.industry.label}.` : "Got it.";

      p.raise = await askFor(`${indBeat} Roughly how much are you looking to raise?`, raiseOf, {
        money: true,
        again: "Roughly how much are you raising?",
        hint: "A rough number is fine, like 750K or 3M.",
      });
      p.timing = await askFor("And how soon do you want to close? Weeks, months, or not sure yet?", timingOf, {
        again: "How soon do you want to close?",
        hint: "Weeks, months, or not sure yet?",
      });
      const timingBeat = p.timing === "Within 30 days" ? "Thirty days. Tight, so I won't waste your time." : p.timing === "A few months" ? "A few months is a good runway." : "No rush, then. Good.";
      const timingSaid = p.timing === "Within 30 days" ? "closing within 30 days" : p.timing === "A few months" ? "closing in a few months" : "timing open";
      await say([timingBeat, `So: ${STAGE_SAID[p.stage]}, ${p.industry.label}, raising ${p.raise}, ${timingSaid}. Noted.`, "I already have what icapos.com/fit would ask you, so no need to type it twice."]);
      await offerMatch();
    };

    const investor = async () => {
      p.check = await askFor("Good to know. What size checks do you usually write?", checkOf, {
        money: true,
        again: "What size checks do you usually write?",
        hint: "A rough range is fine, like 100K or 1M.",
      });
      const beat = p.check === "$5M plus" ? "Serious money." : "Got it.";
      const ind = await askIndustry(`${beat} Which sectors do you focus on?`, "Which sectors do you focus on?");
      p.industry = ind.industry;
      p.industryText = ind.text;
      await say(["Checks like that are exactly what the deals we bring need."]);
      await offerTimes("Khris, our founder, takes the first call himself. Twenty minutes to see the deal flow.");
    };

    const intro = async () => {
      void loadSectors();
      const h = new Date().getHours();
      const greet = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
      await say([`${greet}, I'm Jessica with iCFO Capital Global.`, "We help companies raise capital by putting them in front of the right investors. Are you raising, or looking at deals?"]);
      while (!cancelled) {
        const raw = await textIn();
        const role = roleOf(raw);
        if (isSideTalk(raw)) await aside(raw);
        if (role === "Raising" || role === "Investing") {
          p.role = role;
          break;
        }
        if (role === "more" && !isSideTalk(raw)) {
          await say([...fresh(WHAT), "Are you raising, or investing?"]);
          continue;
        }
        await say([fresh([["Just so I point you right: are you the company raising, or the one investing?"], ["Are you raising capital, or looking at deals?"]])[0]]);
      }
      if (p.role === "Raising") await founder();
      else await investor();
    };

    const timer = setTimeout(() => {
      void intro();
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [hostId, sourceTag]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs, typing]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const value = draft.trim();
    if (!value) return;
    if (submitRef.current(value)) setDraft("");
  };

  return (
    <div
      role="region"
      aria-label="Conversation with Jessica"
      className="flex h-[min(680px,calc(100dvh-3rem))] min-h-[440px] w-full max-w-[520px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
    >
      <div ref={scrollRef} aria-live="polite" className="flex flex-1 flex-col gap-1.5 overflow-y-auto px-4 pb-2 pt-5">
        {msgs.map((m, i) => {
          const first = i === 0 || msgs[i - 1].from !== m.from;
          const fromYou = m.from === "you";
          return (
            <div
              key={m.id}
              className={`relative shrink-0 pl-[52px] text-[15px] leading-snug text-slate-900 ${first ? "mt-4 min-h-[44px]" : ""} ${fromYou ? "ml-6" : ""}`}
            >
              {first ? (
                <>
                  {fromYou ? (
                    <div className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">
                      You
                    </div>
                  ) : (
                    <Image src="/jessica.jpg" alt="Jessica" width={40} height={40} className="absolute left-0 top-0 h-10 w-10 rounded-full object-cover" />
                  )}
                  <div className="mb-0.5 text-[15px] font-semibold leading-tight">
                    {fromYou ? "You" : "Jessica"}
                    {fromYou ? null : <span className="block text-[13px] font-normal text-slate-500">iCFO Capital Global, Inc.</span>}
                  </div>
                </>
              ) : null}
              <div className="break-words">{m.text}</div>
              {m.matches ? (
                <div className="mt-2 flex flex-col gap-1.5">
                  {m.matches.map((r) => (
                    <div key={r.key} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-semibold text-slate-900">{r.company ?? r.title}</p>
                        <p className="mt-0.5 text-[12px] text-slate-500">{r.company ? [r.title, r.detail].filter(Boolean).join(" · ") : r.detail}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-[12px] font-semibold tabular-nums text-emerald-700">{Math.round(r.fit)}% fit</span>
                    </div>
                  ))}
                </div>
              ) : null}
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
          <div className="flex shrink-0 gap-1 py-2.5 pl-[52px]" aria-label="Jessica is typing">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400" />
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400 [animation-delay:150ms]" />
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400 [animation-delay:300ms]" />
          </div>
        ) : null}
      </div>

      <div className="border-t border-slate-200 px-3.5 pb-2 pt-2.5">
        <form onSubmit={submit} className="flex gap-2">
          <label htmlFor="jessica2-input" className="sr-only">
            Reply to Jessica
          </label>
          <input
            id="jessica2-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Reply to Jessica…"
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
        <p className="mt-2 text-center font-mono text-[10px] leading-snug text-slate-500">{JESSICA_DISCLAIMER}</p>
      </div>
    </div>
  );
}
