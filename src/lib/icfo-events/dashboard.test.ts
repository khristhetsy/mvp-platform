import { describe, expect, it } from "vitest";
import { buildEventsDashboard } from "./dashboard";

const now = new Date("2026-11-25T12:00:00Z");
const base = { registrations: [], applications: [], sponsorEventIds: [], campaigns: [], invitations: [], now };

describe("buildEventsDashboard", () => {
  it("flags drafts whose date has passed and finds the next live event", () => {
    const d = buildEventsDashboard({
      ...base,
      events: [
        { id: "a", title: "Paris", status: "published", startsAt: "2026-12-15T09:00:00Z" },
        { id: "b", title: "Singapore", status: "draft", startsAt: "2026-11-17T09:00:00Z" },
      ],
    });
    expect(d.totals.draftsPastDate).toBe(1);
    expect(d.totals.published).toBe(1);
    expect(d.nextEvent).toMatchObject({ id: "a", daysAway: 20 });
    expect(d.attention.some((a) => a.tone === "bad")).toBe(true);
  });

  it("counts registrations by status and keeps attended as a subset", () => {
    const d = buildEventsDashboard({
      ...base,
      events: [{ id: "a", title: "Paris", status: "ended", startsAt: "2026-11-01T09:00:00Z" }],
      registrations: [
        { event_id: "a", status: "attended" },
        { event_id: "a", status: "no_show" },
        { event_id: "a", status: "registered" },
      ],
    });
    expect(d.rows[0]).toMatchObject({ registered: 3, attended: 1, noShow: 1 });
    expect(d.totals.registrations).toBe(3);
  });

  it("tallies applications, campaigns and invitations per event", () => {
    const d = buildEventsDashboard({
      ...base,
      events: [{ id: "a", title: "Paris", status: "published", startsAt: "2026-12-15T09:00:00Z" }],
      applications: [
        { event_id: "a", status: "submitted" },
        { event_id: "a", status: "under_review" },
        { event_id: "a", status: "approved" },
      ],
      campaigns: [{ id: "c1", status: "paused", event_ids: ["a"] }],
      invitations: [{ campaign_id: "c1" }, { campaign_id: "c1" }],
    });
    expect(d.totals).toMatchObject({ applicationsSubmitted: 1, applicationsUnderReview: 1, applicationsOpen: 2 });
    expect(d.campaigns.paused).toBe(1);
    expect(d.invitedByEvent.a).toBe(2);
  });

  it("returns no next event and no attention items for an empty dataset", () => {
    const d = buildEventsDashboard({ ...base, events: [] });
    expect(d.nextEvent).toBeNull();
    expect(d.attention).toEqual([]);
  });
});
