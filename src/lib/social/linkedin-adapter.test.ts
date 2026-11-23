import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { linkedInCommentary, linkedInCommentsEnabled, linkedInAdapter, escapeLinkedInLittleText } from "./linkedin-adapter";

const ORIG = process.env.LINKEDIN_COMMENTS_ENABLED;
afterEach(() => { process.env.LINKEDIN_COMMENTS_ENABLED = ORIG; });

const link = "https://icapos.com/r/abc";

describe("linkedInCommentary", () => {
  it("comments off: appends comment text, then the link", () => {
    expect(linkedInCommentary({ body: "Body", commentText: "Try it now", linkUrl: link }, false))
      .toBe(`Body\n\nTry it now\n\n${link}`);
  });
  it("comments off: does not repeat a link the comment already contains", () => {
    expect(linkedInCommentary({ body: "Body", commentText: `Match here: ${link}`, linkUrl: link }, false))
      .toBe(`Body\n\nMatch here: ${link}`);
  });
  it("comments on: body plus link only, comment goes out separately", () => {
    expect(linkedInCommentary({ body: "Body", commentText: "Try it now", linkUrl: link }, true))
      .toBe(`Body\n\n${link}`);
  });
  it("no comment and no link: body only", () => {
    expect(linkedInCommentary({ body: "Body", commentText: null, linkUrl: null }, false)).toBe("Body");
  });
});

describe("escapeLinkedInLittleText", () => {
  it("puts a backslash before each of the 15 reserved characters", () => {
    expect(escapeLinkedInLittleText("|{}@[]()<>#\\*_~")).toBe("\\|\\{\\}\\@\\[\\]\\(\\)\\<\\>\\#\\\\\\*\\_\\~");
  });
  it("keeps the whole company line, parentheses included", () => {
    expect(escapeLinkedInLittleText("Meet First Person Solutions LLC (CelWel).")).toBe("Meet First Person Solutions LLC \\(CelWel\\).");
  });
  it("leaves ordinary text, ampersands and newlines alone", () => {
    const plain = "We are meeting Health & Wellness investors. Curious? Message me.\n\nLyme disease, long Covid.";
    expect(escapeLinkedInLittleText(plain)).toBe(plain);
  });
});

describe("linkedInCommentsEnabled", () => {
  it("is off unless the flag is exactly true", () => {
    delete process.env.LINKEDIN_COMMENTS_ENABLED;
    expect(linkedInCommentsEnabled()).toBe(false);
    expect(linkedInAdapter.supportsComments?.()).toBe(false);
    process.env.LINKEDIN_COMMENTS_ENABLED = "true";
    expect(linkedInCommentsEnabled()).toBe(true);
  });
});

describe("linkedInAdapter.publish with an image", () => {
  const account = { id: "acc", platform: "linkedin", externalMemberId: "urn:li:person:1", accessToken: "tok", refreshToken: null, tokenExpiresAt: null };
  const variant = { id: "v1", body: "Hello", commentText: null, linkUrl: null, imageUrl: "https://cdn.example.com/a.png", idempotencyKey: "k" };
  const calls: Array<{ url: string; method: string; body: unknown }> = [];

  beforeEach(() => {
    process.env.LINKEDIN_CLIENT_ID = "id"; process.env.LINKEDIN_CLIENT_SECRET = "secret";
    calls.length = 0;
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, method: init?.method ?? "GET", body: init?.body ?? null });
      if (url.includes("/images?action=initializeUpload")) return new Response(JSON.stringify({ value: { uploadUrl: "https://upload.linkedin.test/u1", image: "urn:li:image:IMG1" } }), { status: 200 });
      if (url === "https://cdn.example.com/a.png") return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
      if (url === "https://upload.linkedin.test/u1") return new Response(null, { status: 201 });
      if (url.endsWith("/posts")) return new Response(null, { status: 201, headers: { "x-restli-id": "urn:li:share:9" } });
      return new Response("unexpected", { status: 400 });
    }));
  });
  afterEach(() => { vi.unstubAllGlobals(); delete process.env.LINKEDIN_CLIENT_ID; delete process.env.LINKEDIN_CLIENT_SECRET; });

  it("uploads the image, then creates the post with the image URN", async () => {
    const r = await linkedInAdapter.publish(variant, account);
    expect(r.externalId).toBe("urn:li:share:9");
    expect(calls.map((c) => c.method + " " + c.url)).toEqual([
      "POST https://api.linkedin.com/rest/images?action=initializeUpload",
      "GET https://cdn.example.com/a.png",
      "PUT https://upload.linkedin.test/u1",
      "POST https://api.linkedin.com/rest/posts",
    ]);
    const post = JSON.parse(String(calls[3].body));
    expect(post.content).toEqual({ media: { id: "urn:li:image:IMG1" } });
    expect(post.commentary).toBe("Hello");
  });

  it("escapes reserved characters in the commentary sent to LinkedIn", async () => {
    await linkedInAdapter.publish({ ...variant, imageUrl: null, body: "Meet Acme (CelWel).\n\nUse utm_source." }, account);
    expect(JSON.parse(String(calls[0].body)).commentary).toBe("Meet Acme \\(CelWel\\).\n\nUse utm\\_source.");
  });

  it("posts text only when there is no image", async () => {
    await linkedInAdapter.publish({ ...variant, imageUrl: null }, account);
    expect(calls).toHaveLength(1);
    expect(JSON.parse(String(calls[0].body)).content).toBeUndefined();
  });

  it("needs some text with an image and calls nothing", async () => {
    await expect(linkedInAdapter.publish({ ...variant, body: "" }, account)).rejects.toThrow(/needs some text/);
    expect(calls).toHaveLength(0);
  });
});
