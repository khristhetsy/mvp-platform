import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ acting: null as { founderId: string; staffId: string } | null }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/admin/act-on-behalf", () => ({ getActingContext: async () => state.acting }));

import { resolveGoogleCalendarOwnerId } from "./google-calendar-owner";

describe("resolveGoogleCalendarOwnerId", () => {
  beforeEach(() => {
    state.acting = null;
  });

  it("uses the signed in user when nobody is acting", async () => {
    expect(await resolveGoogleCalendarOwnerId("founder-1")).toBe("founder-1");
  });

  it("uses the founder, not the staff member, while acting as a founder", async () => {
    state.acting = { founderId: "founder-1", staffId: "staff-1" };
    expect(await resolveGoogleCalendarOwnerId("staff-1")).toBe("founder-1");
  });
});
