import { describe, expect, it, vi } from "vitest";
import { CloudSenderError, addLeads, cloudSenderConfig, createCampaign, isUuid, senderCall, setStatus } from "./cloud-sender";

const cfg = { url: "https://sender.example.com", token: "tok-123456789012345" };
const reply = (status: number, body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

describe("cloudSenderConfig", () => {
  it("needs both settings", () => {
    expect(cloudSenderConfig({})).toBeNull();
    expect(cloudSenderConfig({ CLOUD_SENDER_URL: "https://a.example.com" })).toBeNull();
    expect(cloudSenderConfig({ CLOUD_SENDER_TOKEN: "x" })).toBeNull();
  });
  it("accepts https, and http only on this machine", () => {
    expect(cloudSenderConfig({ CLOUD_SENDER_URL: "https://a.example.com/path", CLOUD_SENDER_TOKEN: "t" })).toEqual({ url: "https://a.example.com", token: "t" });
    expect(cloudSenderConfig({ CLOUD_SENDER_URL: "http://localhost:3100", CLOUD_SENDER_TOKEN: "t" })?.url).toBe("http://localhost:3100");
    expect(cloudSenderConfig({ CLOUD_SENDER_URL: "http://a.example.com", CLOUD_SENDER_TOKEN: "t" })).toBeNull();
    expect(cloudSenderConfig({ CLOUD_SENDER_URL: "not a url", CLOUD_SENDER_TOKEN: "t" })).toBeNull();
  });
});

describe("senderCall", () => {
  it("sends the bearer token and json body", async () => {
    const f = reply(200, { ok: true });
    await senderCall(cfg, "POST", "/api/x", { a: 1 }, f);
    const [url, init] = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://sender.example.com/api/x");
    expect((init.headers as Record<string, string>).authorization).toBe(`Bearer ${cfg.token}`);
    expect(init.body).toBe('{"a":1}');
  });
  it("turns a refused token into a clear error that never shows the token", async () => {
    const err = await senderCall(cfg, "GET", "/api/x", undefined, reply(401, { error: "Wrong or missing admin token." })).catch((e) => e as CloudSenderError);
    expect(err.message).toContain("CLOUD_SENDER_TOKEN");
    expect(err.message).not.toContain(cfg.token);
  });
  it("reports an unreachable sender", async () => {
    const f = vi.fn(async () => { throw new Error("ECONNREFUSED"); }) as unknown as typeof fetch;
    await expect(senderCall(cfg, "GET", "/api/x", undefined, f)).rejects.toMatchObject({ status: 502 });
  });
  it("passes sender validation messages through", async () => {
    await expect(senderCall(cfg, "GET", "/api/x", undefined, reply(400, { error: "Give the campaign a name." }))).rejects.toMatchObject({ message: "Give the campaign a name.", status: 400 });
  });
});

describe("operations", () => {
  it("creates a dry run invite campaign from the signed in senders only", async () => {
    const calls: Array<[string, unknown]> = [];
    const f = vi.fn(async (url: string, init: RequestInit) => {
      calls.push([url, init.body ? JSON.parse(init.body as string) : null]);
      if (url.endsWith("/api/accounts")) return new Response(JSON.stringify([{ id: "a1", status: "connected" }, { id: "a2", status: "needs_login" }]), { status: 200 });
      return new Response(JSON.stringify({ id: "c1" }), { status: 201 });
    }) as unknown as typeof fetch;
    expect(await createCampaign(cfg, "Founders", " Hi there ", f)).toBe("c1");
    expect(calls[1]![1]).toEqual({ name: "Founders", steps: [{ type: "invite", waitDays: 0, note: "Hi there" }], accountIds: ["a1"] });
  });
  it("refuses to create a campaign with no signed in sender", async () => {
    const f = reply(200, [{ id: "a2", status: "needs_login" }]);
    await expect(createCampaign(cfg, "X", undefined, f)).rejects.toMatchObject({ status: 409 });
  });
  it("adds leads and sets status through the right paths", async () => {
    const f = reply(200, { added: 1, skipped: [] });
    await addLeads(cfg, "id1", [{ url: "https://www.linkedin.com/in/x/" }], f);
    await setStatus(cfg, "id1", "paused", f);
    const urls = (f as unknown as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0]);
    expect(urls).toEqual(["https://sender.example.com/api/campaigns/id1/leads", "https://sender.example.com/api/campaigns/id1/status"]);
  });
  it("checks ids", () => {
    expect(isUuid("3f2b8c1e-1d2a-4b3c-8d4e-5f6a7b8c9d0e")).toBe(true);
    expect(isUuid("../accounts")).toBe(false);
  });
});
