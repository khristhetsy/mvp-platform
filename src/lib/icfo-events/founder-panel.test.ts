/**
 * The admin panel's "last emailed" text.
 */
import { describe, it, expect } from "vitest";
import { formatEmailedAt } from "@/lib/icfo-events/founder-status";

describe("last emailed", () => {
  it("says never when nobody has been emailed", () => {
    expect(formatEmailedAt(null)).toBe("Never");
    expect(formatEmailedAt("not a date")).toBe("Never");
  });

  it("prints a fixed zone, so the server and the browser agree", () => {
    const text = formatEmailedAt("2026-11-18T00:30:00Z");
    expect(text).toContain("Nov 18");
    expect(text.endsWith("UTC")).toBe(true);
  });
});
