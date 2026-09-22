/**
 * Every pair of registered investors and founders.
 *
 * Registration is the qualifier. The first version keyed off the networking
 * opt-in and a 106-person event produced one match, because that toggle only
 * exists for people who registered through the public form, found it, and
 * declared a sector.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const regs = vi.fn();
const conns = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createServiceRoleClient: () => ({
    from: (table: string) => ({
      select: (_cols: string, opts?: { head?: boolean }) => ({
        eq: (_c: string, _v: string) => {
          const done = () => {
            if (opts?.head) return { count: 9, error: null };
            if (table === "registrations") return { data: regs(), error: null };
            if (table === "networking_connections") return { data: conns(), error: null };
            return { data: [], error: null };
          };
          return Object.assign(Promise.resolve(done()), {
            eq: () => Promise.resolve(done()),
          });
        },
      }),
    }),
  }),
}));

const { loadNetworkingBoard } = await import("@/lib/icfo-events/networking-board");

/** A registration, which is all it takes to be matchable. */
const person = (id: string, name: string, role: string, sectors: string[]) => ({
  id: `reg-${id}`,
  attendee_id: id,
  attendee_type: role,
  answers: { name, sectors },
  profiles: { full_name: name },
});

beforeEach(() => {
  regs.mockReturnValue([]);
  conns.mockReturnValue([]);
});

describe("which pairs count as a match", () => {
  it("scores shared sectors at two apiece", async () => {
    regs.mockReturnValue([
      person("a", "Ann", "founder", ["FinTech", "AI / ML"]),
      person("b", "Ben", "founder", ["FinTech", "AI / ML"]),
    ]);
    const b = await loadNetworkingBoard("e1");
    expect(b.pairs).toHaveLength(1);
    expect(b.pairs[0].score).toBe(4);
    expect(b.pairs[0].sharedInterests.sort()).toEqual(["AI / ML", "FinTech"]);
  });

  it("adds three for a founder–investor pairing", async () => {
    regs.mockReturnValue([
      person("a", "Ann", "founder", ["FinTech"]),
      person("b", "Ivy", "investor", ["FinTech"]),
    ]);
    expect((await loadNetworkingBoard("e1")).pairs[0].score).toBe(5);
  });

  it("keeps a founder–investor pair with nothing in common", async () => {
    regs.mockReturnValue([
      person("a", "Ann", "founder", ["FinTech"]),
      person("b", "Ivy", "investor", ["Logistics"]),
    ]);
    const b = await loadNetworkingBoard("e1");
    expect(b.pairs).toHaveLength(1);
    expect(b.pairs[0].score).toBe(3);
    expect(b.pairs[0].sharedInterests).toEqual([]);
  });

  it("drops two of the same kind with nothing in common", async () => {
    regs.mockReturnValue([
      person("a", "Ann", "founder", ["FinTech"]),
      person("b", "Ben", "founder", ["Logistics"]),
    ]);
    expect((await loadNetworkingBoard("e1")).pairs).toEqual([]);
  });

  it("never pairs somebody with themselves, or counts a pair twice", async () => {
    regs.mockReturnValue([
      person("a", "Ann", "founder", ["FinTech"]),
      person("b", "Ivy", "investor", ["FinTech"]),
      person("c", "Cal", "investor", ["FinTech"]),
    ]);
    const b = await loadNetworkingBoard("e1");
    // 3 people → 3 unordered pairs, and investor↔investor still shares FinTech.
    expect(b.pairs).toHaveLength(3);
    expect(new Set(b.pairs.map((p) => p.key)).size).toBe(3);
  });
});

describe("how a pair is read", () => {
  it("puts the investor on the left, whichever way round the rows arrived", async () => {
    regs.mockReturnValue([
      person("a", "Ann", "founder", ["FinTech"]),
      person("b", "Ivy", "investor", ["FinTech"]),
    ]);
    const p = (await loadNetworkingBoard("e1")).pairs[0];
    expect(p.a.name).toBe("Ivy");
    expect(p.b.name).toBe("Ann");
  });

  it("ranks the strongest match first", async () => {
    regs.mockReturnValue([
      person("a", "Ann", "founder", ["FinTech"]),
      person("b", "Ivy", "investor", ["FinTech", "AI / ML"]),
      person("c", "Cal", "investor", ["Logistics"]),
    ]);
    const scores = (await loadNetworkingBoard("e1")).pairs.map((p) => p.score);
    expect(scores).toEqual([...scores].sort((x, y) => y - x));
  });
});

describe("what happened to the request", () => {
  const two = [
    person("a", "Ann", "founder", ["FinTech"]),
    person("b", "Ivy", "investor", ["FinTech"]),
  ];

  it("is 'no request' when nobody asked", async () => {
    regs.mockReturnValue(two);
    expect((await loadNetworkingBoard("e1")).pairs[0].status).toBe("none");
  });

  it("matches a request sent in either direction to the same pair", async () => {
    regs.mockReturnValue(two);
    conns.mockReturnValue([{ from_id: "b", to_id: "a", status: "accepted" }]);
    const p = (await loadNetworkingBoard("e1")).pairs[0];
    expect(p.status).toBe("accepted");
    expect(p.requestedBy).toBe("b");
  });

  it("counts the statuses for the tiles", async () => {
    regs.mockReturnValue([
      ...two,
      person("c", "Cal", "investor", ["FinTech"]),
    ]);
    conns.mockReturnValue([
      { from_id: "a", to_id: "b", status: "accepted" },
      { from_id: "a", to_id: "c", status: "requested" },
    ]);
    const b = await loadNetworkingBoard("e1");
    expect(b.counts.accepted).toBe(1);
    expect(b.counts.requested).toBe(1);
    expect(b.counts.matches).toBe(3);
  });
});

describe("an event with nobody matchable", () => {
  it("reports zero rather than failing", async () => {
    const b = await loadNetworkingBoard("e1");
    expect(b.matchable).toBe(0);
    expect(b.pairs).toEqual([]);
    expect(b.counts.matches).toBe(0);
  });
});

describe("registration is the qualifier", () => {
  it("matches a guest with no account at all", async () => {
    regs.mockReturnValue([
      { id: "r1", attendee_id: null, attendee_type: "founder", answers: { name: "Guest Founder", sectors: ["FinTech"] }, profiles: null },
      { id: "r2", attendee_id: null, attendee_type: "investor", answers: { name: "Guest Investor", sectors: ["FinTech"] }, profiles: null },
    ]);
    const b = await loadNetworkingBoard("e1");
    expect(b.matchable).toBe(2);
    expect(b.pairs).toHaveLength(1);
    expect(b.pairs[0].a.profileId).toBeNull();
  });

  it("shows no status for a pair where either side is a guest", async () => {
    regs.mockReturnValue([
      { id: "r1", attendee_id: null, attendee_type: "founder", answers: { name: "Guest", sectors: ["FinTech"] }, profiles: null },
      person("b", "Ivy", "investor", ["FinTech"]),
    ]);
    // A connection row cannot reference a registration that has no profile.
    conns.mockReturnValue([{ from_id: "b", to_id: "r1", status: "accepted" }]);
    expect((await loadNetworkingBoard("e1")).pairs[0].status).toBe("none");
  });

  it("leaves sponsors and service providers out of the pool", async () => {
    regs.mockReturnValue([
      person("a", "Ann", "founder", ["FinTech"]),
      person("s", "Sponsor Co", "sponsor", ["FinTech"]),
      person("v", "Law Firm", "service", ["FinTech"]),
    ]);
    const b = await loadNetworkingBoard("e1");
    expect(b.matchable).toBe(1);
    expect(b.registered).toBe(3);
    expect(b.pairs).toEqual([]);
  });
});

describe("the sector answer comes in more than one shape", () => {
  it("reads a founder's single `sector` string", async () => {
    regs.mockReturnValue([
      { id: "r1", attendee_id: "a", attendee_type: "founder", answers: { name: "Ann", sector: "FinTech" }, profiles: null },
      person("b", "Ivy", "investor", ["FinTech"]),
    ]);
    expect((await loadNetworkingBoard("e1")).pairs[0].sharedInterests).toEqual(["FinTech"]);
  });

  it("counts somebody who declared nothing, and still matches them on role", async () => {
    regs.mockReturnValue([
      { id: "r1", attendee_id: "a", attendee_type: "founder", answers: { name: "Ann" }, profiles: null },
      person("b", "Ivy", "investor", ["FinTech"]),
    ]);
    const b = await loadNetworkingBoard("e1");
    expect(b.withoutSectors).toBe(1);
    expect(b.pairs[0].score).toBe(3);
  });

  it("does not double-count a sector listed under both keys", async () => {
    regs.mockReturnValue([
      { id: "r1", attendee_id: "a", attendee_type: "founder", answers: { name: "Ann", sector: "FinTech", sectors: ["FinTech"] }, profiles: null },
      person("b", "Ivy", "investor", ["FinTech"]),
    ]);
    expect((await loadNetworkingBoard("e1")).pairs[0].sharedInterests).toEqual(["FinTech"]);
  });
});

describe("a room big enough to matter", () => {
  it("counts every pair but returns only the strongest, so the page stays usable", async () => {
    // 60 founders + 60 investors is 7,080 scoring pairs.
    const many = [
      ...Array.from({ length: 60 }, (_, i) => person(`f${i}`, `Founder ${i}`, "founder", ["FinTech"])),
      ...Array.from({ length: 60 }, (_, i) => person(`i${i}`, `Investor ${i}`, "investor", ["FinTech"])),
    ];
    regs.mockReturnValue(many);
    const b = await loadNetworkingBoard("e1");
    expect(b.matchable).toBe(120);
    expect(b.totalPairs).toBeGreaterThan(7000);
    expect(b.pairs.length).toBe(400);
    expect(b.counts.matches).toBe(b.totalPairs);
  });
});
