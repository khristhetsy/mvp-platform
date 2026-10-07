import { describe, it, expect, vi } from "vitest";
vi.mock("@/lib/ir/db", () => ({ db: vi.fn(), entrepreneurProfile: vi.fn(), getProject: vi.fn() }));
import { raiseFromRequest, splitNumbered } from "./branded-prefill";

describe("raiseFromRequest", () => {
  it("reads the raise out of Odoo's request note", () => {
    expect(raiseFromRequest("Raise-2.5-Mil-Revenue-150-200K")).toBe("$2.5M");
    expect(raiseFromRequest("raise $500k seed")).toBe("$500K");
    expect(raiseFromRequest("Raise 3 million")).toBe("$3M");
  });
  it("is null when no amount is written", () => {
    expect(raiseFromRequest("Intro call next week")).toBeNull();
    expect(raiseFromRequest("")).toBeNull();
  });
});

describe("splitNumbered", () => {
  it("puts each numbered highlight on its own line", () => {
    expect(splitNumbered("1. Founder fit Forty years. 2. Proof Seven customers. 3. Revenue RTM.")).toBe(
      "Founder fit Forty years.\nProof Seven customers.\nRevenue RTM.",
    );
  });
  it("keeps unnumbered text", () => {
    expect(splitNumbered("One block of text.")).toBe("One block of text.");
  });
  it("does not split on numbers inside a highlight", () => {
    expect(splitNumbered("1. Scale 33 sites, 1,111 patients. 2. Exits 19 collective exits.")).toBe(
      "Scale 33 sites, 1,111 patients.\nExits 19 collective exits.",
    );
  });
});
