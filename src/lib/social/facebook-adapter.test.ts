import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { facebookAdapter } from "./facebook-adapter";

const account = { id: "acc", platform: "facebook", externalMemberId: "555", accessToken: "tok", refreshToken: null, tokenExpiresAt: null };
const variant = { id: "v1", body: "Hello", commentText: null, linkUrl: null, imageUrl: null as string | null, idempotencyKey: "k" };

describe("facebookAdapter.publish", () => {
  const calls: Array<{ url: string; body: Record<string, string> }> = [];
  beforeEach(() => {
    process.env.META_APP_ID = "app"; process.env.META_APP_SECRET = "secret";
    calls.length = 0;
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, body: JSON.parse(String(init?.body ?? "{}")) });
      if (url.endsWith("/photos")) return new Response(JSON.stringify({ id: "PHOTO1", post_id: "555_777" }), { status: 200 });
      return new Response(JSON.stringify({ id: "555_123" }), { status: 200 });
    }));
  });
  afterEach(() => { vi.unstubAllGlobals(); delete process.env.META_APP_ID; delete process.env.META_APP_SECRET; });

  it("posts text to the feed", async () => {
    const r = await facebookAdapter.publish(variant, account);
    expect(calls[0].url).toMatch(/\/555\/feed$/);
    expect(calls[0].body).toMatchObject({ message: "Hello" });
    expect(r).toEqual({ externalId: "555_123", url: "https://www.facebook.com/555_123" });
  });

  it("posts an image to photos with the text as caption and returns the post id", async () => {
    const r = await facebookAdapter.publish({ ...variant, imageUrl: "https://cdn.example.com/a.jpg" }, account);
    expect(calls[0].url).toMatch(/\/555\/photos$/);
    expect(calls[0].body).toMatchObject({ url: "https://cdn.example.com/a.jpg", caption: "Hello" });
    expect(r.externalId).toBe("555_777");
  });

  it("allows an image with no text", async () => {
    await facebookAdapter.publish({ ...variant, body: "", imageUrl: "https://cdn.example.com/a.jpg" }, account);
    expect(calls[0].body).toMatchObject({ caption: "" });
  });
});
