"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { PLATFORM_TZ, PLATFORM_TZ_LABEL } from "@/lib/time/platform-tz";
import { formatSlotWhen, groupSlotsByDay, looksLikeName, questionKey, timeOfferLine, validEmail, type DayGroup, type Slot } from "@/lib/jessica/flow";
import {
  JOHNNY_AI_LINES,
  JOHNNY_BOOKING_NOTE,
  JOHNNY_CONFIRM_QUESTIONS,
  JOHNNY_ACKS,
  JOHNNY_DEALSIZE_LINES,
  JOHNNY_DISCLAIMER,
  JOHNNY_FALLBACK_LINE,
  JOHNNY_HINTS,
  JOHNNY_LEADS,
  JOHNNY_NO_FIELDS,
  JOHNNY_OPENER,
  JOHNNY_IDLE_LINES,
  JOHNNY_NO_LADDER,
  JOHNNY_OPTOUT_LINES,
  JOHNNY_QUESTIONS,
  JOHNNY_SLOT_MINUTES,
  JOHNNY_STALL_LINES,
  JOHNNY_THANKS,
  isQuestion,
  matchJohnny,
  typoFix,
  type JohnnyScripted,
} from "@/lib/johnny/config";
import {
  OTHER,
  ASK_TO_FIELD,
  OPTIONS,
  applyOption,
  applyOtherText,
  bareNumber,
  checksPhrase,
  emptyProfile,
  extractFields,
  hasAnything,
  mergeAiFields,
  missingFields,
  profileAnswers,
  summaryLine,
  type FieldKey,
  type JohnnyAiReply,
} from "@/lib/johnny/profile";

type Msg = { id: number; from: "johnny" | "you"; text: string; href?: string; hrefLabel?: string };
type LinkExtra = Pick<Msg, "href" | "hrefLabel">;
type Options = { options: string[]; main: boolean; pick: (option: string) => void };
type Mode = "chat" | "confirm" | "times" | "name" | "email" | "phone" | "done";
type Turn = { role: "user" | "assistant"; content: string };
type BookResult = { ok: true; meetUrl: string | null } | { ok: false; retry: boolean; message: string };

const OTHER_TIME = "Another time";
const OTHER_DAY = "Other day";
const YES = /^(yes|yeah|yep|correct|right|exactly|perfect|good|great|sounds good|that'?s (right|correct)|ok|okay)\b/i;
const NO = /^(no|nope|not quite|not really|wrong)\b/i;

/**
 * Johnny, the iCFO Investor Relations agent: a real conversation that learns how
 * an investor invests (type, check size, industry, stages, capital types) and
 * books a call on the host's calendar through the existing scheduling endpoints.
 * Nothing is written until the visitor taps a time and gives name, email, phone.
 *
 * Every question has tap options and the investor can type instead, in any
 * order. All five answers are needed for a good match, so there is no Skip. Fees, commission, opt outs and the AI disclosure are scripted
 * (matchJohnny). Everything else is written by /api/johnny/reply from the iCFO
 * fact sheet, with a scripted fallback when the AI is unavailable or refused.
 */
export function JohnnyChat({ hostId, sourceTag }: { hostId: string; sourceTag: string | null }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [typing, setTyping] = useState(false);
  const [options, setOptionsState] = useState<Options | null>(null);
  const [draft, setDraft] = useState("");
  const submitRef = useRef<(value: string) => boolean>(() => false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let busy = false;
    let nextId = 1;
    let mode: Mode = "chat";
    let asked: FieldKey | null = null;
    let other: "sect" | "stage" | "cap" | null = null;
    let bare: string | null = null;
    // Never takes a no: how many nos so far, and what the ladder is waiting for.
    let nos = 0;
    let thesisAsk = false;
    let keepAsk = false;
    let offerPending = false;
    // Five minutes of silence while Johnny waits gets one "Are you still there?".
    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    let idleAsked = false;
    let offered = 0;
    let stopped = false;
    let slot: Slot | null = null;
    const contact: { fullName?: string; email?: string; phone?: string } = {};
    const profile = emptyProfile();
    const said = new Set<string>();
    const turns: Turn[] = [];
    const visitorSaid: string[] = [];
    // Questions that already got a fixed answer, so a typo fix of one is acknowledged, not answered again.
    const answered = new Set<string>();
    const sessionId = Math.random().toString(36).slice(2, 14);

    const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
    const push = (from: Msg["from"], text: string, extra?: LinkExtra) => {
      const id = nextId++;
      setMsgs((list) => [...list, { id, from, text, ...extra }]);
    };
    const remember = (role: Turn["role"], content: string) => {
      turns.push({ role, content: content.slice(0, 600) });
      if (turns.length > 15) turns.splice(0, turns.length - 15);
    };
    /** Never the same words twice: the first wording none of whose lines has been said, else the last one. */
    const fresh = (wordings: string[][]): string[] => wordings.find((w) => !w.some((l) => said.has(questionKey(l)))) ?? wordings[wordings.length - 1];
    const freshOne = (wordings: string[]): string => fresh(wordings.map((w) => [w]))[0];

    const clearIdle = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = null;
    };
    const armIdle = () => {
      clearIdle();
      if (idleAsked || stopped || mode === "done") return;
      idleTimer = setTimeout(() => {
        if (cancelled || busy || stopped || mode === "done") return;
        idleAsked = true;
        void say([freshOne(JOHNNY_IDLE_LINES)]);
      }, 5 * 60 * 1000);
    };

    /** Johnny reads first, then types at a human pace: a pause of a couple of seconds, never an instant reply. */
    const say = async (lines: string[], extra?: LinkExtra) => {
      busy = true;
      clearIdle();
      lines.forEach((l) => said.add(questionKey(l)));
      // The opening is quick; every reply after the investor speaks gets a pause before typing.
      const opening = !turns.some((t) => t.role === "user");
      if (!opening) await sleep(1200 + Math.random() * 800);
      for (let i = 0; i < lines.length; i++) {
        if (cancelled) return;
        setTyping(true);
        await sleep(opening ? 400 + Math.min(lines[i].length * 10, 1000) : 600 + Math.min(lines[i].length * 18, 1800));
        if (cancelled) return;
        setTyping(false);
        push("johnny", lines[i], i === lines.length - 1 ? extra : undefined);
        remember("assistant", lines[i]);
        await sleep(400);
      }
      busy = false;
      armIdle();
    };

    const showOptions = (opts: string[], pick: (option: string) => void, main = false) => {
      setOptionsState({
        options: opts,
        main,
        pick: (option) => {
          setOptionsState(null);
          clearIdle();
          idleAsked = false;
          push("you", option);
          remember("user", option);
          pick(option);
        },
      });
    };

    const calendarLink = (): LinkExtra => ({
      href: `/schedule/${hostId}${sourceTag ? `?src=${encodeURIComponent(sourceTag)}` : ""}`,
      hrefLabel: "Open the calendar",
    });

    /* ---------- the AI reply, with a quiet fallback ---------- */

    const callAi = async (): Promise<JohnnyAiReply | null> => {
      setTyping(true);
      try {
        let t = turns.slice(-14);
        while (t.length && t[0].role !== "user") t = t.slice(1);
        if (!t.length || t[t.length - 1].role !== "user") return null;
        const res = await fetch("/api/johnny/reply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode,
            known: {
              investor_type: profile.type ?? null,
              check_size_min: profile.cmin ?? null,
              check_size_max: profile.cmax ?? null,
              preferred_sectors: profile.sect,
              preferred_stages: profile.stage,
              capital_types: profile.cap,
            },
            missing: missingFields(profile).map((f) => ({ type: "investor_type", sect: "preferred_sectors", check: "check_size", stage: "preferred_stages", cap: "capital_types" })[f]),
            turns: t,
            sessionId,
          }),
        });
        if (!res.ok) return null;
        const data = (await res.json()) as { ok?: boolean } & Partial<JohnnyAiReply>;
        if (!data.ok || !Array.isArray(data.lines) || !data.lines.length) return null;
        // A reply that repeats a line already said is not used; the scripted wording takes over.
        if (data.lines.some((l) => said.has(questionKey(l)))) return null;
        return data as JohnnyAiReply;
      } catch {
        return null;
      } finally {
        setTyping(false);
      }
    };

    /* ---------- discovery: ask only what is missing ---------- */

    const react = (changed: FieldKey[]): string => {
      if (!changed.length) return asked ? freshOne(JOHNNY_HINTS[asked]) : freshOne(JOHNNY_NO_FIELDS);
      const parts: string[] = [];
      if (changed.includes("type") && profile.type) parts.push(profile.type);
      if (changed.includes("check")) parts.push(checksPhrase(profile));
      if (changed.includes("sect")) parts.push(profile.sect.join(" and "));
      if (changed.includes("stage")) parts.push(profile.stage.join(" and "));
      if (changed.includes("cap")) parts.push(profile.cap.join(" and "));
      const said = parts.join(", ");
      return `${freshOne(JOHNNY_THANKS)} ${said.charAt(0).toUpperCase()}${said.slice(1)}.`;
    };

    const nextQuestion = (field: FieldKey) => freshOne(JOHNNY_QUESTIONS[field]);

    const showFieldOptions = (field: FieldKey) => {
      if (mode !== "chat" || cancelled || stopped) return;
      if (!missingFields(profile).includes(field)) return;
      showOptions(OPTIONS[field], (option) => void chipAnswer(field, option));
    };

    const OTHER_QUESTION = {
      sect: "Of course. Which industry? Type it in and I will note it.",
      stage: "Of course. Which stage? Type it in and I will note it.",
      cap: "Of course. What kind of capital? Type it in and I will note it.",
    } as const;

    const chipAnswer = async (field: FieldKey, option: string) => {
      if (option === OTHER && (field === "sect" || field === "stage" || field === "cap")) {
        other = field;
        await say([OTHER_QUESTION[field]]);
        return;
      }
      applyOption(profile, field, option);
      await chat(option, [field]);
    };

    const chat = async (input: string, tapped?: FieldKey[]) => {
      let text = input;
      // A bare number for a check size is checked, never guessed: "Just to be sure: 2 million?"
      if (bare) {
        const n = bare;
        bare = null;
        if (/^(y|yes|yeah|yep|yup|correct|right|exactly|sure)\b/i.test(text.trim())) text = `${n}m`;
      } else if (!tapped && asked === "check") {
        const n = bareNumber(text);
        if (n) {
          bare = n;
          await say([freshOne([`Just to be sure: ${n} million?`, `${n} million, right?`])]);
          return;
        }
      }
      // A question is answered and never read for profile values. Johnny comes back to his own question after.
      if (!tapped && isQuestion(text)) {
        await converse();
        return;
      }
      let changed = tapped ?? extractFields(profile, text, asked);
      // The typed answer to "Other" is kept as given when nothing on the lists matched it.
      if (other && !changed.length && applyOtherText(profile, other, text)) changed = [other];
      other = null;
      let ai = await callAi();
      if (cancelled) return;
      if (ai) mergeAiFields(profile, ai.fields);
      // A question about something already answered is never shown: the scripted reply takes over this turn.
      if (ai && ai.ask !== "none" && !missingFields(profile).includes(ASK_TO_FIELD[ai.ask])) ai = null;
      const lines = ai ? ai.lines : [react(changed)];
      const m = missingFields(profile);
      if ((ai && ai.ready) || !m.length) {
        await say(lines);
        await readback();
        return;
      }
      if (ai && ai.ask !== "none" && /\?\s*$/.test(lines[lines.length - 1])) {
        asked = ASK_TO_FIELD[ai.ask] ?? m[0];
        await say(lines);
        showFieldOptions(asked);
        return;
      }
      // Nothing in the answer fit what was asked: the hint is the question, nothing stacked on it.
      if (!ai && !changed.length && asked && m.includes(asked)) {
        await say(lines);
        showFieldOptions(asked);
        return;
      }
      asked = m[0];
      await say([...lines, nextQuestion(asked)]);
      showFieldOptions(asked);
    };

    const confirmOptions = () => showOptions(["Yes, that is right", "Change something"], (o) => void (/^Yes/.test(o) ? reflect() : say(["Sure. What should I change?"])), true);

    const readback = async () => {
      mode = "confirm";
      if (!hasAnything(profile)) {
        await reflect();
        return;
      }
      await say([summaryLine(profile), freshOne(JOHNNY_CONFIRM_QUESTIONS)]);
      confirmOptions();
    };

    const confirmTyped = async (value: string) => {
      if (YES.test(value)) {
        await reflect();
        return;
      }
      const changed = extractFields(profile, value, null);
      if (changed.length) {
        await say(["Thank you, updated.", summaryLine(profile), "Is that right?"]);
        confirmOptions();
        return;
      }
      if (NO.test(value)) {
        await say(["No problem. What should I change?"]);
        return;
      }
      await converse();
    };

    const reflect = async () => {
      mode = "times";
      const s = profile.sect.length && profile.sect[0] !== OTHER ? profile.sect[0].toLowerCase() : "your range of sectors";
      await say([`Thank you, that gives me a clear picture. Companies in ${s} that match your profile fit the deal flow we bring to our investors.`]);
      await offerTimes(`Next step is ${JOHNNY_SLOT_MINUTES} minutes with our team. We cover the rest of your profile there.`);
    };

    /* ---------- the time offer, real open days in Pacific ---------- */

    const loadSlots = async (fromDays = 0): Promise<Slot[] | null> => {
      try {
        const from = new Date(Date.now() + fromDays * 24 * 60 * 60 * 1000);
        const to = new Date(from.getTime() + 21 * 24 * 60 * 60 * 1000);
        const url =
          `/api/scheduling/slots?host=${hostId}` +
          `&from=${encodeURIComponent(from.toISOString())}` +
          `&to=${encodeURIComponent(to.toISOString())}` +
          `&duration=${JOHNNY_SLOT_MINUTES}`;
        const res = await fetch(url);
        if (!res.ok) return null;
        const data = (await res.json()) as { slots?: Slot[] };
        return Array.isArray(data.slots) ? data.slots : [];
      } catch {
        return null;
      }
    };

    const offerTimes = async (lead: string, fromDays = 0) => {
      mode = "times";
      const slots = await loadSlots(fromDays);
      if (cancelled) return;
      const days = slots ? groupSlotsByDay(slots, PLATFORM_TZ, 4) : [];
      if (days.length === 0) {
        await say([`${lead} You can pick a time directly here.`.trim()], calendarLink());
        return;
      }
      const line = timeOfferLine(days.map((d) => d.label), offered, PLATFORM_TZ_LABEL);
      offered++;
      await say([`${lead} ${line}`.trim()]);
      showDays(days);
    };

    const showDays = (days: DayGroup[]) => {
      showOptions(
        [...days.map((d) => d.label), OTHER_TIME],
        (choice) => {
          if (choice === OTHER_TIME) {
            void say(["No problem. Pick anything that works for you here."], calendarLink());
            return;
          }
          const day = days.find((d) => d.label === choice);
          if (day) void showTimes(day, days);
        },
        true,
      );
    };

    const showTimes = async (day: DayGroup, days: DayGroup[]) => {
      await say([`${day.label}. What time, ${PLATFORM_TZ_LABEL}?`]);
      showOptions(
        [...day.slots.slice(0, 8).map((s) => s.label), OTHER_DAY],
        (choice) => {
          if (choice === OTHER_DAY) {
            showDays(days);
            return;
          }
          const picked = day.slots.find((s) => s.label === choice);
          if (picked) void slotPicked(picked);
        },
        true,
      );
    };

    /* ---------- booking: name, email, phone ---------- */

    const slotPicked = async (picked: Slot) => {
      slot = picked;
      if (contact.fullName && contact.email && contact.phone) {
        await bookNow();
        return;
      }
      mode = "name";
      await say(["Wonderful. Whose name should I put on the invitation?"]);
    };

    const book = async (s: Slot): Promise<BookResult> => {
      try {
        const res = await fetch("/api/scheduling/book", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            hostId,
            startTime: s.start,
            endTime: s.end,
            timezone: PLATFORM_TZ,
            name: contact.fullName ?? "",
            email: contact.email ?? "",
            phone: contact.phone,
            note: JOHNNY_BOOKING_NOTE,
            answers: [...profileAnswers(profile), { label: "Phone", value: contact.phone ?? "" }],
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

    const bookNow = async () => {
      if (!slot) return;
      const result = await book(slot);
      if (cancelled) return;
      if (!result.ok) {
        await say([result.message]);
        if (result.retry) {
          slot = null;
          await offerTimes("Here's what's open now.");
        }
        return;
      }
      mode = "done";
      const confirmCall = formatSlotWhen(new Date(new Date(slot.start).getTime() - 15 * 60 * 1000).toISOString(), PLATFORM_TZ, PLATFORM_TZ_LABEL);
      await say(
        [
          `Done. ${formatSlotWhen(slot.start, PLATFORM_TZ, PLATFORM_TZ_LABEL)} with our team.`,
          `Invite is on its way to ${contact.email}.`,
          `I will call you on ${contact.phone} at ${confirmCall} to confirm.`,
          "On the call we will cover the rest of your profile.",
          "Thank you again. Talk to you soon.",
        ],
        result.meetUrl ? { href: result.meetUrl, hrefLabel: "Join Google Meet" } : undefined,
      );
    };

    /* ---------- side questions: answer, then carry on like a person ---------- */

    const resume = async () => {
      if (cancelled || stopped) return;
      if (mode === "chat" && other) {
        const name = { sect: "industry", stage: "stage", cap: "kind of capital" }[other];
        await say([freshOne([`And which ${name} was it? Type it in and I will note it.`, `Back to your ${name}: type it in and I will note it.`])]);
      } else if (mode === "chat") {
        // No cutoff: Johnny keeps asking until all five are in. "Too many questions" is the only way out.
        const m = missingFields(profile);
        if (!m.length) {
          await readback();
          return;
        }
        asked = m[0];
        const lower = (q: string) => `${q.charAt(0).toLowerCase()}${q.slice(1)}`;
        const all = JOHNNY_QUESTIONS[asked].flatMap((q) => JOHNNY_LEADS.map((lead) => `${lead}${lower(q)}`));
        await say([freshOne(all)]);
        showFieldOptions(asked);
      } else if (mode === "confirm") {
        await say([freshOne(JOHNNY_CONFIRM_QUESTIONS)]);
        confirmOptions();
      } else if (mode === "times") {
        await offerTimes("");
      } else if (mode === "name") {
        await say(["And whose name should I put on the invitation?"]);
      } else if (mode === "email") {
        await say(["And the best email for the invite?"]);
      } else if (mode === "phone") {
        await say(["And the best phone number for the invite?"]);
      }
    };

    const converse = async () => {
      const ai = await callAi();
      if (cancelled) return;
      await say(ai ? ai.lines : [JOHNNY_FALLBACK_LINE]);
      if (mode !== "done") await resume();
    };

    const scripted = async (s: JohnnyScripted) => {
      if (s.kind === "stop") {
        stopped = true;
        await say(JOHNNY_OPTOUT_LINES);
      } else if (s.kind === "no") {
        await noLadder();
      } else if (s.kind === "stall") {
        await say([freshOne(JOHNNY_STALL_LINES)]);
        await offerTimes("");
      } else if (s.kind === "toomany") {
        if (mode === "chat" || mode === "confirm") {
          await say(["Fair point, no more questions from me."]);
          mode = "times";
          await offerTimes(`Next step is ${JOHNNY_SLOT_MINUTES} minutes with our team, and we cover the rest there.`);
        } else {
          await say(["Fair point. Only the invite details are left."]);
          await resume();
        }
      } else if (s.kind === "ai") {
        await say(fresh(JOHNNY_AI_LINES));
        offerPending = true;
        showOptions(["Yes, please", "Keep chatting"], (o) => {
          if (o === "Yes, please") void offerTimes("Let's get you on their calendar.");
          else void say(["Of course, happy to keep talking."]).then(resume);
        }, true);
      } else if (s.kind === "later") {
        await say(["Of course, I understand. Would next week be easier?"]);
        await offerTimes("", 7);
      } else if (s.kind === "dealsize") {
        const ask = mode === "chat" && missingFields(profile).includes("check");
        await say([freshOne(ask ? JOHNNY_DEALSIZE_LINES.ask : JOHNNY_DEALSIZE_LINES.plain)]);
        if (ask) {
          asked = "check";
          showFieldOptions("check");
        } else await resume();
      } else {
        await say(s.wordings.flatMap((w) => fresh(w)));
        await resume();
      }
    };

    /** Never takes a no (iCFO sales training, adapted to booking investor meetings). "Remove me" never reaches this. */
    const noLadder = async () => {
      nos++;
      if (nos === 1) {
        await say([freshOne(JOHNNY_NO_LADDER.columbo)]);
        await offerTimes("");
      } else if (nos === 2) {
        thesisAsk = true;
        await say([freshOne(JOHNNY_NO_LADDER.backwards)]);
      } else if (nos === 3) {
        await say([JOHNNY_NO_LADDER.later]);
        await offerTimes("", 7);
      } else if (nos === 4) {
        keepAsk = true;
        await say(JOHNNY_NO_LADDER.keep);
      } else {
        stopped = true;
        await say(JOHNNY_NO_LADDER.goodbye);
      }
    };

    /* ---------- one entry for everything typed ---------- */

    const route = async (input: string) => {
      let value = input;
      visitorSaid.push(input);
      if (mode === "chat" || mode === "confirm" || mode === "times") {
        const fix = typoFix(input, visitorSaid.slice(0, -1));
        if (fix) {
          if (answered.has(questionKey(fix.original))) {
            await say([freshOne(JOHNNY_ACKS)]);
            await resume();
            return;
          }
          value = fix.text;
        }
      }
      if (stopped) {
        await say(["Thank you. Your preference is noted and I will not contact you again."]);
        return;
      }
      const yes = /^(yes|yeah|yep|yup|sure|ok|okay|fine|please|why not|go ahead|definitely|sounds good)\b/i.test(value.trim());
      if (keepAsk) {
        keepAsk = false;
        stopped = true;
        if (yes) {
          profile.followUp = true;
          await say(JOHNNY_NO_LADDER.keepYes);
        } else await say(JOHNNY_NO_LADDER.goodbye);
        return;
      }
      if (thesisAsk) {
        thesisAsk = false;
        if (!/^(no|nope|nothing|pass)\b/i.test(value.trim()) && !isQuestion(value)) {
          profile.thesis = value.trim().slice(0, 200);
          extractFields(profile, value, null);
          await say([freshOne(JOHNNY_NO_LADDER.thesisThanks)]);
          await offerTimes(JOHNNY_NO_LADDER.thesisLead);
          return;
        }
      }
      if (offerPending) {
        offerPending = false;
        if (yes) {
          setOptionsState(null);
          await offerTimes("Let's get you on their calendar.");
          return;
        }
      }
      if (mode === "name" && looksLikeName(value)) {
        contact.fullName = value.replace(/^(i'?m|my name is|it'?s|this is)\s+/i, "").slice(0, 200);
        mode = "email";
        await say([`Thank you, ${contact.fullName.split(/\s+/)[0]}. What is the best email for the invite?`]);
        return;
      }
      if (mode === "email" && validEmail(value)) {
        contact.email = value;
        mode = "phone";
        await say(["And the best phone number, in case the video link gives you trouble?"]);
        return;
      }
      if (mode === "phone" && value.replace(/\D/g, "").length >= 7) {
        contact.phone = value.slice(0, 40);
        await bookNow();
        return;
      }
      const s = matchJohnny(value);
      if (s) {
        answered.add(questionKey(value));
        await scripted(s);
        return;
      }
      if (mode === "chat") await chat(value);
      else if (mode === "confirm") await confirmTyped(value);
      else if (mode === "email" && !/[?]|^(what|who|how|why|where|when|do|does|are|is|can|could|will|would)\b/i.test(value)) await say(["That email does not look right. Could you check it for me?"]);
      else if (mode === "phone" && !/[?]|^(what|who|how|why|where|when|do|does|are|is|can|could|will|would)\b/i.test(value)) await say(["I need a phone number with at least seven digits. Could you send it again?"]);
      else await converse();
    };

    submitRef.current = (value) => {
      if (busy || cancelled) return false;
      setOptionsState(null);
      clearIdle();
      idleAsked = false;
      push("you", value);
      remember("user", value);
      void route(value);
      return true;
    };

    const intro = async () => {
      const h = new Date().getHours();
      const greet = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
      await say([`${greet}, ${JOHNNY_OPENER[0]}`, ...JOHNNY_OPENER.slice(1)]);
      asked = "type";
      showFieldOptions("type");
    };
    const timer = setTimeout(() => void intro(), 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      clearIdle();
    };
  }, [hostId, sourceTag]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs, typing, options]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const value = draft.trim();
    if (!value) return;
    if (submitRef.current(value)) setDraft("");
  };

  return (
    <div
      role="region"
      aria-label="Conversation with Johnny"
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
                    <Image src="/johnny.jpg" alt="Johnny" width={40} height={40} className="absolute left-0 top-0 h-10 w-10 rounded-full object-cover" />
                  )}
                  <div className="mb-0.5 text-[15px] font-semibold leading-tight">
                    {fromYou ? "You" : "Johnny"}
                    {fromYou ? null : <span className="block text-[13px] font-normal text-slate-500">iCFO Capital Global, Inc.</span>}
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
          <div className="flex shrink-0 gap-1 py-2.5 pl-[52px]" aria-label="Johnny is typing">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400" />
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400 [animation-delay:150ms]" />
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400 [animation-delay:300ms]" />
          </div>
        ) : null}

        {options ? (
          <div className="my-2.5 flex shrink-0 flex-wrap gap-2 pl-[52px]">
            {options.options.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => options.pick(option)}
                className={
                  options.main
                    ? "min-h-11 rounded-full border border-[#1A6CE4] bg-[#1A6CE4] px-4 text-sm font-semibold text-white hover:bg-[#2E78F5]"
                    : "min-h-11 rounded-full border border-[#185FA5] bg-white px-4 text-sm font-semibold text-[#185FA5] hover:bg-slate-50"
                }
              >
                {option}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="border-t border-slate-200 px-3.5 pb-2 pt-2.5">
        <form onSubmit={submit} className="flex gap-2">
          <label htmlFor="johnny-input" className="sr-only">
            Reply to Johnny
          </label>
          <input
            id="johnny-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Reply to Johnny…"
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
        <p className="mt-2 text-center font-mono text-[10px] leading-snug text-slate-500">{JOHNNY_DISCLAIMER}</p>
      </div>
    </div>
  );
}
