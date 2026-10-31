import { describe, expect, it } from "vitest";
import type { AgentPublicConfig } from "@/lib/ir-agent/types";
import { isOpportunityTag, personalizeConfig, type ProspectContext } from "./chat-context";

const config: AgentPublicConfig = {
  id: "a1", companySlug: "icfo", ending: "invest", companyName: "iCFO", displayName: "Jessica", imageUrl: null,
  welcome: ["Jessica here. I handle sales questions at iCFO.", "Tell me a little about what you need."], disclaimer: "", hostProfileId: null, slotMinutes: 20,
  questions: [{ id: "q1", field: "custom", prompt: "What are you hoping to solve?", options: [], enabled: true, position: 0 }],
  contactFields: [], taughtAnswers: [], bookingReady: true, demo: false,
} as unknown as AgentPublicConfig;

const ctx: ProspectContext = { firstName: "Dana", asked: "How long does this take?", concern: "I would rather not pay before I know it works.", objection: "money", closingQuestion: "What would it take to move forward?" };

describe("personalizeConfig", () => {
  it("opens with the prospect's own words and the bridge, and keeps the agent's name first so the chat keeps its case", () => {
    const out = personalizeConfig(config, ctx);
    expect(out.welcome[0]).toBe("Jessica here. Thanks for clicking, Dana.");
    expect(out.welcome[1]).toBe('You asked: "How long does this take?"');
    expect(out.welcome[2]).toBe('You also wrote: "I would rather not pay before I know it works."');
    expect(out.welcome[3]).toBe("That is a fair concern.");
  });

  it("asks the email's closing question as the one question", () => {
    const out = personalizeConfig(config, ctx);
    expect(out.questions).toHaveLength(1);
    expect(out.questions[0].prompt).toBe("What would it take to move forward?");
  });

  it("works with no quotes and no name", () => {
    const out = personalizeConfig(config, { ...ctx, firstName: null, asked: null, concern: null, objection: "unknown", closingQuestion: "What is your biggest struggle in raising capital right now?" });
    expect(out.welcome).toEqual(["Jessica here. Thanks for clicking.", "Thank you for your interest."]);
  });

  it("leaves everything else in the config alone", () => {
    const out = personalizeConfig(config, ctx);
    expect(out.bookingReady).toBe(true);
    expect(out.demo).toBe(false);
    expect(out.companyName).toBe("iCFO");
  });
});

describe("isOpportunityTag", () => {
  it("accepts only the tag format the assignment makes", () => {
    expect(isOpportunityTag("opp-0123456789")).toBe(true);
    expect(isOpportunityTag("opp-xyz")).toBe(false);
    expect(isOpportunityTag("linkedin")).toBe(false);
    expect(isOpportunityTag(null)).toBe(false);
  });
});
