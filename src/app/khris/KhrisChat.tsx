"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { PLATFORM_TZ, PLATFORM_TZ_LABEL } from "@/lib/time/platform-tz";
import { JESSICA_DISCLAIMER } from "@/lib/jessica/config";
import { formatSlotWhen, parseAiReply, questionKey, validEmail, type JessicaAiReply, type Slot } from "@/lib/jessica/flow";
import type { PublicMatch, PublicMatchResponse } from "@/lib/fit/public-match";
import { MATCH_QUESTIONS, timesLine } from "@/lib/jessica2/config";
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
  slotsFor,
  timeRequestOf,
  timingOf,
  validPhone,
  yesNo,
  zonedParts,
  type Industry,
  type Jessica2Profile,
  type Stage,
} from "@/lib/jessica2/parse";
import { AGAIN, HINTS, KHRIS_BOOKING_NOTE, KHRIS_FALLBACK_ASIDE, KHRIS_SLOT_MINUTES, LEADS } from "@/lib/khris/config";
import { founderSignal, investorSignal, isKhrisSideTalk, khrisRoleOf, khrisStageOf, topicOf } from "@/lib/khris/parse";

type Msg = { id: number; from: "khris" | "you"; text: string; href?: string; hrefLabel?: string; matches?: PublicMatch[] };
type Extra = Pick<Msg, "href" | "hrefLabel" | "matches">;
type Turn = { role: "user" | "assistant"; content: string };
type Mode = "CLOSE" | "QUALIFY" | "DONE" | "ASIDE" | "BREATHE";
/** What a written answer asks for next when the chat isn't in the middle of a question. `stop` means the visitor said no: stop asking. */
type Outcome = { bridge?: string; match?: boolean; quiet?: boolean; stop?: boolean };
type BookResult = { ok: true; meetUrl: string | null } | { ok: false; retry: boolean; message: string };
type AskKind = keyof typeof AGAIN;

/** Thrown when the visitor corrects which side they're on; the conversation restarts on the right path. */
class RoleSwitch extends Error {}

const WHAT = [
  ["We get founders in front of the right investors.", "I rate how ready you are, match you with investors whose mandate fits, and follow up with them for you."],
  ["Short version: readiness, the right investors, and real follow up."],
  ["We get companies investor ready, match them with investors whose mandate fits, and handle the follow up."],
];
const HOW = [
  ["Three steps. I rate how ready you are, match you with the right investors from a network built over 16 years, and get your materials in front of them.", "Then I follow up with the ones who show interest."],
  ["Rate, match, outreach. You bring the company, I bring the investors and the follow up."],
  ["It starts with a readiness check, then a matched investor list, then I run the outreach with you."],
];
const COST = [
  ["There's no price list, and I won't pretend there is.", "The fee follows the work: what kind of capital, and how much preparation and outreach it takes to get you in front of the right investors."],
  ["Same answer, short version: you pay for the work, never a cut of the raise.", "The scope sets the fee, and you see it before anything starts."],
  ["Put simply, the fee pays for the work, not a share of your round.", "You'll see the scope and fee in writing first."],
];
const MAKE_MONEY = [
  ["I'm paid a fee for the work, agreed before we start. Never a cut of what you raise."],
  ["You pay for the work, scoped and agreed first. Nothing comes out of your raise."],
  ["A fee for the work, set once we scope it. It's never tied to the money raised."],
];
const AI_LINES = [
  ["I'm an AI assistant for Khris, and I'm confident I can help with what you need.", "Want Khris on the call in person?"],
  ["Yes, still Khris's AI assistant, and still confident I can help you here.", "Want me to put you on his calendar?"],
  ["I'm an AI assistant for Khris. Whatever you need here, I can handle it, and Khris takes the call himself.", "Shall I set that up?"],
];

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
/** "saas" reads back as "SaaS", "ai" as "AI". */
const tidy = (s: string) => s.replace(/\bsaas\b/gi, "SaaS").replace(/\bai\b/gi, "AI");

/** "Tuesday 9:00 AM", or "Tue, Oct 20 at 9:00 AM" once it's more than six days out. */
function slotLabel(slot: Slot): string {
  const when = new Date(slot.start);
  const far = when.getTime() - Date.now() > 6 * 24 * 60 * 60 * 1000;
  const day = new Intl.DateTimeFormat("en-US", far ? { timeZone: PLATFORM_TZ, weekday: "short", month: "short", day: "numeric" } : { timeZone: PLATFORM_TZ, weekday: "long" }).format(when);
  const time = new Intl.DateTimeFormat("en-US", { timeZone: PLATFORM_TZ, hour: "numeric", minute: "2-digit" }).format(when);
  return `${day}${far ? " at" : ""} ${time}`.replace(/[  ]/g, " ");
}
function timeOnly(slot: Slot): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: PLATFORM_TZ, hour: "numeric", minute: "2-digit" }).format(new Date(slot.start)).replace(/[  ]/g, " ");
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
 * The Khris chat: Jessica 2.0's typed conversation, investor match and booking,
 * speaking as Khris. Differences from 2.0: the visitor can correct which side
 * they're on at any point; a question asked again comes back in new words and
 * stops after two re-asks; "not interested" ends the pushing; any written line
 * that has run out of new wordings is rewritten by the AI so nothing repeats.
 */
export function KhrisChat({ hostId, sourceTag }: { hostId: string; sourceTag: string | null }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const submitRef = useRef<(value: string) => boolean>(() => false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let busy = false;
    let booked = false;
    let paused = false; // the visitor said they're not interested: answer, never push
    let switched = false;
    let helpLead = false;
    let nextId = 1;
    let waiter: ((value: string) => void) | null = null;
    const p: Jessica2Profile = {};
    const said = new Set<string>();
    const history: string[] = [];
    const used = new Map<string, number>();
    const turns: Turn[] = [];
    const sessionId = Math.random().toString(36).slice(2, 14);
    let offered = 0;
    let closes = 0;
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

    /** Lines already said get new words from the AI before they go out; if it can't, the line goes out as written. */
    const vary = async (lines: string[]): Promise<string[]> => {
      const idx = lines.map((l, i) => (l.length >= 16 && said.has(questionKey(l)) ? i : -1)).filter((i) => i >= 0);
      if (idx.length === 0) return lines;
      setTyping(true);
      try {
        const res = await fetch("/api/khris/reply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "REWRITE", lines: idx.map((i) => lines[i]), earlier: history.slice(-25), sessionId }),
        });
        const data = res.ok ? ((await res.json()) as { lines?: string[] }) : null;
        const out = [...lines];
        idx.forEach((i, k) => {
          const t = data?.lines?.[k];
          if (t && !said.has(questionKey(t))) out[i] = t;
        });
        return out;
      } catch {
        return lines;
      } finally {
        setTyping(false);
      }
    };

    const say = async (input: string[], extra?: Extra) => {
      busy = true;
      const lines = await vary(input);
      lines.forEach((l) => said.add(questionKey(l)));
      history.push(...lines);
      if (history.length > 40) history.splice(0, history.length - 40);
      for (let i = 0; i < lines.length; i++) {
        if (cancelled) return;
        setTyping(true);
        await sleep(350 + Math.min(lines[i].length * 12, 700));
        if (cancelled) return;
        setTyping(false);
        push("khris", lines[i], i === lines.length - 1 ? extra : undefined);
        await sleep(150);
      }
      busy = false;
    };

    const textIn = () =>
      new Promise<string>((resolve) => {
        waiter = resolve;
      });

    /** The first wording none of whose lines has been said; when all are used, the last one (say() rewrites it). */
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
        paused && "Said they are not interested; do not push a call",
      ]
        .filter(Boolean)
        .join("; ");

    const askAi = async (text: string, mode: Mode): Promise<JessicaAiReply | null> => {
      turns.push({ role: "user", content: text.slice(0, 600) });
      if (turns.length > 12) turns.splice(0, turns.length - 12);
      const call = async (): Promise<JessicaAiReply | null> => {
        try {
          const res = await fetch("/api/khris/reply", {
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
          `&duration=${KHRIS_SLOT_MINUTES}`;
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
            note: KHRIS_BOOKING_NOTE,
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

    // ── Written answers ─────────────────────────────────────────────
    /**
     * Answers that are written, not generated. `aside` means the chat is in the
     * middle of a question of its own: answer in a line or two and never ask a
     * follow up; the question comes back right after.
     */
    const scripted = async (raw: string, aside: boolean): Promise<Outcome | null> => {
      const l = raw.toLowerCase().replace(/’/g, "'");
      const topic = topicOf(raw);
      if (!topic) return null;
      switch (topic) {
        case "ai": {
          const lines = fresh(AI_LINES);
          if (aside) {
            await say([lines[0]]);
            return { quiet: true };
          }
          await say(lines);
          const answer = await textIn();
          if (yesNo(answer) === "yes" || /\b(yes|please|sure)\b/i.test(answer)) {
            sinceNew = 0;
            paused = false;
            return { bridge: "Let's get you on Khris's calendar." };
          }
          if (yesNo(answer) === "no") {
            sinceNew = 2;
            await say([fresh([["No problem, I've got you."], ["Sure, no rush."]])[0]]);
            return { quiet: true };
          }
          await idle(answer);
          return { quiet: true };
        }
        case "name":
          await say(fresh([["I'm Khris Thetsy, founder of iCFO Capital Global. I help founders and investors get to the right people."], ["Khris Thetsy. I run iCFO Capital Global, putting founders in front of the right investors."]]));
          return { bridge: "I take the first call myself." };
        case "license":
          await say(
            fresh([
              ["We're not a registered broker dealer or investment adviser.", "We don't sell securities or give investment advice. We're an investor relations firm."],
              ["Not registered as a broker dealer or investment adviser, and we don't act as one.", "Investor relations is our work: readiness, introductions and follow up."],
            ]),
          );
          return { bridge: "Happy to walk you through how we work on a quick call." };
        case "broker":
          await say(
            fresh([
              ["No. We're an investor relations firm, not a broker dealer.", "We help companies with capital acquisition, and we don't sell securities."],
              ["Not a broker dealer, no. We're an investor relations firm.", "We help companies acquire capital, and we never sell securities."],
              ["No, still not a broker dealer. Investor relations is what we do.", "Our work is getting companies in front of investors. Selling securities isn't part of it."],
            ]),
          );
          return { bridge: "I can walk you through how it works on a quick call." };
        case "fund":
          await say(
            fresh([
              ["No fund, and I don't invest my own money in companies.", "I connect companies that are raising with investors whose mandate fits."],
              ["No, we're not a fund and we don't write checks.", "Our job is getting you in front of the investors who do."],
            ]),
          );
          return { match: true, bridge: "Happy to show you how on a quick call." };
        case "investorsCount":
          await say(
            fresh([
              ["Over 7,000 investor relationships, built over 16 years.", "Angels, family offices, VCs and institutions, and I know who invests in what."],
              ["More than 7,000, and every one came from a real relationship.", "That's why I match on mandate, never by blast."],
            ]),
          );
          return { match: true, bridge: "Let's see who fits you on a quick call." };
        case "backend":
          used.set("fee", (used.get("fee") ?? 0) + 1);
          paused = false;
          await say(
            fresh([
              ["I can't tie my fee to money raised. That's how it stays clean, since we're not a broker dealer.", "What I can do is scope it to the work you actually need, so you only pay for that."],
              ["Fees tied to the raise aren't something I do; that's broker territory.", "I keep the scope tight instead, so the fee matches what you really need."],
            ]),
          );
          return { bridge: "Let's size the work on a quick call." };
        case "contact":
          await say(fresh([["The best way to reach me is a call on my calendar.", "Book a time and you'll have my email with the invite."], ["Easiest is a time on my calendar; my contact details come with the invite."]]));
          return { bridge: "Here's what I have open." };
        case "valuation":
          await say(fresh([["Valuation comes up in every raise, and investors will test yours.", "I'll go through how we'd approach it for your company on the call."], ["Every investor will push on valuation.", "Better to talk it through with your numbers in front of us, on a call."]]));
          return { bridge: "Twenty minutes with me covers it." };
        case "refund":
          await say(
            fresh([
              ["The fee pays for the work, not the outcome, because nobody can promise a raise.", "You see the full scope in writing before anything starts."],
              ["No refund tied to results; the work is what you pay for.", "And you know exactly what that work is before you commit."],
            ]),
          );
          return { bridge: "I'll walk you through the scope on a quick call." };
        case "references":
          await say(
            fresh([
              ["Yes. I share references on the call, matched to founders closest to your stage and industry."],
              ["Happy to. References come on the call, picked to match your stage and sector."],
            ]),
          );
          return { bridge: "Twenty minutes and you'll have names to call." };
        case "timeline":
          await say(
            fresh([
              ["It depends on how ready you are when we start.", "Readiness is the part I can speed up; investor decisions run on their own clock."],
              ["Readiness sets the pace. I move that part fast; investors decide on their own time."],
            ]),
          );
          return { match: true, bridge: "A short call tells you where you stand today." };
        case "investorTypes":
          await say(
            fresh([
              ["Angels, family offices, VCs, private equity and institutions, in a network built over 16 years.", "I match on mandate, never a mass list."],
              ["A mix: angels, family offices, funds and institutions.", "What matters is whose mandate fits you, and that's what I match on."],
            ]),
          );
          return { match: true, bridge: "Let's see which of them fit you on a quick call." };
        case "stageFit":
          await say(
            fresh([
              ["Yes. We work from pre revenue up.", "At that stage readiness is exactly what I work on first."],
              ["We do. Early companies are where readiness makes the biggest difference."],
            ]),
          );
          return { bridge: "A short call tells you where you stand." };
        case "successRate":
          await say(
            fresh([
              ["I don't publish a success rate. Every raise is different, and introductions are best efforts.", "What I can show you is who in the network actually fits your company."],
              ["No headline number from me. Each raise is its own case.", "Better to show you who actually fits your company."],
            ]),
          );
          return { match: true, bridge: "That starts with a short call." };
        case "process":
          await say(
            fresh([
              ["Qualifying is simple: stage, industry, raise size and timing.", "Then I check your fit against investors whose mandate matches. No fit, no pitch."],
              ["Four things: stage, industry, how much, and when.", "Then a fit check against the network before anyone gets pitched."],
            ]),
          );
          return { bridge: "I'll walk you through it on a short call." };
        case "makeMoney": {
          count("fee");
          const objection = /upfront|up front|don'?t pay|not paying|not interested to pa/.test(l) ? ["Fair. Most founders I talk to feel the same way about upfront fees."] : [];
          const process = /qualif|process|criteria/.test(l) ? ["As for qualifying: stage, industry, raise size and timing, then a fit check against the network."] : [];
          await say([...objection, ...fresh(MAKE_MONEY), ...process]);
          return { bridge: "I'll lay it out properly on a quick call." };
        }
        case "upfront": {
          used.set("fee", (used.get("fee") ?? 0) + 1);
          if (count("upfront") === 0) {
            await say(["Fair. Most founders I talk to feel the same way.", "How I make money: a fee for the work, agreed once I know your capital and the scope. Nothing is tied to what you raise."]);
          } else {
            await say(
              fresh([
                ["Understood. The fee follows the work, and nothing is tied to what you raise.", "I lay out the scope and the fee before anything starts, so there are no surprises."],
                ["Same principle: the fee is for the work, never a share of the raise.", "You'll see the scope and fee in writing first."],
              ]),
            );
          }
          return { bridge: "I'll lay it out on a quick call, no commitment." };
        }
        case "commission":
          used.set("fee", (used.get("fee") ?? 0) + 1);
          await say(
            fresh([
              ["No commission. We're not a broker dealer, and nothing I charge is tied to money raised.", "What I charge depends on the kind of capital and the work it takes to get you investor ready."],
              ["Still no commission and no success fee. The fee is for the work, never a cut of the raise."],
            ]),
          );
          return { bridge: "I walk you through the structure on a quick call." };
        case "scam":
          await say([
            ...fresh([["Fair to check. 16 years, offices in La Jolla, Paris and Singapore, and 7,000 plus investor relationships built one at a time."], ["Check us out anytime. We've built this over 16 years, relationship by relationship."]]),
            ...(aside ? [] : ["If something specific went wrong, tell me and I'll look at it myself."]),
          ]);
          sinceNew = 2;
          return { quiet: true };
        case "guarantee":
          await say(fresh([["Nobody can promise a raise, and anyone who does is someone to avoid.", "What I promise is the right investors in front of you and real follow up."], ["No one can guarantee capital. I guarantee the work: the right investors and steady follow up."]]));
          return { bridge: "I can show you what that looks like." };
        case "what":
          await say(fresh(WHAT));
          return { match: true, bridge: "Easiest way to see if it fits is twenty minutes with me." };
        case "how":
          await say(fresh(HOW));
          return { match: true, bridge: "Twenty minutes with me and you'll see it on your own company." };
        case "showMatch":
          return { match: true, bridge: "I can tell you who's realistic for your raise." };
        case "notInterested": {
          paused = true;
          const ind = p.industry && p.industry.chips.length ? p.industry.label : null;
          if (ind && count("notInterested") === 0) await say(["No problem at all.", `Before you go: I have investors active in ${ind}. Say the word if you want to see them.`]);
          else await say(fresh([["No problem at all. If you're raising later, I'm here."], ["Understood. When the raise is on, come back."], ["No worries. The door stays open."]]));
          return { quiet: true, stop: true };
        }
        case "notFit": {
          await say(fresh([["Fair, and you'd know your company better than I do."], ["Fair enough, you know your business best."]]));
          if (aside) return { quiet: true };
          await say([fresh([["What's the part that doesn't fit: the stage, the investors, or the timing?"], ["Which part feels off: stage, investors, or timing?"]])[0]]);
          const answer = (await textIn()).toLowerCase();
          sinceNew = 0;
          if (/stage/.test(answer)) {
            await say(["We work from pre revenue up. Readiness is exactly what I work on first."]);
            return { bridge: "Twenty minutes with me tells you if it's real." };
          }
          if (/investor/.test(answer)) {
            await say(["Then let's test it right here."]);
            return { match: true, bridge: "I can tell you who's realistic." };
          }
          await say(["Timing I can work around. Nothing starts until you say so."]);
          return { bridge: "Twenty minutes now saves you the scramble later." };
        }
        case "notNow": {
          await say(fresh([["No problem, no pressure."], ["That's fine, no rush."]]));
          if (aside) return { quiet: true };
          sinceNew = 2;
          await say(["So I'm useful anyway: what would you want to know first, the cost, the investors, or how it works?"]);
          const answer = await textIn();
          sinceNew = 0;
          if (/invest/i.test(answer)) {
            await say(["Angels, family offices, VCs and institutions, in a network built over 16 years. I match on mandate, not a mass list."]);
            return { match: true, quiet: true };
          }
          if (/cost|fee|price|money/i.test(answer)) {
            await say(fresh(COST));
            return { quiet: true };
          }
          await say(fresh(HOW));
          return { quiet: true };
        }
        case "board":
          await say(fresh([["Of course, that's a decision worth making together."], ["Makes sense to decide that together."]]));
          return { bridge: "A call with me gives you something concrete to bring to them." };
        case "sendInfo":
          await say(fresh([["Happy to. I send material after a short call, so it fits your raise instead of a generic PDF."], ["Straight answer: there's no generic deck. I send what fits after twenty minutes together."]]));
          return { bridge: "Twenty minutes tells you more than any PDF." };
        case "number":
          await say(fresh([["A number now would be a guess, and I don't hand out guesses."], ["You'll get a real number once I know the scope, not before."]]));
          return { bridge: "Fifteen minutes with me gets you exactly that." };
        case "budget":
          await say(fresh([["Understood, budget matters.", "The scope shapes the cost, so every company starts in a different place."], ["Fair, budget is real.", "The fee is scoped per company, so there's no single starting point."]]));
          return { bridge: "Let's find out what yours looks like." };
        case "cost": {
          const n = count("fee");
          const pushed = n > 0 && /how much|exact|number|ball ?park/.test(l);
          await say(pushed ? ["I'd be guessing, and I don't guess with other people's money.", "Equity, debt, an SPV: each is a different amount of work, and the fee follows the work. Nothing is tied to what you raise."] : fresh(COST));
          return { match: true, bridge: n === 0 ? "Tell me the raise on a quick call and I'll give you a real number." : "Twenty minutes with me settles it either way." };
        }
        case "where":
          await say(fresh([["La Jolla, California is home base, with offices in Paris and Singapore.", "We work with founders and investors everywhere."], ["Still La Jolla, Paris and Singapore. Location has never limited who we work with."]]));
          return { bridge: "Easiest way to meet is a quick call." };
        case "years":
          await say(fresh([["Over 16 years, and the investor network was built over that time, so they're relationships, not a list."], ["16 years now. Every investor in the network came from a real relationship."]]));
          return { bridge: "I can tell you what that means for your raise." };
        case "spv":
          await say(fresh([["Yes, we set up SPVs for specific deals: one vehicle, one line on your cap table, one close."], ["We do. One SPV per deal pulls investors into a single line on your cap table."]]));
          return { bridge: "I can walk you through it." };
        case "thanks":
          await say(booked ? ["You're welcome. Talk soon."] : fresh([["You're welcome."], ["Anytime."], ["Glad to help."]]));
          return { quiet: booked || aside };
        case "hello":
          await say(fresh([["Hi there."], ["Hello again."]]));
          return { quiet: true };
      }
      return null;
    };

    /** Something said in the middle of one of the chat's questions: answer it in a line or two. True when the visitor said no. */
    const aside = async (raw: string): Promise<boolean> => {
      const out = await scripted(raw, true);
      if (cancelled) return false;
      if (out) return Boolean(out.stop);
      const reply = await askAi(raw, "ASIDE");
      await say(reply ? reply.lines : fresh(KHRIS_FALLBACK_ASIDE));
      return false;
    };

    // ── Asking ──────────────────────────────────────────────────────
    /**
     * Ask one question and read the typed answer. Side talk is answered first,
     * then the question comes back in new words, at most twice, then once more
     * as a gentle "whenever you're ready" and never again. A visitor correcting
     * which side they're on restarts the conversation on the right path.
     */
    const askFor = async <T,>(kind: AskKind, question: string, parse: (text: string) => T | null, opts: { money?: boolean; hint: string; industry?: boolean }): Promise<T> => {
      await say([question]);
      let misses = 0;
      let reasks = 0;
      let quiet = paused;
      const reask = async () => {
        if (quiet || cancelled) return;
        if (reasks >= 2) {
          quiet = true;
          await say([fresh([[`Whenever you're ready, just tell me ${HINTS[kind]}.`], [`No rush. When you want, tell me ${HINTS[kind]}.`]])[0]]);
          return;
        }
        reasks++;
        const n = count(`again:${kind}`);
        const qs = AGAIN[kind];
        await say([`${LEADS[n % LEADS.length]}${lowerFirst(qs[(n + 1) % qs.length])}`]);
      };
      while (!cancelled) {
        const raw = await textIn();
        const value = parse(raw);
        const openToSignal = value === null || Boolean(opts.industry);
        if (founderSignal(raw) && openToSignal) {
          if (p.role === "Investing") {
            p.role = "Raising";
            p.check = undefined;
            p.industry = undefined;
            p.industryText = undefined;
            switched = true;
            paused = false;
            await say(["Got it, you're the one raising. That's exactly what I do."]);
            throw new RoleSwitch();
          }
          // Saying it again means they're back in the conversation: ask afresh.
          paused = false;
          quiet = false;
          reasks = 0;
          await say([fresh([["Understood, you're raising. I have that."], ["Right, you're raising. Noted."], ["Raising, got it."]])[0]]);
          await reask();
          continue;
        }
        if (investorSignal(raw) && openToSignal && p.role === "Raising") {
          p.role = "Investing";
          p.stage = undefined;
          p.industry = undefined;
          p.industryText = undefined;
          p.raise = undefined;
          p.timing = undefined;
          switched = true;
          paused = false;
          await say(["Got it, you're investing."]);
          throw new RoleSwitch();
        }
        if (isKhrisSideTalk(raw)) {
          if (await aside(raw)) quiet = true;
          else await reask();
          continue;
        }
        if (value !== null) {
          sinceNew = 0;
          paused = false;
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
        if (quiet || raw.trim().split(/\s+/).length > 6) {
          await aside(raw);
          await reask();
          continue;
        }
        misses++;
        if (misses > 1) await reask();
        else await say([opts.hint]);
      }
      return new Promise<T>(() => {});
    };

    const industryParse =
      (sectorMode: boolean) =>
      (t: string): { industry: Industry; text: string } | null => {
        const found = industryOf(t);
        if (found) return { industry: { ...found, label: tidy(found.label) }, text: t.trim() };
        if (sectorMode && /generalist|everything|any(thing)?\b|all sectors|agnostic/i.test(t)) return { industry: { label: "a generalist mandate", chips: [] }, text: t.trim() };
        const words = t.trim().split(/\s+/);
        return words.length <= 5 && t.trim().length >= 2 && !/^\d/.test(t.trim()) && !isSideTalk(t) && !isKhrisSideTalk(t) && !topicOf(t) && !/^(do|does|can|could|are|is|what|how|why|will|would|should|who|where)\b|\byou\b/i.test(t.trim()) ? { industry: { label: tidy(t.trim().toLowerCase()), chips: [] }, text: t.trim() } : null;
      };

    // ── The match ───────────────────────────────────────────────────
    const canMatch = () => !booked && !paused && !matched && !timeLoop && p.role === "Raising" && Boolean(p.stage && p.raise && p.industry) && matchOffers < 2;

    const showMatch = async () => {
      matched = true;
      await say(["Give me a second."]);
      setTyping(true);
      const [result] = await Promise.all([runMatch(), sleep(1200)]);
      setTyping(false);
      if (cancelled) return;
      if (!result || result.top.length === 0) {
        await say(["Your exact profile is thin in my network today, so I won't show you a weak list.", "I look wider on the call; that's what it's for."]);
        await offerTimes("Twenty minutes, and I'll tell you who's realistic.");
        return;
      }
      const top = result.top.slice(0, 5);
      const who = p.industry && p.industry.chips.length ? p.industry.label : "your profile";
      push("khris", `${top.length === 1 ? "One investor" : `${top.length} investors`} in my network who fit ${who} at your stage. Firms only here; the people come with the intro.`, { matches: top });
      said.add(questionKey("match"));
      await sleep(900);
      await say(["Get a warm intro, not a cold email."]);
      await offerTimes("I take the first call and make the intros myself.");
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
      if (booked || timeLoop || paused || cancelled) return;
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
        const req = isKhrisSideTalk(raw) ? null : timeRequestOf(raw);
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
          await say(["My calendar is full for the next few weeks. Pick anything that opens up here."], calendarLink());
          return;
        }
        if (topicOf(raw) === "notInterested") {
          timeLoop = false;
          await scripted(raw, true);
          return;
        }
        if (declinesTimes(raw) || yesNo(raw) === "no") {
          await say([fresh([["No problem. Tell me a day and time that suits you, Pacific, and I'll hold it."], ["Sure. What day and time works for you, Pacific?"]])[0]]);
          continue;
        }
        if (isKhrisSideTalk(raw) || raw.trim().split(/\s+/).length > 5) {
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
          if (isKhrisSideTalk(raw)) {
            await aside(raw);
            await say([fresh([["And the email for the invite?"], ["What email should the invite go to?"]])[0]]);
            continue;
          }
          await say(["That email doesn't look right. Can you type it again?"]);
        }
        await say(["And a phone number, in case I need to reach you."]);
        let tries = 0;
        while (!cancelled) {
          const raw = (await textIn()).trim();
          if (validPhone(raw)) {
            phone = raw;
            break;
          }
          if (/^(no|skip|rather not|prefer not|n\/a|none)\b/i.test(raw)) break;
          if (isKhrisSideTalk(raw)) {
            await aside(raw);
            await say([fresh([["And the best number for you?"], ["What's a good number for you?"]])[0]]);
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
            `Booked: ${formatSlotWhen(slot.start, PLATFORM_TZ, PLATFORM_TZ_LABEL)}, ${KHRIS_SLOT_MINUTES} minutes with me.`,
            `Invite is on its way to ${email}${phone ? ", and I have your number" : ""}. Talk soon.`,
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
      if (booked || paused || cancelled) return;
      if (out.match && canMatch()) {
        await offerMatch();
        return;
      }
      if (out.quiet) return;
      if (canMatch()) {
        await offerMatch();
        return;
      }
      await offerTimes(out.bridge ?? "Easiest next step is twenty minutes with me.");
    };

    /** Anything typed when the chat isn't waiting on an answer. */
    const idle = async (raw: string): Promise<void> => {
      if (/show (me )?(the |a |my )?match|see (the )?investors|which investors/i.test(raw) && canMatch()) {
        await showMatch();
        return;
      }
      if (founderSignal(raw) || investorSignal(raw)) paused = false;
      const out = await scripted(raw, false);
      if (cancelled) return;
      if (out) {
        await afterSide(out);
        return;
      }
      const mode: Mode = booked ? "DONE" : paused || (closes >= 2 && sinceNew < 2) ? "BREATHE" : offered > 0 && sinceNew < 2 ? "QUALIFY" : "CLOSE";
      const reply = await askAi(raw, mode);
      if (cancelled) return;
      const lines = reply ? reply.lines : fresh(KHRIS_FALLBACK_ASIDE);
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
      const lead = switched ? "" : helpLead ? "Yes, that's exactly what I do. " : "You're in the right place. ";
      let stage = await askFor<Stage | "revenue">("stage", `${lead}${AGAIN.stage[0]}`, khrisStageOf, {
        money: true,
        hint: "Roughly is fine: pre revenue, under $1M a year, or more?",
      });
      if (stage === "revenue") {
        stage = await askFor<Stage>(
          "revenue",
          "Good, real revenue. Roughly how much a year?",
          (t) => {
            const s = khrisStageOf(t);
            return s && s !== "revenue" ? s : null;
          },
          { money: true, hint: "A rough number is fine, like 500K or 2M." },
        );
      }
      p.stage = stage;
      const stageBeat = stage === "Pre revenue" ? "Pre revenue, got it. Readiness matters most at this stage." : stage === "Over $5M a year" ? "Solid. You've done the hard part." : "Okay, real revenue. That changes the conversation with investors.";

      const ind = await askFor("industry", `${stageBeat} ${AGAIN.industry[0]}`, industryParse(false), {
        industry: true,
        hint: "Just the industry is fine. Software, healthcare, energy, consumer, something else?",
      });
      p.industry = ind.industry;
      p.industryText = ind.text;
      const covered = coveredBy(ind.industry, await loadSectors());
      const indBeat = covered ? `Good, I have investors active in ${ind.industry.label}.` : "Got it.";

      p.raise = await askFor("raise", `${indBeat} ${AGAIN.raise[0]}`, raiseOf, { money: true, hint: "A rough number is fine, like 750K or 3M." });
      p.timing = await askFor("timing", `And ${lowerFirst(AGAIN.timing[0])}`, timingOf, { hint: "Weeks, months, or not sure yet?" });
      const timingBeat = p.timing === "Within 30 days" ? "Thirty days. Tight, so I won't waste your time." : p.timing === "A few months" ? "A few months is a good runway." : "No rush, then. Good.";
      const timingSaid = p.timing === "Within 30 days" ? "closing within 30 days" : p.timing === "A few months" ? "closing in a few months" : "timing open";
      await say([timingBeat, `So: ${STAGE_SAID[p.stage]}, ${p.industry.label}, raising ${p.raise}, ${timingSaid}. Noted.`, "I already have what icapos.com/fit would ask you, so no need to type it twice."]);
      await offerMatch();
    };

    const investor = async () => {
      p.check = await askFor("check", `${switched ? "" : "Good to know. "}${AGAIN.check[0]}`, checkOf, { money: true, hint: "A rough range is fine, like 100K or 1M." });
      const beat = p.check === "$5M plus" ? "Serious money." : "Got it.";
      const ind = await askFor("sector", `${beat} ${AGAIN.sector[0]}`, industryParse(true), {
        industry: true,
        hint: "Just the sectors are fine. Software, healthcare, energy, consumer, or generalist?",
      });
      p.industry = ind.industry;
      p.industryText = ind.text;
      await say(["Checks like that are exactly what the deals I bring need."]);
      await offerTimes("I take the first call myself. Twenty minutes to see the deal flow.");
    };

    const intro = async () => {
      void loadSectors();
      const h = new Date().getHours();
      const evening = h >= 18 || h < 5;
      await say(
        evening
          ? ["Good evening, Khris here at iCFO. Thanks for stopping by.", "So I point you the right way: are you raising capital, or looking at deals?"]
          : ["Hi, Khris here at iCFO. Thanks for stopping by.", "Quick one so I point you the right way: are you raising capital, or looking at deals?"],
      );
      let asks = 0;
      while (!cancelled) {
        const raw = await textIn();
        const role = khrisRoleOf(raw);
        if (role === "Raising" || role === "Investing") {
          p.role = role;
          helpLead = role === "Raising" && /\bhelp\b/i.test(raw);
          paused = false;
          break;
        }
        if (isKhrisSideTalk(raw) || topicOf(raw)) {
          if (await aside(raw)) {
            asks = 3;
            continue;
          }
        } else if (role === "more") {
          await say(fresh(WHAT));
        } else if (asks >= 3) {
          await aside(raw);
          continue;
        }
        if (asks < 2) {
          const n = count("again:role");
          await say([AGAIN.role[n % AGAIN.role.length]]);
          asks++;
        } else if (asks === 2) {
          asks++;
          await say([`Whenever you're ready, just tell me ${HINTS.role}.`]);
        }
      }
      while (!cancelled) {
        try {
          if (p.role === "Raising") await founder();
          else await investor();
          return;
        } catch (e) {
          if (e instanceof RoleSwitch) continue;
          throw e;
        }
      }
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
      aria-label="Conversation with Khris Thetsy"
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
                    <Image src="/khris.jpg" alt="Khris Thetsy" width={40} height={40} className="absolute left-0 top-0 h-10 w-10 rounded-full object-cover" />
                  )}
                  <div className="mb-0.5 text-[15px] font-semibold leading-tight">
                    {fromYou ? "You" : "Khris Thetsy"}
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
          <div className="flex shrink-0 gap-1 py-2.5 pl-[52px]" aria-label="Khris is typing">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400" />
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400 [animation-delay:150ms]" />
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400 [animation-delay:300ms]" />
          </div>
        ) : null}
      </div>

      <div className="border-t border-slate-200 px-3.5 pb-2 pt-2.5">
        <form onSubmit={submit} className="flex gap-2">
          <label htmlFor="khris-input" className="sr-only">
            Message Khris Thetsy
          </label>
          <input
            id="khris-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Message Khris Thetsy…"
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
