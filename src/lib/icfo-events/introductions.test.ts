/**
 * The rules that keep "automatically" from meaning "endlessly".
 */
import { describe, it, expect } from "vitest";
import {
  introVars,
  planBulkSend,
  renderBody,
  renderTemplate,
  shouldFollowUp,
  canFounderFollowUp,
  shouldRemindFounder,
  MAX_FOLLOW_UPS,
  type FounderChase,
  type Introduction,
} from "@/lib/icfo-events/introductions";

const NOW = new Date("2026-09-10T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

const intro = (over: Partial<Introduction> = {}): Introduction => ({
  id: "i1",
  status: "accepted",
  sentAt: daysAgo(5),
  followUps: 0,
  lastFollowUpAt: null,
  ...over,
});

const decide = (i: Introduction) => shouldFollowUp(i, { now: NOW });

describe("when a follow-up goes out", () => {
  it("sends once three days have passed since the investor accepted", () => {
    expect(decide(intro({ respondedAt: daysAgo(4) }))).toEqual({ send: true });
  });

  it("waits until then", () => {
    expect(decide(intro({ respondedAt: daysAgo(2) }))).toEqual({
      send: false, reason: "only 48h since the last message",
    });
  });

  it("counts from the last follow-up, not from the acceptance", () => {
    const i = intro({ respondedAt: daysAgo(9), followUps: 1, lastFollowUpAt: daysAgo(1) });
    expect(decide(i).send).toBe(false);
  });

  it("stops after two", () => {
    const i = intro({ followUps: MAX_FOLLOW_UPS, lastFollowUpAt: daysAgo(9) });
    expect(decide(i)).toEqual({ send: false, reason: "already followed up 2 times" });
  });
});

describe("who is never followed up", () => {
  it("leaves a declined introduction alone", () => {
    expect(decide(intro({ status: "declined" }))).toEqual({
      send: false, reason: "declined — never chased",
    });
  });

  it("leaves an investor who has not answered alone", () => {
    expect(decide(intro({ status: "sent" }))).toEqual({
      send: false, reason: "not accepted — never chased",
    });
  });

  it("stops once a time is booked", () => {
    expect(decide(intro({ scheduledAt: daysAgo(1) }))).toEqual({ send: false, reason: "already booked" });
  });

  it("has no event window: the same decision on any day", () => {
    const later = new Date(NOW.getTime() + 30 * 86_400_000);
    expect(shouldFollowUp(intro(), { now: later })).toEqual({ send: true });
  });
});

describe("when the founder follows up by hand", () => {
  it("is allowed for an accepted investor with no time", () => {
    expect(canFounderFollowUp({ status: "accepted", followUps: 0, scheduledAt: null })).toEqual({ send: true });
  });

  it("needs no three day wait", () => {
    expect(canFounderFollowUp({ status: "accepted", followUps: 1, scheduledAt: null }).send).toBe(true);
  });

  it("is refused for an investor who has not accepted", () => {
    expect(canFounderFollowUp({ status: "sent", followUps: 0, scheduledAt: null }).send).toBe(false);
    expect(canFounderFollowUp({ status: "declined", followUps: 0, scheduledAt: null }).send).toBe(false);
  });

  it("is refused once a time is booked", () => {
    expect(canFounderFollowUp({ status: "accepted", followUps: 0, scheduledAt: daysAgo(1) }).send).toBe(false);
  });

  it("is refused after two", () => {
    expect(canFounderFollowUp({ status: "accepted", followUps: MAX_FOLLOW_UPS, scheduledAt: null }).send).toBe(false);
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

describe("chasing the founder for a time", () => {
  const chase = (over: Partial<FounderChase> = {}): FounderChase => ({
    status: "accepted",
    scheduledAt: null,
    respondedAt: daysAgo(2),
    sentAt: daysAgo(6),
    founderReminders: 0,
    lastFounderReminderAt: null,
    ...over,
  });
  const decide = (c: FounderChase, eventStartsAt?: string | null) =>
    shouldRemindFounder(c, { now: NOW, eventStartsAt });

  it("nudges a day after the investor said yes", () => {
    expect(decide(chase())).toEqual({ send: true });
  });

  it("waits a day first — sooner than an investor chase, because someone is expecting a meeting", () => {
    expect(decide(chase({ respondedAt: new Date(NOW.getTime() - 3 * 3_600_000).toISOString() }))).toEqual({
      send: false, reason: "only 3h since the last message",
    });
  });

  it("stops once a time is set", () => {
    expect(decide(chase({ scheduledAt: daysAgo(1) }))).toEqual({ send: false, reason: "already scheduled" });
  });

  it("never chases an introduction that was not accepted", () => {
    expect(decide(chase({ status: "sent" })).send).toBe(false);
    expect(decide(chase({ status: "declined" })).send).toBe(false);
  });

  it("stops after two", () => {
    expect(decide(chase({ founderReminders: 2, lastFounderReminderAt: daysAgo(4) })))
      .toEqual({ send: false, reason: "already reminded 2 times" });
  });

  it("gives up once the event has started — there is no slot left to give", () => {
    expect(decide(chase(), daysAgo(1))).toEqual({ send: false, reason: "event has started" });
  });

  it("still chases while the event is ahead", () => {
    const later = new Date(NOW.getTime() + 5 * 86_400_000).toISOString();
    expect(decide(chase(), later)).toEqual({ send: true });
  });

  it("counts from the last reminder, not from the acceptance", () => {
    expect(decide(chase({ founderReminders: 1, lastFounderReminderAt: daysAgo(0) })).send).toBe(false);
  });
});

describe("a token nobody answered", () => {
  const vars = introVars({
    investor: { name: "Marcus Reyes", company: "Tessellate" },
    founder: {
      name: "Shan Padda", company: "Harvard MedTech",
      pitch: "VR therapy for chronic pain.", stage: "Seed", raising: "Raising now", roundSize: "$1M–$3M",
    },
    eventTitle: "iCFO PE Expo",
    sharedSectors: ["HealthTech"],
  });
  const bare = introVars({
    investor: { name: "Marcus", company: null },
    founder: { name: "Shan", company: null },
    eventTitle: "iCFO PE Expo",
    sharedSectors: [],
  });

  const TEMPLATE = "Hi {{first_name}},\n\n{{founder_line}}.\n{{founder_pitch}}\n{{founder_stage_line}}\n\nBoth at {{event_title}}.";

  it("prints every line when the founder answered everything", () => {
    expect(renderBody(TEMPLATE, vars)).toBe(
      "Hi Marcus,\n\nShan Padda — Harvard MedTech.\nVR therapy for chronic pain.\nSeed · Raising now · $1M–$3M\n\nBoth at iCFO PE Expo.",
    );
  });

  it("drops the lines that emptied rather than leaving gaps", () => {
    expect(renderBody(TEMPLATE, bare)).toBe("Hi Marcus,\n\nShan.\n\nBoth at iCFO PE Expo.");
  });

  it("keeps the blank lines between paragraphs", () => {
    expect(renderBody("A\n\nB", vars)).toBe("A\n\nB");
  });

  it("still shows a mistyped token — that is a visible mistake, not a gap", () => {
    expect(renderBody("Hi {{nickname}}.", vars)).toBe("Hi {{nickname}}.");
  });

  it("joins only the stage answers that exist", () => {
    const some = introVars({
      investor: { name: "M", company: null },
      founder: { name: "S", company: null, stage: "Seed", raising: null, roundSize: "$1M–$3M" },
      eventTitle: "X", sharedSectors: [],
    });
    expect(some.founder_stage_line).toBe("Seed · $1M–$3M");
  });

  it("leaves the name alone when there is no company", () => {
    expect(bare.founder_line).toBe("Shan");
    expect(vars.founder_line).toBe("Shan Padda — Harvard MedTech");
  });
});
