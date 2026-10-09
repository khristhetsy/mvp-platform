import { describe, expect, it } from "vitest";
import { welcomeLetterChip } from "./welcome-letter-chip";

const base = { sentAt: "2026-10-09T01:06:00Z", status: "sent", deliveredAt: null, openedAt: null, clickedAt: null, bouncedAt: null };

describe("welcome letter chip", () => {
  it("shows nothing when no letter was sent", () => {
    expect(welcomeLetterChip(null)).toBeNull();
  });
  it("shows the furthest tracked state in PT", () => {
    expect(welcomeLetterChip(base)).toEqual({ label: "Welcome letter: sent Oct 8, 6:06 PM PT", tone: "neutral" });
    expect(welcomeLetterChip({ ...base, deliveredAt: "2026-10-09T01:06:05Z" })?.tone).toBe("info");
    expect(welcomeLetterChip({ ...base, deliveredAt: "x", openedAt: "2026-10-09T01:41:00Z" })?.label).toBe("Welcome letter: opened Oct 8, 6:41 PM PT");
    expect(welcomeLetterChip({ ...base, openedAt: "2026-10-09T01:41:00Z", clickedAt: "2026-10-09T01:42:00Z" })?.label).toBe("Welcome letter: clicked Oct 8, 6:42 PM PT");
    expect(welcomeLetterChip({ ...base, bouncedAt: "2026-10-09T01:07:00Z" })?.tone).toBe("danger");
    expect(welcomeLetterChip({ ...base, status: "failed" })?.tone).toBe("danger");
  });
});
