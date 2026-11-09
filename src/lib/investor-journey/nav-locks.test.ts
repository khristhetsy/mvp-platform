import { describe, expect, it } from "vitest";
import { investorWorkspaceNavSections, type WorkspaceNavItem } from "@/lib/workspace-nav";
import { INVESTOR_STAGES } from "@/lib/investor-journey/stages";

function walk(items: WorkspaceNavItem[], out: WorkspaceNavItem[] = []) {
  for (const it of items) {
    out.push(it);
    if (it.children) walk(it.children, out);
  }
  return out;
}

const journey = investorWorkspaceNavSections.find((s) => s.title === "Your journey")!;
const stageGroups = journey.items;

describe("investor menu stage groups and locks", () => {
  it("has one group per stage, in order, each tagged with its own stage", () => {
    expect(stageGroups).toHaveLength(INVESTOR_STAGES.length);
    stageGroups.forEach((g, i) => {
      expect(g.minInvestorStage).toBe(INVESTOR_STAGES[i]);
      expect(g.children?.length).toBeGreaterThan(0);
    });
  });

  it("puts the Stage guide first in every stage and never locks it", () => {
    for (const g of stageGroups) {
      expect(g.children![0].label).toBe("Stage guide");
      expect(g.children![0].minInvestorStage).toBeUndefined();
    }
  });

  it("only uses real investor stage keys", () => {
    for (const it of walk(investorWorkspaceNavSections.flatMap((s) => s.items))) {
      if (it.minInvestorStage) expect(INVESTOR_STAGES).toContain(it.minInvestorStage);
    }
  });

  it("tags locked pages inside a stage with that stage, and keeps Private Market open", () => {
    for (const [i, key] of [[2, "access"], [3, "manage"]] as const) {
      for (const it of walk(stageGroups[i].children!.slice(1))) {
        if (it.minInvestorStage) expect(it.minInvestorStage).toBe(key);
      }
    }
    const pm = investorWorkspaceNavSections.flatMap((s) => s.items).find((i) => i.href === "/investor/opportunities");
    expect(pm?.minInvestorStage).toBeUndefined();
  });

  it("does not lock Workspace or Help", () => {
    for (const title of ["Workspace", "Help"]) {
      const sec = investorWorkspaceNavSections.find((s) => s.title === title)!;
      expect(walk(sec.items).some((i) => i.minInvestorStage)).toBe(false);
    }
  });

  it("puts Help & guides and Support in Help, and Calendar, Tasks and Notifications in Settings", () => {
    const labels = (title: string, group: string) =>
      walk(investorWorkspaceNavSections.find((s) => s.title === title)!.items.find((i) => i.label === group)!.children!).map((i) => i.label);
    expect(labels("Help", "Help")).toEqual(["Help & guides", "Support"]);
    expect(labels("Workspace", "Settings")).toEqual(expect.arrayContaining(["Settings", "Tasks", "Notifications", "Calendar", "Scheduling"]));
  });
});
