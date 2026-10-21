import { describe, expect, it } from "vitest";
import { OUTREACH_PLAYBOOK } from "@/lib/learning/outreach-playbook";
import { COACH_TONES } from "@/lib/learning/coach/tones";
import { ENCOURAGEMENT, MONDAY_REVIEW, PROGRAM_BENCHMARKS, PROGRAM_MODULES, encouragement, getProgramModule, recallEncouragement, testEncouragement } from "@/lib/learning/coach/program";
import { CLOSING_PROGRAM } from "@/lib/learning/coach/program-closing";
import { CLOSING_PLAYBOOK } from "@/lib/learning/closing-playbook";

describe("closing program content", () => {
  const closingSlugs = CLOSING_PLAYBOOK.sections.flatMap((s) => s.lessons.map((l) => l.slug));

  it("covers every closing lesson exactly once, in order", () => {
    expect(CLOSING_PROGRAM.modules.map((m) => m.lessonSlug)).toEqual(closingSlugs);
    expect(CLOSING_PROGRAM.modules).toHaveLength(12);
  });

  it("gives each module three option questions, valid tests, coach questions and stuck help", () => {
    for (const m of CLOSING_PROGRAM.modules) {
      expect(m.faq?.length ?? 0).toBeGreaterThan(0);
      expect(m.stuckHelp).toBeTruthy();
      expect(m.companyQuestion).toBeTruthy();
      for (const q of [...m.recall, ...m.tests]) expect(q.options).toHaveLength(3);
      for (const q of m.tests) expect(q.rightIndex).toBeLessThan(q.options.length);
    }
    expect(CLOSING_PROGRAM.modules[0].recall).toHaveLength(0);
    for (const m of CLOSING_PROGRAM.modules.slice(1)) expect(m.recall.length).toBeGreaterThan(0);
    expect(CLOSING_PROGRAM.benchmarks.length).toBeGreaterThan(0);
    expect(CLOSING_PROGRAM.sources.length).toBeGreaterThan(0);
  });
});

const lessonSlugs = OUTREACH_PLAYBOOK.sections.flatMap((s) => s.lessons.map((l) => l.slug));
const PROMISES = /\b(guarantee|will (?:definitely|certainly) (?:raise|close)|investors will (?:say yes|invest))\b/i;

describe("coached program content", () => {
  it("covers every playbook lesson exactly once, in order", () => {
    expect(PROGRAM_MODULES.map((m) => m.lessonSlug)).toEqual(lessonSlugs);
    expect(PROGRAM_MODULES.map((m) => m.week)).toEqual(lessonSlugs.map((_, i) => i + 1));
  });

  it("gives every module a case, three selectable answers, three tests and a commitment", () => {
    for (const m of PROGRAM_MODULES) {
      expect(m.case.lines.length).toBeGreaterThanOrEqual(3);
      expect(m.companyOptions).toHaveLength(3);
      expect(m.tests).toHaveLength(3);
      for (const q of [...m.tests, ...m.recall]) {
        expect(q.options).toHaveLength(3);
        expect(q.rightIndex).toBeGreaterThanOrEqual(0);
        expect(q.rightIndex).toBeLessThan(q.options.length);
        expect(new Set(q.options).size).toBe(3);
      }
      expect(m.commitHint.length).toBeGreaterThan(10);
      expect(m.doTarget).toBeGreaterThan(0);
    }
  });

  it("opens with recall from week 2 on, and not in week 1", () => {
    expect(PROGRAM_MODULES[0].recall).toHaveLength(0);
    for (const m of PROGRAM_MODULES.slice(1)) expect(m.recall).toHaveLength(2);
    expect(MONDAY_REVIEW.recall).toHaveLength(2);
  });

  it("points every screen at a founder route", () => {
    for (const m of PROGRAM_MODULES) {
      expect(m.readScreen.href.startsWith("/founder/")).toBe(true);
      expect(m.doScreen.href.startsWith("/founder/")).toBe(true);
    }
  });

  it("never promises a funding outcome", () => {
    const text = JSON.stringify([PROGRAM_MODULES, MONDAY_REVIEW, ENCOURAGEMENT, PROGRAM_BENCHMARKS]);
    expect(PROMISES.test(text)).toBe(false);
  });

  it("has a line for every tone and key, and ranks test feedback by score", () => {
    for (const tone of COACH_TONES) {
      expect(encouragement(tone, "read").length).toBeGreaterThan(0);
      expect(testEncouragement(tone, 3)).toBe(ENCOURAGEMENT[tone].test3);
      expect(testEncouragement(tone, 2)).toBe(ENCOURAGEMENT[tone].test2);
      expect(testEncouragement(tone, 0)).toBe(ENCOURAGEMENT[tone].test1);
      expect(recallEncouragement(tone, 2)).toBe(ENCOURAGEMENT[tone].recall2);
      expect(recallEncouragement(tone, 0)).toBe(ENCOURAGEMENT[tone].recall0);
    }
  });

  it("looks a module up by lesson slug", () => {
    expect(getProgramModule("game-plan")?.week).toBe(1);
    expect(getProgramModule("nope")).toBeNull();
  });

  it("names a source for every benchmark and labels estimates as such", () => {
    for (const b of PROGRAM_BENCHMARKS) {
      expect(b.stage.length).toBeGreaterThan(0);
      if (/\d/.test(b.industry) && !/benchmark/i.test(b.industry)) expect(b.industry).toMatch(/Estimate|survey|Metal/);
    }
  });
});
