import { describe, expect, it } from "vitest";
import { FEATURES } from "@/lib/feature-controls";
import { workspaceNavIconByHref } from "@/lib/ui/nav-icons";
import { adminWorkspaceNavSections, founderWorkspaceNavSections, founderWorkspaceNavSectionsV2, type WorkspaceNavItem } from "@/lib/workspace-nav";

const find = (items: WorkspaceNavItem[], href: string): WorkspaceNavItem | undefined => {
  for (const i of items) {
    if (i.href === href) return i;
    const c = i.children ? find(i.children, href) : undefined;
    if (c) return c;
  }
  return undefined;
};

describe("Private Market board menu link", () => {
  it("is governed by the Private Market feature for founders and investors", () => {
    const f = FEATURES.find((x) => x.key === "private_market");
    expect(f?.hrefs.founder).toContain("/private-market");
    expect(f?.hrefs.investor).toContain("/private-market");
  });
  it("has its own icon", () => {
    expect(workspaceNavIconByHref["/private-market"]).toBeDefined();
  });
  it("shows to every founder, not only Reg CF offerings", () => {
    const item = find(founderWorkspaceNavSectionsV2.flatMap((x) => x.items), "/private-market");
    expect(item).toBeDefined();
    expect(item?.requiresRegCf).toBeFalsy();
  });
  it("sits right under Dashboard with no stage gate, in both founder menus", () => {
    for (const sections of [founderWorkspaceNavSections, founderWorkspaceNavSectionsV2]) {
      const first = sections.flatMap((x) => x.items).slice(0, 2);
      expect(first.map((i) => i.href)).toEqual(["/founder", "/private-market"]);
      expect(first[1].label).toBe("Private Market");
      expect(first[1].minStage).toBeUndefined();
    }
  });
  it("is not repeated inside Stage 3", () => {
    const all = founderWorkspaceNavSectionsV2.flatMap((x) => x.items);
    expect(all.filter((i) => i.href === "/private-market")).toHaveLength(1);
    expect(all.flatMap((i) => i.children ?? []).some((c) => c.href === "/private-market")).toBe(false);
  });
});

describe("Weekly emailer menu entry", () => {
  const admin = () => adminWorkspaceNavSections.flatMap((x) => x.items);
  it("sits under the admin Private Market board with the Board", () => {
    const parent = find(admin(), "/private-market");
    expect(parent?.children?.map((c) => c.label)).toEqual(["Board", "Weekly emailer"]);
    expect(find(admin(), "/admin/private-market/weekly-emailer")).toBeDefined();
  });
  it("has its own icon and page note", () => {
    expect(workspaceNavIconByHref["/admin/private-market/weekly-emailer"]).toBeDefined();
  });
});

describe("founder menu groups", () => {
  it("marks each stage row with its journey stage, in order", () => {
    const raise = founderWorkspaceNavSectionsV2.find((s) => s.title === "Your raise");
    expect(raise?.items.map((i) => i.journeyStage)).toEqual(["initialize", "qualify", "deploy", "optimize"]);
  });
  it("keeps the investor pages in Stage 3 as well as in the Investors group", () => {
    const stage3 = founderWorkspaceNavSectionsV2.flatMap((s) => s.items).find((i) => i.label === "Stage 3 – Marketing");
    const group = founderWorkspaceNavSectionsV2.find((s) => s.title === "Investors");
    const stage3Hrefs = new Set((stage3?.children ?? []).map((c) => c.href));
    for (const it of group?.items ?? []) {
      if (it.href !== "/founder/investor-interest") expect(stage3Hrefs.has(it.href)).toBe(true);
    }
  });
});
