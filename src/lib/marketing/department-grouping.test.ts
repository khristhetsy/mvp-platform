import { describe, it, expect } from "vitest";
import { DEPARTMENTS, UNASSIGNED, departmentOf, groupByDepartment } from "./department-grouping";

describe("departmentOf", () => {
  it("prefers an optimistic override, then the saved value, then Unassigned", () => {
    expect(departmentOf("Sales")).toBe("Sales");
    expect(departmentOf("Sales", "Events")).toBe("Events"); // override wins
    expect(departmentOf(null)).toBe(UNASSIGNED);
    expect(departmentOf(undefined, undefined)).toBe(UNASSIGNED);
    expect(departmentOf("", null)).toBe(UNASSIGNED); // empty string → Unassigned
  });
});

describe("groupByDepartment", () => {
  type Row = { id: string; dept: string | null };
  const deptOf = (r: Row) => departmentOf(r.dept);

  it("groups in fixed DEPARTMENTS + Unassigned order and drops empty groups", () => {
    const rows: Row[] = [
      { id: "a", dept: "Events" },
      { id: "b", dept: "Sales" },
      { id: "c", dept: null },
      { id: "d", dept: "Sales" },
    ];
    const grouped = groupByDepartment(rows, deptOf);
    expect(grouped.map((g) => g.dept)).toEqual(["Sales", "Events", UNASSIGNED]);
    expect(grouped.find((g) => g.dept === "Sales")!.items.map((r) => r.id)).toEqual(["b", "d"]);
    expect(grouped.find((g) => g.dept === UNASSIGNED)!.items.map((r) => r.id)).toEqual(["c"]);
    // Marketing/IR/Administration are empty → not present
    expect(grouped.some((g) => g.dept === "Marketing")).toBe(false);
  });

  it("returns nothing for an empty input", () => {
    expect(groupByDepartment([] as Row[], deptOf)).toEqual([]);
  });

  it("keeps DEPARTMENTS as the canonical five", () => {
    expect(DEPARTMENTS).toEqual(["Sales", "Investor Relations", "Marketing", "Administration", "Events"]);
  });
});
