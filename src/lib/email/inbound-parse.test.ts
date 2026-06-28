import { describe, it, expect } from "vitest";
import { pickField, extractReplyToken, parseFromHeader } from "./inbound-parse";

describe("extractReplyToken", () => {
  it("pulls the token from a plus-address", () => {
    expect(extractReplyToken("reply+abc123@mail.icapos.com")).toBe("abc123");
  });
  it("is case-insensitive on the prefix and finds it inside a header", () => {
    expect(extractReplyToken('"Inbox" <Reply+Tok9@mail.icapos.com>')).toBe("Tok9");
  });
  it("returns null when there's no token", () => {
    expect(extractReplyToken("hello@example.com")).toBeNull();
    expect(extractReplyToken("")).toBeNull();
  });
});

describe("parseFromHeader", () => {
  it("splits 'Name <email>' and lowercases the email", () => {
    expect(parseFromHeader("Jordan Nguyen <J.Nguyen@Acme.com>")).toEqual({
      email: "j.nguyen@acme.com",
      name: "Jordan Nguyen",
    });
  });
  it("strips surrounding quotes from the display name", () => {
    expect(parseFromHeader('"Acme, Inc." <hi@acme.com>')).toEqual({
      email: "hi@acme.com",
      name: "Acme, Inc.",
    });
  });
  it("handles a bare email with no name", () => {
    expect(parseFromHeader("hi@acme.com")).toEqual({ email: "hi@acme.com", name: null });
  });
});

describe("pickField", () => {
  it("returns the first non-empty string among keys", () => {
    expect(pickField({ a: "", b: "x" }, "a", "b")).toBe("x");
  });
  it("reads the first element of an array field", () => {
    expect(pickField({ to: ["reply+t@d.com", "other@d.com"] }, "to")).toBe("reply+t@d.com");
  });
  it("returns empty string when nothing matches", () => {
    expect(pickField({ a: 1, b: null }, "a", "b", "c")).toBe("");
  });
});
