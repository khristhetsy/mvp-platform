import { afterEach, describe, expect, it, vi } from "vitest";

const hold = vi.fn();
const logged: Array<Record<string, unknown>> = [];
vi.mock("@/lib/notifications/founder-email-budget/gate", () => ({ holdForFounderDigest: (p: unknown) => hold(p) }));
vi.mock("@/lib/cron/job-deliveries", () => ({ recordDelivery: async () => {} }));
vi.mock("@/lib/email/email-log", () => ({ logOutboundEmail: async (row: Record<string, unknown>) => { logged.push(row); } }));

const { sendEmail } = await import("./send-email");

afterEach(() => {
  hold.mockReset();
  logged.length = 0;
  vi.unstubAllGlobals();
  delete process.env.RESEND_API_KEY;
});

describe("sendEmail with the founder email budget", () => {
  it("does not call the provider for a held email, reports it handled and logs why", async () => {
    process.env.RESEND_API_KEY = "re_test";
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    hold.mockResolvedValue({ action: "hold", reason: "Held for the founder's digest" });
    expect(await sendEmail({ to: "ada@startup.com", subject: "S", html: "<p>x</p>" })).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(logged[0]).toMatchObject({ status: "skipped", error: "Held for the founder's digest" });
  });

  it("sends as before when the gate returns null, passing headers through", async () => {
    process.env.RESEND_API_KEY = "re_test";
    const fetchSpy = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "abc" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);
    hold.mockResolvedValue(null);
    expect(await sendEmail({ to: "ada@startup.com", subject: "S", html: "<p>x</p>", headers: { "List-Unsubscribe": "<https://x>" } })).toBe(true);
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string);
    expect(body.headers).toEqual({ "List-Unsubscribe": "<https://x>" });
    expect(logged[0]).toMatchObject({ status: "sent", providerId: "abc" });
  });
});
