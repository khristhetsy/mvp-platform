import { describe, it, expect } from "vitest";
import { renderDesign } from "./design-render";
import { DESIGN_SIZES, type DesignSize } from "./design-config";

function dims(png: Buffer): [number, number] {
  return [png.readUInt32BE(16), png.readUInt32BE(20)];
}

describe("renderDesign", () => {
  const spec = { headline: "Know your Capital Readiness", subline: "Your rating, in minutes", button: "Take the fit quiz", stat: { value: "72", label: "out of 100" } };
  for (const size of Object.keys(DESIGN_SIZES) as DesignSize[]) {
    it(`draws a PNG at the exact ${size} size`, async () => {
      const png = await renderDesign(spec, "brand", size, "left", "circles");
      expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
      expect(dims(png)).toEqual([DESIGN_SIZES[size].w, DESIGN_SIZES[size].h]);
    });
  }
  it("draws the centered layout with no extras", async () => {
    const png = await renderDesign({ headline: "Just a headline" }, "light", "square", "center", "none");
    expect(dims(png)).toEqual([1080, 1080]);
  });
});
