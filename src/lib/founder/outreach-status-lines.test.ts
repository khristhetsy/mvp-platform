import { describe, expect, it } from "vitest";
import { EMPTY_OUTREACH_STATUS, manualResultsLine, type OutreachStatus } from "@/lib/founder/outreach-status-lines";

describe("manualResultsLine", () => {
  const withManual = (manual: OutreachStatus["manual"]): OutreachStatus => ({ ...EMPTY_OUTREACH_STATUS, manual });

  it("shows only sent when nothing was opened or replied", () => {
    expect(manualResultsLine(withManual({ sent: 2, started: true }))).toBe("2 sent");
  });

  it("adds opened and replied when present", () => {
    expect(manualResultsLine(withManual({ sent: 8, started: true, opened: 3, replied: 1 }))).toBe("8 sent, 3 opened, 1 replied");
  });

  it("leaves out zero counts", () => {
    expect(manualResultsLine(withManual({ sent: 5, started: true, opened: 0, replied: 2 }))).toBe("5 sent, 2 replied");
  });
});
