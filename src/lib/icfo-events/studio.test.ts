import { describe, expect, it } from "vitest";
import { pickStudioEvent, sessionsForRoom } from "./studio";

const NOW = Date.parse("2026-12-01T00:00:00Z");
const ev = (id: string, status: string, startsAt: string | null) => ({ id, title: id, status, startsAt });

describe("pickStudioEvent", () => {
  it("returns null with no events", () => {
    expect(pickStudioEvent([], null, NOW)).toBeNull();
  });
  it("honours the requested event", () => {
    const events = [ev("a", "published", "2026-12-15T00:00:00Z"), ev("b", "published", "2027-01-15T00:00:00Z")];
    expect(pickStudioEvent(events, "b", NOW)?.id).toBe("b");
  });
  it("prefers a live event, then the next upcoming one", () => {
    const events = [ev("old", "ended", "2026-06-01T00:00:00Z"), ev("soon", "published", "2026-12-15T00:00:00Z"), ev("later", "published", "2027-02-01T00:00:00Z")];
    expect(pickStudioEvent(events, null, NOW)?.id).toBe("soon");
    expect(pickStudioEvent([...events, ev("now", "live", null)], null, NOW)?.id).toBe("now");
  });
  it("falls back to the first event when none is upcoming", () => {
    expect(pickStudioEvent([ev("old", "ended", "2026-06-01T00:00:00Z")], "missing", NOW)?.id).toBe("old");
  });
});

describe("sessionsForRoom", () => {
  const sessions = [
    { type: "keynote", status: "scheduled" },
    { type: "panel", status: "live" },
    { type: "talk_show", status: "scheduled" },
    { type: "keynote", status: "draft" },
  ];
  it("keeps talk shows in their own room", () => {
    expect(sessionsForRoom(sessions, "talk-show")).toHaveLength(1);
  });
  it("runs everything else on the main stage, without drafts", () => {
    expect(sessionsForRoom(sessions, "main-stage")).toHaveLength(2);
  });
});

import { buildStudioRulesPatch, clockFromSeconds, mapStudioRules } from "./studio";

describe("studio rules", () => {
  it("reads unset columns as null", () => {
    expect(mapStudioRules({ spotlight_break_seconds: 8 })).toEqual({ spotlightBreakSeconds: 8 });
    expect(mapStudioRules(null).spotlightBreakSeconds).toBeNull();
  });
  it("builds a patch from valid values and null to clear", () => {
    expect(buildStudioRulesPatch({ spotlightBreakSeconds: 8 })).toEqual({ patch: { spotlight_break_seconds: 8 } });
  });
  it("rejects out of range or non whole values and empty bodies", () => {
    expect(buildStudioRulesPatch({ spotlightBreakSeconds: 0 })).toHaveProperty("error");
    expect(buildStudioRulesPatch({ spotlightBreakSeconds: 61 })).toHaveProperty("error");
    expect(buildStudioRulesPatch({ spotlightBreakSeconds: 2.5 })).toHaveProperty("error");
    expect(buildStudioRulesPatch({})).toHaveProperty("error");
    expect(buildStudioRulesPatch(null)).toHaveProperty("error");
  });
  it("formats a clock", () => {
    expect(clockFromSeconds(125)).toBe("2:05");
    expect(clockFromSeconds(-3)).toBe("0:00");
  });
});
