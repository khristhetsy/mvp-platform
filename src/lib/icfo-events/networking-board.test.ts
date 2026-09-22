/**
 * Every pair of opted-in attendees, scored the way the attendee-facing
 * suggestions score them — so the staff view and what a member sees can't
 * disagree about who matched whom.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const optins = vi.fn();
const conns = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createServiceRoleClient: () => ({
    from: (table: string) => ({
      select: (_cols: string, opts?: { head?: boolean }) => ({
        eq: (_c: string, _v: string) => {
          const done = () => {
            if (opts?.head) return { count: 9, error: null };
            if (table === "networking_optins") return { data: optins(), error: null };
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

const person = (id: string, name: string, role: string, interests: string[]) => ({
  profile_id: id, interests, profiles: { full_name: name, role },
});

beforeEach(() => {
  optins.mockReturnValue([]);
  conns.mockReturnValue([]);
});

describe("which pairs count as a match", () => {
  it("scores shared sectors at two apiece", async () => {
    optins.mockReturnValue([
      person("a", "Ann", "founder", ["FinTech", "AI / ML"]),
      person("b", "Ben", "founder", ["FinTech", "AI / ML"]),
    ]);
    const b = await loadNetworkingBoard("e1");
    expect(b.pairs).toHaveLength(1);
    expect(b.pairs[0].score).toBe(4);
    expect(b.pairs[0].sharedInterests.sort()).toEqual(["AI / ML", "FinTech"]);
  });

  it("adds three for a founder–investor pairing", async () => {
    optins.mockReturnValue([
      person("a", "Ann", "founder", ["FinTech"]),
      person("b", "Ivy", "investor", ["FinTech"]),
    ]);
    expect((await loadNetworkingBoard("e1")).pairs[0].score).toBe(5);
  });

  it("keeps a founder–investor pair with nothing in common", async () => {
    optins.mockReturnValue([
      person("a", "Ann", "founder", ["FinTech"]),
      person("b", "Ivy", "investor", ["Logistics"]),
    ]);
    const b = await loadNetworkingBoard("e1");
    expect(b.pairs).toHaveLength(1);
    expect(b.pairs[0].score).toBe(3);
    expect(b.pairs[0].sharedInterests).toEqual([]);
  });

  it("drops two of the same kind with nothing in common", async () => {
    optins.mockReturnValue([
      person("a", "Ann", "founder", ["FinTech"]),
      person("b", "Ben", "founder", ["Logistics"]),
    ]);
    expect((await loadNetworkingBoard("e1")).pairs).toEqual([]);
  });

  it("never pairs somebody with themselves, or counts a pair twice", async () => {
    optins.mockReturnValue([
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
    optins.mockReturnValue([
      person("a", "Ann", "founder", ["FinTech"]),
      person("b", "Ivy", "investor", ["FinTech"]),
    ]);
    const p = (await loadNetworkingBoard("e1")).pairs[0];
    expect(p.a.name).toBe("Ivy");
    expect(p.b.name).toBe("Ann");
  });

  it("ranks the strongest match first", async () => {
    optins.mockReturnValue([
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
    optins.mockReturnValue(two);
    expect((await loadNetworkingBoard("e1")).pairs[0].status).toBe("none");
  });

  it("matches a request sent in either direction to the same pair", async () => {
    optins.mockReturnValue(two);
    conns.mockReturnValue([{ from_id: "b", to_id: "a", status: "accepted" }]);
    const p = (await loadNetworkingBoard("e1")).pairs[0];
    expect(p.status).toBe("accepted");
    expect(p.requestedBy).toBe("b");
  });

  it("counts the statuses for the tiles", async () => {
    optins.mockReturnValue([
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

describe("an event nobody has opted into", () => {
  it("reports zero rather than failing", async () => {
    const b = await loadNetworkingBoard("e1");
    expect(b.optedIn).toBe(0);
    expect(b.pairs).toEqual([]);
    expect(b.counts.matches).toBe(0);
  });
});
