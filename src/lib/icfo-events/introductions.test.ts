/**
 * The rules that keep "automatically" from meaning "endlessly".
 */
import { describe, it, expect } from "vitest";
import {
  introVars,
  planBulkSend,
  renderTemplate,
  shouldFollowUp,
  MAX_FOLLOW_UPS,
  type Introduction,
} from "@/lib/icfo-events/introductions";

const NOW = new Date("2026-09-10T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

const intro = (over: Partial<Introduction> = {}): Introduction => ({
  id: "i1",
  status: "sent",
  sentAt: daysAgo(5),
  followUps: 0,
  lastFollowUpAt: null,
  ...over,
});

const decide = (i: Introduction, eventStartsAt?: string | null) =>
  shouldFollowUp(i, { now: NOW, eventStartsAt });

describe("when a founder follow-up goes out", () => {
  it("sends once three days have passed with no answer", () => {
    expect(decide(intro())).toEqual({ send: true });
  });

  it("waits until then", () => {
    expect(decide(intro({ sentAt: daysAgo(2) }))).toEqual({
      send: false, reason: "only 48h since the last message",
    });
  });

  it("counts from the last follow-up, not from the first message", () => {
    const i = intro({ sentAt: daysAgo(9), followUps: 1, lastFollowUpAt: daysAgo(1) });
    expect(decide(i).send).toBe(false);
  });

  it("stops after two", () => {
    const i = intro({ followUps: MAX_FOLLOW_UPS, lastFollowUpAt: daysAgo(9) });
    expect(decide(i)).toEqual({ send: false, reason: "already followed up 2 times" });
  });
});

describe("who is never chased", () => {
  it("leaves a declined introduction alone", () => {
    expect(decide(intro({ status: "declined" }))).toEqual({
      send: false, reason: "declined — never chased",
    });
  });

  it("leaves an accepted one alone", () => {
    expect(decide(intro({ status: "accepted" })).send).toBe(false);
  });

  it("goes quiet in the last day before the event", () => {
    const soon = new Date(NOW.getTime() + 6 * 3_600_000).toISOString();
    expect(decide(intro(), soon)).toEqual({ send: false, reason: "event is within 24h" });
  });

  it("does not chase after the event has happened", () => {
    expect(decide(intro(), daysAgo(1)).send).toBe(false);
  });

  it("still chases when the event is comfortably ahead", () => {
    const later = new Date(NOW.getTime() + 10 * 86_400_000).toISOString();
    expect(decide(intro(), later)).toEqual({ send: true });
  });

  it("chases when the event has no date at all", () => {
    expect(decide(intro(), null).send).toBe(true);
  });
});

describe("filling the template", () => {
  const vars = introVars({
    investor: { name: "Marcus Reyes", company: "Tessellate" },
    founder: { name: "Shan Padda", company: "Harvard MedTech" },
    eventTitle: "iCFO PE Expo — Las Vegas",
    sharedSectors: ["HealthTech", "Deep Tech"],
  });

  it("addresses the investor by first name — the invitation goes to them", () => {
    expect(vars.first_name).toBe("Marcus");
    expect(vars.founder_name).toBe("Shan Padda");
  });

  it("writes the shared sectors as a sentence fragment", () => {
    expect(vars.shared_line).toBe(", and you share HealthTech, Deep Tech");
  });

  it("leaves nothing dangling when they share nothing", () => {
    const none = introVars({
      investor: { name: "Marcus", company: null },
      founder: { name: "Shan", company: null },
      eventTitle: "X",
      sharedSectors: [],
    });
    expect(none.shared_line).toBe("");
    expect(renderTemplate("Both at {{event_title}}{{shared_line}}.", none)).toBe("Both at X.");
  });

  it("falls back for a founder with no company", () => {
    const v = introVars({
      investor: { name: "M", company: null },
      founder: { name: "S", company: null },
      eventTitle: "X",
      sharedSectors: [],
    });
    expect(v.founder_company).toBe("their company");
  });

  it("substitutes every token it knows", () => {
    expect(renderTemplate("Hi {{first_name}}, meet {{founder_name}}.", vars))
      .toBe("Hi Marcus, meet Shan Padda.");
  });

  it("leaves an unknown token visible rather than blanking it", () => {
    // A stray {{token}} in a test send is a mistake you can see; a gap is not.
    expect(renderTemplate("Hi {{nickname}}.", vars)).toBe("Hi {{nickname}}.");
  });
});

describe("a bulk send is grouped by who receives it", () => {
  it("collapses one investor's several matches into one recipient", () => {
    const plan = planBulkSend([
      { investorRegId: "inv-1", introductionId: "a" },
      { investorRegId: "inv-1", introductionId: "b" },
      { investorRegId: "inv-2", introductionId: "c" },
    ]);
    expect(plan.perRecipient).toHaveLength(2);
    expect(plan.perRecipient.find((r) => r.investorRegId === "inv-1")?.introductionIds).toEqual(["a", "b"]);
  });

  it("counts the investors who would otherwise be mailed more than once", () => {
    const plan = planBulkSend([
      { investorRegId: "inv-1", introductionId: "a" },
      { investorRegId: "inv-1", introductionId: "b" },
      { investorRegId: "inv-2", introductionId: "c" },
    ]);
    expect(plan.wouldRepeat).toBe(1);
  });

  it("reports nothing to warn about when every investor appears once", () => {
    const plan = planBulkSend([
      { investorRegId: "inv-1", introductionId: "a" },
      { investorRegId: "inv-2", introductionId: "b" },
    ]);
    expect(plan.wouldRepeat).toBe(0);
  });

  it("copes with an empty selection", () => {
    expect(planBulkSend([])).toEqual({ perRecipient: [], wouldRepeat: 0 });
  });
});
