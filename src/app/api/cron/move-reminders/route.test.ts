import { beforeEach, describe, expect, it, vi } from "vitest";
import { MoveReminderFakeDb, seedCustomer } from "@/lib/billing/move-reminder.test-helper";

let db: MoveReminderFakeDb;
const sendEmail = vi.fn(async () => true);

vi.mock("server-only", () => ({}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createServiceRoleClient: () => db, serviceRoleClientUntyped: () => db }));
vi.mock("@/lib/email/send-email", () => ({ sendEmail: () => sendEmail() }));
vi.mock("@/lib/cron/gate", () => ({ withCronGate: (_p: string, h: (r: Request) => Promise<Response>) => h, CRON_SUMMARY_HEADER: "x-cron-summary" }));
vi.mock("@/lib/notifications/cron/auth", () => ({
  getCronSecret: () => "s",
  validateCronSecret: (r: Request) => r.headers.get("authorization") === "Bearer s",
  cronUnauthorizedResponse: () => new Response("no", { status: 401 }),
  cronMisconfiguredResponse: () => new Response("cfg", { status: 503 }),
}));

import { clearBoolSettingCache } from "@/lib/settings/platform-settings";
import { GET, POST } from "./route";

const request = (auth = "Bearer s", method = "GET") =>
  new Request("https://icapos.com/api/cron/move-reminders", { method, headers: { authorization: auth } });
// Renewal dates relative to the real clock: the route runs "now".
const soon = () => new Date(Date.now() + 3 * 86_400_000).toISOString();

beforeEach(() => {
  db = new MoveReminderFakeDb();
  sendEmail.mockClear();
  clearBoolSettingCache();
  vi.spyOn(console, "info").mockImplementation(() => {});
});

describe("move-reminders cron", () => {
  it("rejects calls without the cron secret", async () => {
    seedCustomer(db, { current_period_end: soon() });
    expect((await GET(request("Bearer nope"))).status).toBe(401);
    expect((await POST(request("Bearer nope", "POST"))).status).toBe(401);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(db.rows("audit_logs")).toHaveLength(0);
  });

  it("sends nothing while the switch is off, and says so", async () => {
    seedCustomer(db, { current_period_end: soon() });
    const res = await GET(request());
    expect(await res.json()).toMatchObject({ ok: true, enabled: false, sent: 0, wouldSend: 1 });
    expect(res.headers.get("x-cron-summary")).toBe("Switch off: 1 would be sent");
    expect(sendEmail).not.toHaveBeenCalled();
    expect(db.events("billing.move_reminder.would_send")).toHaveLength(1);
  });

  it("sends once the switch is on, and not again on a rerun", async () => {
    seedCustomer(db, { current_period_end: soon() });
    db.rows("platform_settings").push({ key: "billing_move_reminder_enabled", value: { enabled: true } });

    expect(await (await GET(request())).json()).toMatchObject({ ok: true, enabled: true, sent: 1 });
    expect(await (await GET(request())).json()).toMatchObject({ ok: true, sent: 0, alreadySent: 1 });
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it("reports a failed read as an error and sends nothing", async () => {
    seedCustomer(db, { current_period_end: soon() });
    db.failTables.add("subscriptions");
    const res = await GET(request());
    expect(res.status).toBe(500);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
