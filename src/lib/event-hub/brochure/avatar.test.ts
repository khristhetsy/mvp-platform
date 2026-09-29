import { describe, it, expect } from "vitest";
import { avatarSource } from "./avatar";

describe("avatarSource", () => {
  it("prefers the headshot", () => {
    expect(avatarSource({ headshotUrl: "h.jpg", companyLogoUrl: "l.png" })).toEqual({ kind: "headshot", url: "h.jpg" });
  });
  it("falls back to the company logo", () => {
    expect(avatarSource({ headshotUrl: null, companyLogoUrl: "l.png" })).toEqual({ kind: "logo", url: "l.png" });
  });
  it("falls back to initials when neither exists", () => {
    expect(avatarSource({ headshotUrl: null, companyLogoUrl: null })).toEqual({ kind: "initials" });
    expect(avatarSource({ headshotUrl: null })).toEqual({ kind: "initials" });
  });
});
