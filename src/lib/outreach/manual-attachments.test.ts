import { describe, expect, it } from "vitest";
import { DEFAULT_ATTACHMENTS, normalizeAttachments, withOnePagerLink } from "./manual-attachments";
import { onePagerFileName, renderOnePagerPdf } from "./one-pager-pdf";

describe("manual outreach attachments", () => {
  it("defaults to the one pager PDF only", () => {
    expect(normalizeAttachments(null)).toEqual(DEFAULT_ATTACHMENTS);
    expect(normalizeAttachments({ onePagerPdf: false, onePagerLink: true, documentIds: ["a", "a", 3, "b"] })).toEqual({
      onePagerPdf: false,
      onePagerLink: true,
      documentIds: ["a", "b"],
    });
  });

  it("adds the link line only when asked and not already in the body", () => {
    const att = { ...DEFAULT_ATTACHMENTS, onePagerLink: true };
    expect(withOnePagerLink("Hi\n", att)).toBe("Hi\n\nOne pager: {{founder_preview}}");
    expect(withOnePagerLink("See {{founder_preview}}", att)).toBe("See {{founder_preview}}");
    expect(withOnePagerLink("Hi", DEFAULT_ATTACHMENTS)).toBe("Hi");
  });

  it("renders a one pager PDF from public fields", async () => {
    const pdf = await renderOnePagerPdf(
      {
        company_name: "Acme Robotics",
        industry: "Robotics",
        country: "US",
        state: "CA",
        business_description: "Warehouse robots.",
        website: "https://acme.test",
        funding_amount: 2_500_000,
        use_of_funds: "1. Engineering (60%)\n2. Sales (40%)",
        revenue_stage: "Early revenue",
        annual_revenue_size: "$500k",
        key_highlights: "3 pilots signed.",
        slug: "acme",
        is_published: true,
      },
      { onlineUrl: "https://icapos.com/f/acme" },
    );
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(1000);
    expect(onePagerFileName("Acme Robotics, Inc.")).toBe("Acme_Robotics_Inc_one_pager.pdf");
  });
});
