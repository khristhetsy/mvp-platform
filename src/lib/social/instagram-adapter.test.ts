import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { instagramAdapter, instagramCaption } from "./instagram-adapter";
import { AdapterNotConfiguredError } from "./types";

const account = { id: "acc", platform: "instagram", externalMemberId: "1789", accessToken: "tok", refreshToken: null, tokenExpiresAt: null };
const variant = { id: "v1", body: "Hello", commentText: null, linkUrl: null, imageUrl: "https://cdn.example.com/a.jpg", idempotencyKey: "k" };

describe("instagramAdapter", () => {
  const calls: Array<{ url: string; body: string | null }> = [];
  beforeEach(() => {
    process.env.META_APP_ID = "app"; process.env.META_APP_SECRET = "secret";
    calls.length = 0;
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      const body = init?.body ? String(init.body) : null;
      calls.push({ url, body });
      if (url.includes("/media_publish")) return new Response(JSON.stringify({ id: "MEDIA1" }), { status: 200 });
      if (url.includes("/1789/media")) return new Response(JSON.stringify({ id: "CONTAINER1" }), { status: 200 });
      if (url.includes("/CONTAINER1?")) return new Response(JSON.stringify({ status_code: "FINISHED" }), { status: 200 });
      if (url.includes("/MEDIA1?")) return new Response(JSON.stringify({ permalink: "https://www.instagram.com/p/abc/" }), { status: 200 });
      if (url.includes("/comments")) return new Response(JSON.stringify({ id: "C1" }), { status: 200 });
      return new Response(JSON.stringify({ error: { message: "unexpected" } }), { status: 400 });
    }));
  });
  afterEach(() => { vi.unstubAllGlobals(); delete process.env.META_APP_ID; delete process.env.META_APP_SECRET; });

  it("creates a container from the image, waits for FINISHED, publishes, and returns the permalink", async () => {
    const r = await instagramAdapter.publish(variant, account);
    expect(r).toEqual({ externalId: "MEDIA1", url: "https://www.instagram.com/p/abc/" });
    expect(calls[0].url).toContain("/1789/media");
    expect(calls[0].body).toContain("image_url=https%3A%2F%2Fcdn.example.com%2Fa.jpg");
    expect(calls[0].body).toContain("caption=Hello");
    expect(calls.some((c) => c.url.includes("/media_publish") && c.body?.includes("creation_id=CONTAINER1"))).toBe(true);
  });

  it("refuses a variant without an image instead of calling the API", async () => {
    await expect(instagramAdapter.publish({ ...variant, imageUrl: null }, account)).rejects.toThrow(/needs an image/);
    expect(calls).toHaveLength(0);
  });

  it("posts the first comment against the media id", async () => {
    await instagramAdapter.comment("MEDIA1", "link here", account);
    expect(calls[0].url).toContain("/MEDIA1/comments");
    expect(calls[0].body).toContain("message=link+here");
  });

  it("is a skip (not a failure) when Meta credentials are missing", async () => {
    delete process.env.META_APP_ID;
    await expect(instagramAdapter.publish(variant, account)).rejects.toBeInstanceOf(AdapterNotConfiguredError);
  });

  it("caps captions at Instagram's 2,200 characters", () => {
    expect(instagramCaption("x".repeat(2200))).toHaveLength(2200);
    const capped = instagramCaption("x".repeat(3000));
    expect(capped.length).toBeLessThanOrEqual(2200);
    expect(capped.endsWith("…")).toBe(true);
  });
});
