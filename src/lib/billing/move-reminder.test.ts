import { beforeEach, describe, expect, it, vi } from "vitest";
import { MoveReminderFakeDb, NOW, inDays, seedCustomer } from "./move-reminder.test-helper";

let db: MoveReminderFakeDb;
const sendEmail = vi.fn<(payload: { to: string; subject: string; html: string; text?: string }) => Promise<boolean>>();

vi.mock("server-only", () => ({}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createServiceRoleClient: () => db, serviceRoleClientUntyped: () => db }));
vi.mock("@/lib/email/send-email", () => ({ sendEmail: (payload: never) => sendEmail(payload) }));

import { clearBoolSettingCache } from "@/lib/settings/platform-settings";
import { verifyMoveLinkToken } from "@/lib/billing/move-link-core";
import { planMoveReminders, runMoveReminders } from "./move-reminder";

const switchOn = () => {
  db.rows("platform_settings").push({ key: "billing_move_reminder_enabled", value: { enabled: true } });
  clearBoolSettingCache();
};
const sentTo = () => sendEmail.mock.calls.map((c) => c[0].to);

beforeEach(() => {
  db = new MoveReminderFakeDb();
  clearBoolSettingCache();
  sendEmail.mockReset();
  sendEmail.mockResolvedValue(true);
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("move reminders with the switch OFF (the default)", () => {
  it("sends nothing and records who it would have emailed", async () => {
    const a = seedCustomer(db);
    const b = seedCustomer(db, { plan_type: "founder_professional", monthly_price_cents: 19900 });

    const run = await runMoveReminders(NOW);

    expect(sendEmail).not.toHaveBeenCalled();
    expect(run).toMatchObject({ enabled: false, sent: 0, wouldSend: 2 });
    expect(db.events("billing.move_reminder.sent")).toHaveLength(0);
    const events = db.events("billing.move_reminder.would_send");
    expect(events).toHaveLength(1);
    expect(events[0].metadata).toMatchObject({ count: 2, profile_ids: [a.profileId, b.profileId], subscription_ids: [a.subscriptionId, b.subscriptionId] });
  });

  it("stays off when the setting row says enabled false", async () => {
    db.rows("platform_settings").push({ key: "billing_move_reminder_enabled", value: { enabled: false } });
    seedCustomer(db);
    await runMoveReminders(NOW);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("records nothing when nobody is due", async () => {
    seedCustomer(db, { current_period_end: inDays(20) });
    const run = await runMoveReminders(NOW);
    expect(run.wouldSend).toBe(0);
    expect(db.rows("audit_logs")).toHaveLength(0);
  });
});

describe("move reminders with the switch ON", () => {
  it("emails each eligible customer once, with their own move link and price", async () => {
    const basic = seedCustomer(db);
    const pro = seedCustomer(db, { plan_type: "founder_professional", monthly_price_cents: 19900 });
    switchOn();

    const run = await runMoveReminders(NOW);

    expect(run).toMatchObject({ enabled: true, due: 2, sent: 2, failed: 0, wouldSend: 0 });
    expect(sentTo()).toEqual([basic.email, pro.email]);
    const [first, second] = sendEmail.mock.calls.map((c) => c[0]);
    expect(first.text).toContain("$49 per month, the same as today");
    expect(second.text).toContain("$199 per month, the same as today");
    const token = (text: string | undefined) => decodeURIComponent(/\/billing\/move\?t=(\S+)/.exec(text ?? "")?.[1] ?? "");
    expect(verifyMoveLinkToken(token(first.text))).toBe(basic.profileId);
    expect(verifyMoveLinkToken(token(second.text))).toBe(pro.profileId);
    expect(db.events("billing.move_reminder.would_send")).toHaveLength(0);
    expect(db.events("billing.move_reminder.sent").map((e) => e.entity_id)).toEqual([basic.subscriptionId, pro.subscriptionId]);
  });

  it("includes a customer who was already inside the window before the switch was turned on", async () => {
    const c = seedCustomer(db, { current_period_end: inDays(1) });
    await runMoveReminders(NOW);
    expect(sendEmail).not.toHaveBeenCalled();

    switchOn();
    const run = await runMoveReminders(NOW);
    expect(run.sent).toBe(1);
    expect(sentTo()).toEqual([c.email]);
  });

  it("does not send again on a rerun", async () => {
    seedCustomer(db);
    switchOn();
    await runMoveReminders(NOW);
    const again = await runMoveReminders(NOW);
    const nextDay = await runMoveReminders(new Date(NOW.getTime() + 86_400_000));

    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(again).toMatchObject({ due: 0, sent: 0, alreadySent: 1 });
    expect(nextDay).toMatchObject({ due: 0, sent: 0, alreadySent: 1 });
    expect(db.events("billing.move_reminder.sent")).toHaveLength(1);
  });

  it("sends once more for the next renewal", async () => {
    const c = seedCustomer(db);
    switchOn();
    await runMoveReminders(NOW);
    db.rows("subscriptions")[0].current_period_end = inDays(33);

    const later = new Date(NOW.getTime() + 28 * 86_400_000);
    await runMoveReminders(later);
    await runMoveReminders(later);

    expect(sentTo()).toEqual([c.email, c.email]);
    expect(db.events("billing.move_reminder.sent")).toHaveLength(2);
  });

  it("never emails Stripe, Premium, free, unpaid or internal customers", async () => {
    const eligible = seedCustomer(db);
    seedCustomer(db, { stripe_subscription_id: "sub_stripe" });
    seedCustomer(db, { plan_type: "founder_premium", monthly_price_cents: 100000 });
    seedCustomer(db, { plan_type: "founder_free", monthly_price_cents: 0 });
    seedCustomer(db, { subscription_status: "pending_payment" });
    seedCustomer(db, { plan_type: "admin_internal", monthly_price_cents: 0 });
    seedCustomer(db, {}, { email: "staff@myicfos.com" });
    seedCustomer(db, {}, { role: "admin" });
    seedCustomer(db, { ls_subscription_id: null });
    seedCustomer(db, { current_period_end: inDays(8) });
    switchOn();

    const run = await runMoveReminders(NOW);

    expect(sentTo()).toEqual([eligible.email]);
    expect(run.sent).toBe(1);
  });

  it("does not mark a failed send as sent, so the next run retries it", async () => {
    const c = seedCustomer(db);
    switchOn();
    sendEmail.mockResolvedValueOnce(false);

    const first = await runMoveReminders(NOW);
    expect(first).toMatchObject({ sent: 0, failed: 1 });
    expect(db.events("billing.move_reminder.sent")).toHaveLength(0);
    expect(db.events("billing.move_reminder.failed")).toHaveLength(1);

    const second = await runMoveReminders(NOW);
    expect(second.sent).toBe(1);
    expect(sentTo()).toEqual([c.email, c.email]);
  });

  it("sends nothing when it cannot read which reminders already went out", async () => {
    seedCustomer(db);
    switchOn();
    db.failTables.add("audit_logs");
    await expect(runMoveReminders(NOW)).rejects.toThrow(/sent reminders/);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("uses the window setting", async () => {
    const c = seedCustomer(db, { current_period_end: inDays(10) });
    switchOn();
    expect((await runMoveReminders(NOW)).sent).toBe(0);

    db.rows("platform_settings").push({ key: "billing_move_reminder_window_days", value: { days: 14 } });
    const run = await runMoveReminders(NOW);
    expect(run).toMatchObject({ windowDays: 14, sent: 1 });
    expect(sentTo()).toEqual([c.email]);
  });
});

describe("planMoveReminders (the dry run)", () => {
  it("lists recipients, already sent and skipped without sending or recording", async () => {
    const due = seedCustomer(db);
    const done = seedCustomer(db);
    const premium = seedCustomer(db, { plan_type: "founder_premium", monthly_price_cents: 100000 });
    db.rows("audit_logs").push({
      action: "billing.move_reminder.sent",
      entity_id: done.subscriptionId,
      metadata: { reminder_key: `${done.subscriptionId}:${inDays(3)}` },
    });

    const plan = await planMoveReminders(NOW);

    expect(plan.enabled).toBe(false);
    expect(plan.windowDays).toBe(7);
    expect(plan.recipients.map((r) => r.profileId)).toEqual([due.profileId]);
    expect(plan.alreadySent.map((r) => r.profileId)).toEqual([done.profileId]);
    expect(plan.skipped).toEqual([{ subscriptionId: premium.subscriptionId, profileId: premium.profileId, reason: "plan_not_included" }]);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(db.rows("audit_logs")).toHaveLength(1);
  });
});
