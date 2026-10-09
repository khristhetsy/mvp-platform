import { describe, expect, it } from "vitest";
import { addUp, allowanceKeyFor, decideEmailStart, emailCapMessage, pickAllowance, sendBudget, DEFAULT_ALLOWANCES } from "@/lib/investor-directory/allowance";
import { FREE_TIER } from "@/lib/investor-directory/types";

const plus1k = { ...FREE_TIER, key: "directory_1k", label: "Directory +1k", hold_limit: 1000, email_limit: 2000 };

describe("allowances", () => {
  it("maps plans to allowance rows", () => {
    expect(allowanceKeyFor("founder_basic")).toBe("founder_basic");
    expect(allowanceKeyFor("founder_trial")).toBe("founder_basic");
    expect(allowanceKeyFor("founder_professional")).toBe("founder_professional");
    expect(allowanceKeyFor("founder_premium")).toBe("founder_premium");
    expect(allowanceKeyFor("founder_managed_ir")).toBe("founder_premium");
    expect(allowanceKeyFor("founder_free")).toBe("founder_free");
    expect(allowanceKeyFor(null)).toBe("founder_free");
  });
  it("uses the stored row, falling back to defaults", () => {
    expect(pickAllowance([], "founder_basic")).toMatchObject({ contacts: 500, emails_per_month: 1000 });
    expect(pickAllowance([{ ...DEFAULT_ALLOWANCES[1], contacts: 700 }], "founder_basic").contacts).toBe(700);
  });
  it("adds the top up to the plan", () => {
    expect(addUp(DEFAULT_ALLOWANCES[1], plus1k)).toEqual({ contacts: 1500, emails: 3000 });
    expect(addUp(DEFAULT_ALLOWANCES[3], FREE_TIER)).toEqual({ contacts: 20000, emails: 40000 });
  });
});

describe("decideEmailStart", () => {
  it("allows a start that fits", () => {
    expect(decideEmailStart(1000, 850, 150)).toEqual({ ok: true, remaining: 150 });
    expect(decideEmailStart(1000, 1000, 0)).toEqual({ ok: true, remaining: 0 });
  });
  it("refuses at the cap and over it", () => {
    expect(decideEmailStart(1000, 1000, 1)).toMatchObject({ ok: false, reason: "cap_reached" });
    const over = decideEmailStart(1000, 850, 200);
    expect(over).toMatchObject({ ok: false, reason: "over_cap", remaining: 150 });
    if (!over.ok) expect(emailCapMessage(over, "Nov 1")).toContain("Remove 50 recipients");
  });
  it("budgets the send pass", () => {
    expect(sendBudget(1000, 990)).toBe(10);
    expect(sendBudget(1000, 1200)).toBe(0);
  });
});
