import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

type Row = Record<string, unknown>;
const tables: Record<string, Row[]> = {};
const inserted: Row[] = [];

/** Tiny in-memory stand in for the Supabase query builder: select, eq, in, gte, limit, insert, update. */
function fakeClient() {
  return {
    from(table: string) {
      let rows = [...(tables[table] ?? [])];
      let updating: Row | null = null;
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: (col: string, v: unknown) => {
          rows = rows.filter((r) => r[col] === v);
          return chain;
        },
        in: (col: string, vs: unknown[]) => {
          rows = rows.filter((r) => vs.includes(r[col]));
          return chain;
        },
        gte: () => chain,
        limit: () => chain,
        insert: (row: Row) => {
          inserted.push({ table, ...row });
          return Promise.resolve({ error: null });
        },
        update: (patch: Row) => {
          updating = patch;
          return chain;
        },
        then: (resolve: (v: unknown) => unknown) => {
          if (updating) {
            for (const r of rows) Object.assign(r, updating);
            return Promise.resolve({ data: null, error: null }).then(resolve);
          }
          return Promise.resolve({ data: rows, error: null }).then(resolve);
        },
      };
      return chain;
    },
  };
}

const sendEmail = vi.fn(async () => undefined);
const createNotification = vi.fn(async () => ({ id: "n1" }));
let prefs = { pause_all: false, channel_in_app: true, channel_email: true, quiet_start: null as string | null, quiet_end: null as string | null, timezone: null };

vi.mock("@/lib/supabase/admin", () => ({ createServiceRoleClient: () => fakeClient() }));
vi.mock("@/lib/email/send-email", () => ({ sendEmail: (...a: unknown[]) => sendEmail(...(a as [])) }));
vi.mock("@/lib/notifications/notifications", () => ({ createNotification: (...a: unknown[]) => createNotification(...(a as [])) }));
vi.mock("@/lib/notifications/preferences", async (orig) => ({
  ...(await orig<typeof import("@/lib/notifications/preferences")>()),
  loadNotificationPrefs: async () => prefs,
}));

import { runCoachReminderPass } from "@/lib/learning/coach/reminders-pass";
import { currentReviewHash } from "@/lib/learning/coach/review-pack";

const NOW = new Date("2026-10-26T18:00:00Z"); // Monday 11:00 PT
const DAY = 86_400_000;

function seed(opts: { email?: string; role?: string; idleDays?: number; coachOn?: boolean } = {}) {
  for (const k of Object.keys(tables)) delete tables[k];
  inserted.length = 0;
  tables.course_coach_config = opts.coachOn === false ? [] : [{ course_key: "investor-outreach-playbook", enabled: true, reviewed_hash: currentReviewHash("investor-outreach-playbook") }];
  tables.coach_enrollments = [
    { founder_id: "f1", company_id: "c1", tone: "driven", status: "active", started_at: new Date(NOW.getTime() - (opts.idleDays ?? 8) * DAY).toISOString() },
  ];
  tables.profiles = [{ id: "f1", email: opts.email ?? "founder@example.com", full_name: "Ada Lovelace", role: opts.role ?? "founder" }];
  tables.coach_step_events = [];
  tables.coach_commitments = [];
  tables.coach_messages = [];
}

beforeEach(() => {
  sendEmail.mockClear();
  createNotification.mockClear();
  prefs = { pause_all: false, channel_in_app: true, channel_email: true, quiet_start: null, quiet_end: null, timezone: null };
});

describe("runCoachReminderPass", () => {
  it("does nothing while no course has the coach enabled", async () => {
    seed({ coachOn: false });
    const r = await runCoachReminderPass(300, NOW);
    expect(r.sent).toBe(0);
    expect(createNotification).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("sends the in app nudge and the email to a founder idle for 8 days", async () => {
    seed();
    const r = await runCoachReminderPass(300, NOW);
    expect(createNotification).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(r.sent).toBe(2);
    expect(inserted.filter((m) => m.table === "coach_messages" && m.status === "sent")).toHaveLength(2);
  });

  it("never emails internal or staff accounts", async () => {
    seed({ email: "someone@myicfos.com" });
    const r = await runCoachReminderPass(300, NOW);
    expect(r.skippedInternal).toBe(1);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(createNotification).not.toHaveBeenCalled();
  });

  it("skips non founder roles", async () => {
    seed({ role: "admin" });
    await runCoachReminderPass(300, NOW);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("honors pause all and records why", async () => {
    seed();
    prefs.pause_all = true;
    const r = await runCoachReminderPass(300, NOW);
    expect(createNotification).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
    expect(r.suppressed).toBeGreaterThan(0);
    expect(inserted.some((m) => m.suppressed_reason === "paused_all")).toBe(true);
  });

  it("holds email during quiet hours and does not record it, so it retries later", async () => {
    seed();
    prefs.quiet_start = "08:00";
    prefs.quiet_end = "12:00"; // 11:00 PT is inside this window
    await runCoachReminderPass(300, NOW);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(createNotification).toHaveBeenCalledTimes(1);
    expect(inserted.some((m) => m.channel === "email")).toBe(false);
  });

  it("records the 14 day human flag without messaging the founder", async () => {
    seed({ idleDays: 15 });
    await runCoachReminderPass(300, NOW);
    expect(inserted.some((m) => m.suppressed_reason === "human_flag_14d")).toBe(true);
  });

  it("marks a commitment kept when the step was done afterwards", async () => {
    seed({ idleDays: 1 });
    tables.coach_commitments = [
      { id: "k1", founder_id: "f1", company_id: "c1", course_slug: "p", lesson_id: "l", step_index: 0, title: "Send", due_at: new Date(NOW.getTime() - DAY).toISOString(), status: "open", created_at: new Date(NOW.getTime() - 2 * DAY).toISOString() },
    ];
    tables.coach_step_events = [
      { founder_id: "f1", company_id: "c1", course_slug: "p", lesson_id: "l", step_index: 0, event: "done", created_at: new Date(NOW.getTime() - 3_600_000).toISOString() },
    ];
    const r = await runCoachReminderPass(300, NOW);
    expect(r.kept).toBe(1);
    expect(createNotification).not.toHaveBeenCalled();
  });
});
