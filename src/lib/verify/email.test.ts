import { beforeEach, describe, expect, it, vi } from "vitest";

const mx = new Map<string, boolean>();
vi.mock("node:dns/promises", () => ({
  resolveMx: vi.fn(async (d: string) => {
    if (mx.get(d)) return [{ exchange: `mx.${d}`, priority: 10 }];
    throw Object.assign(new Error("ENOTFOUND"), { code: "ENOTFOUND" });
  }),
}));

import { verifyEmail, isRoleAddress, _clearMxCache, DOMAIN_ONLY_CONFIDENCE } from "./email";

beforeEach(() => {
  mx.clear();
  _clearMxCache();
  mx.set("stripe.com", true);
});

describe("verifyEmail (D1)", () => {
  it("an invented address at a real domain is only domain-level, confidence 50", async () => {
    const v = await verifyEmail("zz-no-such-person-48213@stripe.com");
    expect(v).toEqual({ status: "valid", role: false, mx: true, level: "domain", confidence: DOMAIN_ONLY_CONFIDENCE });
    expect(DOMAIN_ONLY_CONFIDENCE).toBe(50);
  });

  it("a company inbox is risky", async () => {
    expect((await verifyEmail("info@stripe.com")).status).toBe("risky");
    expect((await verifyEmail("ir@stripe.com")).status).toBe("risky");
    expect((await verifyEmail("bonjour@stripe.com")).status).toBe("risky");
  });

  it("a domain with no MX is invalid", async () => {
    const v = await verifyEmail("a@no-such-domain-xyz-48213.com");
    expect(v.status).toBe("invalid");
    expect(v.level).toBe("syntax");
  });

  it("bad syntax is invalid without a DNS lookup", async () => {
    expect((await verifyEmail("not-an-email")).status).toBe("invalid");
  });
});

describe("isRoleAddress", () => {
  it("covers the shared company inbox list", () => {
    expect(isRoleAddress("contact@x.fr")).toBe(true);
    expect(isRoleAddress("investors@x.com")).toBe(true);
    expect(isRoleAddress("jane.doe@x.com")).toBe(false);
  });
});
