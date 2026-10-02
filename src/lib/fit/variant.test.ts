import { describe, it, expect } from "vitest";
import { bucketOf, variantFor, forcedVariant } from "./variant";

describe("fit variant bucketing", () => {
  it("buckets from the first 32 bits of the uuid", () => {
    // 0x00000063 = 99
    expect(bucketOf("00000063-0000-4000-8000-000000000000")).toBe(99);
    expect(bucketOf("00000000-0000-4000-8000-000000000000")).toBe(0);
  });

  it("is deterministic and respects the rollout share", () => {
    const low = "00000001-aaaa-4000-8000-000000000000"; // bucket 1
    const high = "00000062-aaaa-4000-8000-000000000000"; // bucket 98
    expect(variantFor(low, 50)).toBe("v2");
    expect(variantFor(high, 50)).toBe("v1");
    expect(variantFor(high, 100)).toBe("v2");
    expect(variantFor(low, 0)).toBe("v1");
  });

  it("keeps malformed ids on the control arm", () => {
    expect(bucketOf("not-a-uuid")).toBeNull();
    expect(variantFor("not-a-uuid", 100)).toBe("v1");
  });

  it("splits a random population near the share", () => {
    let v2 = 0;
    for (let i = 0; i < 4000; i++) {
      const id = crypto.randomUUID();
      if (variantFor(id, 50) === "v2") v2++;
    }
    expect(v2 / 4000).toBeGreaterThan(0.45);
    expect(v2 / 4000).toBeLessThan(0.55);
  });

  it("accepts only explicit overrides", () => {
    expect(forcedVariant("2")).toBe("v2");
    expect(forcedVariant("v1")).toBe("v1");
    expect(forcedVariant("3")).toBeNull();
    expect(forcedVariant(undefined)).toBeNull();
  });
});
