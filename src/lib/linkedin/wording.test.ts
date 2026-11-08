import { describe, expect, it } from "vitest";
import { agentFor, checkWording, handoffLink, isApproved, pickVariant, renderAcceptedMessage, renderInvite, wordingHash, type InviteVariant } from "./wording";

const v = (id: string, text: string): InviteVariant => ({ id, text });
const good = [v("a", "Hi {first_name}, I saw your work at {company}."), v("b", "Hello {first_name}, would like to connect.")];

describe("checkWording", () => {
  it("accepts good wording", () => {
    expect(checkWording(good, "Thanks for connecting. {link}")).toEqual([]);
  });
  it("rejects empty, long, duplicate and missing wording", () => {
    expect(checkWording([], "x").length).toBe(1);
    expect(checkWording([v("a", "")], "x").length).toBe(1);
    expect(checkWording([v("a", "x".repeat(201))], "x").length).toBe(1);
    expect(checkWording([v("a", "Same"), v("b", "same")], "x").length).toBe(1);
    expect(checkWording(good, "  ").length).toBe(1);
    expect(checkWording(Array.from({ length: 6 }, (_, i) => v(String(i), `t${i}`)), "x").length).toBe(1);
  });
});

describe("approval", () => {
  const base = { approved_at: "2026-11-09T10:00:00Z", wording_hash: wordingHash(good, "msg"), invite_variants: good, message_text: "msg" };
  it("holds while the wording is unchanged", () => {
    expect(isApproved(base)).toBe(true);
  });
  it("is cleared by any change", () => {
    expect(isApproved({ ...base, message_text: "msg." })).toBe(false);
    expect(isApproved({ ...base, invite_variants: [...good, v("c", "new")] })).toBe(false);
    expect(isApproved({ ...base, approved_at: null })).toBe(false);
    expect(isApproved({ ...base, wording_hash: null })).toBe(false);
  });
});

describe("rendering", () => {
  it("fills names and never cuts text", () => {
    expect(renderInvite("Hi {first_name} at {company}", { name: "Maria Lopez", company: "Acme" })).toBe("Hi Maria at Acme");
    expect(renderInvite("x".repeat(190) + " {company}", { name: null, company: "Long Company Name" })).toBeNull();
  });
  it("adds the handoff link once", () => {
    const link = handoffLink({ appUrl: "https://icapos.com/", agent: "johnny", targetId: "t 1" });
    expect(link).toBe("https://icapos.com/johnny?src=linkedin&t=t%201");
    expect(renderAcceptedMessage("Thanks {first_name}. Chat here: {link}", { name: "Maria L." }, link)).toBe(`Thanks Maria. Chat here: ${link}`);
    expect(renderAcceptedMessage("Thanks!", { name: null }, link)).toBe(`Thanks!\n\n${link}`);
    expect(renderAcceptedMessage("Thanks {link}", { name: null }, null)).toBe("Thanks");
  });
});

describe("helpers", () => {
  it("picks a variant by random draw", () => {
    expect(pickVariant(good, () => 0)?.id).toBe("a");
    expect(pickVariant(good, () => 0.99)?.id).toBe("b");
    expect(pickVariant([])).toBeNull();
  });
  it("sends investors to Johnny and founders to Jessica", () => {
    expect(agentFor("founder")).toBe("jessica");
    expect(agentFor("investor")).toBe("johnny");
    expect(agentFor(null)).toBe("johnny");
  });
});
