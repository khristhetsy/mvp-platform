import { beforeEach, describe, expect, it, vi } from "vitest";
import { MoveReminderFakeDb, seedCustomer } from "@/lib/billing/move-reminder.test-helper";

let db: MoveReminderFakeDb;
let session: { id: string; role: string } | null;
const sendEmail = vi.fn(async () => true);

vi.mock("server-only", () => ({}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createServiceRoleClient: () => db, serviceRoleClientUntyped: () => db }));
vi.mock("@/lib/email/send-email", () => ({ sendEmail: () => sendEmail() }));
// The signed in user, as the real staff guard reads it: auth.getUser, then the profile row.
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: async () => ({
    auth: { getUser: async () => ({ data: { user: session ? { id: session.id } : null }, error: null }) },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: session ? { id: session.id, full_name: "Test User", email: "user@example.com", role: session.role, is_active: true, is_super_admin: false } : null,
            error: null,
          }),
        }),
      }),
    }),
  }),
}));

import { clearBoolSettingCache } from "@/lib/settings/platform-settings";
import { GET } from "./route";

beforeEach(() => {
  db = new MoveReminderFakeDb();
  session = null;
  sendEmail.mockClear();
  clearBoolSettingCache();
  vi.spyOn(console, "info").mockImplementation(() => {});
});

describe("GET /api/admin/billing/move-reminders (dry run)", () => {
  it("refuses a caller who is not signed in", async () => {
    seedCustomer(db);
    const res = await GET();
    expect(res.status).toBe(401);
    expect(await res.json()).not.toHaveProperty("wouldSend");
  });

  it.each(["founder", "investor"])("refuses a %s", async (role) => {
    seedCustomer(db);
    session = { id: "user-1", role };
    const res = await GET();
    expect(res.status).toBe(403);
    expect(await res.json()).not.toHaveProperty("wouldSend");
  });

  it.each(["admin", "analyst"])("lets an %s see who would be emailed, without sending or recording", async (role) => {
    const c = seedCustomer(db);
    seedCustomer(db, { stripe_subscription_id: "sub_stripe" });
    session = { id: "staff-1", role };

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ dryRun: true, enabled: false, enabledSetting: "billing_move_reminder_enabled", windowDays: 7 });
    expect(body.wouldSend).toHaveLength(1);
    expect(body.wouldSend[0]).toMatchObject({ profileId: c.profileId, email: c.email, plan: "founder_basic", priceCents: 4900 });
    expect(sendEmail).not.toHaveBeenCalled();
    expect(db.rows("audit_logs")).toHaveLength(0);
  });

  it("still sends nothing when the switch is on", async () => {
    seedCustomer(db);
    db.rows("platform_settings").push({ key: "billing_move_reminder_enabled", value: { enabled: true } });
    session = { id: "staff-1", role: "admin" };

    const body = await (await GET()).json();

    expect(body.enabled).toBe(true);
    expect(body.wouldSend).toHaveLength(1);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(db.rows("audit_logs")).toHaveLength(0);
  });
});
