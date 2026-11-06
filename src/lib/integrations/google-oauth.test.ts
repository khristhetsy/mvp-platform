import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/integrations/google-env", () => ({
  assertGoogleOAuthEnv: () => ({ clientId: "id", clientSecret: "secret", redirectUri: "http://x/cb" }),
  getGoogleOAuthEnv: () => ({ clientId: "id", clientSecret: "secret", redirectUri: "http://x/cb" }),
  isGoogleOAuthConfigured: () => true,
}));
vi.mock("@/lib/integrations/token-encryption", () => ({ encryptSecret: (s: string) => s }));

import { GoogleReconnectRequiredError, refreshGoogleAccessToken } from "@/lib/integrations/google-oauth";

afterEach(() => vi.unstubAllGlobals());

function stubFetch(status: number, body: unknown) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status })));
}

describe("refreshGoogleAccessToken", () => {
  it("throws GoogleReconnectRequiredError on invalid_grant", async () => {
    stubFetch(400, { error: "invalid_grant" });
    const err = await refreshGoogleAccessToken("rt").catch((e) => e);
    expect(err).toBeInstanceOf(GoogleReconnectRequiredError);
    expect(err.message).toBe("Your Google connection expired. Reconnect Google to send email.");
  });

  it("keeps other failures as plain errors", async () => {
    stubFetch(500, { error: "backend_error" });
    const err = await refreshGoogleAccessToken("rt").catch((e) => e);
    expect(err).not.toBeInstanceOf(GoogleReconnectRequiredError);
    expect(err.message).toBe("backend_error");
  });

  it("returns the token on success", async () => {
    stubFetch(200, { access_token: "a", expires_in: 3600, scope: "s", token_type: "Bearer" });
    await expect(refreshGoogleAccessToken("rt")).resolves.toMatchObject({ access_token: "a" });
  });
});
