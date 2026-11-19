import { describe, expect, it } from "vitest";
import { adminWorkspaceNavLeaves } from "@/lib/workspace-nav";
import { ADMIN_NAV_SOP_COVERAGE } from "./nav-coverage";
import { ADMIN_SOPS, getSopById } from "./library";

describe("Operations Manual covers the admin sidebar", () => {
  it("every admin sidebar page maps to at least one procedure", () => {
    const missing = adminWorkspaceNavLeaves()
      .map(({ item }) => item.href)
      .filter((href) => !(ADMIN_NAV_SOP_COVERAGE[href]?.length));
    expect(
      missing,
      `Sidebar pages with no Operations Manual procedure: ${missing.join(", ")}. ` +
        "Add or update a procedure in src/lib/admin-sop and map the page in nav-coverage.ts.",
    ).toEqual([]);
  });

  it("every mapped procedure exists", () => {
    const bad = Object.entries(ADMIN_NAV_SOP_COVERAGE).flatMap(([href, ids]) =>
      ids.filter((id) => !getSopById(id)).map((id) => `${href} → SOP ${id}`),
    );
    expect(bad).toEqual([]);
  });

  it("every mapped page is still in the sidebar", () => {
    const live = new Set(adminWorkspaceNavLeaves().map(({ item }) => item.href));
    const stale = Object.keys(ADMIN_NAV_SOP_COVERAGE).filter((href) => !live.has(href));
    expect(stale, `Remove pages no longer in the sidebar from nav-coverage.ts: ${stale.join(", ")}`).toEqual([]);
  });

  it("procedure ids are unique and in order", () => {
    const ids = ADMIN_SOPS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual([...ids].sort((a, b) => a - b));
  });
});
