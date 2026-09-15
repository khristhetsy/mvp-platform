import { describe, it, expect } from "vitest";
import { periodRange, bucketStarts, bucketIndex, rollup, type EventRow } from "./followup-analytics";

const NOW = new Date("2026-09-15T12:00:00Z");
const iso = (d: string) => new Date(d).toISOString();

describe("periodRange", () => {
  it("30d ends now and the previous period sits right before it", () => {
    const { cur, cmp } = periodRange("30d", NOW, "prev");
    expect(cur.end.toISOString()).toBe(NOW.toISOString());
    expect((cur.end.getTime() - cur.start.getTime()) / 86_400_000).toBe(30);
    expect(cmp.end.toISOString()).toBe(cur.start.toISOString());
    expect((cmp.end.getTime() - cmp.start.getTime()) / 86_400_000).toBe(30);
  });
  it("yoy shifts the same window back one year", () => {
    const { cur, cmp } = periodRange("week", NOW, "yoy");
    expect(cmp.start.getFullYear()).toBe(cur.start.getFullYear() - 1);
    expect(cmp.start.getMonth()).toBe(cur.start.getMonth());
    expect(cmp.start.getDate()).toBe(cur.start.getDate());
  });
});

describe("buckets", () => {
  it("daily for week/30d, weekly for quarter/year", () => {
    expect(bucketStarts("week", periodRange("week", NOW, "prev").cur)).toHaveLength(7);
    expect(bucketStarts("30d", periodRange("30d", NOW, "prev").cur)).toHaveLength(30);
    expect(bucketStarts("quarter", periodRange("quarter", NOW, "prev").cur)).toHaveLength(13);
    expect(bucketStarts("year", periodRange("year", NOW, "prev").cur).length).toBeGreaterThanOrEqual(52);
  });
  it("bucketIndex is -1 outside the range", () => {
    const { cur } = periodRange("week", NOW, "prev");
    expect(bucketIndex("week", cur, new Date(cur.start.getTime() + 1))).toBe(0);
    expect(bucketIndex("week", cur, new Date(cur.start.getTime() - 1))).toBe(-1);
    expect(bucketIndex("week", cur, cur.end)).toBe(-1);
  });
});

describe("rollup", () => {
  const { cur } = periodRange("30d", NOW, "prev");
  const seqA = "a-seq", seqB = "b-seq";
  const ev = (over: Partial<EventRow>): EventRow => ({ sequence_id: seqA, step_id: "s1", campaign_id: null, contact_id: "c1", email: "one@x.com", event_type: "sent", occurred_at: iso("2026-09-10T10:00:00Z"), ...over });
  const input = {
    sequences: [{ id: seqA, name: "Pending follow up" }, { id: seqB, name: "Qualified" }],
    events: [
      ev({}), ev({ contact_id: "c2", email: "two@x.com" }), ev({ sequence_id: seqB, contact_id: "c3", email: "three@x.com", step_id: "s9" }),
      ev({ event_type: "opened", occurred_at: iso("2026-09-10T11:00:00Z") }),
      ev({ event_type: "opened", occurred_at: iso("2026-09-10T12:00:00Z") }),          // same contact+step: counted once
      ev({ event_type: "replied", occurred_at: iso("2026-09-11T09:00:00Z") }),
      ev({ contact_id: "c0", email: "old@x.com", occurred_at: iso("2026-07-01T00:00:00Z") }),  // before the period: not counted, but attributable
    ],
    enrollments: [
      { sequence_id: seqA, contact_id: "c1", status: "active", enrolled_at: iso("2026-09-09T00:00:00Z") },
      { sequence_id: seqA, contact_id: "c2", status: "completed", enrolled_at: iso("2026-09-09T00:00:00Z") },
      { sequence_id: seqB, contact_id: "c3", status: "active", enrolled_at: iso("2026-09-09T00:00:00Z") },
      { sequence_id: seqB, contact_id: "c4", status: "active", enrolled_at: iso("2026-06-01T00:00:00Z") },   // outside period
    ],
    bookings: [
      { booker_email: "One@X.com", created_at: iso("2026-09-12T00:00:00Z"), status: "confirmed" },           // after the send → counted
      { booker_email: "two@x.com", created_at: iso("2026-09-12T00:00:00Z"), status: "cancelled" },           // cancelled → no
      { booker_email: "nobody@x.com", created_at: iso("2026-09-12T00:00:00Z"), status: "confirmed" },        // never emailed → no
    ],
    won: [
      { contact_email: "one@x.com", value_cents: 100000, updated_at: iso("2026-09-13T00:00:00Z") },
      { contact_email: "three@x.com", value_cents: 50000, updated_at: iso("2026-09-01T00:00:00Z") },        // won BEFORE the send → not attributed
    ],
  };
  const r = rollup("30d", cur, input);

  it("totals: sent, unique opens/replies, enrolled, meetings, won, rates", () => {
    expect(r.totals.sent).toBe(3);
    expect(r.totals.opened).toBe(1);
    expect(r.totals.replied).toBe(1);
    expect(r.totals.enrolled).toBe(3);
    expect(r.totals.meetings).toBe(1);
    expect(r.totals.won).toBe(1);
    expect(r.totals.wonCents).toBe(100000);
    expect(r.totals.openPct).toBe(33.3);
    expect(r.totals.replyPct).toBe(33.3);
    expect(r.totals.conversionPct).toBe(33.3);
  });
  it("per-sequence rows attribute meetings and wins to the sequence that emailed the address", () => {
    const a = r.sequences.find((s) => s.id === seqA)!, b = r.sequences.find((s) => s.id === seqB)!;
    expect(a).toMatchObject({ name: "Pending follow up", enrolled: 2, sent: 2, opened: 1, replied: 1, meetings: 1, won: 1, conversionPct: 50 });
    expect(b).toMatchObject({ enrolled: 1, sent: 1, opened: 0, replied: 0, meetings: 0, won: 0, conversionPct: 0 });
  });
  it("series has one cell per day and lands events in the right day", () => {
    expect(r.series.labels).toHaveLength(30);
    expect(r.series.sent.reduce((a, b) => a + b, 0)).toBe(3);
    const i = bucketIndex("30d", cur, new Date("2026-09-10T10:00:00Z"));
    expect(r.series.sent[i]).toBe(3);
    expect(r.series.won.reduce((a, b) => a + b, 0)).toBe(1);
  });
});
