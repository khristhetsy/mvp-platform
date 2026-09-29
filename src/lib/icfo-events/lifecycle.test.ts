import { describe, it, expect } from "vitest";
import { effectiveStatus, isPastDraft } from "@/lib/icfo-events/lifecycle";

const NOW = Date.parse("2026-09-24T12:00:00Z");
const PAST = "2026-08-25T18:00:00Z";
const FUTURE = "2026-10-20T18:00:00Z";

describe("effectiveStatus", () => {
  it("ends a published or live event once its end passes", () => {
    expect(effectiveStatus({ status: "published", startsAt: PAST, endsAt: null }, NOW)).toBe("ended");
    expect(effectiveStatus({ status: "live", startsAt: FUTURE, endsAt: PAST }, NOW)).toBe("ended");
  });
  it("prefers endsAt over startsAt", () => {
    expect(effectiveStatus({ status: "published", startsAt: PAST, endsAt: FUTURE }, NOW)).toBe("published");
  });
  it("keeps upcoming and undated events as stored", () => {
    expect(effectiveStatus({ status: "published", startsAt: FUTURE, endsAt: null }, NOW)).toBe("published");
    expect(effectiveStatus({ status: "published", startsAt: null, endsAt: null }, NOW)).toBe("published");
  });
  it("never promotes drafts or archived events", () => {
    expect(effectiveStatus({ status: "draft", startsAt: PAST, endsAt: null }, NOW)).toBe("draft");
    expect(effectiveStatus({ status: "archived", startsAt: PAST, endsAt: null }, NOW)).toBe("archived");
  });
});

describe("isPastDraft", () => {
  it("flags only drafts whose date has passed", () => {
    expect(isPastDraft({ status: "draft", startsAt: PAST, endsAt: null }, NOW)).toBe(true);
    expect(isPastDraft({ status: "draft", startsAt: FUTURE, endsAt: null }, NOW)).toBe(false);
    expect(isPastDraft({ status: "draft", startsAt: null, endsAt: null }, NOW)).toBe(false);
    expect(isPastDraft({ status: "published", startsAt: PAST, endsAt: null }, NOW)).toBe(false);
  });
});
