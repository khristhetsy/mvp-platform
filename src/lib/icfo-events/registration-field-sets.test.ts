import { describe, it, expect } from "vitest";
import {
  diffFieldSets,
  keyIsLocked,
  resolveField,
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
