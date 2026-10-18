import { describe, expect, it } from "vitest";
import { OUTREACH_PLAYBOOK } from "@/lib/learning/outreach-playbook";
import { founderWorkspaceNavSectionsV2, founderWorkspaceNavSections } from "@/lib/workspace-nav";
import type { WorkspaceNavItem } from "@/lib/workspace-nav";

function collect(items: WorkspaceNavItem[], out: Map<string, Set<string>> = new Map()) {
  for (const i of items) {
    if (!out.has(i.href)) out.set(i.href, new Set());
    out.get(i.href)!.add(i.label);
    if (i.children) collect(i.children, out);
  }
  return out;
}

const nav = collect([...founderWorkspaceNavSectionsV2, ...founderWorkspaceNavSections].flatMap((s) => s.items));
const steps = OUTREACH_PLAYBOOK.sections.flatMap((s) => s.lessons.flatMap((l) => l.steps ?? []));

describe("outreach playbook", () => {
  it("has a game plan plus seven modules", () => {
    expect(OUTREACH_PLAYBOOK.sections.flatMap((s) => s.lessons)).toHaveLength(8);
  });

  it("gives every lesson at least one step", () => {
    for (const l of OUTREACH_PLAYBOOK.sections.flatMap((s) => s.lessons)) {
      expect(l.steps?.length, l.slug).toBeGreaterThan(0);
    }
  });

  it("points every step at a real founder menu item", () => {
    for (const s of steps) {
      expect(nav.has(s.href), `${s.title}: ${s.href}`).toBe(true);
      const last = s.menuPath[s.menuPath.length - 1];
      expect(nav.get(s.href)!.has(last), `${s.title}: ${last}`).toBe(true);
    }
  });

  it("uses unique lesson slugs and never promises an outcome", () => {
    const slugs = OUTREACH_PLAYBOOK.sections.flatMap((s) => s.lessons.map((l) => l.slug));
    expect(new Set(slugs).size).toBe(slugs.length);
    const text = JSON.stringify(OUTREACH_PLAYBOOK).toLowerCase();
    expect(text).not.toMatch(/guarantee|will raise|assured/);
  });
});
