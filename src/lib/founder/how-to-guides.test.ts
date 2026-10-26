import { describe, expect, it } from "vitest";
import { HOW_TO_GUIDES } from "./how-to-guides";
import { guideByKey, guideForPath } from "./how-to-lookup";

describe("founder how to guides", () => {
  it("has one guide per feature, with unique keys and routes", () => {
    expect(HOW_TO_GUIDES).toHaveLength(40);
    const keys = HOW_TO_GUIDES.map((g) => g.key);
    expect(new Set(keys).size).toBe(keys.length);
    const routes = HOW_TO_GUIDES.flatMap((g) => g.routes);
    expect(new Set(routes).size).toBe(routes.length);
    for (const r of routes) expect(r.startsWith("/founder/")).toBe(true);
  });

  it("gives every guide 3 to 5 complete steps with no dashes as punctuation", () => {
    for (const g of HOW_TO_GUIDES) {
      expect(g.steps.length, g.key).toBeGreaterThanOrEqual(3);
      expect(g.steps.length, g.key).toBeLessThanOrEqual(5);
      for (const s of g.steps) {
        for (const text of [g.title, s.title, s.desc, s.then]) {
          expect(text.trim().length, g.key).toBeGreaterThan(0);
          expect(text, g.key).not.toMatch(/[–—]| - /);
        }
        expect(s.tap.label.trim().length, g.key).toBeGreaterThan(0);
      }
    }
  });

  it("finds a guide by exact route, ignoring a trailing slash and query", () => {
    expect(guideForPath("/founder/readiness/data-room")?.key).toBe("data-room");
    expect(guideForPath("/founder/readiness/data-room/")?.key).toBe("data-room");
    expect(guideForPath("/founder/tasks?tab=done")?.key).toBe("tasks");
    expect(guideForPath("/founder/messages")?.key).toBe("inbox");
    expect(guideForPath("/founder/schedule")?.key).toBe("calendar");
  });

  it("never shows a parent guide on a child page, or a guide on pages that have their own", () => {
    expect(guideForPath("/founder/readiness")?.key).toBe("readiness-checklist");
    expect(guideForPath("/founder/readiness/missing")).toBeNull();
    expect(guideForPath("/founder/deploy")).toBeNull();
    expect(guideForPath("/founder/investor-directory")).toBeNull();
    expect(guideForPath("/admin/dashboard")).toBeNull();
    expect(guideForPath(null)).toBeNull();
  });

  it("serves the automated outreach guide by key", () => {
    expect(guideByKey("outreach-automated")?.routes).toEqual([]);
    expect(guideByKey("nope")).toBeNull();
  });
});
