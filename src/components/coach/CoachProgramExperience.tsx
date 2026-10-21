"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CoachStep } from "@/lib/learning/course-types";
import { COACH_TONES, TONE_LABELS, type CoachTone } from "@/lib/learning/coach/tones";
import {
  MONDAY_REVIEW_SLUG,
  encouragement,
  recallEncouragement,
  testEncouragement,
  type ProgramChoice,
  type ProgramDefinition,
  type ProgramQuestion,
} from "@/lib/learning/coach/program";
import { TONE_LINES } from "@/lib/learning/coach/tones";
import { taskBody } from "@/lib/learning/coach/plan-items";
import type { CommitmentRead, ProgramRaw, StandRow } from "@/lib/learning/coach/program-reads";
import { coachLessonHref } from "@/lib/learning/coach/program-links";

type Initial = {
  raw: ProgramRaw;
  stand: StandRow[];
  weekLine: string;
  streak: { met: number; resolved: number; streak: number };
  metric: number | null;
  lastResolved: CommitmentRead | null;
};

type Lesson = { title: string; content: string; keyPoints: string[]; steps: CoachStep[] };

type Props = Readonly<{
  founderFirstName: string;
  program: ProgramDefinition;
  lessonSlug: string;
  lesson: Lesson | null;
  tone: CoachTone;
  initial: Initial;
}>;

type Phase = 0 | 1 | 2 | 3 | 4 | 5 | 6;
const PHASE_NAMES = ["Recall", "Read", "Your company", "Do", "Test", "Answers", "Commit"] as const;

type Msg =
  | { id: string; role: "coach"; text: string; quick?: Array<{ label: string; onPick: () => void }>; caseCard?: boolean; verdict?: { ok: boolean; right: string }; commitForm?: boolean }
  | { id: string; role: "founder"; text: string };

function fmtDue(iso: string) {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles" }).format(new Date(iso));
}

export function CoachProgramExperience({ founderFirstName, program, lessonSlug, lesson, tone: initialTone, initial }: Props) {
  const courseSlug = program.courseSlug;
  const MODULES = program.modules;
  const MONDAY_REVIEW = program.review;
  const isReview = lessonSlug === MONDAY_REVIEW_SLUG;
  const mod = isReview ? null : (MODULES.find((m) => m.lessonSlug === lessonSlug) ?? null);
  const weekIndex = mod ? MODULES.findIndex((m) => m.lessonSlug === lessonSlug) : MODULES.length;
  const recallQs: ProgramQuestion[] = isReview ? MONDAY_REVIEW.recall : (mod?.recall ?? []);
  const faq = (isReview ? MONDAY_REVIEW.faq : mod?.faq) ?? [];
  const companyQ = isReview ? MONDAY_REVIEW.companyQuestion : mod!.companyQuestion;
  const companyOpts: ProgramChoice[] = isReview ? MONDAY_REVIEW.companyOptions : mod!.companyOptions;
  const companyFollowUp = isReview ? MONDAY_REVIEW.companyFollowUp : mod!.companyFollowUp;
  const companyFollowUpReply = isReview ? MONDAY_REVIEW.companyFollowUpReply : mod!.companyFollowUpReply;
  const commitHint = isReview ? MONDAY_REVIEW.commitHint : mod!.commitHint;
  const commitDone = isReview ? MONDAY_REVIEW.commitDone : mod!.commitDone;
  const minutes = isReview ? MONDAY_REVIEW.minutes : mod!.minutes;

  const [tone, setTone] = useState<CoachTone>(initialTone);
  const [phase, setPhase] = useState<Phase>(recallQs.length ? 0 : 1);
  const [recallAns, setRecallAns] = useState<Array<{ text: string; ok: boolean } | null>>(recallQs.map(() => null));
  const [companyText, setCompanyText] = useState("");
  const [companyReply, setCompanyReply] = useState("");
  const [companyText2, setCompanyText2] = useState("");
  const [testAns, setTestAns] = useState<Array<{ text: string; ok: boolean } | null>>([null, null, null]);
  const [qi, setQi] = useState(0);
  const [cue, setCue] = useState("");
  const [act, setAct] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [committed, setCommitted] = useState<{ dueAt: string; taskId: string | null } | null>(null);
  const [draft, setDraft] = useState("");
  const [asides, setAsides] = useState<Array<{ q: string; r: string }>>([]);
  const [data, setData] = useState<Initial>(initial);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showStand, setShowStand] = useState(false);
  const [selfReported, setSelfReported] = useState(false);
  const [explained, setExplained] = useState<number[]>([]);
  const [stuck, setStuck] = useState<string | null>(null);
  const [notNow, setNotNow] = useState<{ stage: "ask" | "chosen"; label?: string; dueAt?: string; task?: "idle" | "saving" | "added" | "failed" } | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const log = useCallback(
    (kind: "opened" | "recall" | "answer" | "test", note: string) => {
      void fetch("/api/founder/learning/coach/program", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "log", courseSlug, lessonSlug, kind, note }),
      }).catch(() => null);
    },
    [courseSlug, lessonSlug],
  );

  useEffect(() => {
    log("opened", isReview ? "Monday review" : (mod?.shortTitle ?? lessonSlug));
    // Once per page open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [phase, recallAns, companyText, companyText2, testAns, committed, asides, data.metric]);

  async function refresh() {
    setChecking(true);
    const res = await fetch(`/api/founder/learning/coach/program?${new URLSearchParams({ courseSlug, lessonSlug })}`).catch(() => null);
    setChecking(false);
    if (!res?.ok) return;
    const body = (await res.json()) as Initial & { tone: CoachTone };
    setData({ raw: body.raw, stand: body.stand, weekLine: body.weekLine, streak: body.streak, metric: body.metric, lastResolved: body.lastResolved });
  }

  async function changeTone(next: CoachTone) {
    setTone(next);
    await fetch("/api/founder/learning/coach/state", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "set_tone", tone: next }) }).catch(() => null);
  }

  async function selfReport() {
    const res = await fetch("/api/founder/learning/coach/program", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "self_report", courseSlug, lessonSlug }) }).catch(() => null);
    if (res?.ok) setSelfReported(true);
    else setError("Could not save that. Try again.");
  }

  async function saveCommit() {
    setError(null);
    if (!cue.trim() || !act.trim() || !dueAt) {
      setError("Write both halves and pick the date and time.");
      return;
    }
    const iso = new Date(dueAt).toISOString();
    const res = await fetch("/api/founder/learning/coach/program", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "commit", courseSlug, lessonSlug, cue: cue.trim(), act: act.trim(), dueAt: iso }),
    }).catch(() => null);
    if (!res?.ok) {
      const body = res ? ((await res.json().catch(() => ({}))) as { error?: string }) : {};
      setError(body.error ?? "Could not save. Try again.");
      return;
    }
    const body = (await res.json()) as { dueAt: string; taskId: string | null };
    setCommitted({ dueAt: body.dueAt, taskId: body.taskId });
    void refresh();
  }

  /** "I am stuck" is a real step check in: the existing step route records it and replies in the founder's tone. */
  async function markStuck() {
    const res = await fetch("/api/founder/learning/coach/step", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ courseSlug, lessonSlug, stepIndex: 0, event: "stuck" }) }).catch(() => null);
    const body = res?.ok ? ((await res.json()) as { reply: string }) : null;
    setStuck(body?.reply ?? TONE_LINES[tone].stuck);
  }

  /** "Not now" with a time records a commitment through the step route; the task is added only when the founder presses the button. */
  async function chooseNotNow(dueChoice: "today" | "tomorrow" | "this_week", label: string) {
    const res = await fetch("/api/founder/learning/coach/step", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ courseSlug, lessonSlug, stepIndex: 0, event: "skipped", dueChoice }) }).catch(() => null);
    const body = res?.ok ? ((await res.json()) as { reply: string; dueAt?: string | null }) : null;
    setNotNow({ stage: "chosen", label, dueAt: body?.dueAt ?? undefined, task: "idle" });
  }

  async function addNotNowTask() {
    if (!notNow?.dueAt || !mod) return;
    setNotNow({ ...notNow, task: "saving" });
    const res = await fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(taskBody({ stepTitle: mod.doVerb + ": " + mod.shortTitle, dueAt: notNow.dueAt })) }).catch(() => null);
    setNotNow({ ...notNow, task: res?.ok ? "added" : "failed" });
  }

  const doTarget = mod?.doTarget ?? 0;
  const metric = data.metric;
  const doComplete = isReview || selfReported || (metric !== null && metric >= doTarget);
  const unread = Boolean(mod) && metric === null;

  function pickRecall(i: number, k: number) {
    const q = recallQs[i];
    const ok = k === q.rightIndex;
    setRecallAns((prev) => prev.map((a, idx) => (idx === i ? { text: q.options[k], ok } : a)));
    log("recall", `q${i + 1} ${ok ? "correct" : "incorrect"}`);
  }

  function pickCompany(choice: ProgramChoice | null, typed?: string) {
    const text = choice ? choice.label : (typed ?? "");
    setCompanyText(text);
    setCompanyReply(choice ? choice.reply : "Thanks. I will hold you to that, and the screen on the right is where it happens.");
    log("answer", `company: ${text}`.slice(0, 500));
  }

  function pickTest(k: number) {
    const q = (mod?.tests ?? [])[qi];
    if (!q) return;
    const ok = k === q.rightIndex;
    setTestAns((prev) => prev.map((a, idx) => (idx === qi ? { text: q.options[k], ok } : a)));
    log("test", `q${qi + 1} ${ok ? "correct" : "incorrect"}`);
    if (qi < 2) setQi(qi + 1);
    else setPhase(5);
  }

  function send(e: React.FormEvent) {
    e.preventDefault();
    const t = draft.trim();
    if (!t) return;
    setDraft("");
    if (phase === 2 && !companyText) {
      pickCompany(null, t);
      return;
    }
    if (phase === 2 && !companyText2) {
      setCompanyText2(t);
      log("answer", `follow up: ${t}`.slice(0, 500));
      return;
    }
    const low = t.toLowerCase();
    const hit = faq.find(([question]) => question.toLowerCase().split(/\W+/).filter((w) => w.length > 4).some((w) => low.indexOf(w) >= 0));
    setAsides((a) => [...a, { q: t, r: hit ? hit[1] : "Noted. For anything beyond this lesson, the coach bubble on every iCapOS page answers from the course and your own numbers. Here, the questions under the box are the ones I answer; try one, or keep going with the step." }]);
  }

  const thread = useMemo<Msg[]>(() => {
    const out: Msg[] = [];
    const C = (id: string, text: string, extra?: Partial<Extract<Msg, { role: "coach" }>>) => out.push({ id, role: "coach", text, ...extra });
    const F = (id: string, text: string) => out.push({ id, role: "founder", text });
    const go = (p: Phase) => () => setPhase(p);
    const intro = isReview ? MONDAY_REVIEW.intro : mod!.intro;

    // 0 Recall and commitment check
    if (recallQs.length === 0) {
      C("intro", `Hi ${founderFirstName}. ${intro}`);
    } else {
      C("intro", `Hi ${founderFirstName}. ${intro}`);
      const answered = recallAns.filter(Boolean).length;
      recallQs.forEach((q, i) => {
        if (phase === 0 && i > answered) return;
        const open = phase === 0 && i === answered;
        C(`r${i}`, q.prompt + (open ? " Say it to yourself first, then pick." : ""), open ? { quick: q.options.map((label, k) => ({ label, onPick: () => pickRecall(i, k) })) } : undefined);
        const a = recallAns[i];
        if (a) F(`ra${i}`, a.text);
      });
      if (phase > 0 || answered === recallQs.length) {
        const correct = recallAns.filter((a) => a?.ok).length;
        const last = data.lastResolved;
        const check = last
          ? `Commitment check from Tasks: "${last.title}" was ${last.status === "kept" ? "kept" : "missed"}.`
          : "Commitment check: no resolved commitment on file yet, so nothing to mark met this week.";
        C("rsum", `${recallEncouragement(tone, correct)} ${check}`, phase === 0 ? { quick: [{ label: isReview ? "See my numbers" : "Start the lesson", onPick: go(1) }] } : undefined);
      }
    }

    // 1 Read (or numbers, for the review)
    if (phase >= 1) {
      if (isReview) {
        const r = data.raw;
        const nums = [
          r.sends ? `Sends: ${r.sends.week}` : "Sends: not read",
          r.sends ? `Follow ups: ${r.sends.followUpsWeek}` : "Follow ups: not read",
          r.intros ? `Introduction requests: ${r.intros.week}` : "Introduction requests: not read",
          r.sends ? `Replies: ${r.sends.replies}` : "Replies: not read",
        ].join(". ");
        C("nums", `Your week against your target. ${nums}. That is not a judgement, it is the starting line.`, phase === 1 ? { quick: [{ label: "Next", onPick: go(2) }] } : undefined);
      } else {
        C("read", `${lesson!.title}. ${lesson!.content}`, { caseCard: true });
        C("readscreen", `${mod!.readNote} Ask me anything about it, or tell me when you have read it.`, phase === 1 ? { quick: [{ label: "I have read it", onPick: go(2) }] } : undefined);
      }
    }

    // 2 Your company
    if (phase >= 2) {
      if (!isReview) C("readenc", encouragement(tone, "read"));
      C("cq", companyQ + (companyText ? "" : " Pick one, or write your own below."), !companyText && phase === 2 ? { quick: companyOpts.map((o) => ({ label: o.label, onPick: () => pickCompany(o) })) } : undefined);
      if (companyText) {
        F("ca", companyText);
        C("cr", `${companyReply} ${isReview ? "" : encouragement(tone, "company")}`);
        C("cq2", companyFollowUp);
        if (companyText2) {
          F("ca2", companyText2);
          C("cr2", `${companyFollowUpReply} ${isReview ? "" : encouragement(tone, "why")}`, phase === 2 ? { quick: [{ label: isReview ? "Commit" : "Go do it", onPick: isReview ? go(6) : go(3) }] } : undefined);
        }
      }
    }

    // 3 Do
    if (phase >= 3 && mod) {
      if (!doComplete) {
        const count = metric === null ? "I cannot read this screen yet, so when it is done, mark it here and I will count it." : `${metric} of ${doTarget} so far.`;
        const quick: Array<{ label: string; onPick: () => void }> = unread ? [{ label: "Done, mark it", onPick: () => void selfReport() }] : [{ label: checking ? "Checking…" : "I did it, check again", onPick: () => void refresh() }];
        if (!stuck) quick.push({ label: "I am stuck", onPick: () => void markStuck() });
        if (!notNow) quick.push({ label: "Not now", onPick: () => setNotNow({ stage: "ask" }) });
        C("do", `${mod.doIntro} ${count}`, phase === 3 ? { quick } : undefined);
        if (stuck) {
          F("stuckq", "I am stuck.");
          C("stucka", `${stuck} ${mod.stuckHelp ?? ""}`.trim(), phase === 3 ? { quick: [{ label: "That worked, check again", onPick: () => void refresh() }] } : undefined);
        }
        if (notNow?.stage === "ask") {
          F("nnq", "Not now.");
          C("nna", `${TONE_LINES[tone].skipped} When? Times are Pacific.`, { quick: [{ label: "Today 6pm", onPick: () => void chooseNotNow("today", "today 6pm") }, { label: "Tomorrow 9am", onPick: () => void chooseNotNow("tomorrow", "tomorrow 9am") }, { label: "This week, Friday 5pm", onPick: () => void chooseNotNow("this_week", "Friday 5pm") }] });
        } else if (notNow?.stage === "chosen") {
          F("nnq", `Not now. ${notNow.label}.`);
          C("nna", `Held to ${notNow.label}. I check it at that time. Put it on your Tasks too? Nothing is added unless you press the button.`, { quick: [{ label: notNow.task === "added" ? "Added to Tasks" : notNow.task === "saving" ? "Adding…" : notNow.task === "failed" ? "Could not add, try again" : "Add to Tasks", onPick: () => void addNotNowTask() }, { label: "Actually, do it now", onPick: () => setNotNow(null) }] });
        }
      } else {
        C("dodone", `${encouragement(tone, "done")} ${mod.doDone}`, phase === 3 ? { quick: [{ label: "Take the test", onPick: go(4) }] } : undefined);
      }
    }

    // 4 Test
    if (phase >= 4 && mod) {
      mod.tests.forEach((q, i) => {
        if (phase === 4 && i > qi) return;
        const open = phase === 4 && i === qi;
        C(`t${i}`, `Question ${i + 1} of 3. ${q.prompt}${open ? " Answer in your head first, then pick." : ""}`, open ? { quick: q.options.map((label, k) => ({ label, onPick: () => pickTest(k) })) } : undefined);
        const a = testAns[i];
        if (a) F(`ta${i}`, a.text);
      });
    }

    // 5 Answers
    if (phase >= 5 && mod) {
      const correct = testAns.filter((a) => a?.ok).length;
      C("tsum", `${testEncouragement(tone, correct)} Here is why, question by question.`);
      mod.tests.forEach((q, i) => {
        const ok = Boolean(testAns[i]?.ok);
        const canExplain = !ok && explained.indexOf(i) < 0 && phase === 5;
        C(`tw${i}`, q.why ?? "", { verdict: { ok, right: q.options[q.rightIndex] }, quick: canExplain ? [{ label: "Explain more", onPick: () => setExplained((e) => [...e, i]) }] : undefined });
        if (explained.indexOf(i) >= 0) {
          F(`twq${i}`, "Explain more.");
          C(`twa${i}`, `You picked "${testAns[i]?.text ?? ""}". The lesson's answer is "${q.options[q.rightIndex]}". ${q.why ?? ""} ${mod.readNote} The lesson lines are in the message above; read them once more, then the doing is what counts.`);
        }
      });
      C("tocommit", "Last step: one if then plan for this week. It becomes a task with a date, and next week I open by checking whether it was done.", phase === 5 ? { quick: [{ label: "Commit", onPick: go(6) }] } : undefined);
    }

    // 6 Commit
    if (phase >= 6) {
      if (!committed) C("commit", "Write it here. Be specific about the day and time.", { commitForm: true });
      else {
        F("cf", `If it is ${cue}, then I will ${act}.`);
        C("cdone", `${encouragement(tone, "commit")} ${fmtDue(committed.dueAt)} Pacific. ${committed.taskId ? "It is on your Tasks, on the right." : "The task could not be added; your commitment is saved and I still check it."} ${commitDone}`);
      }
    }

    asides.forEach((a, i) => {
      F(`aq${i}`, a.q);
      C(`ar${i}`, a.r);
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, recallAns, companyText, companyReply, companyText2, testAns, qi, committed, asides, data, tone, checking, selfReported, explained, stuck, notNow]);

  const timeLeft = committed ? "done" : `about ${Math.max(1, Math.round(minutes * (1 - phase / 7)))} min left`;
  const placeholder = phase === 2 && (!companyText || !companyText2) ? "Answer in your own words" : "Ask your coach anything";
  const screen = mod ? (phase <= 1 ? mod.readScreen : phase >= 6 ? { path: "Workspace › Tasks", title: "Tasks", href: "/founder/tasks" } : mod.doScreen) : { path: "Workspace › Tasks", title: "Tasks", href: "/founder/tasks" };
  const r = data.raw;

  return (
    <div className="mx-auto max-w-[1320px] px-4 py-6 sm:px-6">
      {/* Milestone strip, the house tracker */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div style={{ height: 3, background: "linear-gradient(90deg,#2E78F5,#7c3aed,#06b6d4)" }} />
        <div className="p-5">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: "#EEEDFE" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 17l4-8 4 4 4-6 4 10" stroke="#2E78F5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">{program.title}</p>
                <p className="text-xs text-slate-500">{isReview ? `Monday review · every week after module ${MODULES.length}` : `Module ${weekIndex + 1} of ${MODULES.length} · ${mod!.shortTitle} · ${mod!.minutes} min`}</p>
              </div>
            </div>
            <p className="text-xs text-slate-500">
              <span className="font-semibold text-slate-900">Commitments met: {data.streak.met} of {data.streak.resolved}</span> · streak {data.streak.streak} {data.streak.streak === 1 ? "week" : "weeks"}
            </p>
          </div>
          <div className="flex">
            {MODULES.map((m, i) => {
              const done = r.lessonsDone.includes(m.lessonSlug);
              const current = i === weekIndex;
              const future = !done && !current;
              return (
                <Link key={m.lessonSlug} href={coachLessonHref(courseSlug, m.lessonSlug)} className="flex min-w-0 flex-1 flex-col items-center" aria-current={current ? "step" : undefined}>
                  <div className="flex w-full items-center">
                    <div className="h-0.5 flex-1" style={{ background: i === 0 ? "transparent" : done || current ? "#2E78F5" : "#e2e8f0" }} />
                    <div className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full" style={{ background: done || current ? "#2E78F5" : "#e2e8f0", boxShadow: current ? "0 0 0 3px #EEEDFE" : "none" }}>
                      {done ? (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 13l4 4L19 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      ) : (
                        <span className="text-[9px] font-bold" style={{ color: future ? "#94a3b8" : "white" }}>{i + 1}</span>
                      )}
                      {current ? <span className="absolute inset-0 rounded-full" style={{ animation: "ping 2s cubic-bezier(0,0,0.2,1) infinite", background: "#2E78F5", opacity: 0.2 }} /> : null}
                    </div>
                    <div className="h-0.5 flex-1" style={{ background: i === MODULES.length - 1 ? "transparent" : done ? "#2E78F5" : "#e2e8f0" }} />
                  </div>
                  <p className="mt-1.5 hidden px-1 text-center text-[10px] font-semibold leading-tight sm:block" style={{ color: current ? "#2E78F5" : future ? "#94a3b8" : "#1e293b" }}>{m.shortTitle}</p>
                </Link>
              );
            })}
          </div>
          <p className="mt-2 text-center text-xs font-semibold text-[#2E78F5] sm:hidden">{isReview ? "Monday review" : `${weekIndex + 1} of ${MODULES.length} · ${mod!.shortTitle}`}</p>
          <div className="mt-3 flex justify-end">
            <Link href={coachLessonHref(courseSlug, MONDAY_REVIEW_SLUG)} className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold ${isReview ? "border-[#0A1A40] bg-[#0A1A40] text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
              After module {MODULES.length}: Monday review, every week · {MONDAY_REVIEW.minutes} min
            </Link>
          </div>
        </div>
      </section>

      {/* This week */}
      <section className="mt-4 flex flex-col gap-3 rounded-xl bg-[#0A1A40] px-5 py-3.5 text-white sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-6"><span className="font-semibold">This week:</span> {data.weekLine}</p>
        <button type="button" onClick={() => setShowStand((s) => !s)} className="shrink-0 rounded-lg border border-[#2A4380] px-3 py-2 text-xs font-semibold text-[#8FB6FF] hover:bg-[#14275A]">
          {showStand ? "Hide where you stand" : "Where you stand"}
        </button>
      </section>

      {showStand ? (
        <section className="mt-3 rounded-xl border border-slate-200 bg-white px-5 py-4">
          <div className="hidden gap-3 pb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 md:flex">
            <div className="flex-[2.2]">Measure</div><div className="flex-1">You are</div><div className="flex-[1.6]">Lesson target</div><div className="flex-[2.4]">Benchmark · your stage</div><div className="flex-[2.2]">Same industry{r.industry ? ` · ${r.industry}` : ""}</div>
          </div>
          {data.stand.map((s) => (
            <div key={s.key} className="flex flex-col gap-1 border-t border-slate-100 py-3 text-[13px] leading-5 md:flex-row md:gap-3">
              <div className="font-medium md:flex-[2.2]">{s.label}</div>
              <div className="text-lg font-bold text-slate-900 md:flex-1">{s.you}</div>
              <div className="text-slate-600 md:flex-[1.6]"><span className="font-semibold md:hidden">Lesson target: </span>{s.lessonTarget}</div>
              <div className="text-slate-600 md:flex-[2.4]"><span className="font-semibold md:hidden">Benchmark, your stage: </span>{s.stage}</div>
              <div className="text-slate-600 md:flex-[2.2]"><span className="font-semibold md:hidden">Same industry: </span>{s.industry}</div>
            </div>
          ))}
          <p className="border-t border-slate-100 pt-3 text-xs leading-5 text-slate-500">
            You: your own company&apos;s data in iCapOS, read {new Date(r.readAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}. Lesson target: the playbook example. Benchmarks: {program.sources.join(" ")} Lines marked estimate are derived from those sources and say so.
          </p>
        </section>
      ) : null}

      <section className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-stretch">
        {/* Coach thread */}
        <div className="flex min-h-[560px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white lg:w-[560px] lg:shrink-0" aria-label="Your IR Coach">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0A1A40] text-sm font-extrabold text-white">C</div>
              <div>
                <p className="text-sm font-semibold">Your IR Coach</p>
                <p className="text-xs text-slate-500">{isReview ? "Weekly review" : lesson!.title} · {PHASE_NAMES[phase]} · <span className="font-semibold text-slate-900">{timeLeft}</span></p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <select aria-label="Coaching style" value={tone} onChange={(e) => void changeTone(e.target.value as CoachTone)} className="rounded-md border border-slate-200 bg-white px-1.5 py-1 text-[11px] text-slate-700">
                {COACH_TONES.map((t) => <option key={t} value={t}>{TONE_LABELS[t].label}</option>)}
              </select>
              <div className="hidden gap-1 sm:flex" aria-hidden="true">
                {(isReview ? [0, 1, 2, 6] : [0, 1, 2, 3, 4, 5, 6]).map((p) => <span key={p} className="h-2 w-2 rounded-full" style={{ background: p < phase ? "#0F7B4F" : p === phase ? "#1A6CE4" : "#DCE4F2" }} />)}
              </div>
            </div>
          </div>

          <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 py-4" style={{ maxHeight: 640 }}>
            {thread.map((m) =>
              m.role === "founder" ? (
                <div key={m.id} className="flex flex-row-reverse items-start gap-2.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#2E78F5] text-xs font-semibold text-white">{founderFirstName.slice(0, 1).toUpperCase()}</div>
                  <div className="max-w-[420px] rounded-xl bg-[#1A6CE4] px-3.5 py-2.5 text-sm leading-6 text-white">{m.text}</div>
                </div>
              ) : (
                <div key={m.id} className="flex items-start gap-2.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0A1A40] text-xs font-extrabold text-white">C</div>
                  <div className="flex max-w-[440px] flex-col gap-2">
                    <div className="rounded-xl bg-[#F4F8FF] px-3.5 py-2.5 text-sm leading-6 text-slate-900">{m.text}</div>
                    {m.caseCard && mod ? (
                      <>
                        <div className="rounded-lg border border-[#BFE3D0] bg-[#EAF6F0] px-3.5 py-3 text-sm leading-6">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#0F6B45]">Worked example · {mod.case.title}</p>
                          <p className="mt-1 font-semibold">{mod.case.setup}</p>
                          <ol className="mt-1.5 space-y-1">
                            {mod.case.lines.map((l, i) => (
                              <li key={i} className="flex gap-2"><span className="mt-1 flex shrink-0 items-center justify-center rounded-full bg-[#0F7B4F] text-[10px] font-bold text-white" style={{ height: 18, width: 18 }}>{i + 1}</span><span>{l}</span></li>
                            ))}
                          </ol>
                          <p className="mt-2 border-t border-[#BFE3D0] pt-1.5"><span className="font-semibold">The rule she took from it:</span> {mod.case.rule}</p>
                          <p className="mt-1 text-xs text-slate-500">Illustrative case built from the lesson, not a founder on the platform.</p>
                        </div>
                        {lesson!.steps.find((s) => s.commonMistake)?.commonMistake ? (
                          <div className="rounded-lg border border-[#F2D4A6] bg-[#FFF4E5] px-3.5 py-2.5 text-sm leading-6">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8A4B00]">Common mistake</p>
                            {lesson!.steps.find((s) => s.commonMistake)!.commonMistake}
                          </div>
                        ) : null}
                        {lesson!.keyPoints.length ? (
                          <div className="flex flex-wrap gap-1.5">{lesson!.keyPoints.map((k) => <span key={k} className="rounded-md bg-[#EEF4FF] px-2.5 py-1 text-xs font-medium text-[#1D2F5C]">{k}</span>)}</div>
                        ) : null}
                      </>
                    ) : null}
                    {m.verdict ? (
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className={`rounded-full px-2.5 py-1 font-semibold ${m.verdict.ok ? "bg-[#EAF6F0] text-[#0F6B45]" : "bg-[#FFF4E5] text-[#8A4B00]"}`}>{m.verdict.ok ? "Correct" : "Not quite"}</span>
                        <span className="text-slate-600">Model answer: <span className="font-semibold text-slate-900">{m.verdict.right}</span></span>
                      </div>
                    ) : null}
                    {m.quick ? (
                      <div className="flex flex-wrap gap-2">
                        {m.quick.map((q) => (
                          <button key={q.label} type="button" onClick={q.onPick} className="min-h-10 rounded-lg border-[1.5px] border-[#1A6CE4] bg-white px-3.5 py-2 text-left text-sm font-semibold text-[#1A6CE4] hover:bg-[#F4F8FF]">
                            {q.label}
                          </button>
                        ))}
                      </div>
                    ) : null}
                    {m.commitForm ? (
                      <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3">
                        <label className="flex items-center gap-2 text-sm"><span className="shrink-0">If it is</span><input type="text" value={cue} onChange={(e) => setCue(e.target.value)} placeholder="Wednesday 9am" className="min-h-10 flex-1 rounded-md border border-slate-300 px-2.5 py-2 text-sm" /></label>
                        <label className="flex items-center gap-2 text-sm"><span className="shrink-0">then I will</span><input type="text" value={act} onChange={(e) => setAct(e.target.value)} placeholder={commitHint} className="min-h-10 flex-1 rounded-md border border-slate-300 px-2.5 py-2 text-sm" /></label>
                        <label className="flex items-center gap-2 text-sm"><span className="shrink-0">Date and time</span><input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className="min-h-10 flex-1 rounded-md border border-slate-300 px-2.5 py-2 text-sm" /></label>
                        <div><button type="button" onClick={() => void saveCommit()} className="min-h-10 rounded-lg bg-[#0A1A40] px-4 py-2 text-sm font-semibold text-white hover:bg-[#14275A]">Save as a task</button></div>
                        {error ? <p className="text-xs text-red-600">{error}</p> : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              ),
            )}
            <div ref={bottomRef} />
          </div>

          {faq.length ? (
            <div className="flex flex-wrap gap-1.5 border-t border-slate-100 bg-[#FAFBFE] px-4 pt-2">
              {faq.map(([question, answer]) => (
                <button key={question} type="button" onClick={() => setAsides((a) => [...a, { q: question, r: answer }])} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-[#1D2F5C] hover:bg-slate-50">
                  {question}
                </button>
              ))}
            </div>
          ) : null}
          <form onSubmit={send} className="flex items-end gap-2 bg-[#FAFBFE] px-4 py-3">
            <textarea rows={2} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={placeholder} aria-label={placeholder} className="min-h-10 flex-1 resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <button type="submit" className="min-h-10 rounded-lg bg-[#0A1A40] px-4 py-2 text-sm font-semibold text-white hover:bg-[#14275A]">Send</button>
          </form>
        </div>

        {/* Live screen */}
        <div className="flex min-h-[320px] flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 bg-[#EEF4FF] px-4 py-2.5">
            <p className="text-xs font-semibold text-[#1D2F5C]">{screen.path}</p>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#1A6CE4]">Your live screen</p>
          </div>
          <div className="flex flex-1 flex-col gap-3 p-5">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-lg font-bold">{screen.title}</h3>
              {mod && phase >= 3 && phase <= 5 && metric !== null ? <p className="text-xs text-slate-500">{metric} of {doTarget}</p> : null}
            </div>
            <LiveFacts raw={r} lessonSlug={lessonSlug} phase={phase} committed={committed} cue={cue} act={act} />
            <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
              <Link href={screen.href} target="_blank" rel="noopener" className="min-h-10 rounded-lg bg-[#1A6CE4] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2E78F5]">Open {screen.title} in a new tab</Link>
              {mod && phase >= 3 && !isReview ? (
                <button type="button" onClick={() => void refresh()} disabled={checking} className="min-h-10 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                  {checking ? "Checking…" : "Check my numbers again"}
                </button>
              ) : null}
            </div>
            <p className="text-xs text-slate-500">Counts are your own company&apos;s data in iCapOS. The coach reads them; it never changes them.</p>
          </div>
        </div>
      </section>

      <style>{`@keyframes ping{75%,100%{transform:scale(2);opacity:0}}`}</style>
    </div>
  );
}

function LiveFacts({ raw, lessonSlug, phase, committed, cue, act }: Readonly<{ raw: ProgramRaw; lessonSlug: string; phase: Phase; committed: { dueAt: string; taskId: string | null } | null; cue: string; act: string }>) {
  const row = (label: string, value: string, good?: boolean) => (
    <div key={label} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm">
      <span>{label}</span>
      <span className={`font-semibold ${good === undefined ? "text-slate-700" : good ? "text-[#0F7B4F]" : "text-[#8A4B00]"}`}>{value}</span>
    </div>
  );
  const na = "Not read just now";
  if (phase >= 6 || lessonSlug === MONDAY_REVIEW_SLUG) {
    return (
      <div className="flex flex-col gap-2">
        {committed ? (
          <div className="rounded-lg border border-[#BFE3D0] bg-[#EAF6F0] px-3.5 py-3 text-sm">
            <p className="font-semibold">Playbook: {act}</p>
            <p className="mt-0.5 text-xs text-slate-600">If it is {cue}. Due {fmtDue(committed.dueAt)} Pacific · {committed.taskId ? "on your Tasks" : "task not added"} · checked by the coach at that time</p>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-300 px-3.5 py-3 text-sm text-slate-500">Your commitment appears here when you save it.</div>
        )}
        {row("Open outreach tasks", raw.tasks ? String(raw.tasks.openOutreach) : na)}
        {row("Commitments kept", `${raw.commitments.filter((c) => c.status === "kept").length} of ${raw.commitments.filter((c) => c.status !== "open" && c.status !== "cancelled").length}`)}
      </div>
    );
  }
  const money = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
  switch (lessonSlug) {
    case "deal-room":
    case "diligence-answers":
      return (
        <div className="flex flex-col gap-2">
          {row("Deal rooms open", raw.dealRooms ? String(raw.dealRooms.open) : na, raw.dealRooms ? raw.dealRooms.open > 0 : undefined)}
          {row("Questions waiting", raw.dealRooms ? String(raw.dealRooms.questionsOpen) : na, raw.dealRooms ? raw.dealRooms.questionsOpen === 0 : undefined)}
          {row("Document requests open", raw.dealRooms ? String(raw.dealRooms.docRequestsOpen) : na)}
          {row("Documents uploaded", raw.documents ? String(raw.documents.total) : na)}
          {lessonSlug === "diligence-answers" ? row("Daily deal room check in Tasks", raw.roomCheckTasks === null ? na : raw.roomCheckTasks > 0 ? "Set" : "No task", Boolean(raw.roomCheckTasks)) : null}
        </div>
      );
    case "documents":
      return <div className="flex flex-col gap-2">{row("Documents uploaded", raw.documents ? String(raw.documents.total) : na)}<p className="text-xs text-slate-500">Which are current versions is yours to say; the coach sees the count. Mark the step done when the sort is finished.</p></div>;
    case "offering-type":
      return (
        <div className="flex flex-col gap-2">
          {row("Offering type", raw.offering?.type ? raw.offering.type.replace(/_/g, " ").toUpperCase() : raw.offering ? "Not set" : na, Boolean(raw.offering?.type))}
          {row("Attested", raw.offering?.attestedAt ? new Date(raw.offering.attestedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : raw.offering ? "Not attested" : na, Boolean(raw.offering?.attestedAt))}
          {row("Raise amount", raw.pledges?.raise ? money(raw.pledges.raise) : na)}
        </div>
      );
    case "closing-checklist":
    case "closing-week":
      return (
        <div className="flex flex-col gap-2">
          {row("SPVs or closings", raw.spvs ? String(raw.spvs.count) : na, raw.spvs ? raw.spvs.count > 0 : undefined)}
          {row("Checklist readiness", raw.spvs ? (raw.spvs.checklistPct === null ? "Not started" : `${raw.spvs.checklistPct}%`) : na)}
          {row("Closing readiness", raw.spvs ? (raw.spvs.closingPct === null ? "Not started" : `${raw.spvs.closingPct}%`) : na)}
          <p className="text-xs text-slate-500">Pledges and indications only; no money moves on the platform.</p>
        </div>
      );
    case "pledges":
      return (
        <div className="flex flex-col gap-2">
          {row("Raise target", raw.pledges?.raise ? money(raw.pledges.raise) : na)}
          {row("Pledged, recorded", raw.pledges ? `${money(raw.pledges.totalPledged)} from ${raw.pledges.investorCount}` : na, raw.pledges ? raw.pledges.investorCount > 0 : undefined)}
          {row("Gap", raw.pledges?.raise ? money(Math.max(0, raw.pledges.raise - raw.pledges.totalPledged)) : na)}
        </div>
      );
    case "investor-updates":
      return (
        <div className="flex flex-col gap-2">
          {row("Updates sent, last 30 days", raw.updates ? String(raw.updates.last30) : na, raw.updates ? raw.updates.last30 > 0 : undefined)}
          {row("Last update", raw.updates ? (raw.updates.daysSince === null ? "None yet" : `${raw.updates.daysSince} days ago`) : na, raw.updates ? raw.updates.daysSince !== null && raw.updates.daysSince <= 31 : undefined)}
          <p className="text-xs text-slate-500">The builder drafts the three sections with AI; you review and send. Open it in a new tab, then check again.</p>
        </div>
      );
    case "milestones":
      return <div className="flex flex-col gap-2">{row("Milestone tasks with a date", raw.milestoneTasks === null ? na : String(raw.milestoneTasks), raw.milestoneTasks ? raw.milestoneTasks >= 3 : false)}<p className="text-xs text-slate-500">Add tasks whose title starts with Milestone, each with a number and a due date.</p></div>;
    case "term-sheet":
    case "valuation":
    case "after-close":
      return <div className="rounded-lg border border-dashed border-slate-300 px-3.5 py-3 text-sm text-slate-500">The coach does not read this screen. Open it, do the step, and mark it done here.</div>;
    case "game-plan":
      return phase <= 1 ? (
        <div className="flex flex-col gap-2">
          {row("Outreach: Manual", "Open", true)}
          {row("Investor matches and introductions", "Open", true)}
          {row("Social media", "Open", true)}
          {row("Automated outreach", raw.automated ? (raw.automated.unlocked ? "Open" : `Locked, rating ${raw.automated.score ?? "not rated"} of gate ${raw.automated.gate}`) : na, raw.automated?.unlocked)}
          {row("IR Agent", raw.irAgent ? (raw.irAgent.status === "live" ? "Live" : raw.irAgent.status ?? "Not set up") : na, raw.irAgent?.status === "live")}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {row("Contacts", raw.contacts ? String(raw.contacts.total) : na)}
          {row("With an email", raw.contacts ? `${raw.contacts.withEmail} of ${raw.contacts.total}` : na)}
          {row("With a short note", raw.contacts ? `${raw.contacts.withNote} of ${raw.contacts.total}` : na)}
          {row("Ready (both)", raw.contacts ? `${raw.contacts.ready} of ${raw.contacts.total}` : na, raw.contacts ? raw.contacts.ready >= 10 : undefined)}
        </div>
      );
    case "matches-introductions":
      return (
        <div className="flex flex-col gap-2">
          {row("Introduction requests this week", raw.intros ? String(raw.intros.week) : na)}
          {row("Requests ever", raw.intros ? String(raw.intros.total) : na)}
          {row("Dismissed or declined", raw.intros ? `${raw.intros.dismissed} of ${raw.intros.total}` : na, raw.intros ? raw.intros.dismissed < raw.intros.total : undefined)}
          {row("Last request", raw.intros?.lastAt ? new Date(raw.intros.lastAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : raw.intros ? "None" : na)}
        </div>
      );
    case "manual-outreach":
      return (
        <div className="flex flex-col gap-2">
          {row("First messages sent this week", raw.sends ? String(raw.sends.week) : na)}
          {row("Follow ups sent this week", raw.sends ? String(raw.sends.followUpsWeek) : na)}
          {row("Contacts enrolled", raw.sends ? String(raw.sends.recipients) : na)}
          {row("Replies", raw.sends ? String(raw.sends.replies) : na)}
        </div>
      );
    case "social-media":
      return (
        <div className="flex flex-col gap-2">
          {row("Connected accounts", raw.social ? String(raw.social.connected) : na, raw.social ? raw.social.connected > 0 : undefined)}
          {row("Posts scheduled or published", raw.social ? String(raw.social.scheduled) : na, raw.social ? raw.social.scheduled > 0 : undefined)}
        </div>
      );
    case "automated-outreach":
      return (
        <div className="flex flex-col gap-2">
          {row("Gate status", raw.automated ? (raw.automated.unlocked ? "Open" : "Locked") : na, raw.automated?.unlocked)}
          {row("Capital Readiness Rating", raw.automated ? `${raw.automated.score ?? "not rated"} of gate ${raw.automated.gate}` : na)}
        </div>
      );
    case "ir-agent":
      return <div className="flex flex-col gap-2">{row("Agent status", raw.irAgent ? (raw.irAgent.status ?? "Not set up") : na, raw.irAgent?.status === "live")}</div>;
    case "events":
      return <div className="rounded-lg border border-dashed border-slate-300 px-3.5 py-3 text-sm text-slate-500">The coach does not read your event list yet. Open Present at event, pick one, and mark the step done here.</div>;
    default:
      return <div className="flex flex-col gap-2">{row("Open outreach tasks", raw.tasks ? String(raw.tasks.openOutreach) : na)}</div>;
  }
}
