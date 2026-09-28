import { describe, it, expect, afterEach, vi } from "vitest";
import { personalFromHeader, verifiedSenderDomains, resetSenderDomainCache } from "./sender-domains";

afterEach(() => { resetSenderDomainCache(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("personalFromHeader", () => {
  const domains = new Set(["myicfos.com", "icapos.com"]);
  it("sends as the person when their domain is verified", () => {
    expect(personalFromHeader("Khris Thetsy", "KThetsy@myicfos.com", domains)).toBe("Khris Thetsy <kthetsy@myicfos.com>");
  });
  it("accepts a subdomain of a verified domain", () => {
    expect(personalFromHeader("A", "a@team.icapos.com", domains)).toBe("A <a@team.icapos.com>");
  });
  it("refuses an unverified domain", () => {
    expect(personalFromHeader("Khris", "kthetsy@gmail.com", domains)).toBeNull();
    expect(personalFromHeader("Khris", "x@evilmyicfos.com", domains)).toBeNull();
  });
  it("strips header-breaking characters from the name", () => {
    expect(personalFromHeader('Khris "K" <T>', "k@icapos.com", domains)).toBe("Khris K T <k@icapos.com>");
  });
  it("refuses a missing or malformed address", () => {
    expect(personalFromHeader("K", null, domains)).toBeNull();
    expect(personalFromHeader("K", "not-an-email", domains)).toBeNull();
  });
});

describe("verifiedSenderDomains", () => {
  it("merges the env list with verified domains from Resend", async () => {
    vi.stubEnv("RESEND_SENDER_DOMAINS", "icapos.com");
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ data: [
      { name: "myicfos.com", status: "verified" }, { name: "other.com", status: "pending" },
    ] }), { status: 200 })));
    expect([...(await verifiedSenderDomains())].sort()).toEqual(["icapos.com", "myicfos.com"]);
  });
  it("uses the env list alone when Resend refuses the key", async () => {
    vi.stubEnv("RESEND_SENDER_DOMAINS", "icapos.com");
    vi.stubEnv("RESEND_API_KEY", "re_sending_only");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 401 })));
    expect([...(await verifiedSenderDomains())]).toEqual(["icapos.com"]);
  });
});
