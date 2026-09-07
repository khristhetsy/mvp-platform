import { afterEach, describe, expect, it } from "vitest";
import { openToken, sealToken, isTokenSealingActive } from "@/lib/social/token-cipher";

const SECRET = "test-secret-at-least-32-chars-long-000";

afterEach(() => {
  delete process.env.TOKEN_ENCRYPTION_SECRET;
});

describe("social token cipher", () => {
  it("round-trips a token when a secret is set", () => {
    process.env.TOKEN_ENCRYPTION_SECRET = SECRET;
    const sealed = sealToken("access-token-abc");
    expect(sealed).not.toBeNull();
    expect(sealed).toMatch(/^s1:/);
    expect(sealed).not.toContain("access-token-abc");
    expect(openToken(sealed)).toBe("access-token-abc");
    expect(isTokenSealingActive()).toBe(true);
  });

  it("stores plaintext when no secret is configured", () => {
    expect(sealToken("plain")).toBe("plain");
    expect(openToken("plain")).toBe("plain");
    expect(isTokenSealingActive()).toBe(false);
  });

  it("reads legacy unsealed tokens even after a secret is set", () => {
    process.env.TOKEN_ENCRYPTION_SECRET = SECRET;
    // A row written before sealing was enabled has no prefix — pass it through.
    expect(openToken("legacy-plaintext")).toBe("legacy-plaintext");
  });

  it("passes null/undefined through", () => {
    expect(sealToken(null)).toBeNull();
    expect(sealToken(undefined)).toBeNull();
    expect(openToken(null)).toBeNull();
  });

  it("fails to open a sealed token when the secret is missing", () => {
    process.env.TOKEN_ENCRYPTION_SECRET = SECRET;
    const sealed = sealToken("secret-value");
    delete process.env.TOKEN_ENCRYPTION_SECRET;
    expect(() => openToken(sealed)).toThrow(/TOKEN_ENCRYPTION_SECRET/);
  });
});
