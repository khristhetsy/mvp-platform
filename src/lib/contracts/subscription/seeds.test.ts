import { describe, expect, it } from "vitest";
import { SUBSCRIPTION_SEEDS } from "./seeds";
import { leftoverPlaceholders, SUBSCRIPTION_TEMPLATE_KEYS } from "./package";
import { loadDocx, renderDocx, tokenizeDoc, tokensInDoc } from "../docx-engine";
import { resolveValues } from "../fields";
import { docxToPdf } from "../render-pdf";
import { placeSignatureFields, readPdfLines } from "../signature-anchors";
import type { TemplateField } from "../types";

const SAMPLE: Record<string, string> = {
  spv_name: "ICFO SOURCE VISION SPV, LLC",
  company_name: "SOURCE VISION CORP",
  date: "2026-10-25",
  subscriber_name: "NORTHGATE CAPITAL, LLC",
  subscription_amount: "150000",
  mailing_address: "1 Main Street\nSan Diego, CA 92101",
  telephone: "(619) 555-0100",
  subscriber_email: "investor@northgate.example",
  issuer_name: "Jane Founder",
  issuer_contact: "Jane Founder, jane@sourcevision.example",
  issuer_address: "10 Market Street, Wilmington, DE 19801",
  bank: "Example Bank",
  ach_routing: "111000025",
  account_number: "000123456789",
  reference_code: "SV-001",
  fund_ein: "12-3456789",
  valuation_cap: "10000000",
};

const asFields = (seed: (typeof SUBSCRIPTION_SEEDS)[number]): TemplateField[] => seed.fields.map((f, i) => ({ ...f, sort_order: i }));

describe("subscription package masters", () => {
  it("seed list matches the key list the app checks for uninstalled masters", () => {
    expect(SUBSCRIPTION_SEEDS.map((s) => s.key)).toEqual([...SUBSCRIPTION_TEMPLATE_KEYS]);
  });

  for (const seed of SUBSCRIPTION_SEEDS) {
    it(`${seed.name}: every field is found, and a full render leaves no token`, async () => {
      const bytes = Buffer.from(seed.base64, "base64");
      const fields = asFields(seed);
      const { doc } = await loadDocx(bytes);
      const counts = tokenizeDoc(doc, fields, null);
      for (const f of fields) expect(counts[f.token], f.token).toBeGreaterThan(0);

      const values = resolveValues(fields, SAMPLE, null);
      for (const f of fields) expect(values[f.token], `${f.token} resolves`).toBeTruthy();
      const out = await renderDocx({ master: bytes, fields, entityMatch: null, values, edits: { edits: {}, inserted: [] }, mode: "final" });
      const r = await loadDocx(out);
      expect(tokensInDoc(r.doc)).toEqual([]);
      const text = (await r.zip.file("word/document.xml")!.async("string")).replace(/<[^>]+>/g, "");
      // Everything the fields stand for is gone; what remains in a part is deal text the editor fills.
      const left = leftoverPlaceholders(text);
      if (seed.key === "sub_ppm") expect(left.length).toBeGreaterThan(0); // deal specific blanks in the Information Statement
      else expect(left, seed.key).toEqual([]);
    }, 120000);
  }

  it("the Interests count is calculated from the amount", () => {
    const seed = SUBSCRIPTION_SEEDS.find((s) => s.key === "sub_sig_subscription_entity")!;
    const v = resolveValues(asFields(seed), SAMPLE, null);
    expect(v.interests_count).toBe("3");
    expect(v.subscription_amount).toBe("150,000");
  });

  for (const seed of SUBSCRIPTION_SEEDS.filter((s) => s.delivery === "sign")) {
    it(`${seed.name}: the signature blocks are found in the rendered PDF`, async () => {
      const bytes = Buffer.from(seed.base64, "base64");
      const fields = asFields(seed);
      const values = resolveValues(fields, SAMPLE, null);
      const docx = await renderDocx({ master: bytes, fields, entityMatch: null, values, edits: { edits: {}, inserted: [] }, mode: "final" });
      const pdf = await docxToPdf(docx, `${seed.key}.docx`);
      const { lines } = await readPdfLines(new Uint8Array(pdf));
      const placed = placeSignatureFields(lines, seed.anchors, values);
      expect(placed.prospect.signature.width).toBeGreaterThan(0);
      expect(placed.countersign.some((c) => c.kind === "signature")).toBe(seed.anchors.countersign.length > 0);
    }, 60000);
  }
});
