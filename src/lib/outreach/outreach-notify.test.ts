import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ createServiceRoleClient: () => ({}) }));
vi.mock("@/lib/notifications/notifications", () => ({ createNotification: vi.fn() }));
vi.mock("@/lib/notifications/preferences", () => ({ shouldSendEmail: vi.fn(async () => true) }));
vi.mock("@/lib/email/send-email", () => ({ sendEmail: vi.fn(async () => true) }));
vi.mock("@/lib/activity/emit", () => ({ recordActivity: vi.fn(async () => null) }));

import { namesSummary, renderQueuedEmail, renderSentEmail } from "./outreach-notify";

const investors = [
  { investorRef: "a", name: "Andres Blank", matchScore: 50 },
  { investorRef: "b", name: "Paul Rosania", matchScore: 50 },
  { investorRef: "c", name: "Marcus Badger", matchScore: 48 },
  { investorRef: "d", name: "Tony Grover", matchScore: 46 },
  { investorRef: "e", name: "Robert Rhinehart", matchScore: 44 },
  { investorRef: "f", name: "Ron Belk", matchScore: 40 },
  { investorRef: "g", name: "Ravi Katta", matchScore: 30 },
];

describe("founder outreach emails", () => {
  it("queued email lists names, never match scores", () => {
    const { subject, html, text } = renderQueuedEmail({
      companyName: "KoreInside",
      firstName: "Sarah",
      investors,
      planName: "Professional",
      monthlyCap: 50,
      isPublished: true,
    });
    expect(subject).toBe("7 investor introductions are queued for KoreInside");
    expect(html).toContain("Andres Blank");
    expect(html).toContain("and 2 more");
    expect(html).not.toContain("Ravi Katta");
    expect(text).toContain("limit of 50 introductions a month");
    // Markup and CSS use "100%"; check only the visible copy.
    const visibleHtml = html.replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ");
    for (const out of [subject, visibleHtml, text]) {
      expect(out).not.toMatch(/\d+%/);
      expect(out).not.toContain(" — ");
    }
  });

  it("queued email warns when the one-pager is unpublished", () => {
    const { text } = renderQueuedEmail({ companyName: "Nostro", firstName: null, investors: investors.slice(0, 1), planName: null, monthlyCap: null, isPublished: false });
    expect(text).toContain("isn't published yet");
  });

  it("sent email shows month usage and queue, never match scores", () => {
    const { subject, html, text } = renderSentEmail({
      companyName: "KoreInside",
      firstName: "Sarah",
      investors: investors.slice(0, 4),
      sentThisMonth: 4,
      monthlyCap: 50,
      stillQueued: 29,
    });
    expect(subject).toBe("Your Founder Preview went to 4 investors today");
    expect(text).toContain("4 of 50");
    expect(text).toContain("29");
    // Markup and CSS use "100%"; check only the visible copy.
    const visibleHtml = html.replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ");
    for (const out of [subject, visibleHtml, text]) {
      expect(out).not.toMatch(/\d+%/);
      expect(out).not.toContain(" — ");
    }
  });

  it("summarises names for in-app copy", () => {
    expect(namesSummary(["A", "B"])).toBe("A and B");
    expect(namesSummary(["A", "B", "C", "D", "E"])).toBe("A, B, C and 2 more");
  });
});
