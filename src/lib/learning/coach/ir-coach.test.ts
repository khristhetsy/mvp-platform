import { describe, expect, it } from "vitest";
import { OUTREACH_PLAYBOOK } from "@/lib/learning/outreach-playbook";
import { buildCoachPromptAddendum, dueAtFor, enforceCoachRules, stepEventReply } from "@/lib/learning/coach/ir-coach";
import { COACH_TONES, coerceCoachTone, DEFAULT_COACH_TONE, TONE_LINES } from "@/lib/learning/coach/tones";

const step = OUTREACH_PLAYBOOK.sections[0].lessons[2].steps![1];

function pt(d: Date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(d);
}

describe("coach tones", () => {
  it("defaults to Driven and rejects unknown styles", () => {
    expect(DEFAULT_COACH_TONE).toBe("driven");
    expect(coerceCoachTone("nonsense")).toBe("driven");
    expect(coerceCoachTone("relentless")).toBe("relentless");
  });

  it("never shames or promises in fixed lines", () => {
    for (const tone of COACH_TONES) {
      for (const line of Object.values(TONE_LINES[tone])) {
        expect(enforceCoachRules(line, tone)).toBe(line);
      }
    }
  });
});

describe("dueAtFor (Pacific time)", () => {
  it("today is 6 pm Pacific when it is still ahead", () => {
    const now = new Date("2026-10-19T17:00:00Z"); // Mon 10:00 PT
    expect(pt(dueAtFor("today", now))).toBe("Mon 18:00");
  });

  it("today falls back to one hour from now after 6 pm", () => {
    const now = new Date("2026-10-20T03:00:00Z"); // Mon 20:00 PT
    expect(dueAtFor("today", now).getTime()).toBe(now.getTime() + 3_600_000);
  });

  it("tomorrow is 9 am Pacific", () => {
    const now = new Date("2026-10-19T17:00:00Z");
    expect(pt(dueAtFor("tomorrow", now))).toBe("Tue 09:00");
  });

  it("this week is Friday 5 pm Pacific, and next Friday once this one has passed", () => {
    expect(pt(dueAtFor("this_week", new Date("2026-10-19T17:00:00Z")))).toBe("Fri 17:00");
    const fridayNight = new Date("2026-10-24T03:00:00Z"); // Fri 20:00 PT
    const due = dueAtFor("this_week", fridayNight);
    expect(pt(due)).toBe("Fri 17:00");
    expect(due.getTime() - fridayNight.getTime()).toBeGreaterThan(6 * 86_400_000);
  });

  it("holds 9 am across the daylight saving change", () => {
    const now = new Date("2026-11-01T15:00:00Z"); // Sun 07:00 PST after the switch
    expect(pt(dueAtFor("tomorrow", now))).toBe("Mon 09:00");
  });
});

describe("step replies", () => {
  it("stuck replies point to the menu path, the mistake and the example", () => {
    const text = stepEventReply({ tone: "driven", event: "stuck", step });
    expect(text).toContain("Stage 3 – Marketing › Outreach");
    expect(text).toContain("Common mistake");
  });

  it("done names the next step when there is one", () => {
    const next = OUTREACH_PLAYBOOK.sections[0].lessons[2].steps![2];
    expect(stepEventReply({ tone: "encouraging", event: "done", step, nextStep: next })).toContain(next.title);
  });
});

describe("coach rules on model output", () => {
  it("replaces shaming and outcome promises with a safe line", () => {
    for (const bad of ["You are lazy, just send it.", "Do this and investors will invest, guaranteed."]) {
      expect(enforceCoachRules(bad, "relentless")).not.toBe(bad);
    }
  });

  it("keeps ordinary coaching", () => {
    const ok = "Send your first three messages today, then log the follow up dates.";
    expect(enforceCoachRules(ok, "driven")).toBe(ok);
  });

  it("builds a prompt addendum that forbids shame and promises", () => {
    const text = buildCoachPromptAddendum({ tone: "relentless", step, lessonTitle: "Manual outreach and follow ups" });
    expect(text).toMatch(/never shame/i);
    expect(text).toMatch(/never promise/i);
    expect(text).toContain(step.title);
  });
});
