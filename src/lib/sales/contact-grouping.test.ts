import { describe, it, expect } from "vitest";
import {
  GROUP_DIMS,
  bucketRows,
  bucketLabel,
  isGroupBy,
  NONE,
  type LiteRow,
} from "./contact-grouping";

// These pin the "Group by" bucketing + filter behaviour that regressed twice
// (multi-word facet values, and the Unassigned count-vs-rows mismatch). The
// filter tests assert the exact PostgREST operands so an accidental edit that
// re-breaks Unassigned or multi-word values fails here rather than in the UI.

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

// Records the query-builder method calls so we can assert the operands.
function mockQuery() {
  const calls: Array<{ m: string; args: unknown[] }> = [];
  const q: Record<string, (...a: unknown[]) => unknown> = {};
  for (const m of ["or", "filter", "is", "eq", "gte", "lt", "contains"]) {
    q[m] = (...args: unknown[]) => { calls.push({ m, args }); return q; };
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { q: q as any, calls };
}

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

describe("applyGroupFilter operands", () => {
  it("facet value uses .filter() containment (survives multi-word values)", () => {
    const { q, calls } = mockQuery();
    GROUP_DIMS.investorTypes.applyFilter(q, "Venture Capital");
    expect(calls).toContainEqual({ m: "filter", args: ["raw->__profile->investorTypes", "cs", '["Venture Capital"]'] });
  });

  it("facet Unassigned matches BOTH null and empty array", () => {
    const { q, calls } = mockQuery();
    GROUP_DIMS.industries.applyFilter(q, NONE);
    expect(calls).toContainEqual({ m: "or", args: ["raw->__profile->industries.is.null,raw->__profile->>industries.eq.[]"] });
  });

  it("lead-source Unassigned requires override AND profile null", () => {
    const { q, calls } = mockQuery();
    GROUP_DIMS.leadSource.applyFilter(q, NONE);
    expect(calls).toContainEqual({ m: "is", args: ["overrides->lead_source", null] });
    expect(calls).toContainEqual({ m: "is", args: ["raw->__profile->leadSource", null] });
  });

  it("scalars use eq for a value and is-null for Unassigned", () => {
    const v = mockQuery(); GROUP_DIMS.country.applyFilter(v.q, "US");
    expect(v.calls).toContainEqual({ m: "eq", args: ["country", "US"] });
    const n = mockQuery(); GROUP_DIMS.country.applyFilter(n.q, NONE);
    expect(n.calls).toContainEqual({ m: "is", args: ["country", null] });
  });

  it("assignees use contains for an id and or() for Unassigned", () => {
    const v = mockQuery(); GROUP_DIMS.assignees.applyFilter(v.q, "u1");
    expect(v.calls).toContainEqual({ m: "contains", args: ["assignee_ids", ["u1"]] });
    const n = mockQuery(); GROUP_DIMS.assignees.applyFilter(n.q, NONE);
    expect(n.calls).toContainEqual({ m: "or", args: ["assignee_ids.is.null,assignee_ids.eq.{}"] });
  });

  it("createdMonth builds a half-open month range, handling December rollover", () => {
    const a = mockQuery(); GROUP_DIMS.createdMonth.applyFilter(a.q, "2026-09");
    expect(a.calls).toContainEqual({ m: "gte", args: ["created_on", "2026-09-01"] });
    expect(a.calls).toContainEqual({ m: "lt", args: ["created_on", "2026-10-01"] });
    const d = mockQuery(); GROUP_DIMS.createdMonth.applyFilter(d.q, "2026-12");
    expect(d.calls).toContainEqual({ m: "lt", args: ["created_on", "2027-01-01"] });
  });

  it("profile matches contact_type OR module", () => {
    const { q, calls } = mockQuery();
    GROUP_DIMS.profile.applyFilter(q, "investor");
    expect(calls).toContainEqual({ m: "or", args: ["contact_type.eq.investor,module.eq.investor"] });
  });
});
