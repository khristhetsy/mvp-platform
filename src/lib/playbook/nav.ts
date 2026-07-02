// The playbook does NOT keep its own module list. It reads the SAME admin nav
// registry the sidebar renders from, flattened to a stable surface list. This
// shared source is what guarantees the doc can't drift from the menu.
//
// Stable id = the item's href (already unique + stable across renames; renaming
// only changes the label, which the playbook follows automatically).

import { adminWorkspaceNavSections } from "@/lib/workspace-nav";

export interface PlaybookNavSurface {
  id: string; // = href, the join key against playbook_module.nav_id
  label: string; // follows the menu — always current
  group: string; // the nav section title (e.g. "Operation", "Reports")
  href: string;
}

/** Flatten the admin nav sections into the surface list the playbook loops over. */
export function playbookNavSurfaces(): PlaybookNavSurface[] {
  const out: PlaybookNavSurface[] = [];
  const seen = new Set<string>();
  for (const section of adminWorkspaceNavSections) {
    for (const item of section.items) {
      if (!seen.has(item.href)) {
        seen.add(item.href);
        out.push({ id: item.href, label: item.label, group: section.title ?? "", href: item.href });
      }
    }
  }
  return out;
}

export function playbookNavIds(): Set<string> {
  return new Set(playbookNavSurfaces().map((s) => s.id));
}
