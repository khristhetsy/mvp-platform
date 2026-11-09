import { describe, expect, it } from "vitest";
import { agentFor, checkNetworkWording, checkWording, handoffLink, isApproved, pickVariant, renderAcceptedMessage, renderConnectedMessage, renderInvite, wordingHash, type InviteVariant } from "./wording";

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

describe("message for existing connections", () => {
  it("keeps an earlier approval valid when there is no such message", () => {
    expect(wordingHash(good, "msg", null)).toBe(wordingHash(good, "msg"));
    expect(wordingHash(good, "msg", "  ")).toBe(wordingHash(good, "msg"));
  });
  it("clears the approval when the message is added or changed", () => {
    const base = { approved_at: "2026-11-09T10:00:00Z", wording_hash: wordingHash(good, "msg", "hello"), invite_variants: good, message_text: "msg", connected_message_text: "hello" };
    expect(isApproved(base)).toBe(true);
    expect(isApproved({ ...base, connected_message_text: "hello!" })).toBe(false);
    expect(isApproved({ ...base, connected_message_text: null })).toBe(false);
  });
  it("is optional but limited in length", () => {
    expect(checkWording(good, "msg", null)).toEqual([]);
    expect(checkWording(good, "msg", "x".repeat(1901))).toHaveLength(1);
  });
  it("fills the name and the link, and never cuts a long text", () => {
    expect(renderConnectedMessage("Hi {first_name}, chat: {link}", { name: "Ana Silva" }, "https://x.test/j")).toBe("Hi Ana, chat: https://x.test/j");
    expect(renderConnectedMessage("Hi {first_name}", { name: "Ana" }, null)).toBe("Hi Ana");
    expect(renderConnectedMessage("x".repeat(1950), { name: "Ana" }, null)).toBeNull();
  });
});

describe("wording for a network campaign", () => {
  it("needs only the message people get", () => {
    expect(checkNetworkWording("Hi {first_name}")).toEqual([]);
    expect(checkNetworkWording("  ")).toHaveLength(1);
    expect(checkNetworkWording(null)).toHaveLength(1);
    expect(checkNetworkWording("x".repeat(1901))).toHaveLength(1);
  });
  it("is approved by the same fingerprint with no invites", () => {
    const h = wordingHash([], "", "Hi {first_name}");
    expect(isApproved({ approved_at: "2026-11-09T10:00:00Z", wording_hash: h, invite_variants: [], message_text: null, connected_message_text: "Hi {first_name}" })).toBe(true);
    expect(isApproved({ approved_at: "2026-11-09T10:00:00Z", wording_hash: h, invite_variants: [], message_text: null, connected_message_text: "Hi" })).toBe(false);
  });
});
