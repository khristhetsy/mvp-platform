import { describe, it, expect } from "vitest";
import { duplicateRoleOf } from "@/lib/icfo-events/duplicate-people";

describe("duplicateRoleOf", () => {
  it("maps the admin role options", () => {
    expect(duplicateRoleOf("Presenter")).toBe("presenters");
    expect(duplicateRoleOf("Founder showcase")).toBe("presenters");
    expect(duplicateRoleOf("Panelist")).toBe("panelists");
    expect(duplicateRoleOf("Exhibitor")).toBe("exhibitors");
    expect(duplicateRoleOf("Guest CEO")).toBe("talkShowGuests");
    expect(duplicateRoleOf("Investor")).toBe("talkShowGuests");
  });

  it("tolerates spelling and case", () => {
    expect(duplicateRoleOf("panellist")).toBe("panelists");
    expect(duplicateRoleOf("  EXHIBITORS ")).toBe("exhibitors");
    expect(duplicateRoleOf("guest-ceo")).toBe("talkShowGuests");
  });

  it("falls back to presenters for blank or unknown labels", () => {
    expect(duplicateRoleOf(null)).toBe("presenters");
    expect(duplicateRoleOf("")).toBe("presenters");
    expect(duplicateRoleOf("Keynote")).toBe("presenters");
  });
});
