import { describe, expect, it } from "vitest";
import {
  adminWorkspaceNavSections,
  founderWorkspaceNavSections,
  founderWorkspaceNavSectionsV2,
  investorWorkspaceNavSections,
  type WorkspaceNavItem,
  type WorkspaceNavSection,
} from "@/lib/workspace-nav";
import { getWorkspaceNavIcon } from "@/lib/ui/nav-icons";

/** Every href a workspace menu shows, top level and nested, once each. */
function menuHrefs(sections: WorkspaceNavSection[]): string[] {
  const out = new Set<string>();
  const walk = (items: WorkspaceNavItem[]) => {
    for (const it of items) {
      out.add(it.href);
      if (it.children?.length) walk(it.children);
    }
  };
  for (const s of sections) walk(s.items);
  return [...out];
}

/** Pairs of different pages in one menu that would show the same icon. */
function duplicateIcons(sections: WorkspaceNavSection[]): string[] {
  const byIcon = new Map<unknown, string[]>();
  for (const href of menuHrefs(sections)) {
    const icon = getWorkspaceNavIcon(href);
    byIcon.set(icon, [...(byIcon.get(icon) ?? []), href]);
  }
  return [...byIcon.values()].filter((hrefs) => hrefs.length > 1).map((hrefs) => hrefs.join(" = "));
}

describe("workspace menu icons", () => {
  it.each([
    ["founder", founderWorkspaceNavSectionsV2],
    ["founder classic", founderWorkspaceNavSections],
    ["investor", investorWorkspaceNavSections],
    ["admin", adminWorkspaceNavSections],
  ] as const)("no icon is used twice in the %s menu", (_name, sections) => {
    expect(duplicateIcons(sections)).toEqual([]);
  });
});
