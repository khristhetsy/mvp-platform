import { describe, expect, it } from "vitest";
import {
  DIFF_VALUE_ALLOWLIST,
  describeChange,
  diffSnapshots,
  formatDiffValue,
  summarizeDiff,
} from "@/lib/activity/diff";

describe("the allow-list decides whether a value is stored", () => {
  it("keeps before and after for an allow-listed field", () => {
    // "$750,000 → $400,000" is the whole reason a diff is worth having — a bare
    // "profile updated" would make you open the company to learn anything.
    const diff = diffSnapshots({ funding_amount: 750000 }, { funding_amount: 400000 });
    expect(diff.changes).toEqual([{ field: "funding_amount", from: 750000, to: 400000 }]);
  });

  it("records only the NAME for a field that is not allow-listed", () => {
    // Founder business prose in a second table with its own retention is a real
    // cost. The field name says enough to act on.
    const diff = diffSnapshots(
      { business_description: "Old summary" },
      { business_description: "New summary" },
    );
    expect(diff.changes).toEqual([{ field: "business_description" }]);
    expect(diff.changes[0]).not.toHaveProperty("from");
  });

  it("does not quietly allow-list free-text fields", () => {
    for (const field of ["business_description", "notes", "use_of_funds", "key_highlights"]) {
      expect(DIFF_VALUE_ALLOWLIST.has(field)).toBe(false);
    }
  });
});

describe("what counts as a change", () => {
  it("ignores whitespace-only and empty-to-null edits", () => {
    // Re-saving a form must not read as a founder edit.
    expect(diffSnapshots({ arr: "  " }, { arr: null }).changed).toBe(false);
    expect(diffSnapshots({ arr: "100k" }, { arr: " 100k " }).changed).toBe(false);
  });

  it("treats undefined and null as the same absence", () => {
    expect(diffSnapshots({ mrr: undefined }, { mrr: null }).changed).toBe(false);
  });

  it("compares arrays and objects by value", () => {
    expect(diffSnapshots({ tags: ["a", "b"] }, { tags: ["a", "b"] }).changed).toBe(false);
    expect(diffSnapshots({ tags: ["a"] }, { tags: ["a", "b"] }).changed).toBe(true);
  });

  it("only looks at the fields the route actually writes", () => {
    // A trigger touching updated_at must not read as a founder edit.
    const before = { funding_amount: 1, updated_at: "t1" };
    const after = { funding_amount: 1, updated_at: "t2" };
    expect(diffSnapshots(before, after).changed).toBe(true);
    expect(diffSnapshots(before, after, ["funding_amount"]).changed).toBe(false);
  });

  it("returns no change when a snapshot is missing", () => {
    expect(diffSnapshots(null, { a: 1 }).changed).toBe(false);
    expect(diffSnapshots({ a: 1 }, null).changed).toBe(false);
  });
});

describe("how a change reads", () => {
  it("renders an allow-listed change with both values", () => {
    expect(describeChange({ field: "funding_amount", from: 750000, to: 400000 })).toBe(
      "funding amount 750,000 → 400,000",
    );
  });

  it("renders a name-only change as the field name", () => {
    expect(describeChange({ field: "business_description" })).toBe("business description");
  });

  it("shows an absent value as a dash rather than 'null'", () => {
    expect(formatDiffValue(null)).toBe("—");
    expect(formatDiffValue(undefined)).toBe("—");
    expect(formatDiffValue(false)).toBe("no");
  });

  it("caps the summary and says how many were left out", () => {
    const diff = diffSnapshots(
      { funding_amount: 1000, arr: "a", mrr: "b", stage: "x" },
      { funding_amount: 2000, arr: "c", mrr: "d", stage: "y" },
    );
    expect(summarizeDiff(diff, 2)).toContain("and 2 more");
  });

  it("says 'no change' rather than an empty string", () => {
    expect(summarizeDiff(diffSnapshots({ a: 1 }, { a: 1 }))).toBe("no change");
  });
});
