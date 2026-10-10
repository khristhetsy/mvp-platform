"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { PLATFORM_TZ, PLATFORM_TZ_LABEL } from "@/lib/time/platform-tz";
import {
  JESSICA_AI_CHOICES,
  JESSICA_AI_NO_LINES,
  JESSICA_AI_VARIANTS,
  JESSICA_AI_YES_BRIDGE,
  JESSICA_BOOKING_NOTE,
  JESSICA_COST_CHOICES,
  JESSICA_DISCLAIMER,
  JESSICA_FALLBACK_BRIDGE,
  JESSICA_FALLBACK_LINES,
  JESSICA_SPARE_BRIDGES,
  JESSICA_QUALIFY_FALLBACK,
  JESSICA_SLOT_MINUTES,
} from "@/lib/jessica/config";
import {
  aiMode,
  bookingAnswers,
  formatSlotWhen,
  groupSlotsByDay,
  looksLikeName,
  matchReply,
  normalizeRole,
  parseAiReply,
  pickWording,
  questionKey,
  timeOfferLine,
  validEmail,
  type JessicaAiReply,
  type JessicaProfile,
  type Slot,
} from "@/lib/jessica/flow";

type Msg = { id: number; from: "jessica" | "you"; text: string; href?: string; hrefLabel?: string };
type LinkExtra = Pick<Msg, "href" | "hrefLabel">;
type Replies = { options: string[]; main: boolean; pick: (option: string) => void; resume?: string };
type BookResult = { ok: true; meetUrl: string | null } | { ok: false; retry: boolean; message: string };
type Turn = { role: "user" | "assistant"; content: string };

const OTHER_TIME = "Another time";
const OTHER_DAY = "Other day";

/**
 * Jessica, the iCFO meeting agent: a short, real-chat style conversation that
 * qualifies the visitor and books a call on the host's own calendar through the
 * existing scheduling endpoints (/api/scheduling/slots and /book). Nothing is
 * written until the visitor taps a time.
 *
 * The qualifying questions, the fee answer, the objection replies and the time
 * offer are scripted. Anything else the visitor types goes to /api/jessica/reply,
 * which answers from the iCFO fact sheet under its rules. Jessica never asks
 * whether they want a call, only when: one close, then one qualifying question
 * if the times were ignored, then a close again.
 */
export function JessicaChat({ hostId, sourceTag }: { hostId: string; sourceTag: string | null }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [typing, setTyping] = useState(false);
  const [replies, setReplies] = useState<Replies | null>(null);
  const [draft, setDraft] = useState("");
  const submitRef = useRef<(value: string) => boolean>(() => false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let busy = false;
    let booked = false;
    let nextId = 1;
    let waiter: ((value: string) => void) | null = null;
    const profile: JessicaProfile = {};
    const said = new Set<string>();

    const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

    const push = (from: Msg["from"], text: string, extra?: LinkExtra) => {
      const id = nextId++;
      setMsgs((list) => [...list, { id, from, text, ...extra }]);
    };

    const say = async (lines: string[], extra?: LinkExtra) => {
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

    const show = (next: Replies | null) => {
      current = next;
      setReplies(next);
    };

    let current: Replies | null = null;
    const ask = (options: string[], main = false, resume?: string) =>
      new Promise<string>((resolve) => {
        show({
          options,
          main,
          resume,
          pick: (option) => {
            show(null);
            push("you", option);
            resolve(option);
          },
        });
      });

    const askText = () =>
      new Promise<string>((resolve) => {
        waiter = resolve;
      });

    const loadSlots = async (): Promise<Slot[] | null> => {
      try {
        const from = new Date();
        const to = new Date(from.getTime() + 21 * 24 * 60 * 60 * 1000);
        const url =
          `/api/scheduling/slots?host=${hostId}` +
          `&from=${encodeURIComponent(from.toISOString())}` +
          `&to=${encodeURIComponent(to.toISOString())}` +
          `&duration=${JESSICA_SLOT_MINUTES}`;
        const res = await fetch(url);
        if (!res.ok) return null;
        const data = (await res.json()) as { slots?: Slot[] };
        return Array.isArray(data.slots) ? data.slots : [];
      } catch {
        return null;
      }
    };

    const book = async (slot: Slot, name: string, email: string): Promise<BookResult> => {
      try {
        const res = await fetch("/api/scheduling/book", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            hostId,
            startTime: slot.start,
            endTime: slot.end,
            timezone: PLATFORM_TZ,
            name,
            email,
            note: JESSICA_BOOKING_NOTE,
            answers: bookingAnswers(profile),
            sourceTag: sourceTag ?? undefined,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as { meetUrl?: string | null; error?: unknown };
        if (res.ok) return { ok: true, meetUrl: data.meetUrl ?? null };
        if (res.status === 409) return { ok: false, retry: true, message: "That time was just taken." };
        if (res.status === 429) return { ok: false, retry: false, message: "Lots of requests from here right now. Try again in a little while." };
        return { ok: false, retry: false, message: "Something went wrong on my end, and I couldn't book that." };
      } catch {
        return { ok: false, retry: false, message: "I lost the connection and couldn't book that." };
      }
    };

    const calendarLink = (): LinkExtra => ({
      href: `/schedule/${hostId}${sourceTag ? `?src=${encodeURIComponent(sourceTag)}` : ""}`,
      hrefLabel: "Open the calendar",
    });

    // One close, then qualify. See aiMode().
    let offered = 0;
    let sinceNew = 0;
    const turns: Turn[] = [];
    const sessionId = Math.random().toString(36).slice(2, 14);
    // Never the same answer twice: how often each scripted reply and each question has come up.
    const usedScript = new Map<string, number>();
    const askedBefore = new Map<string, number>();
    const timesUsed = (id: string) => {
      const n = usedScript.get(id) ?? 0;
      usedScript.set(id, n + 1);
      return n;
    };

    const pickSlot = async (): Promise<Slot | "calendar" | null> => {
      const slots = await loadSlots();
      if (cancelled) return null;
      const days = slots ? groupSlotsByDay(slots, PLATFORM_TZ, 4) : [];
      if (days.length === 0) return "calendar";
      offered++;
      sinceNew = 0;
      return new Promise((resolve) => {
        void (async () => {
          while (true) {
            const dayChoice = await ask([...days.map((d) => d.label), OTHER_TIME], true);
            if (dayChoice === OTHER_TIME) return resolve("calendar");
            const day = days.find((d) => d.label === dayChoice);
            if (!day) continue;
            await say([`${day.label}. What time, ${PLATFORM_TZ_LABEL}?`]);
            const timeChoice = await ask([...day.slots.slice(0, 8).map((s) => s.label), OTHER_DAY], true);
            if (timeChoice === OTHER_DAY) continue;
            const picked = day.slots.find((s) => s.label === timeChoice);
            if (picked) return resolve(picked);
          }
        })();
      });
    };

    /** The assumptive close: a bridge that fits what was just said, then the real open days. */
    const offerTimes = async (wanted: string) => {
      const bridge = freshBridge(wanted);
      const slots = await loadSlots();
      if (cancelled) return;
      const days = slots ? groupSlotsByDay(slots, PLATFORM_TZ, 4) : [];
      if (days.length === 0) {
        await say([`${bridge} You can pick a time directly here.`], calendarLink());
        return;
      }
      await say([`${bridge} ${timeOfferLine(days.map((d) => d.label), offered, PLATFORM_TZ_LABEL)}`]);
      await startBooking();
    };

    const startBooking = async () => {
      let picked = await pickSlot();
      if (cancelled || picked === null) return;
      if (picked === "calendar") {
        await say(["No problem. Pick anything that works for you here."], calendarLink());
        return;
      }

      await say([profile.name ? `Great, ${profile.name}. What's the best email for the invite?` : "Great. What's your name?"]);
      if (!profile.name) {
        let fullName = (await askText()).trim().slice(0, 200);
        // A question typed into the name prompt is a question, not a name.
        while (!looksLikeName(fullName)) {
          await answerAside(fullName);
          if (cancelled) return;
          await say(["And your name, for the invite?"]);
          fullName = (await askText()).trim().slice(0, 200);
        }
        profile.name = fullName.split(/\s+/)[0] || fullName;
        profile.fullName = fullName;
        await say([`Thanks, ${profile.name}. What's the best email for the invite?`]);
      }
      let email = (await askText()).trim();
      while (!validEmail(email)) {
        await say(["That email doesn't look right. Can you type it again?"]);
        email = (await askText()).trim();
      }

      for (let attempt = 0; attempt < 3; attempt++) {
        const result = await book(picked, profile.fullName ?? profile.name ?? "", email);
        if (result.ok) {
          booked = true;
          await say(
            [`Done. ${formatSlotWhen(picked.start, PLATFORM_TZ, PLATFORM_TZ_LABEL)} with our team.`, `Invite is on its way to ${email}. Talk soon.`],
            result.meetUrl ? { href: result.meetUrl, hrefLabel: "Join Google Meet" } : undefined,
          );
          return;
        }
        await say([result.message]);
        if (!result.retry) return;
        await say(["Here's what's open now."]);
        const again = await pickSlot();
        if (cancelled || again === null) return;
        if (again === "calendar") {
          await say(["Pick anything that works for you here."], calendarLink());
          return;
        }
        picked = again;
      }
      await say(["Those times keep getting taken. You can pick one directly here."], calendarLink());
    };

    /** Answer a question asked in the middle of booking, without a new time offer. */
    const answerAside = async (text: string) => {
      const scripted = matchReply(text);
      if (scripted.kind === "cost" || scripted.kind === "objection" || scripted.kind === "ai") {
        await say(scripted.lines);
        return;
      }
      setTyping(true);
      const reply = await askAi(text, "(Mid booking. Answer in one line, no bridge and no question.)");
      setTyping(false);
      await say(reply ? reply.lines : scripted.kind === "fact" ? fresh([scripted.lines, ...scripted.variants]) : JESSICA_FALLBACK_LINES);
    };

    const sameAsBefore = (reply: JessicaAiReply) => reply.lines.some((l) => said.has(questionKey(l)));
    /** Never the same words twice: the first wording none of whose lines has been said, else the last one. */
    const fresh = (wordings: string[][]): string[] => wordings.find((w) => !w.some((l) => said.has(questionKey(l)))) ?? wordings[wordings.length - 1];
    const freshBridge = (bridge: string): string => fresh([[bridge], ...JESSICA_SPARE_BRIDGES.map((b) => [b])])[0];

    const askAi = async (text: string, note?: string): Promise<JessicaAiReply | null> => {
      const key = questionKey(text);
      const repeats = askedBefore.get(key) ?? 0;
      askedBefore.set(key, repeats + 1);
      // A repeat question gets a fresh answer and then goes straight back to the focus point: the call.
      const mode = repeats > 0 && !booked ? "CLOSE" : aiMode({ booked, offered, sinceNew });
      const hint = note ?? (repeats > 0 ? "(The visitor already asked this. Say it a different way, shorter, with one new fact, then bring it back to the call.)" : "");
      turns.push({ role: "user", content: `${text.slice(0, 600)}${hint ? `\n${hint}` : ""}` });
      if (turns.length > 12) turns.splice(0, turns.length - 12);
      const known = bookingAnswers(profile).map((a) => `${a.label}: ${a.value}`).join("; ");
      const sent = known ? [{ role: "user" as const, content: `KNOWN: ${known}` }, ...turns] : turns;
      const call = async (): Promise<JessicaAiReply | null> => {
        try {
          const res = await fetch("/api/jessica/reply", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mode, turns: sent, sessionId }),
          });
          if (!res.ok) return null;
          return parseAiReply(await res.json());
        } catch {
          return null;
        }
      };
      let reply = await call();
      // Never the same words twice. One retry with an explicit note, then give up on the AI for this turn.
      if (reply && sameAsBefore(reply)) {
        turns.push({ role: "user", content: "(You already said that word for word. Say it differently.)" });
        reply = await call();
        if (reply && sameAsBefore(reply)) reply = null;
      }
      if (reply) {
        turns.push({ role: "assistant", content: [...reply.lines, reply.bridge || reply.question].join(" ").trim() });
        reply.lines.forEach((l) => said.add(questionKey(l)));
      }
      return reply;
    };

    const sideConversation = async (value: string) => {
      push("you", value);
      const pending = current?.resume ? current : null;
      show(null);
      const scripted = matchReply(value);

      // A question in the middle of qualifying: answer it, then pick the thread back up.
      // Cost and objections still take their own path, since the visitor just opened a door.
      if (pending && !booked && scripted.kind !== "cost" && scripted.kind !== "objection") {
        await answerAside(value);
        if (cancelled) return;
        await say([pending.resume!]);
        show(pending);
        return;
      }

      if (booked) {
        const reply = scripted.kind === "unknown" || scripted.kind === "fact" ? await askAi(value) : null;
        if (cancelled) return;
        await say(reply ? reply.lines : scripted.kind === "unknown" ? ["Good question. The team can go into that on the call."] : scripted.lines);
        return;
      }

      if (scripted.kind === "cost") {
        const wording = pickWording(scripted.lines, scripted.variants, timesUsed("cost"));
        if (!wording) {
          await say(["I'll keep saying it because it's true: it depends on the type of capital, and how much work we have to do."]);
          await offerTimes("Let the team put a real number on it.");
          return;
        }
        await say(wording);
        const pick = await ask(Object.keys(JESSICA_COST_CHOICES));
        profile.capitalType = pick;
        sinceNew = 0;
        const choice = JESSICA_COST_CHOICES[pick] ?? JESSICA_COST_CHOICES["Not sure yet"];
        await say(choice.lines);
        await offerTimes(choice.bridge);
        return;
      }
      if (scripted.kind === "objection") {
        const feeAlreadyGiven = (usedScript.get("cost") ?? 0) + (usedScript.get("commission") ?? 0) > 0;
        const skipOpener = scripted.id === "upfront-fee" && feeAlreadyGiven && (usedScript.get(scripted.id) ?? 0) === 0;
        if (skipOpener) usedScript.set(scripted.id, 1);
        const wording = pickWording(scripted.lines, scripted.variants, timesUsed(scripted.id));
        if (!wording) {
          // Every scripted wording is used up. Let the AI answer it fresh.
          setTyping(true);
          const reply = await askAi(value, "(The visitor raised this objection again. Answer it a new way in one line, then move on.)");
          setTyping(false);
          if (cancelled) return;
          await say(reply ? reply.lines : JESSICA_FALLBACK_LINES);
          await offerTimes(reply?.bridge || scripted.bridge || JESSICA_FALLBACK_BRIDGE);
          return;
        }
        await say(wording);
        const repeat = wording !== scripted.lines;
        if (scripted.choices && !repeat) {
          const pick = await ask(Object.keys(scripted.choices));
          sinceNew = 0;
          const choice = scripted.choices[pick] ?? Object.values(scripted.choices)[0];
          await say(choice.lines);
          await offerTimes(choice.bridge);
        } else {
          await offerTimes((repeat && scripted.repeatBridge) || scripted.bridge || JESSICA_FALLBACK_BRIDGE);
        }
        return;
      }
      if (scripted.kind === "ai") {
        // The one place she asks whether, not when: after saying she is an AI.
        await say(fresh([scripted.lines, ...JESSICA_AI_VARIANTS]));
        const pick = await ask([JESSICA_AI_CHOICES.yes, JESSICA_AI_CHOICES.no], true);
        if (pick === JESSICA_AI_CHOICES.yes) {
          sinceNew = 0;
          await offerTimes(JESSICA_AI_YES_BRIDGE);
        } else {
          sinceNew = 2;
          await say(JESSICA_AI_NO_LINES);
        }
        return;
      }

      // Everything else: the AI, under the fact sheet. Scripted facts are the fallback when it is down.
      const mode = aiMode({ booked, offered, sinceNew });
      setTyping(true);
      const reply = await askAi(value);
      setTyping(false);
      if (cancelled) return;
      const lines = reply ? reply.lines : scripted.kind === "fact" ? fresh([scripted.lines, ...scripted.variants]) : JESSICA_FALLBACK_LINES;
      if (mode === "QUALIFY") {
        sinceNew = 2;
        await say([...lines, reply?.question || JESSICA_QUALIFY_FALLBACK]);
        return;
      }
      await say(lines);
      await offerTimes(reply?.bridge || JESSICA_FALLBACK_BRIDGE);
    };

    submitRef.current = (value) => {
      if (busy || cancelled) return false;
      if (waiter) {
        const resolve = waiter;
        waiter = null;
        push("you", value);
        resolve(value);
        return true;
      }
      void sideConversation(value);
      return true;
    };

    const intro = async () => {
      await say(["Hey, I'm Jessica.", "What brings you here today?"]);
      let role = await ask(["Raising capital", "Looking at deals", "What do you guys do?"], false, "So, what brings you here today?");
      if (/guys/.test(role)) {
        await say([
          "Fair question. We rate how ready your company is, match you with investors who fit, and get your materials in front of them.",
          "Are you raising or investing?",
        ]);
        role = await ask(["Raising", "Investing"], false, "Are you raising or investing?");
      }
      profile.role = normalizeRole(role);

      if (profile.role === "Investing") {
        await say(["Nice. We match investors with companies that fit their mandate.", "What size checks do you usually write?"]);
        profile.checkSize = await ask(["Under $250K", "$250K to $1M", "$1M to $5M", "$5M plus"], false, "Back to you: what size checks do you usually write?");
        await say(["Thanks, that gives me a clear picture. Checks in that range are a good match for the deals we bring to our investors."]);
        await offerTimes(`Next step is ${JESSICA_SLOT_MINUTES} minutes with the team to see the deal flow.`);
        return;
      }

      await say(["Cool, that's what we do.", "What stage is the company at?"]);
      const stage = await ask(["Pre revenue", "Under $1M a year", "$1M to $5M", "Over $5M"], false, "Back to your company: what stage is it at?");
      profile.stage = stage;
      await say([
        /^Pre/.test(stage) ? "Early, got it." : /^Over/.test(stage) ? "Solid." : "Okay, that helps.",
        "Roughly how much are you looking to raise?",
      ]);
      profile.raise = await ask(["Under $1M", "$1M to $5M", "$5M to $20M", "Over $20M"], false, "Back to it: roughly how much are you looking to raise?");
      await say(["And how soon do you want to close?"]);
      profile.timing = await ask(["Within 30 days", "A few months", "Not sure yet"], false, "And how soon do you want to close?");
      await say([
        `Thanks, that gives me a clear picture. A raise like that${/30/.test(profile.timing) ? " on a tight timeline" : ""} is right in our lane.`,
      ]);
      await offerTimes(`Next step is ${JESSICA_SLOT_MINUTES} minutes with the team on how they'd run it.`);
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
  }, [msgs, typing, replies]);

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
                    <Image
                      src="/jessica.jpg"
                      alt="Jessica"
                      width={40}
                      height={40}
                      className="absolute left-0 top-0 h-10 w-10 rounded-full object-cover"
                    />
                  )}
                  <div className="mb-0.5 text-[15px] font-semibold leading-tight">
                    {fromYou ? "You" : "Jessica"}
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
          <div className="flex shrink-0 gap-1 py-2.5 pl-[52px]" aria-label="Jessica is typing">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400" />
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400 [animation-delay:150ms]" />
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400 [animation-delay:300ms]" />
          </div>
        ) : null}

        {replies ? (
          <div className="my-2.5 flex shrink-0 flex-wrap gap-2 pl-[52px]">
            {replies.options.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => replies.pick(option)}
                className={
                  replies.main
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
          <label htmlFor="jessica-input" className="sr-only">
            Reply to Jessica
          </label>
          <input
            id="jessica-input"
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
