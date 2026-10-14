import { describe, expect, it } from "vitest";
import { attributeIntros } from "./founder-intros";

describe("attributeIntros", () => {
  it("counts only intros whose investor came through a tracked link", () => {
    const r = attributeIntros(["a@x.com", "B@X.com", "c@x.com", null], { camp_1: ["a@x.com"], camp_2: ["b@x.com"] });
    expect(r.total).toBe(4);
    expect(r.fromLinks).toBe(2);
    expect(r.byTag).toEqual({ camp_1: 1, camp_2: 1 });
  });
  it("is zero when no investor came through a link", () => {
    expect(attributeIntros(["a@x.com"], { camp_1: [] })).toEqual({ total: 1, fromLinks: 0, byTag: {} });
  });
  it("counts an investor once, to the first tag", () => {
    const r = attributeIntros(["a@x.com"], { camp_1: ["a@x.com"], camp_2: ["a@x.com"] });
    expect(r.fromLinks).toBe(1);
    expect(r.byTag).toEqual({ camp_1: 1 });
  });
});
