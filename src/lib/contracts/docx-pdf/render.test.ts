import { describe, expect, it } from "vitest";
import { MASTER_SEEDS } from "../master-seeds";
import { renderDocx } from "../docx-engine";
import { resolveValues } from "../fields";
import { placeSignatureFields, readPdfLines } from "../signature-anchors";
import type { TemplateField } from "../types";
import { renderDocxToPdf } from ".";

// Page counts of Word's own PDFs of the blank masters (Word for Mac, Oct 3, 2026).
const WORD_PAGES: Record<string, number> = {
  term_sheet_convertible_note: 6,
  term_sheet_safe: 4,
  term_sheet_series_a: 11,
  dd_services_agreement_3mo: 15,
  dd_services_agreement_stock_cash: 14,
};

const SAMPLE: Record<string, string> = {
  spv_name: "ICFO ARRAYWORKS SPV, LLC",
  company_name: "ARRAYWORKS, INC.",
  date: "2026-10-13",
  expiration_date: "2026-11-30",
  financing_amount: "2500000",
  company_state: "Delaware",
  pre_money_valuation: "18000000",
  post_money_valuation: "20500000",
  company_address: "1200 Market Street, Suite 400\nSan Francisco, CA 94102",
  company_email: "ceo@arrayworks.com",
  cash_portion: "40000",
  equity_portion: "35000",
  payment_schedule: "50% on signing and 50% on delivery of the final report",
  service_fee_words: "Seventy Five Thousand Dollars",
  service_fee: "75000",
};

describe("iCapOS contract PDF renderer", () => {
  for (const seed of MASTER_SEEDS) {
    const fields: TemplateField[] = seed.fields.map((f, i) => ({ ...f, sort_order: i }));
    const master = Buffer.from(seed.base64, "base64");

    if (WORD_PAGES[seed.key]) {
      it(`${seed.name}: blank master has Word's page count`, async () => {
        const pdf = await renderDocxToPdf(master);
        const { pageCount } = await readPdfLines(new Uint8Array(pdf));
        expect(pageCount).toBe(WORD_PAGES[seed.key]);
      }, 60000);
    }

    it(`${seed.name}: filled document renders and every signature box is placed`, async () => {
      const values = resolveValues(fields, SAMPLE, { id: "e", legal_name: seed.entityMatch, short_name: "", address: null, signatory_name: null, signatory_title: null, active: true });
      const docx = await renderDocx({ master, fields, entityMatch: seed.entityMatch, values, edits: { edits: {}, inserted: [] }, mode: "final" });
      const pdf = await renderDocxToPdf(docx);
      expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
      const { lines } = await readPdfLines(new Uint8Array(pdf));
      const text = lines.map((l) => l.text).join("\n");
      expect(text).toContain(values.company_name ?? "ARRAYWORKS");
      expect(text).not.toMatch(/\{\{[a-z_]+\}\}/);
      const placed = placeSignatureFields(lines, seed.anchors, values);
      expect(placed.prospect.signature.width).toBeGreaterThan(0);
      expect(placed.countersign.filter((f) => f.kind === "signature").length).toBe(seed.anchors.countersign.length);
    }, 60000);
  }
});
