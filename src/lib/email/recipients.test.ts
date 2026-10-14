import { describe, expect, it } from "vitest";
import { parseRecipients, recipientHeader } from "./recipients";

describe("parseRecipients", () => {
  it("splits addresses separated by a space", () => {
    expect(parseRecipients("po@pioneernuclear.com irishabne.va@gmail.com")).toEqual([
      "po@pioneernuclear.com",
      "irishabne.va@gmail.com",
    ]);
  });
  it("splits on commas, semicolons and line breaks", () => {
    expect(parseRecipients("a@x.com, b@x.com;c@x.com\nd@x.com")).toEqual(["a@x.com", "b@x.com", "c@x.com", "d@x.com"]);
  });
  it("keeps Name <addr> entries whole", () => {
    expect(parseRecipients("Peter Okrasa <po@x.com>, b@x.com")).toEqual(["Peter Okrasa <po@x.com>", "b@x.com"]);
  });
  it("removes duplicates ignoring case", () => {
    expect(parseRecipients(["A@x.com", "a@x.com b@x.com"])).toEqual(["A@x.com", "b@x.com"]);
  });
  it("handles empty input", () => {
    expect(parseRecipients(null)).toEqual([]);
    expect(parseRecipients("  ")).toEqual([]);
  });
});

describe("recipientHeader", () => {
  it("joins with a comma and space", () => {
    expect(recipientHeader("a@x.com b@x.com")).toBe("a@x.com, b@x.com");
  });
});
