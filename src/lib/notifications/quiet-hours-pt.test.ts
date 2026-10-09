import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ createServiceRoleClient: vi.fn() }));

import { DEFAULT_PREFS, isQuietNow } from "./preferences";

// Oct 9, 2026 01:06 UTC is Oct 8, 6:06 PM PT: the moment a real payment alert
// was muted because quiet hours were read in UTC instead of PT.
const PAYMENT_MOMENT = new Date("2026-10-09T01:06:00Z");

describe("quiet hours with no saved time zone", () => {
  it("are read in Pacific time, not UTC", () => {
    expect(isQuietNow({ ...DEFAULT_PREFS, timezone: null }, PAYMENT_MOMENT)).toBe(false);
  });

  it("still mute inside the PT window (10 PM PT)", () => {
    expect(isQuietNow({ ...DEFAULT_PREFS, timezone: null }, new Date("2026-10-09T05:00:00Z"))).toBe(true);
  });

  it("use a saved zone when there is one", () => {
    // 01:06 UTC is 03:06 in Paris, inside 8 PM to 7 AM there.
    expect(isQuietNow({ ...DEFAULT_PREFS, timezone: "Europe/Paris" }, PAYMENT_MOMENT)).toBe(true);
  });
});

describe("payment alert email", () => {
  it("sends during quiet hours because it is critical, signup does not", async () => {
    const { createServiceRoleClient } = await import("@/lib/supabase/admin");
    const row = { ...DEFAULT_PREFS, quiet_start: "20:00", quiet_end: "07:00", timezone: "America/Los_Angeles" };
    vi.mocked(createServiceRoleClient).mockReturnValue({
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row }) }) }) }),
    } as never);
    const { shouldSendEmail } = await import("./preferences");
    const tenPmPt = new Date("2026-10-09T05:00:00Z");
    expect(await shouldSendEmail("u1", "staff_new_founder_payment", "critical", tenPmPt)).toBe(true);
    expect(await shouldSendEmail("u1", "staff_new_founder_signup", null, tenPmPt)).toBe(false);
  });
});
