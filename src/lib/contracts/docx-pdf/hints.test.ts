import { describe, expect, it } from "vitest";
import { SUBSCRIPTION_SEEDS } from "../subscription/seeds";
import { paragraphHints } from "./model";

describe("paragraphHints", () => {
  it("reads centering, hanging indent, check box labels and dotted right tabs from the Memorandum and letters", async () => {
    const ppm = SUBSCRIPTION_SEEDS.find((x) => x.key === "sub_ppm")!;
    const h = await paragraphHints(Buffer.from(ppm.base64, "base64"));
    const all = Object.values(h);
    expect(all.length).toBeGreaterThan(100);
    expect(all.some((x) => x.align === "center")).toBe(true);
    expect(all.some((x) => x.firstLine < 0 && x.left > 0)).toBe(true);
    expect(all.some((x) => x.tabs.some((t) => t.type === "right" && t.leader === "dot"))).toBe(true);
  });
});
