/**
 * Who gets named.
 *
 * Registration is the qualifier: anyone registered as an investor or a founder
 * is listed, with no opt-in and no account required. An earlier version gated
 * on a consent tick, which named nobody at a 106-person event because the tick
 * postdated every registration.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const rows = vi.fn();
const failing = vi.fn(() => false);

vi.mock("@/lib/supabase/admin", () => ({
  createServiceRoleClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => Promise.resolve(
          failing() ? { data: null, error: { message: "boom" } } : { data: rows(), error: null },
        ),
      }),
    }),
  }),
}));

const { listEventAttendees } = await import("@/lib/icfo-events/attendees");

const reg = (over: Record<string, unknown> = {}) => ({
  attendee_type: "investor",
  answers: { name: "Marcus Reyes" },
  profiles: null,
  ...over,
});

beforeEach(() => { rows.mockReset(); failing.mockReturnValue(false); });

describe("registration is the qualifier", () => {
  it("names a registered investor", async () => {
    rows.mockReturnValue([reg()]);
    expect((await listEventAttendees("e1")).investors).toEqual([{ name: "Marcus Reyes", badge: "Investor" }]);
  });

  it("names them without any consent answer — the tick no longer gates", async () => {
    rows.mockReturnValue([reg({ answers: { name: "Marcus Reyes", listedPublicly: false } })]);
    expect((await listEventAttendees("e1")).investors).toHaveLength(1);
  });

  it("names a guest with no account", async () => {
    rows.mockReturnValue([reg({ answers: { name: "Guest Investor" }, profiles: null })]);
    expect((await listEventAttendees("e1")).investors[0].name).toBe("Guest Investor");
  });

  it("splits investors from founders", async () => {
    rows.mockReturnValue([
      reg({ answers: { name: "Marcus" } }),
      reg({ attendee_type: "founder", answers: { name: "Shan" } }),
    ]);
    const a = await listEventAttendees("e1");
    expect(a.investors.map((x) => x.name)).toEqual(["Marcus"]);
    expect(a.founders.map((x) => x.name)).toEqual(["Shan"]);
  });

  it("leaves sponsors and service providers out of both lists", async () => {
    rows.mockReturnValue([
      reg({ attendee_type: "sponsor", answers: { name: "Sponsor Co" } }),
      reg({ attendee_type: "service", answers: { name: "Law Firm" } }),
    ]);
    const a = await listEventAttendees("e1");
    expect(a.investors).toEqual([]);
    expect(a.founders).toEqual([]);
    // Still registered, so the headline count says so.
    expect(a.total).toBe(2);
    expect(a.unnamed).toBe(0);
  });

  it("counts everyone in the total", async () => {
    rows.mockReturnValue([reg(), reg({ attendee_type: "founder" }), reg({ attendee_type: "sponsor" })]);
    expect((await listEventAttendees("e1")).total).toBe(3);
  });
});

describe("the name shown", () => {
  it("prefers what they typed on the form", async () => {
    rows.mockReturnValue([reg({ answers: { name: "Marcus Reyes" }, profiles: { full_name: "M. Reyes" } })]);
    expect((await listEventAttendees("e1")).investors[0].name).toBe("Marcus Reyes");
  });

  it("falls back to the account name", async () => {
    rows.mockReturnValue([reg({ answers: {}, profiles: { full_name: "M. Reyes" } })]);
    expect((await listEventAttendees("e1")).investors[0].name).toBe("M. Reyes");
  });

  it("counts somebody with no name at all rather than rendering a blank chip", async () => {
    rows.mockReturnValue([reg({ answers: {}, profiles: null })]);
    const a = await listEventAttendees("e1");
    expect(a.investors).toEqual([]);
    expect(a.unnamed).toBe(1);
  });

  it("sorts alphabetically, so the order implies no ranking", async () => {
    rows.mockReturnValue([
      reg({ answers: { name: "Zoe" } }),
      reg({ answers: { name: "Aisha" } }),
    ]);
    expect((await listEventAttendees("e1")).investors.map((x) => x.name)).toEqual(["Aisha", "Zoe"]);
  });
});

describe("a failed read", () => {
  it("returns an empty list rather than throwing into the page", async () => {
    // Supabase reports a failure in `error` rather than rejecting, and the
    // page must still render — an attendee list is not worth a 500.
    failing.mockReturnValue(true);
    expect(await listEventAttendees("e1")).toEqual({ investors: [], founders: [], unnamed: 0, total: 0 });
  });
});
