import { describe, it, expect } from "vitest";
import {
  prefixSubject,
  replySubject,
  forwardSubject,
  dedupeEmails,
  replyAllRecipients,
  buildPrefill,
} from "./compose-prefill";

describe("subject prefixing (no stacking)", () => {
  it("adds Re: to a bare subject", () => {
    expect(replySubject("Quarterly update")).toBe("Re: Quarterly update");
  });
  it("does not stack Re:", () => {
    expect(replySubject("Re: Quarterly update")).toBe("Re: Quarterly update");
  });
  it("is case-insensitive about existing prefix", () => {
    expect(replySubject("re: hi")).toBe("re: hi");
    expect(replySubject("RE:  hi")).toBe("RE:  hi");
  });
  it("adds Fwd: and does not stack", () => {
    expect(forwardSubject("Deck")).toBe("Fwd: Deck");
    expect(forwardSubject("Fwd: Deck")).toBe("Fwd: Deck");
  });
  it("handles null/empty subjects", () => {
    expect(prefixSubject("Re", null)).toBe("Re:");
    expect(prefixSubject("Fwd", "")).toBe("Fwd:");
  });
  it("does not treat Fwd as Re (independent prefixes)", () => {
    expect(replySubject("Fwd: Deck")).toBe("Re: Fwd: Deck");
  });
});

describe("dedupeEmails", () => {
  it("removes case-insensitive duplicates, keeps first casing + order", () => {
    expect(dedupeEmails(["A@x.com", "b@x.com", "a@X.com", "", null, "  c@x.com "])).toEqual([
      "A@x.com",
      "b@x.com",
      "c@x.com",
    ]);
  });
});

describe("replyAllRecipients", () => {
  it("puts sender in to and others in cc, excluding self", () => {
    const r = replyAllRecipients({
      sender: "founder@startup.com",
      recipients: ["me@capitalos.io", "partner@vc.com", "founder@startup.com"],
      self: "me@capitalos.io",
    });
    expect(r.to).toEqual(["founder@startup.com"]);
    expect(r.cc).toEqual(["partner@vc.com"]); // self removed, sender not duplicated in cc
  });
  it("drops sender from to when sender is self", () => {
    const r = replyAllRecipients({ sender: "me@x.com", recipients: ["a@x.com"], self: "me@x.com" });
    expect(r.to).toEqual([]);
    expect(r.cc).toEqual(["a@x.com"]);
  });
});

describe("buildPrefill (spec §5.3 table)", () => {
  it("Compose: empty to + empty subject", () => {
    expect(buildPrefill({ mode: "new" })).toMatchObject({ to: [], subject: "", mode: "new" });
  });
  it("Email (contact card): to=[sender], empty subject", () => {
    expect(buildPrefill({ mode: "new", sender: "noreply@tips.preply.com" })).toMatchObject({
      to: ["noreply@tips.preply.com"],
      subject: "",
    });
  });
  it("Reply: to=[sender], Re: subject", () => {
    expect(buildPrefill({ mode: "reply", sender: "x@y.com", subject: "Hello" })).toMatchObject({
      to: ["x@y.com"],
      subject: "Re: Hello",
    });
  });
  it("Reply all: sender in to, others in cc, Re: subject", () => {
    const p = buildPrefill({
      mode: "replyAll",
      sender: "x@y.com",
      recipients: ["me@c.io", "z@y.com"],
      self: "me@c.io",
      subject: "Re: Hello",
    });
    expect(p.to).toEqual(["x@y.com"]);
    expect(p.cc).toEqual(["z@y.com"]);
    expect(p.subject).toBe("Re: Hello"); // no stacking
  });
  it("Forward: empty to, Fwd: subject, quoted body", () => {
    const p = buildPrefill({ mode: "forward", sender: "x@y.com", subject: "Deck", body: "hi" });
    expect(p.to).toEqual([]);
    expect(p.subject).toBe("Fwd: Deck");
    expect(p.body).toContain("Forwarded message");
    expect(p.body).toContain("hi");
  });
});
