import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildSuggestedActions } from "@/lib/assistant/assistant-actions";
import { inferAssistantMode } from "@/lib/assistant/assistant-context";
import {
  buildMenuKnowledge,
  currentLeaf,
  filterNavByPermission,
  flattenNav,
  pageDescriptions,
} from "@/lib/assistant/menu-knowledge";
import { PAGE_NOTES } from "@/lib/assistant/page-notes";
import { ASSISTANT_MODES, type SanitizedAssistantContext } from "@/lib/assistant/types";
import { assistantChatSchema } from "@/lib/validation";
import {
  getAdminWorkspaceNavSections,
  getFounderWorkspaceNavSections,
  getInvestorWorkspaceNavSections,
} from "@/lib/workspace-nav";

const APP = join(process.cwd(), "src", "app");

/** Does a route resolve to a page file? Falls back to a [dynamic] folder per segment. */
function routeExists(href: string): boolean {
  const segs = href.split("?")[0].split("/").filter(Boolean);
  let dir = APP;
  for (const seg of segs) {
    if (existsSync(join(dir, seg))) {
      dir = join(dir, seg);
      continue;
    }
    const dyn = existsSync(dir) ? readdirSync(dir).find((d) => d.startsWith("[") && !d.startsWith("[[")) : undefined;
    if (!dyn) return false;
    dir = join(dir, dyn);
  }
  return existsSync(join(dir, "page.tsx")) || existsSync(join(dir, "page.ts"));
}

const founderLeaves = [
  ...flattenNav(getFounderWorkspaceNavSections(false)),
  ...flattenNav(getFounderWorkspaceNavSections(true)),
];
const investorLeaves = flattenNav(getInvestorWorkspaceNavSections());
const adminLeaves = flattenNav(getAdminWorkspaceNavSections());

describe("assistant menu knowledge stays in step with the menu", () => {
  it("every founder and investor menu page has a one line description for the assistant", () => {
    const described = pageDescriptions();
    const missing = [...founderLeaves, ...investorLeaves].map((l) => l.href).filter((href) => !described[href]);
    // Add a line to src/lib/assistant/page-notes.ts (or a Stage guide step) for each page listed here.
    expect([...new Set(missing)]).toEqual([]);
  });

  it("every page the assistant can mention opens a real page", () => {
    const hrefs = new Set([
      ...Object.keys(PAGE_NOTES),
      ...Object.keys(pageDescriptions()),
      ...founderLeaves.map((l) => l.href),
      ...investorLeaves.map((l) => l.href),
      ...adminLeaves.map((l) => l.href),
    ]);
    expect([...hrefs].filter((h) => !routeExists(h))).toEqual([]);
  });

  it("suggested action buttons point at real pages", () => {
    const base = { workspaceLabel: "x", currentPath: null, entity: null, highlights: [] };
    const contexts: SanitizedAssistantContext[] = [
      { ...base, role: "founder", mode: "founder_workflow", summary: { companyLinked: false, documentsMissingCount: 2, pitchDeckUploaded: false, remediationActiveCount: 1 } },
      { ...base, role: "investor", mode: "investor_workflow", summary: { approvalStatus: "pending", pendingSpvRequirementsCount: 1 } },
      { ...base, role: "admin", mode: "admin_operations", summary: { pendingCompanyReviews: 1, pendingInvestorApprovals: 1, complianceEscalations: 1, spvBlockers: 1 } },
    ];
    const hrefs = contexts.flatMap((c) => buildSuggestedActions(c).map((a) => a.href));
    expect(hrefs.filter((h) => !routeExists(h))).toEqual([]);
  });

  it("the chat API accepts every assistant mode", () => {
    for (const mode of ASSISTANT_MODES) {
      expect(assistantChatSchema.safeParse({ message: "hi", mode }).success).toBe(true);
    }
  });
});

describe("page → assistant mode", () => {
  it.each([
    ["/admin/ir", "ir_hub"],
    ["/admin/ir/tasks", "ir_hub"],
    ["/admin/playbook", "ir_hub"],
    ["/admin/ceo", "ceo_hub"],
    ["/founder/deploy", "founder_marketing"],
    ["/founder/matches", "founder_marketing"],
    ["/founder/investor-pipeline", "founder_marketing"],
    ["/founder/settings/billing", "billing"],
    ["/founder/readiness/data-room", "reports_guidance"],
  ])("%s → %s", (path, mode) => {
    const role = path.startsWith("/admin") ? "admin" : "founder";
    expect(inferAssistantMode({ role, currentPath: path })).toBe(mode);
  });

  it("does not treat /admin/ir-funnel as Investor Relations", () => {
    expect(inferAssistantMode({ role: "admin", currentPath: "/admin/ir-funnel" })).toBe("admin_operations");
  });
});

describe("buildMenuKnowledge", () => {
  it("lists pages with their menu trail, marks the current page and stage locks, and drops hidden pages", () => {
    const sections = getFounderWorkspaceNavSections(true);
    const text = buildMenuKnowledge({
      workspace: "founder",
      sections,
      hidden: ["/founder/tasks"],
      currentPath: "/founder/cap-table",
      journeyStage: "initialize",
    });
    expect(text).toContain("Current page: Your raise › Stage 2 – Preparation › Materials › Cap table (/founder/cap-table).");
    expect(text).toMatch(/\(\/founder\/deploy\):.*\[locked for this founder until Stage 3 – Marketing\]/);
    expect(text).not.toContain("(/founder/tasks)");
  });

  it("picks the deepest matching page", () => {
    const leaf = currentLeaf(founderLeaves, "/founder/readiness/data-room/upload");
    expect(leaf?.href).toBe("/founder/readiness/data-room");
  });

  it("hides admin pages the user has no permission for", () => {
    const visible = flattenNav(filterNavByPermission(getAdminWorkspaceNavSections(), ["view_admin_dashboard"]));
    expect(visible.some((l) => l.href === "/admin/ceo")).toBe(true);
    expect(visible.some((l) => l.href === "/admin/billing")).toBe(false);
  });
});
