import { describe, expect, it } from "vitest";
import {
  activeHref,
  appLinks,
  currentApp,
  groupMenu,
  toApps,
  type TopMenuApp,
} from "./top-menu";
import {
  getAdminWorkspaceNavSections,
  founderWorkspaceNavSections,
  founderWorkspaceNavSectionsV2,
  getInvestorWorkspaceNavSections,
  type WorkspaceNavItem,
  type WorkspaceNavSection,
} from "@/lib/workspace-nav";

/** Every leaf href in a nav tree. */
function navLeaves(sections: WorkspaceNavSection[]): string[] {
  const out: string[] = [];
  const walk = (items: WorkspaceNavItem[]) => {
    for (const it of items) {
      if (it.children?.length) walk(it.children);
      else out.push(it.href);
    }
  };
  for (const s of sections) walk(s.items);
  return out;
}

/** Every href reachable from the launcher plus the top menus. */
function reachable(apps: TopMenuApp[]): Set<string> {
  const out = new Set<string>();
  for (const a of apps) {
    out.add(a.href);
    for (const l of appLinks(a)) out.add(l.href);
  }
  return out;
}

const byLabel = (apps: TopMenuApp[], label: string) => {
  const app = apps.find((a) => a.label === label);
  if (!app) throw new Error(`no app ${label}`);
  return app;
};

const entryLabels = (app: TopMenuApp) => app.entries.map((e) => e.label);

describe("toApps: admin", () => {
  const apps = toApps(getAdminWorkspaceNavSections());

  it("gives one launcher app per top-level admin item, in sidebar order", () => {
    expect(apps.map((a) => a.label)).toEqual([
      "Dashboard",
      "Contacts",
      "CEO",
      "Sales",
      "Marketing",
      "Investor Relations",
      "Investor Directory",
      "Accounting",
      "Social Media",
      "Events",
      "Voice",
      "Communication",
      "Operational Tools",
      "Customer Support",
      "Learning",
      "Operations Manual",
      "Administration",
      "System",
    ]);
  });

  it("keeps every sidebar page reachable", () => {
    const r = reachable(apps);
    for (const href of navLeaves(getAdminWorkspaceNavSections())) expect(r.has(href)).toBe(true);
  });

  it("single-page apps have no menu", () => {
    expect(byLabel(apps, "Contacts").entries).toEqual([]);
    expect(byLabel(apps, "Contacts").href).toBe("/admin/contacts");
  });

  it("groups Operational Tools into dropdowns", () => {
    expect(entryLabels(byLabel(apps, "Operational Tools"))).toEqual([
      "Action Center",
      "Account Activity",
      "Funnels",
      "Investor Relations CRM",
      "Deals",
      "Matching",
      "Diligence",
      "Analytics",
      "Compliance",
    ]);
  });

  it("groups Marketing into Audience and Campaigns", () => {
    const m = byLabel(apps, "Marketing");
    expect(entryLabels(m)).toEqual(["Dashboard", "Plan", "Audience", "Campaigns", "Testimonials", "Analytics", "AEO", "Settings"]);
    const audience = m.entries.find((e) => e.label === "Audience");
    expect(audience?.kind === "group" && audience.items.map((i) => i.label)).toEqual(["Contacts", "Lists", "Suppressions"]);
  });

  it("groups Events", () => {
    expect(entryLabels(byLabel(apps, "Events"))).toEqual(["All events", "Sales", "Content", "Networking Matching", "Reporting"]);
  });

  it("uses a hub's own tabs when an override is given", () => {
    const withTabs = toApps(getAdminWorkspaceNavSections(), {
      menuOverrides: { "/admin/sales": [{ label: "Dashboard", href: "/admin/sales" }, { label: "Forecast", href: "/admin/sales/forecast" }] },
    });
    expect(entryLabels(byLabel(withTabs, "Sales"))).toEqual(["Dashboard", "Forecast"]);
  });
});

describe("toApps: founder", () => {
  it("V2: Dashboard, the four stages and the workspace apps", () => {
    const apps = toApps(founderWorkspaceNavSectionsV2);
    expect(apps.map((a) => a.label)).toEqual([
      "Dashboard",
      "Stage 1 – Onboarding",
      "Stage 2 – Preparation",
      "Stage 3 – Marketing",
      "Stage 4 – Closing",
      "Communications",
      "Calendar",
      "Workspace",
    ]);
    expect(entryLabels(byLabel(apps, "Stage 2 – Preparation"))).toEqual([
      "Stage guide",
      "Capital Readiness Rating",
      "Readiness",
      "Materials",
      "Analyzers",
      "Diligence",
      "Learn",
    ]);
  });

  it("V1 and V2 keep every sidebar page reachable", () => {
    for (const sections of [founderWorkspaceNavSections, founderWorkspaceNavSectionsV2]) {
      const r = reachable(toApps(sections));
      for (const href of navLeaves(sections)) expect(r.has(href)).toBe(true);
    }
  });

  it("marks locked pages and locks an app when every page is locked", () => {
    const apps = toApps(founderWorkspaceNavSectionsV2, { isLocked: (i) => i.minStage === "deploy" || i.minStage === "optimize" });
    const closing = byLabel(apps, "Stage 4 – Closing");
    expect(appLinks(closing).filter((l) => !l.locked).map((l) => l.label)).toEqual(["SPVs & closings"]);
    expect(closing.locked).toBe(false);
    expect(closing.href).toBe("/founder/spvs");
    expect(byLabel(apps, "Stage 3 – Marketing").locked).toBe(true);
  });
});

describe("toApps: investor", () => {
  const apps = toApps(getInvestorWorkspaceNavSections());

  it("gathers stage leaves into section apps", () => {
    expect(apps.map((a) => a.label)).toEqual([
      "Dashboard",
      "Profile",
      "Identity & accreditation",
      "Private Market",
      "Stage 3 · Deals access",
      "Stage 4 · Manage deals",
      "Workspace",
      "Communications",
      "Calendar",
    ]);
  });

  it("keeps every sidebar page reachable", () => {
    const r = reachable(apps);
    for (const href of navLeaves(getInvestorWorkspaceNavSections())) expect(r.has(href)).toBe(true);
  });
});

describe("groupMenu", () => {
  it("ignores menuGroup at or below the threshold", () => {
    const items: WorkspaceNavItem[] = [
      { href: "/a", label: "A", menuGroup: "G" },
      { href: "/b", label: "B", menuGroup: "G" },
    ];
    expect(groupMenu(items).map((e) => e.kind)).toEqual(["link", "link"]);
  });
});

describe("currentApp and activeHref", () => {
  const apps = toApps(getAdminWorkspaceNavSections());

  it("picks the app owning the longest matching href", () => {
    expect(currentApp(apps, "/admin/marketing/lists/42")?.label).toBe("Marketing");
    expect(currentApp(apps, "/admin")?.label).toBe("Dashboard");
    expect(currentApp(apps, "/admin/unknown-page")?.label).toBe("Dashboard");
  });

  it("breaks ties with the app the user last opened", () => {
    // Contacts moved to its own page (/admin/contacts), so no two apps share a path
    // out of the box. Give two hubs the same link to make a tie.
    const withTabs = toApps(getAdminWorkspaceNavSections(), {
      menuOverrides: {
        "/admin/sales": [{ label: "Contacts", href: "/admin/sales/contacts" }],
        "/admin/marketing": [{ label: "Sales contacts", href: "/admin/sales/contacts" }],
      },
    });
    const marketing = byLabel(withTabs, "Marketing");
    expect(currentApp(withTabs, "/admin/sales/contacts")?.label).toBe("Sales");
    expect(currentApp(withTabs, "/admin/sales/contacts", marketing.id)?.label).toBe("Marketing");
    // Without overrides, the Sales contacts page belongs to Sales Hub.
    expect(currentApp(apps, "/admin/sales/contacts")?.label).toBe("Sales");
  });

  it("returns null when no app owns the path", () => {
    expect(currentApp(apps, "/somewhere-else")).toBeNull();
  });

  it("highlights only the longest matching link", () => {
    const m = byLabel(apps, "Marketing");
    expect(activeHref(m, "/admin/marketing")).toBe("/admin/marketing");
    expect(activeHref(m, "/admin/marketing/campaigns/7")).toBe("/admin/marketing/campaigns");
  });
});
