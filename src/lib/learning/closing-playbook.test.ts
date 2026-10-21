import { describe, expect, it } from "vitest";
import { CLOSING_PLAYBOOK } from "@/lib/learning/closing-playbook";
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
const steps = CLOSING_PLAYBOOK.sections.flatMap((s) => s.lessons.flatMap((l) => l.steps ?? []));

describe("closing playbook", () => {
  it("has twelve modules", () => {
    expect(CLOSING_PLAYBOOK.sections.flatMap((s) => s.lessons)).toHaveLength(12);
  });

  it("gives every lesson at least one step", () => {
    for (const l of CLOSING_PLAYBOOK.sections.flatMap((s) => s.lessons)) {
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
    const slugs = CLOSING_PLAYBOOK.sections.flatMap((s) => s.lessons.map((l) => l.slug));
    expect(new Set(slugs).size).toBe(slugs.length);
    const text = JSON.stringify(CLOSING_PLAYBOOK).toLowerCase();
    expect(text).not.toMatch(/guarantee|will raise|assured/);
    // Structure, terms and valuation are the founder's decisions with counsel; the course says so.
    for (const slug of ["offering-type", "term-sheet", "valuation"]) {
      const l = CLOSING_PLAYBOOK.sections[0].lessons.find((x) => x.slug === slug)!;
      expect(l.content.toLowerCase()).toMatch(/educational only|not legal/);
    }
  });

  it("gives every step that names a control a learning id, and names the control as the app does", () => {
    for (const s of steps) {
      if (s.control) expect(s.learningId, `${s.title} needs a learningId`).toBeTruthy();
      if (s.learningId) expect(s.control, `${s.title} needs a control label`).toBeTruthy();
    }
  });
});
