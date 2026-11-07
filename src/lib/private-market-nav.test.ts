import { describe, expect, it } from "vitest";
import { FEATURES } from "@/lib/feature-controls";
import { workspaceNavIconByHref } from "@/lib/ui/nav-icons";
import { adminWorkspaceNavSections, founderWorkspaceNavSectionsV2, type WorkspaceNavItem } from "@/lib/workspace-nav";

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
