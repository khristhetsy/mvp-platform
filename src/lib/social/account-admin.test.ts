import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ createServiceRoleClient: () => ({}) }));

import { encodeConnectMeta, decodeConnectMeta, hashInviteToken } from "./account-admin";
import { buildAuthorizeUrl } from "./linkedin-oauth";

describe("connect metadata cookie", () => {
  it("round-trips label / assignee / default / invite", () => {
    const meta = { label: "Jessica Santos", assignedTo: "11111111-1111-1111-1111-111111111111", isDefault: true, inviteId: "inv-1" };
    expect(decodeConnectMeta(encodeConnectMeta(meta))).toEqual(meta);
  });
  it("is empty for a missing or garbled cookie, and never trusts odd types", () => {
    expect(decodeConnectMeta(undefined)).toEqual({});
    expect(decodeConnectMeta("not-base64-json")).toEqual({});
    const odd = Buffer.from(JSON.stringify({ label: 42, isDefault: "yes", assignedTo: { x: 1 } })).toString("base64url");
    expect(decodeConnectMeta(odd)).toEqual({ label: null, assignedTo: null, isDefault: false, inviteId: null });
  });
  it("caps the label so a crafted URL can't stuff the cookie", () => {
    const long = "x".repeat(500);
    expect(decodeConnectMeta(encodeConnectMeta({ label: long })).label).toHaveLength(80);
  });
});

describe("invite tokens", () => {
  it("hashes deterministically and never stores the raw token", () => {
    expect(hashInviteToken("abc")).toBe(hashInviteToken("abc"));
    expect(hashInviteToken("abc")).not.toBe("abc");
    expect(hashInviteToken("abc")).not.toBe(hashInviteToken("abd"));
  });
});

describe("authorize url", () => {
  const env = { clientId: "id", clientSecret: "s", redirectUri: "https://x/cb", stateSecret: "k" };
  it("adds prompt=login only when a fresh sign-in is requested", () => {
    expect(buildAuthorizeUrl(env, "st")).not.toContain("prompt=");
    expect(buildAuthorizeUrl(env, "st", { freshLogin: true })).toContain("prompt=login");
  });
});
