import { describe, expect, it } from "vitest";
import { commitmentStreak, countContacts, countIntros, countSends, metricValue, weekLine, whereYouStand, type ProgramRaw } from "@/lib/learning/coach/program-reads";
import { dueChoiceFor } from "@/lib/learning/coach/program-events";

function raw(over: Partial<ProgramRaw> = {}): ProgramRaw {
  return {
    contacts: { total: 15, withEmail: 7, withNote: 13, ready: 6 },
    intros: { week: 0, total: 9, dismissed: 9, lastAt: "2026-10-06T00:00:00Z" },
    sends: { week: 0, total: 0, followUpsWeek: 0, replies: 0, recipients: 1 },
    social: null,
    automated: { unlocked: false, score: 40, gate: 65 },
    irAgent: { status: null },
    events: null,
    tasks: { openOutreach: 0 },
    dealRooms: { open: 0, questionsOpen: 0, docRequestsOpen: 0 },
    documents: { total: 18 },
    offering: { type: "reg_d_506c", attestedAt: null },
    spvs: { count: 0, checklistPct: null, closingPct: null },
    pledges: { totalPledged: 0, investorCount: 0, raise: 1000000 },
    updates: { last30: 0, lastAt: "2026-08-08T00:00:00Z", daysSince: 73 },
    milestoneTasks: 0,
    roomCheckTasks: 0,
    commitments: [],
    lessonsDone: [],
    industry: "SaaS / B2B Software",
    stage: "Seed",
    industryPeers: 1,
    readAt: "2026-10-20T08:00:00Z",
    ...over,
  };
}

describe("program reads, pure arithmetic", () => {
  it("counts a contact as ready only with both an email and a note", () => {
    const c = countContacts([
      { email: "a@x.com", notes: "met at demo day" },
      { email: "b@x.com", notes: "" },
      { email: null, notes: "warm" },
      { email: "  ", notes: null },
    ]);
    expect(c).toEqual({ total: 4, withEmail: 2, withNote: 2, ready: 1 });
  });

  it("counts intro requests this week and dismissed ones", () => {
    const i = countIntros(
      [
        { status: "dismissed", created_at: "2026-10-06T10:00:00Z" },
        { status: "requested", created_at: "2026-10-20T10:00:00Z" },
        { status: "declined", created_at: "2026-09-01T10:00:00Z" },
      ],
      "2026-10-19T00:00:00Z",
    );
    expect(i).toEqual({ week: 1, total: 3, dismissed: 2, lastAt: "2026-10-20T10:00:00Z" });
  });

  it("separates first messages from follow ups by step index", () => {
    const s = countSends(
      [
        { step_index: 0, sent_at: "2026-10-20T10:00:00Z" },
        { step_index: 1, sent_at: "2026-10-20T11:00:00Z" },
        { step_index: 0, sent_at: "2026-10-01T10:00:00Z" },
      ],
      [{ repliedAt: null }, { repliedAt: "2026-10-02T00:00:00Z" }],
      "2026-10-19T00:00:00Z",
    );
    expect(s).toEqual({ week: 1, total: 3, followUpsWeek: 1, replies: 1, recipients: 2 });
  });

  it("returns null for a metric whose source could not be read", () => {
    expect(metricValue(raw(), "contacts_ready")).toBe(6);
    expect(metricValue(raw(), "social")).toBeNull();
    expect(metricValue(raw({ social: { connected: 2, scheduled: 0 } }), "social")).toBe(1);
    expect(metricValue(raw(), "events")).toBeNull();
  });

  it("builds the week line from the founder's own numbers", () => {
    expect(weekLine(raw(), "game-plan")).toBe("0 first messages sent this week, 6 of 15 contacts ready. Next step: make ready 4 more (6 of 10).");
    expect(weekLine(raw({ contacts: { total: 15, withEmail: 12, withNote: 13, ready: 10 } }), "game-plan")).toContain("target met (10 of 10)");
    expect(weekLine(raw({ contacts: null, sends: null }), "events")).toContain("could not be read");
  });

  it("counts a streak of weeks where every resolved commitment was kept", () => {
    const now = new Date("2026-10-20T12:00:00Z");
    const c = (status: "kept" | "missed" | "open", due: string) => ({ lesson_id: "x", status, due_at: due, created_at: due, title: "t" });
    expect(commitmentStreak([], now)).toEqual({ met: 0, resolved: 0, streak: 0 });
    expect(commitmentStreak([c("kept", "2026-10-07T00:00:00Z"), c("kept", "2026-10-14T00:00:00Z"), c("open", "2026-10-21T00:00:00Z")], now)).toEqual({ met: 2, resolved: 2, streak: 2 });
    expect(commitmentStreak([c("kept", "2026-10-07T00:00:00Z"), c("missed", "2026-10-14T00:00:00Z")], now)).toEqual({ met: 1, resolved: 2, streak: 0 });
  });

  it("shows where you stand with the founder's figures and the peer count", () => {
    const rows = whereYouStand(raw());
    const contacts = rows.find((r) => r.key === "contacts_ready")!;
    expect(contacts.you).toBe("6 of 15");
    expect(contacts.industry).toContain("peers today: 1");
    expect(rows.find((r) => r.key === "sends_week")!.you).toBe("0");
    expect(whereYouStand(raw({ contacts: null })).find((r) => r.key === "contacts_ready")!.you).toBe("Not read");
  });

  it("maps an exact due time onto the three due choices", () => {
    const now = new Date("2026-10-20T15:00:00Z");
    expect(dueChoiceFor(new Date("2026-10-20T23:00:00Z"), now)).toBe("today");
    expect(dueChoiceFor(new Date("2026-10-21T16:00:00Z"), now)).toBe("tomorrow");
    expect(dueChoiceFor(new Date("2026-10-24T16:00:00Z"), now)).toBe("this_week");
  });
});
