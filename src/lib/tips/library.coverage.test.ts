import { describe, expect, it } from "vitest";
import { JOURNEY_STAGES, type JourneyStage } from "@/lib/founder-journey/types";
import {
  founderWorkspaceNavSections,
  founderWorkspaceNavSectionsV2,
  type WorkspaceNavItem,
} from "@/lib/workspace-nav";
import { TIPS } from "./library";
import { selectTip } from "./select";

/**
 * Menu pages that deliberately have no tip of their own:
 * the dashboard itself, the four stage guides, and the Reg CF only marketplace.
 */
const EXEMPT = new Set([
  "/founder",
  "/founder/stages/onboarding",
  "/founder/stages/preparation",
  "/founder/stages/marketing",
  "/founder/stages/closing",
  "/founder/private-market",
]);

function collect(items: WorkspaceNavItem[], into: Map<string, number>) {
  for (const item of items) {
    const rank = item.minStage ? JOURNEY_STAGES.indexOf(item.minStage) : 0;
    into.set(item.href, Math.max(into.get(item.href) ?? 0, rank));
    if (item.children) collect(item.children, into);
  }
}

function founderMenu(): Map<string, number> {
  const hrefs = new Map<string, number>();
  for (const sections of [founderWorkspaceNavSections, founderWorkspaceNavSectionsV2]) {
    for (const section of sections) collect(section.items, hrefs);
  }
  return hrefs;
}

const founderTips = TIPS.filter((t) => t.audience === "founder");

describe("founder tips cover the whole founder menu", () => {
  it("has a tip for every founder menu page (add a tip in library.ts when you add a page)", () => {
    const tipped = new Set(founderTips.map((t) => t.actionHref));
    const missing = [...founderMenu().keys()].filter((href) => !EXEMPT.has(href) && !tipped.has(href));
    expect(missing).toEqual([]);
  });

  it("never shows a tip for a page before the menu unlocks it", () => {
    const menu = founderMenu();
    const tooEarly = founderTips
      .filter((t) => t.actionHref && menu.has(t.actionHref))
      .filter((t) => {
        const tipRank = t.founderStage ? JOURNEY_STAGES.indexOf(t.founderStage) : t.minStage ? JOURNEY_STAGES.indexOf(t.minStage) : 0;
        return tipRank < (menu.get(t.actionHref as string) ?? 0);
      })
      .map((t) => t.id);
    expect(tooEarly).toEqual([]);
  });

  it("has unique tip ids", () => {
    const ids = TIPS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("shows every eligible tip once per cycle for each stage", () => {
    for (const stage of JOURNEY_STAGES as readonly JourneyStage[]) {
      const seen = new Set<string>();
      for (let d = 0; d < 120; d += 1) {
        const date = new Date(Date.UTC(2026, 9, 1 + d)).toISOString().slice(0, 10);
        const tip = selectTip({ audience: "founder", founderStage: stage, dateKey: date });
        if (tip) seen.add(tip.id);
      }
      const eligible = founderTips.filter(
        (t) =>
          (t.founderStage === undefined || t.founderStage === stage) &&
          (t.minStage === undefined || JOURNEY_STAGES.indexOf(t.minStage) <= JOURNEY_STAGES.indexOf(stage)),
      );
      expect(seen.size).toBe(eligible.length);
    }
  });
});
