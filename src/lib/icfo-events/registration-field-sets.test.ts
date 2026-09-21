import { describe, it, expect } from "vitest";
import {
  diffFieldSets,
  keyIsLocked,
  resolveField,
  resolvedOptionsFor,
  sharedOptionList,
  sharedOptions,
  validateFieldSet,
  type FieldSet,
  type StoredField,
} from "@/lib/icfo-events/registration-field-sets";

const base = (over: Partial<FieldSet> = {}): FieldSet => ({
  version: "v1",
  roles: [{ key: "investor", label: "Investor" }],
  common: [{ key: "name", label: "Full name", kind: "text", required: true }],
  byType: {
    investor: [
      { key: "checkSize", label: "Typical check size", kind: "select", options: ["< $25k", "$25k+"], required: true },
    ],
  },
  ...over,
});

describe("options that are linked, not copied", () => {
  it("fills a linked field from the shared sector list", () => {
    const f: StoredField = { key: "sectors", label: "Sectors", kind: "chips", optionsFrom: "sectors" };
    const resolved = resolveField(f);
    expect(resolved.options?.length).toBe(sharedOptions("sectors").length);
    expect(resolved.options?.length).toBeGreaterThan(0);
  });

  it("counts linked options as present, so a linked field isn't flagged empty", () => {
    const set = base({
      byType: { investor: [{ key: "sectors", label: "Sectors", kind: "chips", optionsFrom: "sectors" }] },
    });
    expect(validateFieldSet(set)).toEqual([]);
  });

  it("exposes a stable value beside each label, so a reworded label keeps its selection", () => {
    const sectors = sharedOptionList("sectors");
    expect(sectors).toContainEqual({ value: "fintech", label: "FinTech" });
    expect(sectors).toContainEqual({ value: "ai-ml", label: "AI / ML" });
    // Countries have no slug of their own; value and label are the same string.
    expect(sharedOptionList("countries").every((o) => o.value === o.label)).toBe(true);
  });
});

describe("a linked list can be narrowed without being copied", () => {
  const sectors: StoredField = { key: "sectors", label: "Sectors", kind: "chips", optionsFrom: "sectors" };

  it("offers everything when nothing is included — an untouched set is unchanged", () => {
    expect(resolvedOptionsFor(sectors)).toEqual(sharedOptions("sectors"));
  });

  it("offers only what is included", () => {
    const f: StoredField = { ...sectors, include: ["fintech", "ai-ml"] };
    expect(resolvedOptionsFor(f)).toEqual(["FinTech", "AI / ML"]);
  });

  it("keeps the shared list's order, not the order values were ticked in", () => {
    const f: StoredField = { ...sectors, include: ["other", "fintech", "healthtech"] };
    expect(resolvedOptionsFor(f)).toEqual(["FinTech", "HealthTech", "Other"]);
  });

  it("ignores a value that has left the shared list rather than inventing an option", () => {
    const f: StoredField = { ...sectors, include: ["fintech", "web3"] };
    expect(resolvedOptionsFor(f)).toEqual(["FinTech"]);
  });

  it("renders the narrowed list, so the form shows what the editor promised", () => {
    const f: StoredField = { ...sectors, include: ["cleantech"] };
    expect(resolveField(f).options).toEqual(["CleanTech"]);
  });

  it("rejects switching every option off — that would render an unanswerable question", () => {
    const set = base({ byType: { investor: [{ ...sectors, include: [], required: true }] } });
    expect(validateFieldSet(set).join(" ")).toMatch(/at least one option/i);
  });

  it("names what a narrowed field stopped offering", () => {
    const before = base({ byType: { investor: [sectors] } });
    const after = base({ byType: { investor: [{ ...sectors, include: ["fintech"] }] } });
    const what = diffFieldSets(before, after).map((c) => ("what" in c ? c.what : "")).join(" ");
    expect(what).toMatch(/options changed/);
    expect(what).toMatch(/no longer offers/);
    expect(what).toMatch(/HealthTech/);
  });

  it("reports nothing when a full include list says what no include list already said", () => {
    const before = base({ byType: { investor: [sectors] } });
    const every = sharedOptionList("sectors").map((o) => o.value);
    const after = base({ byType: { investor: [{ ...sectors, include: every }] } });
    expect(diffFieldSets(before, after)).toEqual([]);
  });
});

describe("validation catches what would break the form", () => {
  it("accepts the baseline", () => {
    expect(validateFieldSet(base())).toEqual([]);
  });

  it("rejects two fields sharing a key — they'd overwrite each other's answers", () => {
    const set = base({
      byType: {
        investor: [
          { key: "dupe", label: "One", kind: "text" },
          { key: "dupe", label: "Two", kind: "text" },
        ],
      },
    });
    expect(validateFieldSet(set).join(" ")).toMatch(/used twice/i);
  });

  it("allows the same key in different groups", () => {
    // `sector` on founder and `sectors` on investor already coexist this way.
    const set = base({
      roles: [{ key: "investor", label: "Investor" }, { key: "founder", label: "Founder" }],
      byType: {
        investor: [{ key: "stage", label: "Stage focus", kind: "text" }],
        founder: [{ key: "stage", label: "Company stage", kind: "text" }],
      },
    });
    expect(validateFieldSet(set)).toEqual([]);
  });

  it("rejects a select with no options", () => {
    const set = base({ byType: { investor: [{ key: "x", label: "X", kind: "select", options: [] }] } });
    expect(validateFieldSet(set).join(" ")).toMatch(/at least one option/i);
  });

  it("rejects a required checkbox — a single yes/no can't be mandatory", () => {
    const set = base({ byType: { investor: [{ key: "ok", label: "Agree", kind: "checkbox", required: true }] } });
    expect(validateFieldSet(set).join(" ")).toMatch(/can't be required/i);
  });

  it("rejects a key that isn't a usable identifier", () => {
    for (const key of ["2fast", "has space", "dash-key", ""]) {
      const set = base({ byType: { investor: [{ key, label: "X", kind: "text" }] } });
      expect(validateFieldSet(set).length, key).toBeGreaterThan(0);
    }
  });
});

describe("a key that has been answered cannot be renamed", () => {
  it("locks once anyone has answered", () => {
    expect(keyIsLocked("checkSize", { checkSize: 412 })).toBe(true);
  });

  it("stays editable while nothing points at it", () => {
    expect(keyIsLocked("newField", {})).toBe(false);
    expect(keyIsLocked("newField", { newField: 0 })).toBe(false);
  });
});

describe("the diff makes a destructive change visible before it happens", () => {
  it("reports a removal with how many answers it strands", () => {
    const after = base({ byType: { investor: [] } });
    const changes = diffFieldSets(base(), after, { checkSize: 412 });
    expect(changes).toContainEqual({
      kind: "removed", group: "Investor", label: "Typical check size", answered: 412,
    });
  });

  it("reports an added field", () => {
    const after = base({
      byType: {
        investor: [
          ...base().byType.investor,
          { key: "raisedBefore", label: "Have you raised before?", kind: "checkbox" },
        ],
      },
    });
    expect(diffFieldSets(base(), after)).toContainEqual({
      kind: "added", group: "Investor", label: "Have you raised before?",
    });
  });

  it("reports a label change as a rename, not a removal", () => {
    const after = base({
      byType: { investor: [{ key: "checkSize", label: "Cheque size", kind: "select", options: ["< $25k", "$25k+"], required: true }] },
    });
    const changes = diffFieldSets(base(), after);
    expect(changes.some((c) => c.kind === "removed")).toBe(false);
    expect(changes.some((c) => c.kind === "changed" && c.what.includes("renamed from"))).toBe(true);
  });

  it("reports required → optional and option edits", () => {
    const after = base({
      byType: { investor: [{ key: "checkSize", label: "Typical check size", kind: "select", options: ["< $25k"], required: false }] },
    });
    const what = diffFieldSets(base(), after).map((c) => ("what" in c ? c.what : "")).join(" ");
    expect(what).toMatch(/now optional/);
    expect(what).toMatch(/options changed/);
  });

  it("says nothing changed when nothing did", () => {
    expect(diffFieldSets(base(), base())).toEqual([]);
  });
});
