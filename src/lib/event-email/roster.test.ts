import { describe, it, expect } from "vitest";
import {
  chunk,
  companyLine,
  normalizeRole,
  personLine,
  pitchLine,
  roleGroupOf,
  rosterSections,
  sessionGuests,
  type RosterPerson,
} from "@/lib/event-email/roster";

const p = (over: Partial<RosterPerson> = {}): RosterPerson => ({
  name: "Jane Doe",
  role: "Presenter",
  company: "Acme",
  headshotUrl: null,
  initials: "JD",
  bio: "",
  companySummary: "",
  sessionId: null,
  ...over,
});

describe("the same role, spelled four ways", () => {
  it("normalises case, underscores and punctuation", () => {
    for (const s of ["Founder Showcase", "founder showcase", "Founder  showcase", "founder_showcase"]) {
      expect(normalizeRole(s), s).toBe("founder showcase");
    }
  });

  it("puts all four spellings in one group", () => {
    for (const s of ["Founder Showcase", "founder showcase", "Founder_Showcase", "  founder   showcase "]) {
      expect(roleGroupOf(s), s).toBe("showcase");
    }
  });

  it("keeps the invitation role 'Founder' out of the showcase", () => {
    // "Founder" is the invite role for someone answering in their own portal —
    // a different thing from pitching on the showcase stage.
    expect(roleGroupOf("Founder")).toBe("presenter");
  });

  it("recognises the talk-show roles", () => {
    expect(roleGroupOf("Guest CEO")).toBe("guest_ceo");
    expect(roleGroupOf("guest ceo")).toBe("guest_ceo");
    expect(roleGroupOf("Investor")).toBe("investor");
  });

  it("never drops someone with an invented role", () => {
    expect(roleGroupOf("Fireside host")).toBe("presenter");
    expect(roleGroupOf("")).toBe("presenter");
  });
});

describe("the lines each cell shows", () => {
  it("leads with the company", () => {
    expect(companyLine(p({ company: "Harvard MedTech" }))).toBe("Harvard MedTech");
  });

  it("falls back to the person rather than rendering blank", () => {
    expect(companyLine(p({ company: "", name: "Shan Padda" }))).toBe("Shan Padda");
  });

  it("names the person with their role", () => {
    expect(personLine(p({ name: "Bob Wood", role: "CEO" }))).toBe("Bob Wood · CEO");
  });

  it("drops the role when asked — the showcase needs the width", () => {
    expect(personLine(p({ name: "Bob Wood", role: "CEO" }), false)).toBe("Bob Wood");
  });

  it("omits a role that just repeats the name", () => {
    expect(personLine(p({ name: "Bob Wood", role: "bob wood" }))).toBe("Bob Wood");
  });

  it("prefers the company summary over the bio for the pitch line", () => {
    expect(pitchLine(p({ companySummary: "Clinical tooling.", bio: "Twenty years in health IT." })))
      .toBe("Clinical tooling.");
    expect(pitchLine(p({ companySummary: "", bio: "Twenty years in health IT." })))
      .toBe("Twenty years in health IT.");
    expect(pitchLine(p())).toBe("");
  });
});

describe("splitting the roster into sections", () => {
  const all = [
    p({ name: "Jamie", role: "Presenter" }),
    p({ name: "Shailesh", role: "Founder showcase" }),
    p({ name: "Steve", role: "Founder Showcase" }),
    p({ name: "NAI", role: "Exhibitor" }),
    p({ name: "Marcus", role: "Investor", sessionId: "sess-1" }),
    p({ name: "Shan", role: "Guest CEO", sessionId: "sess-1" }),
  ];

  it("gathers the presenting companies", () => {
    expect(rosterSections(all).companies.map((x) => x.name)).toEqual(["Jamie"]);
  });

  it("gathers both spellings of the showcase into one list", () => {
    expect(rosterSections(all).showcase.map((x) => x.name)).toEqual(["Shailesh", "Steve"]);
  });

  it("gathers the exhibitors", () => {
    expect(rosterSections(all).exhibitors.map((x) => x.name)).toEqual(["NAI"]);
  });

  it("leaves session guests out — they are billed under their session instead", () => {
    const s = rosterSections(all);
    const listed = [...s.companies, ...s.showcase, ...s.exhibitors].map((x) => x.name);
    expect(listed).not.toContain("Marcus");
    expect(listed).not.toContain("Shan");
  });
});

describe("who is billed under a session", () => {
  const all = [
    p({ name: "Marcus", role: "Investor", company: "Tessellate", sessionId: "sess-1" }),
    p({ name: "Shan", role: "Guest CEO", company: "Harvard MedTech", sessionId: "sess-1" }),
    p({ name: "Ada", role: "Fireside host", sessionId: "sess-1" }),
    p({ name: "Elsewhere", role: "Investor", sessionId: "sess-2" }),
    p({ name: "Loose", role: "Presenter" }),
  ];

  it("takes only that session's people", () => {
    expect(sessionGuests(all, "sess-1").map((g) => g.person.name)).toEqual(["Shan", "Marcus", "Ada"]);
  });

  it("introduces the guest CEO before the investor", () => {
    const [first, second] = sessionGuests(all, "sess-1");
    expect(first.role).toBe("Guest CEO");
    expect(second.role).toBe("Investor");
  });

  it("labels an unrecognised role with what was typed, rather than hiding them", () => {
    expect(sessionGuests(all, "sess-1")[2]).toEqual({ role: "Fireside host", person: expect.objectContaining({ name: "Ada" }) });
  });

  it("returns nothing for a session with no one on it", () => {
    expect(sessionGuests(all, "sess-9")).toEqual([]);
  });
});

describe("rows of three", () => {
  it("splits a long list into full rows plus a short last one", () => {
    expect(chunk([1, 2, 3, 4, 5], 3)).toEqual([[1, 2, 3], [4, 5]]);
  });

  it("returns nothing for an empty list, so no empty row is rendered", () => {
    expect(chunk([], 3)).toEqual([]);
  });

  it("keeps a list of exactly three as one row", () => {
    expect(chunk([1, 2, 3], 3)).toEqual([[1, 2, 3]]);
  });
});
