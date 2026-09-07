import { describe, it, expect } from "vitest";
import { normalizeEmail } from "./handoff";

describe("normalizeEmail", () => {
  it("lowercases and trims", () => {
    expect(normalizeEmail("  Founder@Acme.CO  ")).toBe("founder@acme.co");
  });
  it("strips +tag on any domain", () => {
    expect(normalizeEmail("jane+startup@acme.co")).toBe("jane@acme.co");
  });
  it("strips dots in the Gmail local part only", () => {
    expect(normalizeEmail("j.a.n.e@gmail.com")).toBe("jane@gmail.com");
    expect(normalizeEmail("j.a.n.e@acme.co")).toBe("j.a.n.e@acme.co"); // non-Gmail keeps dots
  });
  it("handles +tag and dots together on Gmail", () => {
    expect(normalizeEmail("Jane.Doe+deals@googlemail.com")).toBe("janedoe@googlemail.com");
  });
  it("returns input unchanged when there's no @", () => {
    expect(normalizeEmail("notanemail")).toBe("notanemail");
  });
});
