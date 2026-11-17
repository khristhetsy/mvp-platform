/**
 * The founder hears where they stand.
 */
import { describe, it, expect } from "vitest";
import { acceptedCount, summarizeByFounder, type StatusInput } from "@/lib/icfo-events/founder-status";
import { founderStatusHtml, founderStatusSubject } from "@/lib/icfo-events/introduction-emails";

const row = (id: string, status: string, scheduledAt: string | null = null, founderRegId = "f1"): StatusInput => ({
  id, founderRegId, investorRegId: `inv-${id}`, status, scheduledAt,
});

describe("summarizing one founder's introductions", () => {
  const s = summarizeByFounder([
    row("1", "sent"), row("2", "sent"), row("3", "accepted"),
    row("4", "accepted", "2026-11-17T20:00:00Z"), row("5", "declined"),
    row("6", "sent", null, "f2"),
  ]);

  it("counts each status", () => {
    const f = s.get("f1")!;
    expect(f.introduced).toBe(5);
    expect(f.awaiting).toBe(2);
    expect(f.declined).toBe(1);
    expect(f.needsTime.map((r) => r.id)).toEqual(["3"]);
    expect(f.scheduled.map((r) => r.id)).toEqual(["4"]);
    expect(acceptedCount(f)).toBe(2);
  });

  it("keeps founders apart", () => {
    expect(s.get("f2")!.introduced).toBe(1);
  });
});

const html = founderStatusHtml({
  founderName: "Todd Bertsch",
  eventTitle: "iCFO PE Expo",
  introduced: 100,
  awaiting: 95,
  declined: 2,
  needsTime: [{ name: "Andrew Hong", company: "Hennessy Capital", scheduleUrl: "https://icapos.com/e/intro/schedule/tok-1" }],
  scheduled: [{ name: "Maya Trujillo", company: null, when: "Nov 17, 9:00 PM" }],
});

describe("the founder status email", () => {
  it("puts the counts in the subject", () => {
    expect(founderStatusSubject({ eventTitle: "iCFO PE Expo", accepted: 3, awaiting: 95 }))
      .toBe("Your introductions at iCFO PE Expo: 3 accepted, 95 waiting");
  });

  it("gives each accepted investor a set-the-time link", () => {
    expect(html).toContain("Andrew Hong");
    expect(html).toContain("https://icapos.com/e/intro/schedule/tok-1");
  });

  it("shows who has a time", () => {
    expect(html).toContain("Maya Trujillo");
    expect(html).toContain("Nov 17, 9:00 PM");
  });

  it("counts waiting and declined investors without naming them", () => {
    expect(html).toContain("95");
    expect(html).toContain("not now");
    expect(html).toContain("counted, not named");
  });

  it("escapes what investors typed", () => {
    const bad = founderStatusHtml({
      founderName: "Todd", eventTitle: "E", introduced: 1, awaiting: 0, declined: 0,
      needsTime: [{ name: "<b>Bad</b>", company: null, scheduleUrl: "https://icapos.com/x" }], scheduled: [],
    });
    expect(bad).not.toContain("<b>Bad</b>");
    expect(bad).toContain("&lt;b&gt;Bad&lt;/b&gt;");
  });
});
