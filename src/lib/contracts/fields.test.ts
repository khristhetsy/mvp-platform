import { describe, expect, it } from "vitest";
import { defaultCompanyName, defaultSpvName, formatCurrency, formatDate, formatPercent, groupCurrencyInput, linkedFieldValues, openFields, plainCurrency, resolveValues } from "./fields";
import type { IssuingEntity, TemplateField } from "./types";

const f = (token: string, required = true, default_value: string | null = null, type: TemplateField["type"] = "text"): TemplateField => ({ token, label: token, type, required, default_value, position_ref: [], sort_order: 0 });
const entity: IssuingEntity = { id: "e1", legal_name: "ICFO VENTURE GROUP, LLC", short_name: "iCFO Venture Group", address: null, signatory_name: null, signatory_title: null, active: true };

describe("formatting", () => {
  it("formats dates the way the signed term sheets write them", () => {
    expect(formatDate("2026-09-17")).toBe("September 17, 2026");
    expect(formatDate("Sept 17")).toBe("Sept 17");
  });
  it("groups currency and keeps non numeric text", () => {
    expect(formatCurrency("2500000")).toBe("2,500,000");
    expect(formatCurrency("$2,500,000.00")).toBe("2,500,000");
    expect(formatCurrency("1250000.5")).toBe("1,250,000.5");
    expect(formatCurrency("TBD")).toBe("TBD");
  });
  it("drops a typed percent sign (the master has its own)", () => {
    expect(formatPercent("10 %")).toBe("10");
  });
});

describe("open fields (send is blocked while any remain)", () => {
  it("names empty required fields and a missing entity", () => {
    const fields = [f("company_name"), f("interest_rate", true, "10.0"), f("note", false)];
    expect(openFields(fields, {}, null, true).map((o) => o.token)).toEqual(["issuing_entity", "company_name"]);
    expect(openFields(fields, { company_name: "ARRAYWORKS, INC." }, entity, true)).toEqual([]);
  });
  it("treats whitespace as empty", () => {
    expect(openFields([f("company_name")], { company_name: "  " }, entity, true)).toHaveLength(1);
  });
});

describe("values", () => {
  it("uses stored values over defaults and adds the entity", () => {
    const v = resolveValues([f("interest_rate", true, "10.0", "percent"), f("financing_amount", true, null, "currency")], { financing_amount: "2500000" }, entity);
    expect(v).toEqual({ interest_rate: "10.0", financing_amount: "2,500,000", issuing_entity: "ICFO VENTURE GROUP, LLC" });
  });
  it("derives SPV and company names like the signed documents", () => {
    expect(defaultSpvName("Arrayworks, Inc.")).toBe("ICFO ARRAYWORKS SPV, LLC");
    expect(defaultSpvName("Zero Emission Truck Leasing Inc.")).toBe("ICFO ZERO EMISSION TRUCK LEASING SPV, LLC");
    expect(defaultSpvName(null)).toBe("");
    expect(defaultCompanyName("Arrayworks, Inc.")).toBe("ARRAYWORKS, INC.");
  });
});

describe("currency input", () => {
  it("groups thousands while typing", () => {
    expect(groupCurrencyInput("1500000")).toBe("1,500,000");
    expect(groupCurrencyInput("1,500,000")).toBe("1,500,000");
    expect(groupCurrencyInput("1500000.")).toBe("1,500,000.");
    expect(groupCurrencyInput("2500.75")).toBe("2,500.75");
    expect(groupCurrencyInput("")).toBe("");
    expect(groupCurrencyInput("TBD")).toBe("TBD");
  });
  it("stores digits only", () => {
    expect(plainCurrency("1,500,000")).toBe("1500000");
    expect(plainCurrency("$2,500.7.5")).toBe("2500.75");
  });
});

describe("linked fields", () => {
  const cf = (token: string, dv: string | null = null) => f(token, true, dv, "currency");
  it("copies the term sheet valuation cap into the services agreement valuation", () => {
    const dd = [cf("equity_valuation", "10,000,000"), cf("service_fee")];
    expect(linkedFieldValues(dd, [{ fields: [cf("valuation_cap", "10,000,000")], values: { valuation_cap: "23,000,000" } }])).toEqual({ equity_valuation: "23000000" });
    expect(linkedFieldValues(dd, [{ fields: [cf("pre_money_valuation")], values: { pre_money_valuation: "8000000" } }])).toEqual({ equity_valuation: "8000000" });
  });
  it("does nothing without a term sheet or the field", () => {
    expect(linkedFieldValues([cf("equity_valuation")], [])).toEqual({});
    expect(linkedFieldValues([cf("service_fee")], [{ fields: [cf("valuation_cap")], values: { valuation_cap: "5" } }])).toEqual({});
  });
});
