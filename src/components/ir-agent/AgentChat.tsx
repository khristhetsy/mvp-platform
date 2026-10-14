"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { PLATFORM_TZ, PLATFORM_TZ_LABEL } from "@/lib/time/platform-tz";
import { formatSlotWhen, groupSlotsByDay, looksLikeName, questionKey, timeOfferLine, validEmail, type DayGroup, type Slot } from "@/lib/jessica/flow";
import { isQuestion, typoFix } from "@/lib/johnny/config";
import {
  OTHER,
  ASK_TO_FIELD,
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
import { AGENT_LINES, fill, matchAgent, type AgentScripted } from "@/lib/ir-agent/scripted";
import { FIELD_TO_KEY, KEY_TO_FIELD, type ProfileField } from "@/lib/ir-agent/defaults";
import type { AgentContactField, AgentPublicConfig, AgentQuestion } from "@/lib/ir-agent/types";

type Msg = { id: number; from: "agent" | "you"; text: string; href?: string; hrefLabel?: string };
type LinkExtra = Pick<Msg, "href" | "hrefLabel">;
type Options = { options: string[]; main: boolean; pick: (option: string) => void };
type Mode = "chat" | "confirm" | "times" | "contact" | "done";
type Turn = { role: "user" | "assistant"; content: string };
type BookResult = { ok: true; meetUrl: string | null } | { ok: false; retry: boolean; message: string };

const OTHER_TIME = "Another time";
const OTHER_DAY = "Other day";
const YES = /^(yes|yeah|yep|correct|right|exactly|perfect|good|great|sounds good|that'?s (right|correct)|ok|okay)\b/i;
const NO = /^(no|nope|not quite|not really|wrong)\b/i;
const QUESTION_START = /[?]|^(what|who|how|why|where|when|do|does|are|is|can|could|will|would)\b/i;

/**
 * A founder's investor relations agent: Johnny's conversation engine, driven by
 * the founder's own questions, contact fields and taught answers. Profile
 * questions (type, industries, check, stages, capital types) use Johnny's field
 * reading; custom questions are stored as typed. Nothing is written until the
 * visitor books or leaves contact details.
 */
export function AgentChat({ config, sourceTag, preview = false }: { config: AgentPublicConfig; sourceTag: string | null; preview?: boolean }) {
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
    let asked: AgentQuestion | null = null;
    let other: "sect" | "stage" | "cap" | null = null;
    let bare: string | null = null;
    let nos = 0;
    let thesisAsk = false;
    let keepAsk = false;
    let offerPending = false;
    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    let idleAsked = false;
    let offered = 0;
    let stopped = false;
    let booked = false;
    let slot: Slot | null = null;
    let contactIndex = 0;
    const contact: Record<string, string> = {};
    const profile = emptyProfile();
    const custom: Record<string, string> = {};
    const said = new Set<string>();
    const turns: Turn[] = [];
    const transcript: Turn[] = [];
    const visitorSaid: string[] = [];
    const answered = new Set<string>();
    const sessionId = Math.random().toString(36).slice(2, 14);
    const vars = { company: config.companyName, name: config.displayName };
    const F = (line: string) => fill(line, vars);
    const questions = config.questions;
    const contactFields = config.contactFields;
    const hostId = config.hostProfileId;
    const canBook = Boolean(hostId) && config.bookingReady && !config.demo && !preview;

    const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
    const push = (from: Msg["from"], text: string, extra?: LinkExtra) => {
      const id = nextId++;
      setMsgs((list) => [...list, { id, from, text, ...extra }]);
    };
    const remember = (role: Turn["role"], content: string) => {
      turns.push({ role, content: content.slice(0, 600) });
      if (turns.length > 15) turns.splice(0, turns.length - 15);
      transcript.push({ role, content: content.slice(0, 600) });
      if (transcript.length > 80) transcript.splice(0, transcript.length - 80);
    };
    const fresh = (wordings: readonly (readonly string[])[]): string[] => {
      const hit = wordings.find((w) => !w.some((l) => said.has(questionKey(F(l))))) ?? wordings[wordings.length - 1];
      return hit.map(F);
    };
    const freshOne = (wordings: readonly string[]): string => fresh(wordings.map((w) => [w]))[0];

    /* ---------- the conversation record, written quietly after each reply ---------- */

    let logTimer: ReturnType<typeof setTimeout> | null = null;
    const log = (immediate = false) => {
      if (preview || !turns.some((t) => t.role === "user")) return;
      if (logTimer) clearTimeout(logTimer);
      const send = () => {
        logTimer = null;
        void fetch(`/api/ir-agent/${config.id}/conversation`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          keepalive: true,
          body: JSON.stringify({
            sessionId,
            source: sourceTag,
            transcript,
            profile: { ...profile, custom },
            contact,
            booked,
            stopped,
          }),
        }).catch(() => {});
      };
      if (immediate) send();
      else logTimer = setTimeout(send, 2500);
    };

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
        void say([freshOne(AGENT_LINES.idle)]);
      }, 5 * 60 * 1000);
    };

    const say = async (lines: string[], extra?: LinkExtra) => {
      busy = true;
      clearIdle();
      lines.forEach((l) => said.add(questionKey(l)));
      const opening = !turns.some((t) => t.role === "user");
      if (!opening) await sleep(1200 + Math.random() * 800);
      for (let i = 0; i < lines.length; i++) {
        if (cancelled) return;
        setTyping(true);
        await sleep(opening ? 400 + Math.min(lines[i].length * 10, 1000) : 600 + Math.min(lines[i].length * 18, 1800));
        if (cancelled) return;
        setTyping(false);
        push("agent", lines[i], i === lines.length - 1 ? extra : undefined);
        remember("assistant", lines[i]);
        await sleep(400);
      }
      busy = false;
      log();
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

    const calendarLink = (): LinkExtra | undefined =>
      hostId ? { href: `/schedule/${hostId}${sourceTag ? `?src=${encodeURIComponent(sourceTag)}` : ""}`, hrefLabel: "Open the calendar" } : undefined;

    /* ---------- which questions are still open ---------- */

    const keyOf = (q: AgentQuestion): FieldKey | null => (q.field === "custom" ? null : FIELD_TO_KEY[q.field as ProfileField]);
    const isOpen = (q: AgentQuestion): boolean => {
      if (q.field === "custom") return !(q.prompt in custom);
      return missingFields(profile).includes(FIELD_TO_KEY[q.field as ProfileField]);
    };
    const openQuestions = () => questions.filter(isOpen);
    const questionFor = (key: FieldKey) => questions.find((q) => q.field === KEY_TO_FIELD[key]) ?? null;
    const missingNames = () => openQuestions().map((q) => (q.field === "custom" ? "custom" : q.field)).filter((f) => f !== "custom");

    /* ---------- the AI reply, with a quiet fallback ---------- */

    const callAi = async (): Promise<JohnnyAiReply | null> => {
      setTyping(true);
      try {
        let t = turns.slice(-14);
        while (t.length && t[0].role !== "user") t = t.slice(1);
        if (!t.length || t[t.length - 1].role !== "user") return null;
        const res = await fetch(`/api/ir-agent/${config.id}/reply`, {
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
            missing: missingNames(),
            turns: t,
            sessionId,
          }),
        });
        if (!res.ok) return null;
        const data = (await res.json()) as { ok?: boolean } & Partial<JohnnyAiReply>;
        if (!data.ok || !Array.isArray(data.lines) || !data.lines.length) return null;
        if (data.lines.some((l) => said.has(questionKey(l)))) return null;
        return data as JohnnyAiReply;
      } catch {
        return null;
      } finally {
        setTyping(false);
      }
    };

    /* ---------- discovery ---------- */

    const react = (changed: FieldKey[]): string => {
      if (!changed.length) {
        const k = asked ? keyOf(asked) : null;
        return k ? freshOne(AGENT_LINES.hints[k]) : freshOne(AGENT_LINES.noFields);
      }
      const parts: string[] = [];
      if (changed.includes("type") && profile.type) parts.push(profile.type);
      if (changed.includes("check")) parts.push(checksPhrase(profile));
      if (changed.includes("sect")) parts.push(profile.sect.join(" and "));
      if (changed.includes("stage")) parts.push(profile.stage.join(" and "));
      if (changed.includes("cap")) parts.push(profile.cap.join(" and "));
      const s = parts.join(", ");
      return `${freshOne(AGENT_LINES.thanks)} ${s.charAt(0).toUpperCase()}${s.slice(1)}.`;
    };

    const showQuestionOptions = (q: AgentQuestion) => {
      if (mode !== "chat" || cancelled || stopped) return;
      if (!isOpen(q) || !q.options.length) return;
      showOptions(q.options, (option) => void chipAnswer(q, option));
    };

    const OTHER_QUESTION = {
      sect: "Of course. Which industry? Type it in and I will note it.",
      stage: "Of course. Which stage? Type it in and I will note it.",
      cap: "Of course. What kind of capital? Type it in and I will note it.",
    } as const;

    const chipAnswer = async (q: AgentQuestion, option: string) => {
      const key = keyOf(q);
      if (!key) {
        custom[q.prompt] = option;
        await chat(option, []);
        return;
      }
      if (option === OTHER && (key === "sect" || key === "stage" || key === "cap")) {
        other = key;
        await say([OTHER_QUESTION[key]]);
        return;
      }
      applyOption(profile, key, option);
      await chat(option, [key]);
    };

    const askNext = async (lines: string[]) => {
      const open = openQuestions();
      if (!open.length) {
        const plain = lines.filter((l) => !/\?\s*$/.test(l));
        if (plain.length) await say(plain);
        await readback();
        return;
      }
      asked = open[0];
      await say([...lines, asked.prompt]);
      showQuestionOptions(asked);
    };

    const chat = async (input: string, tapped?: FieldKey[]) => {
      let text = input;
      const askedKey = asked ? keyOf(asked) : null;
      if (bare) {
        const n = bare;
        bare = null;
        if (/^(y|yes|yeah|yep|yup|correct|right|exactly|sure)\b/i.test(text.trim())) text = `${n}m`;
      } else if (!tapped && askedKey === "check") {
        const n = bareNumber(text);
        if (n) {
          bare = n;
          await say([freshOne([`Just to be sure: ${n} million?`, `${n} million, right?`])]);
          return;
        }
      }
      if (!tapped && isQuestion(text)) {
        await converse();
        return;
      }
      // A custom question takes the typed answer as given.
      if (!tapped && asked && asked.field === "custom" && !(asked.prompt in custom)) {
        custom[asked.prompt] = text.trim().slice(0, 300);
        extractFields(profile, text, null);
        await askNext([freshOne(AGENT_LINES.thanks)]);
        return;
      }
      let changed = tapped ?? extractFields(profile, text, askedKey);
      if (other && !changed.length && applyOtherText(profile, other, text)) changed = [other];
      other = null;
      let ai = await callAi();
      if (cancelled) return;
      if (ai) mergeAiFields(profile, ai.fields);
      if (ai && ai.ask !== "none") {
        const q = questionFor(ASK_TO_FIELD[ai.ask]);
        if (!q || !isOpen(q)) ai = null;
      }
      const lines = ai ? ai.lines : [react(changed)];
      const open = openQuestions();
      if (!open.length) {
        const plain = lines.filter((l) => !/\?\s*$/.test(l));
        if (plain.length) await say(plain);
        await readback();
        return;
      }
      if (ai && ai.ask !== "none" && /\?\s*$/.test(lines[lines.length - 1])) {
        asked = questionFor(ASK_TO_FIELD[ai.ask]) ?? open[0];
        await say(lines);
        showQuestionOptions(asked);
        return;
      }
      if (!ai && !changed.length && asked && isOpen(asked)) {
        await say(lines);
        showQuestionOptions(asked);
        return;
      }
      await askNext(lines);
    };

    const confirmOptions = () => showOptions(["Yes, that is right", "Change something"], (o) => void (/^Yes/.test(o) ? reflect() : say(["Sure. What should I change?"])), true);

    const readback = async () => {
      mode = "confirm";
      if (!hasAnything(profile)) {
        await reflect();
        return;
      }
      await say([summaryLine(profile), freshOne(AGENT_LINES.confirm)]);
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
      const s = profile.sect.length && profile.sect[0] !== OTHER ? profile.sect[0] : "your range of sectors";
      await say([`Thank you, that gives me a clear picture. If ${config.companyName} fits an investor in ${s}, that is you.`]);
      if (canBook) {
        await offerTimes(`Next step is ${config.slotMinutes} minutes with the founder. We cover the rest there.`);
      } else {
        await say([`Next step is ${config.slotMinutes} minutes with the founder. Leave your details and the team will set it up.`]);
        await startContact();
      }
    };

    /* ---------- the time offer ---------- */

    const loadSlots = async (fromDays = 0): Promise<Slot[] | null> => {
      if (!hostId) return null;
      try {
        const from = new Date(Date.now() + fromDays * 24 * 60 * 60 * 1000);
        const to = new Date(from.getTime() + 21 * 24 * 60 * 60 * 1000);
        const url =
          `/api/scheduling/slots?host=${hostId}` +
          `&from=${encodeURIComponent(from.toISOString())}` +
          `&to=${encodeURIComponent(to.toISOString())}` +
          `&duration=${config.slotMinutes}`;
        const res = await fetch(url);
        if (!res.ok) return null;
        const data = (await res.json()) as { slots?: Slot[] };
        return Array.isArray(data.slots) ? data.slots : [];
      } catch {
        return null;
      }
    };

    const offerTimes = async (lead: string, fromDays = 0) => {
      if (!canBook) {
        if (lead) await say([lead]);
        await startContact();
        return;
      }
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

    /* ---------- contact details, in the founder's order ---------- */

    const contactDone = () => contactFields.every((f) => !f.required || contact[f.key]);
    const nextContactField = (): AgentContactField | null => {
      for (let i = contactIndex; i < contactFields.length; i++) {
        if (!contact[contactFields[i].key]) {
          contactIndex = i;
          return contactFields[i];
        }
      }
      return null;
    };
    const contactPrompt = (f: AgentContactField, first: boolean): string => {
      if (f.kind === "email") return first ? "What is the best email for the invite?" : "And the best email for the invite?";
      if (f.kind === "phone") return first ? "And the best phone number, in case the video link gives you trouble?" : "And the best phone number for the invite?";
      if (f.key === "name") return first ? "Wonderful. Whose name should I put on the invitation?" : "And whose name should I put on the invitation?";
      return `${first ? "" : "And "}${f.label.toLowerCase()}${f.required ? "?" : ", if you like? (Or type skip.)"}`;
    };

    const startContact = async () => {
      mode = "contact";
      contactIndex = 0;
      const f = nextContactField();
      if (!f) {
        await finish();
        return;
      }
      await say([contactPrompt(f, true)]);
    };

    const slotPicked = async (picked: Slot) => {
      slot = picked;
      if (contactDone() && contact.name && contact.email) {
        await bookNow();
        return;
      }
      await startContact();
    };

    const contactTyped = async (value: string): Promise<boolean> => {
      const f = nextContactField();
      if (!f) return false;
      const v = value.trim();
      if (!f.required && /^(skip|no|none|pass)\b/i.test(v)) {
        contact[f.key] = "";
        contactIndex++;
      } else if (f.kind === "email") {
        if (!validEmail(v)) {
          if (!QUESTION_START.test(v)) await say(["That email does not look right. Could you check it for me?"]);
          return !QUESTION_START.test(v);
        }
        contact[f.key] = v;
      } else if (f.kind === "phone") {
        const digits = v.replace(/\D/g, "");
        if (digits.length < 7) {
          if (!QUESTION_START.test(v)) await say(["I need a phone number with at least seven digits. Could you send it again?"]);
          return !QUESTION_START.test(v);
        }
        const us = digits.length === 10 ? digits : digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : null;
        contact[f.key] = us ? `(${us.slice(0, 3)}) ${us.slice(3, 6)}-${us.slice(6)}` : v.slice(0, 40);
      } else if (f.key === "name") {
        if (!looksLikeName(v)) return false;
        contact[f.key] = v
          .replace(/^(i'?m|my name is|it'?s|this is)\s+/i, "")
          .slice(0, 200)
          .replace(/\b\p{L}/gu, (c) => c.toUpperCase());
      } else {
        if (isQuestion(v)) return false;
        contact[f.key] = v.slice(0, 200);
      }
      const next = nextContactField();
      if (next) {
        const first = contact.name && next.kind === "email" ? `Thank you, ${contact.name.split(/\s+/)[0]}. ` : "";
        await say([`${first}${contactPrompt(next, Boolean(first))}`]);
        return true;
      }
      if (slot && canBook) await bookNow();
      else await finish();
      return true;
    };

    /* ---------- booking and the close ---------- */

    const book = async (s: Slot): Promise<BookResult> => {
      try {
        const extra = contactFields.filter((f) => !["name", "email", "phone"].includes(f.key) && contact[f.key]).map((f) => ({ label: f.label, value: contact[f.key] }));
        const customAnswers = Object.entries(custom).map(([label, value]) => ({ label: label.slice(0, 80), value }));
        const res = await fetch("/api/scheduling/book", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            hostId,
            startTime: s.start,
            endTime: s.end,
            timezone: PLATFORM_TZ,
            name: contact.name ?? "",
            email: contact.email ?? "",
            phone: contact.phone || undefined,
            company: contact.firm || undefined,
            note: `Booked through ${config.displayName}, the ${config.companyName} investor relations agent (icapos.com/${config.companySlug}/${config.ending}).`,
            answers: [...profileAnswers(profile), ...customAnswers, ...extra, ...(contact.phone ? [{ label: "Phone", value: contact.phone }] : [])],
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
      booked = true;
      await say(
        [
          `Done. ${formatSlotWhen(slot.start, PLATFORM_TZ, PLATFORM_TZ_LABEL)} with the ${config.companyName} team.`,
          `Invite is on its way to ${contact.email}.`,
          "On the call we will cover the rest of your profile.",
          "Thank you again. Talk to you soon.",
        ],
        result.meetUrl ? { href: result.meetUrl, hrefLabel: "Join Google Meet" } : undefined,
      );
      log(true);
    };

    const finish = async () => {
      mode = "done";
      await say([
        contact.name ? `Thank you, ${contact.name.split(/\s+/)[0]}. The ${config.companyName} team will reach out to set up the call.` : `Thank you. The ${config.companyName} team will reach out to set up the call.`,
        "Talk to you soon.",
      ]);
      log(true);
    };

    /* ---------- side questions, then carry on ---------- */

    const resume = async () => {
      if (cancelled || stopped) return;
      if (mode === "chat" && other) {
        const name = { sect: "industry", stage: "stage", cap: "kind of capital" }[other];
        await say([freshOne([`And which ${name} was it? Type it in and I will note it.`, `Back to your ${name}: type it in and I will note it.`])]);
      } else if (mode === "chat") {
        const open = openQuestions();
        if (!open.length) {
          await readback();
          return;
        }
        asked = open[0];
        const lower = (q: string) => `${q.charAt(0).toLowerCase()}${q.slice(1)}`;
        await say([freshOne(AGENT_LINES.leads.map((lead) => `${lead}${lower(asked!.prompt)}`))]);
        showQuestionOptions(asked);
      } else if (mode === "confirm") {
        await say([freshOne(AGENT_LINES.confirm)]);
        confirmOptions();
      } else if (mode === "times") {
        await offerTimes("");
      } else if (mode === "contact") {
        const f = nextContactField();
        if (f) await say([contactPrompt(f, false)]);
        else await finish();
      }
    };

    const converse = async () => {
      const ai = await callAi();
      if (cancelled) return;
      const lines = ai ? ai.lines : [AGENT_LINES.fallback];
      await say(lines);
      if (mode === "done") return;
      const open = openQuestions();
      if (mode === "chat" && !other && open.length && /\?\s*$/.test(lines[lines.length - 1])) {
        const q = ai && ai.ask !== "none" ? questionFor(ASK_TO_FIELD[ai.ask]) : null;
        asked = q && isOpen(q) ? q : open[0];
        showQuestionOptions(asked);
        return;
      }
      await resume();
    };

    const scripted = async (s: AgentScripted) => {
      if (s.kind === "stop") {
        stopped = true;
        await say(AGENT_LINES.optOut.map(F));
        log(true);
      } else if (s.kind === "no") {
        await noLadder();
      } else if (s.kind === "stall") {
        await say([freshOne(AGENT_LINES.stall)]);
        await offerTimes("");
      } else if (s.kind === "toomany") {
        if (mode === "chat" || mode === "confirm") {
          await say(["Fair point, no more questions from me."]);
          await offerTimes(`Next step is ${config.slotMinutes} minutes with the founder, and we cover the rest there.`);
        } else {
          await say(["Fair point. Only the invite details are left."]);
          await resume();
        }
      } else if (s.kind === "ai") {
        await say(fresh(AGENT_LINES.ai));
        offerPending = true;
        showOptions(["Yes, please", "Keep chatting"], (o) => {
          if (o === "Yes, please") void offerTimes("Let's get you on the calendar.");
          else void say(["Of course, happy to keep talking."]).then(resume);
        }, true);
      } else if (s.kind === "later") {
        await say(["Of course, I understand. Would next week be easier?"]);
        await offerTimes("", 7);
      } else if (s.kind === "dealsize") {
        const q = questionFor("check");
        const ask = mode === "chat" && q && isOpen(q);
        await say([freshOne(ask ? AGENT_LINES.dealSize.ask : AGENT_LINES.dealSize.plain)]);
        if (ask && q) {
          asked = q;
          showQuestionOptions(q);
        } else await resume();
      } else {
        await say([s.answer]);
        await resume();
      }
    };

    const noLadder = async () => {
      nos++;
      const L = AGENT_LINES.noLadder;
      if (nos === 1) {
        await say([freshOne(L.columbo)]);
        await offerTimes("");
      } else if (nos === 2) {
        thesisAsk = true;
        await say([freshOne(L.backwards)]);
      } else if (nos === 3) {
        await say([L.later]);
        await offerTimes("", 7);
      } else if (nos === 4) {
        keepAsk = true;
        await say(L.keep.map(F));
      } else {
        stopped = true;
        await say([...L.goodbye]);
        log(true);
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
            await say([freshOne(AGENT_LINES.acks)]);
            await resume();
            return;
          }
          value = fix.text;
        }
      }
      if (stopped) {
        await say([AGENT_LINES.stopped]);
        return;
      }
      const yes = /^(yes|yeah|yep|yup|sure|ok|okay|fine|please|why not|go ahead|definitely|sounds good)\b/i.test(value.trim());
      if (keepAsk) {
        keepAsk = false;
        stopped = true;
        if (yes) {
          profile.followUp = true;
          await say([...AGENT_LINES.noLadder.keepYes]);
        } else await say([...AGENT_LINES.noLadder.goodbye]);
        log(true);
        return;
      }
      if (thesisAsk) {
        thesisAsk = false;
        if (!/^(no|nope|nothing|pass)\b/i.test(value.trim()) && !isQuestion(value)) {
          profile.thesis = value.trim().slice(0, 200);
          extractFields(profile, value, null);
          await say([freshOne(AGENT_LINES.noLadder.thesisThanks)]);
          await offerTimes(AGENT_LINES.noLadder.thesisLead);
          return;
        }
      }
      if (offerPending) {
        offerPending = false;
        if (yes) {
          setOptionsState(null);
          await offerTimes("Let's get you on the calendar.");
          return;
        }
      }
      if (mode === "contact" && (await contactTyped(value))) return;
      const s = matchAgent(value, config.taughtAnswers);
      if (s) {
        answered.add(questionKey(value));
        await scripted(s);
        return;
      }
      if (mode === "chat") await chat(value);
      else if (mode === "confirm") await confirmTyped(value);
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
      const [first, ...rest] = config.welcome.length ? config.welcome : [`${config.displayName} here. I handle investor relations at ${config.companyName}.`];
      const open = openQuestions();
      const joined = first.startsWith(config.displayName) || /^[A-Z][a-z]*\s[A-Z]/.test(first) ? first : `${first.charAt(0).toLowerCase()}${first.slice(1)}`;
      const lines = [`${greet}, ${joined}`, ...rest];
      if (open.length) {
        asked = open[0];
        await say([...lines, asked.prompt]);
        showQuestionOptions(asked);
      } else {
        await say(lines);
        await readback();
      }
    };
    // A fresh conversation whenever the config changes: the preview restarts clean.
    const timer = setTimeout(() => {
      setMsgs([]);
      setOptionsState(null);
      setTyping(false);
      void intro();
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      clearIdle();
      if (logTimer) clearTimeout(logTimer);
    };
  }, [config, sourceTag, preview]);

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

  const initials = config.displayName
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      role="region"
      aria-label={`Conversation with ${config.displayName}`}
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
                    <div className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">You</div>
                  ) : config.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={config.imageUrl} alt={config.displayName} width={40} height={40} className="absolute left-0 top-0 h-10 w-10 rounded-full object-cover" />
                  ) : (
                    <div className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-full bg-[#0A1A40] text-xs font-semibold text-white">{initials}</div>
                  )}
                  <div className="mb-0.5 text-[15px] font-semibold leading-tight">
                    {fromYou ? "You" : config.displayName}
                    {fromYou ? null : <span className="block text-[13px] font-normal text-slate-500">{config.companyName}</span>}
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
          <div className="flex shrink-0 gap-1 py-2.5 pl-[52px]" aria-label={`${config.displayName} is typing`}>
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
          <label htmlFor={`agent-input-${config.id}`} className="sr-only">
            Reply to {config.displayName}
          </label>
          <input
            id={`agent-input-${config.id}`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={`Reply to ${config.displayName}…`}
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
        <p className="mt-2 text-center font-mono text-[10px] leading-snug text-slate-500">{config.disclaimer}</p>
      </div>
    </div>
  );
}
