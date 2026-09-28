import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ir/db", () => ({ db: vi.fn(), updateMatch: vi.fn() }));
vi.mock("@/lib/crm-connectors/odoo/client", () => ({ executeKw: vi.fn(), odooConfigured: () => false }));

import { activityKey, planResync } from "./odoo-resync";

const tag = (name: string) => ({ id: 1, name, stage: "contacted" as const, via: ["Contact"] });

describe("planResync", () => {
  const irTasks = [{ id: "T1", odoo_task_id: 10, assignee_id: "U1" }];
  const matches = [{ id: "M1", odoo_tag: "Dan Farrell (Acme) dan@acme.com", stage: "intro_sent" as const }, { id: "M2", odoo_tag: "Ann Lee ann@x.com", stage: "contacted" as const }];

  it("keeps task-level notes on the task and named ones on the investor", () => {
    const tasks = [{ id: 10, tags: [tag("Dan Farrell (Acme) dan@acme.com"), tag("Ann Lee ann@x.com")], agentText: "Called 10 investors, no answer 4/23/26 | Sent follow-up emails 4/24/26\nDan Farrell: Term sheet received 5/2/26" }];
    const p = planResync(tasks, irTasks, matches, new Set());
    expect(p.add.map((a) => [a.type, a.matchId, a.date])).toEqual([["call", null, "2026-04-23"], ["email", null, "2026-04-24"], ["term_sheet", "M1", "2026-05-02"]]);
    expect(p.add[0].taskId).toBe("T1");
    expect(p.stageMoves).toEqual([{ matchId: "M1", to: "committed" }]);
  });

  it("skips undated entries, plain notes, entries already present, and tasks not imported", () => {
    const tasks = [
      { id: 10, tags: [tag("Ann Lee ann@x.com")], agentText: "Called, no answer | Waiting to hear back | Sent intro email 4/22/26" },
      { id: 99, tags: [], agentText: "Called 4/1/26" },
    ];
    const existing = new Set([activityKey({ taskId: "T1", matchId: "M2", type: "email", date: "2026-04-22", outcome: "Sent intro email" })]);
    const p = planResync(tasks, irTasks, matches, existing);
    expect(p.add).toEqual([]);
    expect(p.undated).toBe(1);
    expect(p.notes).toBe(1);
    expect(p.already).toBe(1);
    expect(p.notImported).toBe(1);
  });
});

describe("chatter", () => {
  it("dates notes by the message, types completed activities, keeps one entry per email", async () => {
    const { messageEntries } = await import("./odoo-resync");
    const es = messageEntries([
      { res_id: 10, date: "2026-05-04 09:00:00", body: "<p>Called Dan Farrell, left voicemail</p>", message_type: "comment", activityType: null },
      { res_id: 10, date: "2026-05-05 09:00:00", body: "<p>Discussed terms</p>", message_type: "notification", activityType: "Meeting" },
      { res_id: 10, date: "2026-05-06 09:00:00", body: "<p>Thanks, see attached deck.</p><p>Best</p>", message_type: "email", activityType: null },
      { res_id: 10, date: "2026-05-07 09:00:00", body: "<p>Stage changed</p>", message_type: "comment", activityType: null },
    ], [tag("Dan Farrell (Acme) dan@acme.com")]);
    expect(es.map((e) => [e.type, e.date])).toEqual([["voicemail", "2026-05-04"], ["meeting", "2026-05-05"], ["email", "2026-05-06"], ["note", "2026-05-07"]]);
  });
});
