import { describe, it, expect } from "vitest";
import { founderTime, parisTime } from "@/components/admin/ReachOutEmailViewer";

describe("scheduled email times", () => {
  const iso = "2026-09-28T13:00:00Z"; // 15:00 in Paris
  it("shows Paris time", () => {
    expect(parisTime(iso)).toBe("Mon 28 Sept, 15:00");
  });
  it("shows the founder's time when their zone is known", () => {
    expect(founderTime(iso, { abbr: "ET", iana: "America/New_York" })).toBe("9:00 AM ET");
    expect(founderTime(iso, { abbr: "PT", iana: "America/Los_Angeles" })).toBe("6:00 AM PT");
    expect(founderTime(iso, null)).toBeNull();
  });
});
