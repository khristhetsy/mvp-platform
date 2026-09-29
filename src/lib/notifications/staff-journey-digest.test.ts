import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ createServiceRoleClient: vi.fn() }));
vi.mock("@/lib/notifications/notifications", () => ({ createNotification: vi.fn(), hasRecentNotification: vi.fn() }));

import { buildStaffJourneyDigestEmail, sortStalled, type StalledRow } from "./staff-journey-digest";

const idle = (company: string, days: number, stage = "Marketing"): StalledRow => ({
  company, companyId: `id-${company}`, founder: "Founder", stage, pending: false, idleDays: days,
});
const pending = (company: string): StalledRow => ({
  company, companyId: `id-${company}`, founder: "Founder", stage: "Preparation", pending: true, idleDays: null,
});

const NOW = new Date("2026-09-27T08:00:00Z");

describe("sortStalled", () => {
  it("puts approvals first, then the longest idle", () => {
    const out = sortStalled([idle("HealthFleet", 36), pending("KoreInside"), idle("Nostro", 54), idle("Impervitex Corp", 8)]);
    expect(out.map((r) => r.company)).toEqual(["KoreInside", "Nostro", "HealthFleet", "Impervitex Corp"]);
  });
});

describe("buildStaffJourneyDigestEmail", () => {
  const rows = [idle("HealthFleet", 36, "Preparation"), pending("KoreInside"), idle("Nostro", 54), idle("COGNITIVE SCIENCE & SOLUTIONS, INC", 47)];

  it("leads the subject with the approval", () => {
    const { subject } = buildStaffJourneyDigestEmail(rows, NOW);
    expect(subject).toBe("4 founders need attention: KoreInside awaits your approval");
  });

  it("falls back to the longest idle founder when nothing is pending", () => {
    const { subject } = buildStaffJourneyDigestEmail([idle("HealthFleet", 36), idle("Nostro", 54)], NOW);
    expect(subject).toBe("2 founders need attention: Nostro idle 54 days");
  });

  it("uses singular grammar for one founder", () => {
    const { subject, html } = buildStaffJourneyDigestEmail([idle("Nostro", 54)], NOW);
    expect(subject).toBe("1 founder needs attention: Nostro idle 54 days");
    expect(html).toContain("One has had no activity");
  });

  it("lists idle founders longest first, with a link to each company", () => {
    const { html, text } = buildStaffJourneyDigestEmail(rows, NOW);
    expect(text.indexOf("Nostro")).toBeLessThan(text.indexOf("HealthFleet"));
    expect(text).toContain("/admin/companies/id-Nostro");
    expect(html).toContain("Review approval");
  });

  it("escapes company names", () => {
    const { html } = buildStaffJourneyDigestEmail(rows, NOW);
    expect(html).toContain("COGNITIVE SCIENCE &amp; SOLUTIONS, INC");
  });

  it("caps the list and says so", () => {
    const many = Array.from({ length: 35 }, (_, i) => idle(`Co ${i}`, 10 + i));
    const { text } = buildStaffJourneyDigestEmail(many, NOW);
    expect(text).toContain("Showing 30 of 35");
    expect(text).toContain("35 idle founders");
  });

  it("dates the header in Pacific time", () => {
    expect(buildStaffJourneyDigestEmail(rows, NOW).html).toContain("Team digest · Sun, Sep 27");
  });
});
