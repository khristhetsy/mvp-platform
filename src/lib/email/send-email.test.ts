import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseFromHeader, resolveFrom, TRANSACTIONAL_FROM_ENV, VERIFIED_FROM_ADDRESS } from "./send-email";

const KEYS = ["EMAIL_FROM", "TRANSACTIONAL_EMAIL_FROM"] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of KEYS) { saved[k] = process.env[k]; delete process.env[k]; }
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  for (const k of KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  vi.restoreAllMocks();
});

describe("parseFromHeader", () => {
  it("reads a named address", () => {
    expect(parseFromHeader("iCapOS <team@icapos.com>")).toEqual({ name: "iCapOS", address: "team@icapos.com" });
  });
  it("reads a bare address", () => {
    expect(parseFromHeader(" team@icapos.com ")).toEqual({ name: null, address: "team@icapos.com" });
  });
  it("rejects blank and address-less values", () => {
    expect(parseFromHeader("")).toBeNull();
    expect(parseFromHeader("   ")).toBeNull();
    expect(parseFromHeader("iCapOS")).toBeNull();
    expect(parseFromHeader(undefined)).toBeNull();
  });
});

describe("resolveFrom", () => {
  it("falls back to the verified address when nothing is set", () => {
    expect(resolveFrom({ envKeys: TRANSACTIONAL_FROM_ENV })).toBe(`iCapOS <${VERIFIED_FROM_ADDRESS}>`);
  });
  it("never sends from mail.icapos.com", () => {
    process.env.TRANSACTIONAL_EMAIL_FROM = "iCapOS <no-reply@mail.icapos.com>";
    expect(resolveFrom({ envKeys: TRANSACTIONAL_FROM_ENV })).toBe(`iCapOS <${VERIFIED_FROM_ADDRESS}>`);
    expect(console.warn).toHaveBeenCalled();
  });
  it("never sends from resend.dev", () => {
    process.env.EMAIL_FROM = "onboarding@resend.dev";
    expect(resolveFrom()).toBe(`iCapOS <${VERIFIED_FROM_ADDRESS}>`);
  });
  it("skips a blank TRANSACTIONAL_EMAIL_FROM and uses EMAIL_FROM", () => {
    process.env.TRANSACTIONAL_EMAIL_FROM = "";
    process.env.EMAIL_FROM = "iCapOS Team <team@icapos.com>";
    expect(resolveFrom({ envKeys: TRANSACTIONAL_FROM_ENV })).toBe("iCapOS Team <team@icapos.com>");
  });
  it("prefers TRANSACTIONAL_EMAIL_FROM when it is valid", () => {
    process.env.TRANSACTIONAL_EMAIL_FROM = "Alerts <alerts@icapos.com>";
    process.env.EMAIL_FROM = "iCapOS <team@icapos.com>";
    expect(resolveFrom({ envKeys: TRANSACTIONAL_FROM_ENV })).toBe("Alerts <alerts@icapos.com>");
  });
  it("applies a display name over the configured address", () => {
    process.env.EMAIL_FROM = "iCapOS <team@icapos.com>";
    expect(resolveFrom({ displayName: "iCFO Venture Group" })).toBe("iCFO Venture Group <team@icapos.com>");
  });
  it("keeps the configured name when the display name is blank", () => {
    process.env.EMAIL_FROM = "iCapOS Team <team@icapos.com>";
    expect(resolveFrom({ displayName: "  " })).toBe("iCapOS Team <team@icapos.com>");
  });
  it("strips header-breaking characters from the display name", () => {
    expect(resolveFrom({ displayName: 'Evil" <x@y.com>' })).toBe(`Evil x@y.com <${VERIFIED_FROM_ADDRESS}>`);
  });
});
