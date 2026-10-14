import { describe, expect, it } from "vitest";
import { buildSearchIndex, searchMenu } from "./nav-search";
import type { WorkspaceNavSection } from "@/lib/workspace-nav";

const sections: WorkspaceNavSection[] = [
  {
    items: [
      { href: "/admin/marketing/aeo", label: "AEO" },
      { href: "/admin/marketing/settings/notifications", label: "Settings" },
      { href: "/admin/billing", label: "Billing" },
      {
        href: "/admin/users/manage",
        label: "Administration",
        children: [
          { href: "/admin/users/manage", label: "User Management" },
          { href: "/admin/feature-controls", label: "Feature Controls" },
        ],
      },
      {
        href: "/admin/integrations",
        label: "System",
        children: [{ href: "/admin/page-builder-lab", label: "Page Builder" }],
      },
    ],
  },
];

const descriptions = { "/admin/feature-controls": "Site default view, limits and feature toggles" };
const index = buildSearchIndex(sections, "Admin", descriptions);

describe("searchMenu", () => {
  it("finds pages for a plain word through synonyms", () => {
    const hrefs = searchMenu(index, "website").map((h) => h.href);
    expect(hrefs).toContain("/admin/page-builder-lab");
    expect(hrefs).toContain("/admin/marketing/aeo");
  });

  it("ranks the page that fits both words first", () => {
    const hits = searchMenu(index, "website setting");
    expect(hits[0]?.href).toBe("/admin/feature-controls");
    expect(hits.map((h) => h.href)).toContain("/admin/marketing/settings/notifications");
  });

  it("treats plural and singular alike", () => {
    expect(searchMenu(index, "settings")[0]?.href).toBe("/admin/marketing/settings/notifications");
  });

  it("shows the menu path and a reason", () => {
    const hit = searchMenu(index, "billing")[0]!;
    expect(hit.path).toBe("Admin › Billing");
    expect(hit.reason).toBe("matches billing");
    const fc = searchMenu(index, "feature controls")[0]!;
    expect(fc.path).toBe("Admin › Administration › Feature Controls");
  });

  it("returns nothing for words that match nothing", () => {
    expect(searchMenu(index, "xyzzy")).toEqual([]);
    expect(searchMenu(index, "the of")).toEqual([]);
  });
});
