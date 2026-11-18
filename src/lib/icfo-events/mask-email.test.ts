import { describe, it, expect } from "vitest";
import { maskEmail } from "@/lib/icfo-events/mask-email";

describe("maskEmail", () => {
  it("keeps the first letter and the domain", () => {
    expect(maskEmail("dana@northline.com")).toBe("d***@northline.com");
  });

  it("hides a one letter name just the same", () => {
    expect(maskEmail("d@northline.com")).toBe("d***@northline.com");
  });

  it("gives nothing away when there is no name or no @", () => {
    expect(maskEmail("@northline.com")).toBe("***");
    expect(maskEmail("nope")).toBe("***");
  });
});
