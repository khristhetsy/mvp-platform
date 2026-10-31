import { describe, expect, it } from "vitest";
import { buildParts, cleanQuote, renderBody, subjectFor, writtenText } from "./draft";
import { draftViolations } from "./guards";
import { OBJECTIONS } from "./types";

const base = { firstName: "Dana", asked: "How long does this take?", concern: "I would rather not pay before I know it works.", chatUrl: "https://icapos.com/acme/invest?src=opp-abc123", includeRefundOffer: true };

describe("buildParts", () => {
  it("quotes the prospect verbatim and ends with a question and the chat link", () => {
    const body = renderBody(buildParts({ ...base, objection: "money" }));
    expect(body).toContain('You asked: "How long does this take?"');
    expect(body).toContain('You also wrote: "I would rather not pay before I know it works."');
    expect(body).toContain("What would it take to move forward?");
    expect(body.trim().endsWith("Click here to respond: https://icapos.com/acme/invest?src=opp-abc123")).toBe(true);
  });

  it("leaves out the refund offer when the switch is off", () => {
    const on = renderBody(buildParts({ ...base, objection: "money" }));
    const off = renderBody(buildParts({ ...base, objection: "money", includeRefundOffer: false }));
    expect(on).toContain("we will refund your money");
    expect(off).not.toContain("refund");
  });

  it("drops the link and its prompt when there is no chat to send them to", () => {
    const body = renderBody(buildParts({ ...base, objection: "money", chatUrl: null }));
    expect(body).not.toContain("Click");
    expect(body).not.toContain("http");
  });

  it("works with no quotes at all", () => {
    const body = renderBody(buildParts({ ...base, asked: null, concern: null, objection: "unknown" }));
    expect(body).toContain("Thank you for your interest.");
    expect(body).toContain("biggest struggle");
  });

  it("greets by name, or plainly when the name is unknown", () => {
    expect(buildParts({ ...base, objection: "money" }).greeting).toBe("Hi Dana,");
    expect(buildParts({ ...base, firstName: null, objection: "money" }).greeting).toBe("Hello,");
  });

  it("keeps every written line clear of the banned words for every objection and switch", () => {
    for (const objection of OBJECTIONS) {
      for (const includeRefundOffer of [true, false]) {
        for (const chatUrl of [base.chatUrl, null]) {
          const parts = buildParts({ ...base, objection, includeRefundOffer, chatUrl });
          expect(draftViolations(writtenText(parts)), `${objection} ${includeRefundOffer} ${chatUrl}`).toEqual([]);
        }
      }
    }
  });
});

describe("guards", () => {
  it("catches each banned pattern", () => {
    for (const bad of ["It is guaranteed", "risk-free", "a free report", "no credit card", "7,000 investors", "16+ years", "A long sentence — with a dash", "we will get you funded", ["Capital", "OS"].join("")]) {
      expect(draftViolations(bad), bad).not.toEqual([]);
    }
  });
  it("lets ordinary copy through", () => {
    expect(draftViolations("Plans are monthly and cancel any time.")).toEqual([]);
  });
});

describe("cleanQuote", () => {
  it("collapses whitespace and swaps double quotes so the quote cannot break out", () => {
    expect(cleanQuote('  He said  "go"\nnow ')).toBe("He said 'go' now");
  });
  it("caps the length", () => {
    expect(cleanQuote("x".repeat(500)).length).toBe(220);
  });
});

describe("subjectFor", () => {
  it("replies to the last subject once", () => {
    expect(subjectFor("Acme", "Timeline")).toBe("Re: Timeline");
    expect(subjectFor("Acme", "Re: Timeline")).toBe("Re: Timeline");
  });
  it("falls back to the opportunity title", () => {
    expect(subjectFor("Acme Robotics", null)).toBe("Following up: Acme Robotics");
    expect(subjectFor("", null)).toBe("Following up");
  });
});

import { withRefund } from "./draft";

describe("withRefund", () => {
  it("switches the offer on and off without touching the rest", () => {
    const parts = buildParts({ ...base, objection: "money", includeRefundOffer: false });
    expect(renderBody(withRefund(parts, true))).toContain("we will refund your money");
    expect(renderBody(withRefund(withRefund(parts, true), false))).toBe(renderBody(parts));
  });
});
