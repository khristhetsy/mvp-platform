import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ createServiceRoleClient: vi.fn() }));
vi.mock("@/lib/notifications/notifications", () => ({ notifyStaffIfNotRecent: vi.fn() }));
vi.mock("@/lib/analytics/activation-funnels", () => ({ loadActivationFunnels: vi.fn() }));

import { biggestDrop, buildFunnelDigestEmail } from "./funnel-email";

const founder = [
  { label: "Signed up", count: 120, fromPrev: null },
  { label: "Onboarded", count: 84, fromPrev: 0.7 },
  { label: "Rated", count: 51, fromPrev: 0.61 },
  { label: "Ready", count: 22, fromPrev: 0.43 },
  { label: "Matched", count: 9, fromPrev: 0.41 },
];
const investor = [
  { label: "Signed up", count: 38, fromPrev: null },
  { label: "Profile complete", count: 29, fromPrev: 0.76 },
];

describe("funnel digest", () => {
  it("marks only the single largest drop", () => {
    expect(biggestDrop(founder as never)).toBe(4);
    expect(biggestDrop([{ label: "A", count: 1, fromPrev: null }] as never)).toBe(-1);
  });

  it("names the biggest drop in the subject and marks it once", () => {
    const m = buildFunnelDigestEmail({ founder, investor } as never);
    expect(m.subject).toBe("Activation funnels: biggest drop is at Matched (41%)");
    expect(m.html.match(/biggest drop<\/div>/g)?.length ?? m.html.split("· biggest drop").length - 1).toBe(2);
    expect(m.text).toContain("Ready: 22 (43% from prev)");
  });
});
