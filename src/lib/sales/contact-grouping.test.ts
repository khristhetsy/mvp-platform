import { describe, it, expect } from "vitest";
import {
  bucketRows,
  bucketLabel,
  isGroupBy,
  NONE,
  type LiteRow,
} from "./contact-grouping";

// These pin the "Group by" bucketing behaviour that regressed twice (multi-word
// facet values, and the Unassigned count-vs-rows mismatch). The matching WHERE
// clauses now live in SQL — see search-contacts.pg.test.ts for those.

const rows: LiteRow[] = [
  {
    id: "1", contact_type: "investor", module: null, country: "US", company: "Acme",
    source: "odoo", created_on: "2026-09-01", assignee_ids: ["u1"],
    profile: { industries: ["FinTech", "Health"], investorTypes: ["Venture Capital"], leadSource: "LinkedIn" },
    lead_override: null,
  },
  {
    id: "2", contact_type: "founder", module: null, country: "US", company: null,
    source: "manual", created_on: "2026-08-15", assignee_ids: [],
    profile: { industries: [] }, // empty array → Unassigned
    lead_override: "SEC Form D", // override wins for lead source
  },
  {
    id: "3", contact_type: null, module: null, country: null, company: "Acme",
    source: null, created_on: null, assignee_ids: null,
    profile: null, lead_override: null, // fully unassigned
  },
];

const countMap = (dim: string) => Object.fromEntries(bucketRows(rows, dim).map((b) => [b.value, b.count]));

describe("bucketRows", () => {
  it("facet arrays: a row lands in each value; empty array + missing → Unassigned", () => {
    expect(countMap("industries")).toEqual({ FinTech: 1, Health: 1, [NONE]: 2 });
  });

  it("profile groups by role; unknown contact_type → other", () => {
    expect(countMap("profile")).toEqual({ investor: 1, founder: 1, other: 1 });
  });

  it("lead source: override wins over profile; only both-empty is Unassigned", () => {
    expect(countMap("leadSource")).toEqual({ LinkedIn: 1, "SEC Form D": 1, [NONE]: 1 });
  });

  it("scalars and month bucket one value per row, null → Unassigned", () => {
    expect(countMap("country")).toEqual({ US: 2, [NONE]: 1 });
    expect(countMap("company")).toEqual({ Acme: 2, [NONE]: 1 });
    expect(countMap("createdMonth")).toEqual({ "2026-09": 1, "2026-08": 1, [NONE]: 1 });
  });

  it("assignees: one bucket per id; no/empty ids → Unassigned", () => {
    expect(countMap("assignees")).toEqual({ u1: 1, [NONE]: 2 });
  });

  it("sorts by count desc with Unassigned always last", () => {
    const order = bucketRows(rows, "industries").map((b) => b.value);
    expect(order[order.length - 1]).toBe(NONE);
  });
});

describe("bucketLabel", () => {
  it("maps roles, months, assignees and NONE to readable text", () => {
    expect(bucketLabel("profile", "investor")).toBe("Investors");
    expect(bucketLabel("createdMonth", "2026-09")).toBe("Sep 2026");
    expect(bucketLabel("assignees", "u1", new Map([["u1", "Dana"]]))).toBe("Dana");
    expect(bucketLabel("industries", NONE)).toBe("Unassigned");
    expect(bucketLabel("industries", "FinTech")).toBe("FinTech");
  });
});

describe("isGroupBy", () => {
  it("accepts known dimensions and rejects others", () => {
    expect(isGroupBy("industries")).toBe(true);
    expect(isGroupBy("createdMonth")).toBe(true);
    expect(isGroupBy("bogus")).toBe(false);
    expect(isGroupBy(null)).toBe(false);
  });
});
