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

describe("cover email gaps", () => {
  it("typed values fill gaps but never override a document's value", async () => {
    const { withTypedValues } = await import("./email-tokens");
    const v = withTypedValues({ financing_amount: "$2,500,000" }, { financing_amount: "$1", valuation_cap: "12,000,000", "bad key": "x", empty: "  " });
    expect(v.financing_amount).toBe("$2,500,000");
    expect(v.valuation_cap).toBe("12,000,000");
    expect(v["bad key"]).toBeUndefined();
    expect(v.empty).toBeUndefined();
  });

  it("picks the draft the chosen documents fill best", async () => {
    const { bestDraft } = await import("./email-tokens");
    const drafts = [
      { id: "cn", subject: "Term sheet for {{company}}", body: "{{financing_amount}} by {{spv_name}}" },
      { id: "ddsa", subject: "Services agreement for {{company}}", body: "Hi {{first_name}}, attached: {{document_list}}" },
    ];
    expect(bestDraft(drafts, { company: "Acme", first_name: "Jo", document_list: "DDSA" })?.id).toBe("ddsa");
    expect(bestDraft(drafts, { company: "Acme", financing_amount: "$1", spv_name: "ICFO ACME SPV, LLC" })?.id).toBe("cn");
  });
});
