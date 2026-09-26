import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createServiceRoleClient: () => ({}) }));
vi.mock("@/lib/founder-outreach/deliver-reach-out", () => ({ deliverReachOut: vi.fn() }));

import { validSendAt } from "@/lib/founder-outreach/scheduled-reach-outs";

const now = new Date("2026-09-26T10:00:00Z");

describe("scheduling a reach out email", () => {
  it("accepts a time in the future within a year", () => {
    expect(validSendAt("2026-09-28T13:00:00Z", now)).toBeNull();
  });
  it("asks for a date and time when missing or unreadable", () => {
    expect(validSendAt("", now)).toBe("Pick a date and time first.");
    expect(validSendAt("not a date", now)).toBe("Pick a date and time first.");
  });
  it("refuses the past and less than a minute ahead", () => {
    expect(validSendAt("2026-09-26T09:00:00Z", now)).toBe("Pick a time in the future.");
    expect(validSendAt("2026-09-26T10:00:30Z", now)).toBe("Pick a time in the future.");
  });
  it("refuses more than a year ahead", () => {
    expect(validSendAt("2027-10-30T10:00:00Z", now)).toBe("Pick a time within the next year.");
  });
});
