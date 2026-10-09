import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ createServiceRoleClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: vi.fn() }));
vi.mock("@/lib/email/send-email", () => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/support/inbound", () => ({ supportInboundEnabled: () => false, supportInboxAddress: () => "support@in.icapos.com" }));

import {
  planFeatures,
  renderWelcomeLetter,
  welcomeBell,
  welcomeNextSteps,
  welcomeReplyTo,
  welcomeSubject,
  type WelcomeLetterData,
} from "./founder-welcome-letter";

const CONN = { monthlyByPlan: { basic: 5, professional: 20 }, weeklyByPlan: { basic: 1, professional: 5 } };

// Ted's real data at the time of his payment.
const TED: WelcomeLetterData = {
  founderId: "u1",
  email: "tedstaley2@gmail.com",
  firstName: "Theodore",
  companyName: "Save Our Oceans Initiative Inc.",
  plan: "founder_basic",
  priceCents: 4900,
  startedAt: "2026-10-09T01:06:33.674Z",
  renewsAt: "2026-11-09T01:05:53Z",
  onboardingPercent: 50,
  steps: [
    { key: "company_profile", done: true },
    { key: "investor_readiness_review", done: true },
    { key: "documents_uploaded", done: false },
    { key: "funding_information", done: false },
  ],
  crrScore: null,
};

describe("welcome letter", () => {
  const out = renderWelcomeLetter(TED, CONN);

  it("greets the founder and confirms the plan in PT", () => {
    expect(out.subject).toBe("Welcome to iCapOS Basic, Theodore");
    expect(out.text).toContain("Save Our Oceans Initiative Inc. is now on the Basic plan.");
    expect(out.text).toContain("Amount: $49.00 / month");
    expect(out.text).toContain("Started: Oct 8, 2026 at 6:06 PM PT");
    expect(out.text).toContain("Next renewal: Nov 8, 2026");
  });

  it("lists Basic features from the enforced limits", () => {
    expect(planFeatures("founder_basic", CONN)).toEqual([
      "All founder tools: Capital Readiness Rating, data room, valuation and e-learning",
      "Full profiles of your matched investors",
      "Your own outreach and one pager to up to 5 matched investors",
      "Introductions through iCFO: up to 5 requests a month, 1 a week",
      "Founder Spotlight at iCFO investor events",
    ]);
  });

  it("lists Professional features", () => {
    const pro = planFeatures("founder_professional", CONN);
    expect(pro).toContain("Your own outreach and one pager to up to 50 matched investors");
    expect(pro).toContain("Introductions through iCFO: up to 20 requests a month, 5 a week");
    expect(pro).toContain("A monthly presentation slot to the iCFO investor network");
    expect(pro).not.toContain("Founder Spotlight at iCFO investor events");
  });

  it("builds next steps from what is open, then the rating", () => {
    expect(welcomeNextSteps(TED).map((s) => s.text)).toEqual([
      "Upload your documents to the data room (pitch deck, financials, cap table).",
      "Complete your funding information.",
      "Get your Capital Readiness Rating. It shows investors where you stand and unlocks outreach.",
    ]);
    expect(out.text).toContain("Your onboarding is 50% complete.");
    expect(out.html).toContain(">Continue onboarding</a>");
  });

  it("points to matches when onboarding is done", () => {
    const done = renderWelcomeLetter({ ...TED, onboardingPercent: 100, steps: TED.steps.map((s) => ({ ...s, done: true })), crrScore: 72 }, CONN);
    expect(done.html).toContain(">Open matches</a>");
    expect(done.text).toContain("Your onboarding is complete.");
  });

  it("carries the signature and disclaimer, with no dashes as punctuation", () => {
    expect(out.text).toContain("Founder & CEO, iCFO Capital Global, Inc.");
    expect(out.text).toContain("does not solicit securities and is not an investment adviser");
    expect(out.text).not.toMatch(/ [-–—] /);
  });

  it("builds the founder bell and falls back without a first name", () => {
    expect(welcomeBell(TED)).toEqual({
      title: "Welcome to iCapOS Basic",
      message: "Your plan is active. Next: upload your documents to the data room (pitch deck, financials, cap table).",
    });
    expect(welcomeSubject({ plan: "founder_basic", firstName: null })).toBe("Welcome to iCapOS Basic");
  });

  it("sends replies to the team inbox when inbound mail is off", () => {
    expect(welcomeReplyTo()).toBe("team@icapos.com");
  });
});

describe("Started row on a late letter", () => {
  it("shows the start only for a payment in the last 2 days", async () => {
    const { startedIfRecent } = await import("./founder-welcome-letter");
    const now = new Date("2026-10-09T14:00:00Z");
    expect(startedIfRecent("2026-10-09T01:06:33Z", now)).toBe("2026-10-09T01:06:33Z");
    // Cynthia: current period started Sep 30 (a renewal), not her real start.
    expect(startedIfRecent("2026-09-30T22:16:32Z", now)).toBeNull();
    expect(startedIfRecent(null, now)).toBeNull();
  });

  it("leaves the Started row out when there is no recent start", () => {
    const late = renderWelcomeLetter({ ...TED, startedAt: null }, CONN);
    expect(late.text).not.toContain("Started:");
    expect(late.text).toContain("Next renewal: Nov 8, 2026");
  });
});
