import { describe, expect, it } from "vitest";
import { getInvestorSidebarSections, investorWorkspaceNavSections } from "@/lib/workspace-nav";

describe("getInvestorSidebarSections", () => {
  const sections = getInvestorSidebarSections();
  const journey = sections.find((s) => s.title === "Your journey")!;

  it("shows each stage as one folding group whose first page is the Stage guide", () => {
    expect(journey.items).toHaveLength(4);
    for (const g of journey.items) {
      expect(g.label.startsWith("Stage ")).toBe(true);
      expect(g.children?.[0].label).toBe("Stage guide");
      expect(g.children?.[0].href).toBe(g.href);
    }
  });

  it("never locks a Stage guide and keeps the sections as authored", () => {
    expect(sections).toEqual(investorWorkspaceNavSections);
    for (const g of journey.items) expect(g.children?.[0].minInvestorStage).toBeUndefined();
  });
});
