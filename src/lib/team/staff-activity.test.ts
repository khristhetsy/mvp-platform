import { describe, expect, it } from "vitest";
import { humanizeAction } from "@/lib/team/staff-activity";

describe("humanizeAction", () => {
  it("makes audit actions readable", () => {
    expect(humanizeAction("team.managed_icfo_invited")).toBe("Team: managed icfo invited");
    expect(humanizeAction("billing.address_updated")).toBe("Billing: address updated");
    expect(humanizeAction("document_uploaded")).toBe("Document uploaded");
  });

  it("handles empty input", () => {
    expect(humanizeAction("")).toBe("Change");
    expect(humanizeAction(null)).toBe("Change");
    expect(humanizeAction(undefined)).toBe("Change");
  });
});
