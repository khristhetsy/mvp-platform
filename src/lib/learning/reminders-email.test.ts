import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ createServiceRoleClient: vi.fn() }));
vi.mock("@/lib/learning/progress", () => ({ getLearningAdminSummaryForCompanies: vi.fn(), listLearningProgressForCompany: vi.fn(), listPublishedLearningModules: vi.fn() }));
vi.mock("@/lib/learning/recommendations", () => ({ getAICoachRecommendations: vi.fn() }));
vi.mock("@/lib/email/transactional-send", () => ({ sendTransactionalEmail: vi.fn() }));

import { buildLearningEmail } from "./reminders";

describe("buildLearningEmail", () => {
  it("renders on the founder layout with the learning link and disclaimer", () => {
    const m = buildLearningEmail({
      subject: "Your weekly learning summary: 45% complete",
      preheader: "2 completed, 5 engaged.",
      eyebrow: "Learning · Weekly",
      headline: "Your learning this week",
      intro: "Hi Maya, here is your weekly summary for Northstar Robotics.",
      companyName: "Northstar Robotics",
      blocks: [{ type: "stats", items: [{ value: "45%", label: "overall progress" }] }],
      cta: "Open learning workspace",
    });
    expect(m.html).toContain("height:3px;background:#1A6CE4");
    expect(m.text).toMatch(/Open learning workspace: https?:\/\/.+\/founder\/learning/);
    expect(m.html).toContain("not legal, tax, or investment advice");
    expect(m.html).toContain("Northstar Robotics is on the iCapOS founder learning path");
  });
});
