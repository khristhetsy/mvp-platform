import { describe, expect, it } from "vitest";
import { buildCoverageTiles } from "./coverage";

describe("buildCoverageTiles", () => {
  const tiles = buildCoverageTiles();

  it("has a tile for every top level sidebar entry", () => {
    expect(tiles.length).toBeGreaterThan(15);
    expect(tiles.map((t) => t.label)).toContain("Accounting");
  });

  it("every tile is fully covered with procedures listed", () => {
    for (const t of tiles) {
      expect(t.coveredPages, t.label).toBe(t.pages);
      expect(t.sopIds.length, t.label).toBeGreaterThan(0);
      expect(t.anchor, t.label).not.toBeNull();
    }
  });
});
