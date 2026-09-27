import { describe, expect, it } from "vitest";
import { isInternalAccount } from "@/lib/notifications/internal-accounts";

describe("internal accounts", () => {
  it("skips @myicfos.com addresses and non-founder roles", () => {
    expect(isInternalAccount({ email: "info@myicfos.com", role: "founder" })).toBe(true);
    expect(isInternalAccount({ email: "GMena@MyICFOs.com", role: "admin" })).toBe(true);
    expect(isInternalAccount({ email: "someone@gmail.com", role: "admin" })).toBe(true);
  });
  it("keeps real founders", () => {
    expect(isInternalAccount({ email: "ergin@lipotechinc.com", role: "founder" })).toBe(false);
    expect(isInternalAccount({ email: "ergin@lipotechinc.com" })).toBe(false);
    expect(isInternalAccount({ email: null, role: "founder" })).toBe(false);
  });
});
