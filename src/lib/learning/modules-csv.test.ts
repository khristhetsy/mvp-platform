import { describe, expect, it } from "vitest";
import { toModulesCsv } from "./modules-csv";

describe("toModulesCsv", () => {
  it("writes a header and one line per module", () => {
    const csv = toModulesCsv([{ module: "Cap table 101", slug: "cs0-cap-table-101", stage: "Stage 0", lessons: 2, linkedCourse: "", status: "unlinked" }]);
    expect(csv.split("\n")).toEqual([
      "Module,Slug,Stage,Lessons,Linked course,Status",
      "Cap table 101,cs0-cap-table-101,Stage 0,2,,unlinked",
    ]);
  });

  it("quotes cells that contain commas or quotes", () => {
    const csv = toModulesCsv([{ module: 'Series A, "metrics"', slug: "s", stage: "Stage 2", lessons: 1, linkedCourse: "", status: "unlinked" }]);
    expect(csv.split("\n")[1]).toBe('"Series A, ""metrics""",s,Stage 2,1,,unlinked');
  });

  it("returns only the header when there are no rows", () => {
    expect(toModulesCsv([])).toBe("Module,Slug,Stage,Lessons,Linked course,Status");
  });
});
