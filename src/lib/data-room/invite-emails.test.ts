import { describe, expect, it } from "vitest";
import { parseInviteEmails } from "./invite-emails";

describe("parseInviteEmails", () => {
  it("splits on commas, semicolons, spaces and new lines", () => {
    const { valid, invalid } = parseInviteEmails("a@x.com, b@y.com;c@z.com\nd@w.com e@v.com");
    expect(valid).toEqual(["a@x.com", "b@y.com", "c@z.com", "d@w.com", "e@v.com"]);
    expect(invalid).toEqual([]);
  });

  it("lowercases and drops repeats", () => {
    expect(parseInviteEmails("A@X.com a@x.com").valid).toEqual(["a@x.com"]);
  });

  it("keeps non emails apart", () => {
    const { valid, invalid } = parseInviteEmails("good@x.com, nope, also@bad");
    expect(valid).toEqual(["good@x.com"]);
    expect(invalid).toEqual(["nope", "also@bad"]);
  });

  it("returns nothing for blank input", () => {
    expect(parseInviteEmails("  \n ")).toEqual({ valid: [], invalid: [] });
  });
});
