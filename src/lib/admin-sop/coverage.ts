import { adminWorkspaceNavSections, type WorkspaceNavItem } from "@/lib/workspace-nav";
import { ADMIN_NAV_SOP_COVERAGE } from "./nav-coverage";
import { sopAnchor } from "./types";

export interface CoverageTile {
  label: string;
  /** Sidebar pages under this section (the section itself when it has none). */
  pages: number;
  /** Pages that map to at least one procedure. */
  coveredPages: number;
  sopIds: number[];
  /** Anchor of the first procedure, for linking. */
  anchor: string | null;
}

function leavesOf(item: WorkspaceNavItem): WorkspaceNavItem[] {
  return item.children?.length ? item.children.flatMap(leavesOf) : [item];
}

/** One tile per top level sidebar entry, built from the live sidebar and the coverage map. */
export function buildCoverageTiles(): CoverageTile[] {
  const tiles: CoverageTile[] = [];
  for (const section of adminWorkspaceNavSections) {
    for (const item of section.items) {
      const leaves = leavesOf(item);
      const ids = new Set<number>();
      let covered = 0;
      for (const leaf of leaves) {
        const mapped = ADMIN_NAV_SOP_COVERAGE[leaf.href] ?? [];
        if (mapped.length) covered += 1;
        mapped.forEach((id) => ids.add(id));
      }
      const sopIds = [...ids].sort((a, b) => a - b);
      tiles.push({
        label: item.label,
        pages: leaves.length,
        coveredPages: covered,
        sopIds,
        anchor: sopIds.length ? sopAnchor(sopIds[0]) : null,
      });
    }
  }
  return tiles;
}
