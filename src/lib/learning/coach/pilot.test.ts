import { describe, expect, it } from "vitest";
import { buildPilot, eligibleFounders, pilotSizing, MIN_GROUP } from "./pilot";

const now = new Date("2026-12-20T00:00:00Z");
const founder = (n: number, email = `f${n}@gmail.com`) => ({ id: `f${n}`, email });
const company = (ids: number[]) => new Map(ids.map((n) => [`f${n}`, { id: `c${n}` }]));

describe("eligible founders", () => {
  it("excludes internal accounts and founders without a company", () => {
    const list = [founder(1), founder(2, "staff@myicfos.com"), founder(3)];
    expect(eligibleFounders(list, company([1, 2])).map((f) => f.id)).toEqual(["f1"]);
  });
});

describe("pilot sizing", () => {
  it("splits evenly and says when it is too few to compare", () => {
    expect(pilotSizing(16)).toMatchObject({ coached: 8, comparison: 8, canCompare: true });
    expect(pilotSizing(16).line).toMatch(/direction/);
    expect(pilotSizing(7)).toMatchObject({ coached: 3, comparison: 4, canCompare: false });
    expect(pilotSizing(7).line).toMatch(new RegExp(`${MIN_GROUP}`));
  });
});

describe("pilot readout", () => {
  const founders = [founder(1), founder(2), founder(3), founder(4)];

  it("has nothing to read before anyone is enrolled", () => {
    const r = buildPilot({ founders, companyByFounder: company([1, 2, 3, 4]), enrollments: [], recipients: [], now });
    expect(r.started).toBe(false);
    expect(r.eligible).toBe(4);
    expect(r.notes[0]).toMatch(/nothing to read/);
  });

  it("counts only activity since the pilot began, for coached and comparison founders", () => {
    const r = buildPilot({
      founders,
      companyByFounder: company([1, 2, 3, 4]),
      enrollments: [{ founder_id: "f1", status: "active", source: "admin_selected", started_at: "2026-11-01T00:00:00Z" }],
      recipients: [
        { company_id: "c1", enrolled_at: "2026-11-05T00:00:00Z", last_sent_at: "2026-11-06T00:00:00Z", replied_at: null },
        { company_id: "c1", enrolled_at: "2026-10-01T00:00:00Z", last_sent_at: "2026-10-02T00:00:00Z", replied_at: null }, // before the pilot
        { company_id: "c2", enrolled_at: "2026-11-10T00:00:00Z", last_sent_at: "2026-11-11T00:00:00Z", replied_at: "2026-11-12T00:00:00Z" },
      ],
      now,
    });
    expect(r.coached).toMatchObject({ founders: 1, contactsAdded: 1, contactsSent: 1, foundersWhoSent: 1 });
    expect(r.comparison).toMatchObject({ founders: 3, contactsAdded: 1, contactsSent: 1, replies: 1, foundersWhoSent: 1 });
    expect(r.weeksElapsed).toBe(7);
  });

  it("keeps a founder who ended in the coached group and says the groups were picked", () => {
    const r = buildPilot({
      founders,
      companyByFounder: company([1, 2, 3, 4]),
      enrollments: [{ founder_id: "f1", status: "ended", source: "admin_selected", started_at: "2026-10-01T00:00:00Z" }],
      recipients: [],
      now,
    });
    expect(r.coached.founders).toBe(1);
    expect(r.selection.handPicked).toBe(1);
    expect(r.notes.join(" ")).toMatch(/chosen by hand or opted in/);
    expect(r.notes.join(" ")).toMatch(/fewer than 5/);
    expect(r.notes.join(" ")).not.toMatch(/significan/i);
  });

  it("ignores enrollments for founders who are not eligible", () => {
    const r = buildPilot({
      founders: [founder(1, "x@myicfos.com")],
      companyByFounder: company([1]),
      enrollments: [{ founder_id: "f1", status: "active", source: "admin_all", started_at: "2026-11-01T00:00:00Z" }],
      recipients: [],
      now,
    });
    expect(r.started).toBe(false);
    expect(r.eligible).toBe(0);
  });
});
