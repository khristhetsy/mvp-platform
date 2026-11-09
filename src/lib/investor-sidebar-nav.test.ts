import { describe, expect, it } from "vitest";
import { getInvestorSidebarSections, investorWorkspaceNavSections } from "@/lib/workspace-nav";

describe("getInvestorSidebarSections", () => {
  const sections = getInvestorSidebarSections();
  const stageSections = sections.filter((s) => s.title?.startsWith("Stage "));

  it("collapses each stage into one Stage guide row that opens a drill-in", () => {
    expect(stageSections).toHaveLength(4);
    for (const s of stageSections) {
      expect(s.items).toHaveLength(1);
      expect(s.items[0].label).toBe("Stage guide");
      expect(s.items[0].drillTitle).toBe(s.title);
      expect(s.items[0].children?.[0].href).toBe(s.items[0].href);
    }
  });

  it("never locks a Stage guide and keeps every page reachable", () => {
    const original = investorWorkspaceNavSections.flatMap((s) => s.items).map((i) => i.href).sort();
    const sidebar = sections.flatMap((s) => s.items.flatMap((i) => (i.children && s.title?.startsWith("Stage ") ? i.children : [i]))).map((i) => i.href).sort();
    expect(sidebar).toEqual(original);
    for (const s of stageSections) expect(s.items[0].minInvestorStage).toBeUndefined();
  });
});
