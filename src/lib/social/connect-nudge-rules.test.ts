import { describe, expect, it } from "vitest";
import {
  MAX_DISMISSALS,
  SNOOZE_DAYS,
  nextNudgeState,
  shouldShowConnectNudge,
  snoozeUntil,
  type ConnectNudgeFacts,
} from "@/lib/social/connect-nudge-rules";
import { socialConnectNudgeEmail } from "@/lib/notifications/social-connect-nudge";

const NOW = new Date("2026-11-18T12:00:00Z");

const due: ConnectNudgeFacts = {
  flagOn: true,
  planType: "founder_professional",
  status: "active",
  socialEnabled: true,
  connected: false,
  dismissals: 0,
  snoozedUntil: null,
};

describe("shouldShowConnectNudge", () => {
  it("shows for an active paid founder with no connected account", () => {
    expect(shouldShowConnectNudge(due, NOW)).toBe(true);
  });

  it("shows for every paid plan", () => {
    for (const planType of ["founder_basic", "founder_professional", "founder_premium", "founder_managed_ir"]) {
      expect(shouldShowConnectNudge({ ...due, planType }, NOW)).toBe(true);
    }
  });

  it("hides when the admin switch is off", () => {
    expect(shouldShowConnectNudge({ ...due, flagOn: false }, NOW)).toBe(false);
  });

  it("hides for free, trial and unpaid founders", () => {
    expect(shouldShowConnectNudge({ ...due, planType: "founder_free", status: "free" }, NOW)).toBe(false);
    expect(shouldShowConnectNudge({ ...due, planType: "founder_trial", status: "trialing" }, NOW)).toBe(false);
    expect(shouldShowConnectNudge({ ...due, status: "pending_payment" }, NOW)).toBe(false);
    expect(shouldShowConnectNudge({ ...due, planType: null }, NOW)).toBe(false);
  });

  it("hides when the plan does not include social media", () => {
    expect(shouldShowConnectNudge({ ...due, socialEnabled: false }, NOW)).toBe(false);
  });

  it("hides once an account is connected", () => {
    expect(shouldShowConnectNudge({ ...due, connected: true }, NOW)).toBe(false);
  });

  it("stops after two closes", () => {
    expect(shouldShowConnectNudge({ ...due, dismissals: MAX_DISMISSALS - 1 }, NOW)).toBe(true);
    expect(shouldShowConnectNudge({ ...due, dismissals: MAX_DISMISSALS }, NOW)).toBe(false);
  });

  it("hides while snoozed and returns when the snooze ends", () => {
    const later = new Date(NOW.getTime() + 60_000).toISOString();
    const earlier = new Date(NOW.getTime() - 60_000).toISOString();
    expect(shouldShowConnectNudge({ ...due, snoozedUntil: later }, NOW)).toBe(false);
    expect(shouldShowConnectNudge({ ...due, snoozedUntil: earlier }, NOW)).toBe(true);
  });
});

describe("nudge state", () => {
  it("snoozes for seven days", () => {
    expect(SNOOZE_DAYS).toBe(7);
    expect(snoozeUntil(NOW)).toBe("2026-11-25T12:00:00.000Z");
  });

  it("a snooze does not count toward the limit, a close does", () => {
    expect(nextNudgeState("snooze", 1, NOW)).toEqual({ dismissals: 1, snoozedUntil: "2026-11-25T12:00:00.000Z" });
    expect(nextNudgeState("dismiss", 1, NOW)).toEqual({ dismissals: 2, snoozedUntil: "2026-11-25T12:00:00.000Z" });
  });
});

describe("socialConnectNudgeEmail", () => {
  it("greets by first name and links to the connect screen", () => {
    const mail = socialConnectNudgeEmail("Jan");
    expect(mail.subject).toBe("Connect with investors");
    expect(mail.text).toContain("Hi Jan,");
    expect(mail.html).toContain("/founder/deploy/social?tab=settings");
  });

  it("works without a first name", () => {
    const mail = socialConnectNudgeEmail(null);
    expect(mail.text).not.toContain("Hi null");
  });
});

import { launchNudgeStep, shouldShowLaunchNudge } from "@/lib/social/connect-nudge-rules";

describe("launchNudgeStep", () => {
  it("walks connect, campaign, post, then stops", () => {
    expect(launchNudgeStep({ connected: false, campaigns: 0, livePosts: 0 })).toBe("connect");
    expect(launchNudgeStep({ connected: true, campaigns: 0, livePosts: 0 })).toBe("campaign");
    expect(launchNudgeStep({ connected: true, campaigns: 1, livePosts: 0 })).toBe("post");
    expect(launchNudgeStep({ connected: true, campaigns: 1, livePosts: 1 })).toBeNull();
  });
});

describe("shouldShowLaunchNudge", () => {
  it("shows for a connected founder who still has a step left", () => {
    expect(shouldShowLaunchNudge({ ...due, connected: true }, "campaign", NOW)).toBe(true);
  });
  it("hides when no step is left", () => {
    expect(shouldShowLaunchNudge(due, null, NOW)).toBe(false);
  });
  it("keeps the plan, switch and close rules", () => {
    expect(shouldShowLaunchNudge({ ...due, flagOn: false }, "connect", NOW)).toBe(false);
    expect(shouldShowLaunchNudge({ ...due, planType: "founder_free", status: "free" }, "connect", NOW)).toBe(false);
    expect(shouldShowLaunchNudge({ ...due, dismissals: MAX_DISMISSALS }, "connect", NOW)).toBe(false);
    expect(shouldShowLaunchNudge({ ...due, snoozedUntil: "2026-11-20T00:00:00Z" }, "connect", NOW)).toBe(false);
  });
});
