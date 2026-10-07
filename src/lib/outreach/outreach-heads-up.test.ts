import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ createServiceRoleClient: () => ({}) }));
vi.mock("@/lib/notifications/notifications", () => ({ createNotification: vi.fn() }));
vi.mock("@/lib/notifications/preferences", () => ({ shouldSendEmail: vi.fn(async () => true) }));
vi.mock("@/lib/email/send-email", () => ({ sendEmail: vi.fn(async () => true) }));
vi.mock("@/lib/activity/emit", () => ({ recordActivity: vi.fn(async () => null) }));
vi.mock("@/lib/settings/platform-settings", () => ({ getOutreachAutomationEnabled: vi.fn(async () => true) }));
vi.mock("@/lib/outreach/founder-overrides", () => ({ resolveFounderOutreachConfig: vi.fn() }));

import { renderManualSentEmail, renderQueuedEmail, renderSentEmail, renderUpcomingEmail } from "./outreach-notify";

const investors = [
  { investorRef: "a", name: "Andres Blank", matchScore: 50 },
  { investorRef: "b", name: "Paul Rosania", matchScore: 48 },
  { investorRef: "c", name: "Marcus Badger", matchScore: 40 },
];
const visible = (html: string) => html.replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ");

describe("founder is told when outreach goes out", () => {
  it("queued email gives the first batch date", () => {
    const { text } = renderQueuedEmail({
      companyName: "KoreInside", firstName: "Sarah", investors, planName: "Basic", monthlyCap: 5, isPublished: true,
      firstRunAt: new Date("2026-10-09T19:00:00Z"),
    });
    expect(text).toContain("The first batch goes out Friday, October 9 around 12:00 PM PT");
  });

  it("queued email leaves the date out when it isn't known", () => {
    const { text } = renderQueuedEmail({ companyName: "K", firstName: null, investors, planName: null, monthlyCap: null, isPublished: true });
    expect(text).not.toContain("first batch goes out");
  });

  it("sent email gives the next batch date when more are queued", () => {
    const { text } = renderSentEmail({
      companyName: "K", firstName: null, investors, sentThisMonth: 3, monthlyCap: 5, stillQueued: 2,
      nextRunAt: new Date("2026-10-16T07:00:00Z"),
    });
    expect(text).toContain("Next batch: Friday, October 16 around 12:00 AM PT");
  });

  it("day-before reminder names the investors, the time and the allowance, never scores", () => {
    const { subject, html, text } = renderUpcomingEmail({
      companyName: "KoreInside",
      firstName: "Sarah",
      batch: {
        runAt: new Date("2026-10-09T19:00:00Z"),
        investors,
        upTo: 2,
        blocked: null,
        periodCap: 5,
        reachedThisPeriod: 2,
        periodResetsAt: new Date("2026-10-20T00:00:00Z"),
      },
    });
    expect(subject).toBe("Your next investor batch goes out Friday, October 9");
    expect(text).toContain("goes to 2 investors Friday, October 9 around 12:00 PM PT");
    expect(visible(html)).toContain("Andres Blank");
    expect(visible(html)).not.toContain("Marcus Badger");
    expect(text).toContain("2 of 5");
    for (const out of [subject, visible(html), text]) expect(out).not.toMatch(/\d+%/);
  });

  it("day-before reminder warns when the one-pager isn't published", () => {
    const { text } = renderUpcomingEmail({
      companyName: "K", firstName: null,
      batch: { runAt: new Date("2026-10-09T19:00:00Z"), investors: [], upTo: 3, blocked: "unpublished", periodCap: null, reachedThisPeriod: 0, periodResetsAt: null },
    });
    expect(text).toContain("up to 3 matched investors");
    expect(text).toContain("isn't published, so this batch will wait");
  });

  it("DIY email groups sends by step", () => {
    const { subject, text } = renderManualSentEmail({
      companyName: "K", firstName: "Sarah",
      sends: [
        { name: "Jane Park", stepLabel: "Intro", stepIndex: 0 },
        { name: "Alder Capital", stepLabel: "Follow-up 1", stepIndex: 1 },
        { name: "Bo Lee", stepLabel: "Intro", stepIndex: 0 },
      ],
    });
    expect(subject).toBe("Your outreach sequence sent 3 emails today");
    expect(text.indexOf("Intro")).toBeLessThan(text.indexOf("Follow-up 1"));
    expect(text).toContain("Jane Park");
    expect(text).toContain("Bo Lee");
  });
});
