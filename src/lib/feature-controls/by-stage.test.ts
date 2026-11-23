import { describe, it, expect } from "vitest";
import { FEATURE_AUDIENCES, featuresForAudience } from "@/lib/feature-controls";
import {
  buildCards,
  buildFounderCards,
  buildInvestorCards,
  buildAdminCards,
  emptiedStage,
} from "@/lib/feature-controls/by-stage";
import { getFounderStageMenuCatalog } from "@/lib/workspace-nav";

const rowsOf = (cards: ReturnType<typeof buildCards>) => cards.flatMap((c) => c.rows);
const find = (cards: ReturnType<typeof buildCards>, href: string) => rowsOf(cards).find((r) => r.href === href);

describe("feature controls by stage", () => {
  it("never loses a switch: every switch for a role appears on its page", () => {
    for (const audience of FEATURE_AUDIENCES) {
      const shown = new Set(rowsOf(buildCards(audience)).map((r) => r.switchKey).filter(Boolean));
      for (const key of featuresForAudience(audience)) {
        expect(shown.has(key), `${audience}:${key} is missing from the page`).toBe(true);
      }
    }
  });

  it("founder stage cards match the Stage menus catalog item for item", () => {
    const catalog = getFounderStageMenuCatalog();
    const stages = buildFounderCards().filter((c) => c.guard);
    expect(stages.map((c) => c.title)).toEqual(catalog.map((g) => g.stage));
    for (const group of catalog) {
      const card = stages.find((c) => c.title === group.stage)!;
      expect(card.rows.map((r) => r.href)).toEqual(group.items.map((i) => i.href));
    }
  });

  it("marks shared switches and pages no switch governs", () => {
    const founder = buildFounderCards();
    expect(find(founder, "/founder/deal-room")).toMatchObject({ switchLabel: "Fundraising suite", kind: "switch", shared: true });
    expect(find(founder, "/founder/spvs")).toMatchObject({ switchLabel: "SPVs & closings", kind: "switch", shared: false });
    expect(find(founder, "/founder/cap-table")).toMatchObject({ switchLabel: "Cap table", kind: "switch", shared: false });
    expect(find(founder, "/founder/stages/closing")).toMatchObject({ kind: "none", switchKey: null });
    expect(find(founder, "/founder/settings")).toMatchObject({ kind: "always" });
    expect(find(founder, "/founder/deploy/social")).toMatchObject({ kind: "external" });
  });

  it("puts switches with no menu item in a card of their own", () => {
    const card = buildFounderCards().find((c) => c.title === "Not in the menu");
    expect(card).toBeDefined();
    const keys = card!.rows.map((r) => r.switchKey);
    expect(keys).toContain("pledged");
    expect(card!.rows.every((r) => !r.menu && r.href === null)).toBe(true);
  });

  it("gives investors their four stages and keeps Private Market shared", () => {
    const investor = buildInvestorCards();
    const stages = investor.filter((c) => c.guard).map((c) => c.title);
    expect(stages).toHaveLength(4);
    expect(find(investor, "/investor/spvs")).toMatchObject({ switchLabel: "Private Market", shared: true });
    expect(find(investor, "/investor/dashboard")).toMatchObject({ kind: "always" });
  });

  it("lists admin switches by group with their page counts, then the always on pages", () => {
    const admin = buildAdminCards();
    const sales = rowsOf(admin).find((r) => r.switchKey === "sales");
    expect(sales).toMatchObject({ label: "Sales", pages: 7 });
    expect(admin[admin.length - 1].title).toBe("Always on");
    expect(admin[admin.length - 1].rows.map((r) => r.label)).toContain("Feature Controls");
  });

  it("no top level page or always on page gets an In menu checkbox", () => {
    for (const audience of ["founder", "investor"] as const) {
      const cards = buildCards(audience);
      expect(cards[0].title).toBe("Top level");
      expect(cards[0].rows.every((r) => !r.menu)).toBe(true);
    }
  });

  it("finds a stage left with nothing visible", () => {
    const cards = buildFounderCards();
    const stage = cards.find((c) => c.guard)!;
    const all = new Set(stage.rows.map((r) => r.href!));
    expect(emptiedStage(cards, all)).toBe(stage.title);
    all.delete(stage.rows[0].href!);
    expect(emptiedStage(cards, all)).toBeNull();
  });
});
