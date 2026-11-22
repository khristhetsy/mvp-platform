import { describe, it, expect, vi, beforeEach } from "vitest";

const single = vi.fn();
const insert = vi.fn(() => ({ select: () => ({ single }) }));
vi.mock("@/lib/supabase/admin", () => ({
  createServiceRoleClient: () => ({ from: () => ({ insert }) }),
}));

import { claimBookingSlot } from "./bookings";

const slot = {
  host_id: "h1", start_time: "2026-12-01T10:00:00Z", end_time: "2026-12-01T10:30:00Z",
  timezone: "UTC", event_type: "Intro", booker_name: "A", booker_email: "a@x.com",
};

describe("claimBookingSlot", () => {
  beforeEach(() => { single.mockReset(); insert.mockClear(); });

  it("returns the new booking id when the slot is free", async () => {
    single.mockResolvedValue({ data: { id: "b1" }, error: null });
    await expect(claimBookingSlot(slot)).resolves.toBe("b1");
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ host_id: "h1", status: "confirmed" }));
  });

  it("throws the slot taken message on a unique violation", async () => {
    single.mockResolvedValue({ data: null, error: { code: "23505" } });
    await expect(claimBookingSlot(slot)).rejects.toThrow("That time is no longer available.");
  });

  it("returns null on any other database error so booking is not blocked", async () => {
    single.mockResolvedValue({ data: null, error: { code: "08006" } });
    await expect(claimBookingSlot(slot)).resolves.toBeNull();
  });
});
