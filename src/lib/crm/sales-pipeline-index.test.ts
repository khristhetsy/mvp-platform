import { describe, expect, it } from "vitest";
import { buildSalesPipelineIndex, inSalesPipeline } from "./sales-pipeline-index";

const idx = buildSalesPipelineIndex([
  { contact_crm_id: "crm-1", contact_email: "Ann@Fund.com ", contact_profile_id: null, company_id: null },
  { contact_crm_id: null, contact_email: null, contact_profile_id: "prof-9", company_id: "co-7" },
]);

describe("sales pipeline index", () => {
  it("matches by CRM id, email (any case), profile or company", () => {
    expect(inSalesPipeline(idx, { crmId: "crm-1" })).toBe(true);
    expect(inSalesPipeline(idx, { email: "ann@fund.com" })).toBe(true);
    expect(inSalesPipeline(idx, { profileId: "prof-9" })).toBe(true);
    expect(inSalesPipeline(idx, { companyId: "co-7" })).toBe(true);
  });
  it("is false with no link or blank keys", () => {
    expect(inSalesPipeline(idx, { crmId: "crm-2", email: "bob@x.com" })).toBe(false);
    expect(inSalesPipeline(idx, { crmId: null, email: "  ", profileId: undefined })).toBe(false);
  });
});
