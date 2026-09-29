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

describe("investor chatter", () => {
  it("builds founder keywords from names, co-founders and companies", async () => {
    const { founderKeywords } = await import("./odoo-resync");
    expect(founderKeywords(["Steve Gatt/Chris Williams", "Holo MD", "Michael Doyle", null])).toEqual(["steve gatt", "gatt", "chris williams", "williams", "holo md", "michael doyle", "doyle"]);
  });

  it("keeps only messages naming the founder, on the task the investor was on at that date", async () => {
    const { partnerEntries, founderKeywords } = await import("./odoo-resync");
    const tasks = [
      { id: 10, createDate: "2026-04-01 10:00:00", tags: [{ id: 7, name: "Dan Farrell (Acme) dan@acme.com", stage: "contacted" as const, via: ["Matches"] }] },
      { id: 11, createDate: "2026-04-08 10:00:00", tags: [{ id: 7, name: "Dan Farrell (Acme) dan@acme.com", stage: "contacted" as const, via: ["Matches"] }] },
    ];
    const kw = founderKeywords(["Michael Doyle"]);
    const r = partnerEntries([
      { res_id: 7, date: "2026-04-09 15:00:00", body: "<p>Doyle Organics</p>", message_type: "notification", activityType: "Call" },
      { res_id: 7, date: "2026-04-03 15:00:00", body: "<p>Holo MD</p>", message_type: "notification", activityType: "Email" },
      { res_id: 7, date: "2026-04-02 15:00:00", body: "Sent deck for Doyle 4/2/26", message_type: "comment", activityType: null },
      { res_id: 99, date: "2026-04-02 15:00:00", body: "Doyle call", message_type: "comment", activityType: "Call" },
    ], tasks, kw);
    expect(r.matched).toBe(2);
    expect(r.byTask.get(11)?.map((e) => [e.type, e.date, e.investorKey])).toEqual([["call", "2026-04-09", "Dan Farrell (Acme) dan@acme.com"]]);
    expect(r.byTask.get(10)?.map((e) => [e.type, e.date])).toEqual([["email", "2026-04-02"]]);
  });

  it("ignores a keyword that is the investor's own name", async () => {
    const { mentions } = await import("./odoo-resync");
    expect(mentions("Call with Chris Williams", ["williams"], "Chris Williams")).toBe(false);
    expect(mentions("Williams intro sent", ["williams"], "Dan Farrell")).toBe(true);
  });
});

describe("investor in brackets", () => {
  const irTasks = [{ id: "T1", odoo_task_id: 10, assignee_id: "U1" }];
  const matches = [{ id: "M1", odoo_tag: "Nick Mysore (Acme) nick@acme.com", stage: "matched" as const }, { id: "M2", odoo_tag: "Ann Lee ann@x.com", stage: "matched" as const }];
  const tasks = [{ id: 10, tags: [tag("Nick Mysore (Acme) nick@acme.com"), tag("Ann Lee ann@x.com")], agentText: "(Nick Mysore)- Sent intro email 9/8/26" }];

  it("reads a leading (Name) as the investor", () => {
    const p = planResync(tasks, irTasks, matches, new Set(), [], new Map(), new Map(), "2026-09-28");
    expect(p.add.map((a) => [a.matchId, a.outcome])).toEqual([["M1", "Sent intro email"]]);
    expect(p.stageMoves).toEqual([{ matchId: "M1", to: "intro_sent" }]);
  });

  it("moves an entry stored on the task onto the investor instead of adding it again", async () => {
    const { looseKey, activityKey: key } = await import("./odoo-resync");
    const old = { taskId: "T1", matchId: null, type: "email", date: "2026-09-08", outcome: "(Nick Mysore)- Sent intro email" };
    const p = planResync(tasks, irTasks, matches, new Set([key(old)]), [], new Map(), new Map([[looseKey(old), "A1"]]), "2026-09-28");
    expect(p.add).toEqual([]);
    expect(p.attach).toEqual([{ id: "A1", matchId: "M1", outcome: "Sent intro email" }]);
    expect(p.stageMoves).toEqual([{ matchId: "M1", to: "intro_sent" }]);
  });

  it("treats typo dates as undated", () => {
    const t = [{ id: 10, tags: [tag("Ann Lee ann@x.com")], agentText: "Sent intro email 8/3/07 | Talked, will call 2/6/30" }];
    const p = planResync(t, irTasks, matches, new Set(), [], new Map(), new Map(), "2026-09-28");
    expect(p.add).toEqual([]);
    expect(p.undated).toBe(2);
  });
});
