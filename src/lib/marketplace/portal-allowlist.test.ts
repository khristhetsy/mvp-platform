import { describe, it, expect } from "vitest";
import { isAllowlistedPortalUrl, isSafePortalHref, PORTAL_ALLOWLIST } from "./portal-allowlist";

describe("isAllowlistedPortalUrl", () => {
  it("accepts an https URL on an allowlisted FINRA portal", () => {
    expect(isAllowlistedPortalUrl("https://wefunder.com/acme")).toMatchObject({ https: true, allowlisted: true });
  });

  it("normalises www and matches subdomains", () => {
    expect(isAllowlistedPortalUrl("https://www.startengine.com/x").allowlisted).toBe(true);
    expect(isAllowlistedPortalUrl("https://invest.republic.com/x").allowlisted).toBe(true);
  });

  it("reports a non-allowlisted host as not allowlisted (routes to review, not hard fail)", () => {
    const r = isAllowlistedPortalUrl("https://totally-not-a-portal.com/x");
    expect(r.https).toBe(true);
    expect(r.allowlisted).toBe(false);
  });

  it("flags a non-https portal URL", () => {
    expect(isAllowlistedPortalUrl("http://wefunder.com/acme").https).toBe(false);
  });

  it("does not let a lookalike domain pass the suffix check", () => {
    // "wefunder.com.evil.com" must not match "wefunder.com".
    expect(isAllowlistedPortalUrl("https://wefunder.com.evil.com/x").allowlisted).toBe(false);
  });

  it("returns a safe shape for a malformed URL rather than throwing", () => {
    expect(isAllowlistedPortalUrl("not a url")).toEqual({ https: false, allowlisted: false, host: null });
  });
});

describe("isSafePortalHref — render-time guard", () => {
  it("allows https", () => {
    expect(isSafePortalHref("https://wefunder.com/acme")).toBe(true);
  });
  it("rejects http, javascript, empty, and null", () => {
    expect(isSafePortalHref("http://wefunder.com")).toBe(false);
    expect(isSafePortalHref("javascript:alert(1)")).toBe(false);
    expect(isSafePortalHref("")).toBe(false);
    expect(isSafePortalHref(null)).toBe(false);
    expect(isSafePortalHref(undefined)).toBe(false);
  });
});

describe("allowlist integrity", () => {
  it("is non-empty and every entry is a bare hostname (no scheme or path)", () => {
    expect(PORTAL_ALLOWLIST.length).toBeGreaterThan(0);
    for (const host of PORTAL_ALLOWLIST) {
      expect(host).not.toMatch(/https?:|\/|\s/);
    }
  });
});
