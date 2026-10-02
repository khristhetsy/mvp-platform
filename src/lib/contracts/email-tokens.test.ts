import { describe, expect, it } from "vitest";
import { applyEmailTokens, emailTokenValues } from "./email-tokens";
import type { TemplateField } from "./types";

const fields: TemplateField[] = [
  { token: "financing_amount", label: "Amount", type: "currency", required: true, default_value: null, position_ref: [], sort_order: 0 },
  { token: "interest_rate", label: "Rate", type: "percent", required: true, default_value: "10.0", position_ref: [], sort_order: 1 },
];

describe("cover email tokens", () => {
  const values = emailTokenValues({
    contactName: "Ken Brauer",
    company: "Arrayworks",
    senderName: "Khris Thetsy",
    documents: [
      { fields, values: { financing_amount: "2500000", interest_rate: "10.0" }, entityName: "ICFO VENTURE GROUP, LLC", title: "Term Sheet, Convertible Note" },
      { fields: [], values: {}, entityName: "ICFO CAPITAL ADVISORY, LLC", title: "Due Diligence Services Agreement" },
    ],
  });

  it("takes amounts from the documents, so email and document agree", () => {
    expect(values.financing_amount).toBe("$2,500,000");
    expect(values.interest_rate).toBe("10.0%");
    expect(values.first_name).toBe("Ken");
    expect(values.issuing_entity).toBe("ICFO VENTURE GROUP, LLC");
    expect(values.document_list).toBe("Term Sheet, Convertible Note, Due Diligence Services Agreement");
  });

  it("uses a field's master default when the drafter left it unchanged", () => {
    const v = emailTokenValues({ contactName: "Ken", company: null, senderName: null, documents: [{ fields, values: { financing_amount: "100" }, entityName: null, title: "T" }] });
    expect(v.interest_rate).toBe("10.0%");
  });

  it("reports tokens without a value instead of sending them raw", () => {
    const r = applyEmailTokens("Hi {{first_name}}, cap {{valuation_cap}}", values);
    expect(r.text).toBe("Hi Ken, cap {{valuation_cap}}");
    expect(r.missing).toEqual(["valuation_cap"]);
  });
});
