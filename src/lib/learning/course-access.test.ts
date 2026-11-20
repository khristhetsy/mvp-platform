import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ createServiceRoleClient: () => ({}) }));

import { mayTakeCourse } from "@/lib/learning/course-access";

describe("invitation only courses", () => {
  it("an open course is open to everyone, including a signed out reader", async () => {
    expect(await mayTakeCourse({ id: "p1", access_mode: "open" }, "u1")).toBe(true);
    expect(await mayTakeCourse({ id: "p1" }, null)).toBe(true);
  });
});
