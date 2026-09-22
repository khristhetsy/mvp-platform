/**
 * Who may be named.
 *
 * The rule is a consent rule, so it is tested as one: nobody is listed without
 * the tick, the people who registered before the tick existed are private by
 * default, and a viewer who is in the room sees everyone.
 *
 * The Supabase client is mocked because the decision being tested is ours, not
 * the database's — the query is a plain select either way.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const rows = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createServiceRoleClient: () => ({
    from: () => ({
      select: () => ({
        eq: (_c: string, _v: string) => {
          const res = { data: rows(), error: null };
          // `.eq()` is both the terminal call (attendee list) and chainable
          // (registration check), so it resolves and chains.
          return Object.assign(Promise.resolve(res), {
            eq: () => ({ maybeSingle: () => Promise.resolve({ data: rows()[0] ?? null, error: null }) }),
          });
        },
      }),
    }),
  }),
}));

const { listEventAttendees, isRegisteredFor } = await import("@/lib/icfo-events/attendees");

const reg = (over: Record<string, unknown> = {}) => ({
  attendee_type: "investor",
  answers: { name: "Marcus Reyes", listedPublicly: true },
  profiles: null,
  ...over,
});

beforeEach(() => rows.mockReset());

describe("nobody is listed without the tick", () => {
  it("names someone who opted in", async () => {
    rows.mockReturnValue([reg()]);
    const a = await listEventAttendees("e1");
    expect(a.investors).toEqual([{ name: "Marcus Reyes", badge: "Investor" }]);
    expect(a.privateInvestors).toBe(0);
  });

  it("counts, but does not name, someone who did not", async () => {
    rows.mockReturnValue([reg({ answers: { name: "Marcus Reyes", listedPublicly: false } })]);
    const a = await listEventAttendees("e1");
    expect(a.investors).toEqual([]);
    expect(a.privateInvestors).toBe(1);
  });

  it("treats a registration from before the question as private", async () => {
    // No `listedPublicly` key at all — they were never asked.
    rows.mockReturnValue([reg({ answers: { name: "Marcus Reyes" } })]);
    const a = await listEventAttendees("e1");
    expect(a.investors).toEqual([]);
    expect(a.privateInvestors).toBe(1);
  });

  it("does not take a truthy string as consent", async () => {
    rows.mockReturnValue([reg({ answers: { name: "M", listedPublicly: "no" } })]);
    expect((await listEventAttendees("e1")).investors).toEqual([]);
  });
});

describe("a viewer already in the room sees everyone", () => {
  it("names the private ones for a registered viewer", async () => {
    rows.mockReturnValue([reg({ answers: { name: "Quiet Investor", listedPublicly: false } })]);
    const a = await listEventAttendees("e1", { viewerIsRegistered: true });
    expect(a.investors).toEqual([{ name: "Quiet Investor", badge: "Investor" }]);
    expect(a.privateInvestors).toBe(0);
  });
});

describe("who gets a badge at all", () => {
  it("splits investors from founders", async () => {
    rows.mockReturnValue([
      reg({ answers: { name: "Marcus", listedPublicly: true } }),
      reg({ attendee_type: "founder", answers: { name: "Shan", listedPublicly: true } }),
    ]);
    const a = await listEventAttendees("e1");
    expect(a.investors.map((x) => x.name)).toEqual(["Marcus"]);
    expect(a.founders.map((x) => x.name)).toEqual(["Shan"]);
  });

  it("leaves sponsors and service providers out entirely — not even counted as private", async () => {
    rows.mockReturnValue([
      reg({ attendee_type: "sponsor", answers: { name: "Sponsor Co", listedPublicly: true } }),
      reg({ attendee_type: "service", answers: { name: "Law Firm", listedPublicly: true } }),
    ]);
    const a = await listEventAttendees("e1");
    expect(a.investors).toEqual([]);
    expect(a.founders).toEqual([]);
    expect(a.privateInvestors + a.privateFounders).toBe(0);
    // They are still registered, and the headline count says so.
    expect(a.total).toBe(2);
  });

  it("counts everyone in the total, listed or not", async () => {
    rows.mockReturnValue([
      reg({ answers: { name: "A", listedPublicly: true } }),
      reg({ answers: { name: "B", listedPublicly: false } }),
      reg({ attendee_type: "sponsor", answers: {} }),
    ]);
    expect((await listEventAttendees("e1")).total).toBe(3);
  });
});

describe("the name shown", () => {
  it("prefers what they typed on the form", async () => {
    rows.mockReturnValue([reg({ answers: { name: "Marcus Reyes", listedPublicly: true }, profiles: { full_name: "M. Reyes" } })]);
    expect((await listEventAttendees("e1")).investors[0].name).toBe("Marcus Reyes");
  });

  it("falls back to the account name", async () => {
    rows.mockReturnValue([reg({ answers: { listedPublicly: true }, profiles: { full_name: "M. Reyes" } })]);
    expect((await listEventAttendees("e1")).investors[0].name).toBe("M. Reyes");
  });

  it("counts as private when there is no name to show — a blank chip is worse", async () => {
    rows.mockReturnValue([reg({ answers: { listedPublicly: true }, profiles: null })]);
    const a = await listEventAttendees("e1");
    expect(a.investors).toEqual([]);
    expect(a.privateInvestors).toBe(1);
  });

  it("sorts alphabetically, so the list has no implied ranking", async () => {
    rows.mockReturnValue([
      reg({ answers: { name: "Zoe", listedPublicly: true } }),
      reg({ answers: { name: "Aisha", listedPublicly: true } }),
    ]);
    expect((await listEventAttendees("e1")).investors.map((x) => x.name)).toEqual(["Aisha", "Zoe"]);
  });
});

describe("registration check", () => {
  it("is false without a signed-in profile, without querying", async () => {
    expect(await isRegisteredFor("e1", null)).toBe(false);
    expect(rows).not.toHaveBeenCalled();
  });

  it("is true when a row comes back", async () => {
    rows.mockReturnValue([{ id: "r1" }]);
    expect(await isRegisteredFor("e1", "p1")).toBe(true);
  });
});
