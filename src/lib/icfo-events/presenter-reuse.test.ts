import { describe, it, expect } from "vitest";
import {
  copyFrom,
  filterCandidates,
  personKey,
  reuseCandidates,
} from "@/lib/icfo-events/presenter-reuse";
import type { EventPresenter } from "@/lib/icfo-events/types";

const NEWPORT = "11111111-1111-1111-1111-111111111111";
const MIAMI = "22222222-2222-2222-2222-222222222222";
const VEGAS = "33333333-3333-3333-3333-333333333333";

let n = 0;
function p(over: Partial<EventPresenter> = {}): EventPresenter {
  n += 1;
  return {
    id: `row-${n}`,
    eventId: NEWPORT,
    sessionId: null,
    applicationId: null,
    profileId: null,
    displayName: `Person ${n}`,
    roleLabel: "Presenter",
    headshotPath: null,
    headline: null,
    bio: null,
    links: [],
    position: 0,
    companySummary: null,
    meetingUrl: null,
    startsAt: null,
    timezone: null,
    email: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    eventTitle: "iCFO PE Expo — Newport Beach",
    ...over,
  };
}

describe("identifying the same person across events", () => {
  it("prefers the account over anything typed by hand", () => {
    const a = p({ profileId: "acct-1", email: "bob@old.com", displayName: "Bob Wood" });
    const b = p({ profileId: "acct-1", email: "bob@new.com", displayName: "Robert Wood" });
    expect(personKey(a)).toBe(personKey(b));
  });

  it("falls back to email, ignoring case and stray spacing", () => {
    expect(personKey(p({ email: " Bob@Scriptive.com " }))).toBe(personKey(p({ email: "bob@scriptive.com" })));
  });

  it("falls back to name only when there is nothing better", () => {
    expect(personKey(p({ displayName: "Shan  Padda" }))).toBe(personKey(p({ displayName: "shan padda" })));
  });

  it("does not merge two people who share a name but have different emails", () => {
    const a = p({ displayName: "John Smith", email: "john@a.com" });
    const b = p({ displayName: "John Smith", email: "john@b.com" });
    expect(personKey(a)).not.toBe(personKey(b));
  });
});

describe("building the reuse list", () => {
  it("collapses one person's several appearances into a single entry", () => {
    const rows = [
      p({ email: "jamie@clearpool.io", eventId: NEWPORT, createdAt: "2026-08-01T00:00:00Z" }),
      p({ email: "jamie@clearpool.io", eventId: MIAMI, createdAt: "2026-03-01T00:00:00Z" }),
    ];
    const out = reuseCandidates(rows, VEGAS);
    expect(out).toHaveLength(1);
    expect(out[0].appearances).toBe(2);
  });

  it("copies from their most recent appearance", () => {
    const rows = [
      p({ email: "j@x.com", eventId: MIAMI, headline: "Old talk", createdAt: "2026-03-01T00:00:00Z" }),
      p({ email: "j@x.com", eventId: NEWPORT, headline: "Recent talk", createdAt: "2026-08-01T00:00:00Z" }),
    ];
    expect(reuseCandidates(rows, VEGAS)[0].source.headline).toBe("Recent talk");
  });

  it("marks someone already on the target, and keeps them visible", () => {
    const rows = [
      p({ email: "tyler@rev5.com", eventId: NEWPORT }),
      p({ email: "tyler@rev5.com", eventId: VEGAS }),
    ];
    const out = reuseCandidates(rows, VEGAS);
    expect(out).toHaveLength(1);
    expect(out[0].onTarget).toBe(true);
  });

  it("omits someone who only exists on the target — there is nothing to copy", () => {
    expect(reuseCandidates([p({ email: "only@vegas.com", eventId: VEGAS })], VEGAS)).toEqual([]);
  });

  it("never offers a row belonging to the target event as a source", () => {
    const rows = [p({ email: "a@x.com", eventId: VEGAS }), p({ email: "b@x.com", eventId: NEWPORT })];
    for (const c of reuseCandidates(rows, VEGAS)) {
      expect(c.source.eventId).not.toBe(VEGAS);
    }
  });

  it("puts the selectable people first", () => {
    const rows = [
      p({ email: "here@x.com", eventId: NEWPORT }),
      p({ email: "here@x.com", eventId: VEGAS }),
      p({ email: "free@x.com", eventId: NEWPORT }),
    ];
    expect(reuseCandidates(rows, VEGAS)[0].onTarget).toBe(false);
  });
});

describe("the picker's filters", () => {
  const list = reuseCandidates(
    [
      p({ email: "jamie@clearpool.io", displayName: "Dr. Jamie Allsop", headline: "ClearPool Digital", roleLabel: "Presenter", eventId: NEWPORT }),
      p({ email: "shan@harvardmedtech.com", displayName: "Shan Padda", headline: "Harvard MedTech", roleLabel: "Founder showcase", eventId: MIAMI, eventTitle: "iCFO PE Expo — Miami" }),
    ],
    VEGAS,
  );

  it("searches the name", () => {
    expect(filterCandidates(list, { q: "padda" }).map((c) => c.source.displayName)).toEqual(["Shan Padda"]);
  });

  it("searches the topic, not just the name", () => {
    expect(filterCandidates(list, { q: "clearpool" })).toHaveLength(1);
  });

  it("searches the email", () => {
    expect(filterCandidates(list, { q: "harvardmedtech" })).toHaveLength(1);
  });

  it("narrows by the event they came from", () => {
    expect(filterCandidates(list, { fromEventId: MIAMI })).toHaveLength(1);
  });

  it("narrows by role", () => {
    expect(filterCandidates(list, { role: "Founder showcase" })).toHaveLength(1);
  });
});

describe("what a copy carries", () => {
  const source = p({
    profileId: "acct-9",
    displayName: "Bob Wood",
    email: "bob@scriptive.com",
    roleLabel: "Presenter",
    headline: "Scriptive",
    bio: "Twenty years in health IT.",
    companySummary: "Seed-stage clinical tooling.",
    links: ["https://scriptive.com"],
    headshotPath: "headshots/bob.jpg",
    sessionId: "sess-1",
    startsAt: "2026-08-25T20:10:00Z",
    timezone: "America/Los_Angeles",
    meetingUrl: "https://meet.google.com/abc-defg-hij",
    applicationId: "app-1",
  });

  it("carries who they are", () => {
    const c = copyFrom(source, { keepBio: true, keepHeadline: false });
    expect(c).toMatchObject({
      profileId: "acct-9",
      displayName: "Bob Wood",
      email: "bob@scriptive.com",
      roleLabel: "Presenter",
      links: ["https://scriptive.com"],
      headshotPath: "headshots/bob.jpg",
    });
  });

  it("leaves the talk topic behind unless asked — it described that talk", () => {
    expect(copyFrom(source, { keepBio: true, keepHeadline: false }).headline).toBeNull();
    expect(copyFrom(source, { keepBio: true, keepHeadline: true }).headline).toBe("Scriptive");
  });

  it("drops bio and company summary together when unticked", () => {
    const c = copyFrom(source, { keepBio: false, keepHeadline: false });
    expect(c.bio).toBeNull();
    expect(c.companySummary).toBeNull();
  });

  it("never carries the old event's slot — a copied Meet room would be dead", () => {
    const c = copyFrom(source, { keepBio: true, keepHeadline: true }) as Record<string, unknown>;
    for (const k of ["sessionId", "startsAt", "timezone", "meetingUrl", "applicationId"]) {
      expect(c[k], k).toBeUndefined();
    }
  });
});
