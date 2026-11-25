import { describe, expect, it } from "vitest";
import type { DepartmentMetric } from "@/lib/dashboard/department-metrics";
import { buildAdministrationDashboard, type DashRecords } from "./administration-dashboard";

const metric = (id: string, value: number, note?: string): DepartmentMetric => ({
  id, department: "administration", label: id, value, detail: "", flowLabel: null, changes: null, weekly: null, note,
});
const users = { total: 57, active: 57, inactive: 0, invited: 0, byRole: [{ role: "founder", count: 50 }] };
const rec = (label: string, href: string) => ({ label, sub: "sub", href });
const records: DashRecords = {
  recentUsers: [rec("Stripe Test", "/admin/users/manage")], inactiveUsers: [], invitedUsers: [],
  compliance: [rec("Event A", "/admin/compliance?status=open&event=1"), rec("Event B", "/admin/compliance?status=open&event=2")],
  spv: [rec("SPV A", "/admin/companies/c1")], reviews: [], upgrades: [], approvals: null,
  invoices: [rec("Invoice 1001", "/admin/accounting/invoices/i1")],
};

describe("buildAdministrationDashboard", () => {
  it("builds attention items in order of urgency, each opening a popup", () => {
    const d = buildAdministrationDashboard({
      metrics: [metric("admin_compliance", 19), metric("admin_upgrades", 0)],
      users, spvBlockers: 1, pendingReviews: 0,
    });
    expect(d.attention.map((a) => a.tone)).toEqual(["bad", "warn", "good"]);
    expect(d.attention.map((a) => a.popup)).toEqual(["compliance", "spv", "reviews"]);
    expect(d.attention[0].text).toBe("19 open compliance events to work.");
  });

  it("keeps a figure null when its count could not be read", () => {
    const d = buildAdministrationDashboard({
      metrics: [metric("admin_compliance", 0, "Not available: the count could not be read.")],
      users: null, spvBlockers: null, pendingReviews: null,
    });
    expect(d.compliance).toBeNull();
    expect(d.queues.every((q) => q.open === null)).toBe(true);
    expect(d.popups.compliance.value).toBe("Not available");
    expect(d.attention).toEqual([]);
  });

  it("carries the invited count and leaves it null when unknown", () => {
    const d = buildAdministrationDashboard({ metrics: [], users: { ...users, invited: null }, spvBlockers: 0, pendingReviews: 0 });
    expect(d.access.find((a) => a.label === "Invited, not joined")?.value).toBeNull();
  });

  it("links each record to its own page and counts the rest", () => {
    const d = buildAdministrationDashboard({ metrics: [metric("admin_compliance", 19), metric("admin_invoices", 1)], users, spvBlockers: 1, pendingReviews: 0, records });
    expect(d.popups.compliance.extra.records?.[0].href).toBe("/admin/compliance?status=open&event=1");
    expect(d.popups.compliance.extra.recordsMore).toBe("17 more in Compliance");
    expect(d.popups.invoices.extra.records?.[0].href).toBe("/admin/accounting/invoices/i1");
    expect(d.popups.invoices.extra.recordsMore).toBeUndefined();
  });

  it("shows an empty state for a zero count and a failure state for an unread list", () => {
    const d = buildAdministrationDashboard({ metrics: [metric("admin_investor_approvals", 3)], users, spvBlockers: 0, pendingReviews: 0, records });
    expect(d.popups.reviews.extra.recordsEmpty).toBe("No companies are waiting for review.");
    expect(d.popups.approvals.extra.recordsEmpty).toBe("The records could not be read.");
  });
});
