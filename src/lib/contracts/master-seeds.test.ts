import { describe, expect, it } from "vitest";
import { MASTER_SEEDS } from "./master-seeds";
import { loadDocx, renderDocx, tokenizeDoc, tokensInDoc } from "./docx-engine";
import { resolveValues } from "./fields";
import type { TemplateField } from "./types";

const SAMPLE: Record<string, string> = {
  spv_name: "ICFO ARRAYWORKS SPV, LLC",
  company_name: "ARRAYWORKS, INC.",
  date: "2026-10-02",
  expiration_date: "2026-10-16",
  financing_amount: "2500000",
  company_state: "Delaware",
  pre_money_valuation: "10000000",
  post_money_valuation: "12500000",
  company_address: "11 Portwalk Place\nPortsmouth, NH 03801",
  company_email: "ken@arrayworks.com",
};

describe("launch masters", () => {
  for (const seed of MASTER_SEEDS) {
    it(`${seed.name}: every field is found and a full render leaves no token or placeholder`, async () => {
      const bytes = Buffer.from(seed.base64, "base64");
      const fields: TemplateField[] = seed.fields.map((f, i) => ({ ...f, sort_order: i }));
      const { doc } = await loadDocx(bytes);
      const counts = tokenizeDoc(doc, fields, seed.entityMatch);
      for (const f of fields) expect(counts[f.token], f.token).toBeGreaterThan(0);
      expect(counts.issuing_entity).toBeGreaterThan(0);

      const values = resolveValues(fields, SAMPLE, { id: "e", legal_name: seed.entityMatch, short_name: "", address: null, signatory_name: null, signatory_title: null, active: true });
      const out = await renderDocx({ master: bytes, fields, entityMatch: seed.entityMatch, values, edits: { edits: {}, inserted: [] }, mode: "final" });
      const r = await loadDocx(out);
      expect(tokensInDoc(r.doc)).toEqual([]);
      const xml = await r.zip.file("word/document.xml")!.async("string");
      for (const placeholder of ["(COMPANY)", "(DATE)", "$0,000,000", "(AMOUNT)", "(STATE)", "[COMPANY]", "[ADDRESS]", "[EMAIL]"]) {
        expect(xml.includes(placeholder), placeholder).toBe(false);
      }
    });
  }
});
