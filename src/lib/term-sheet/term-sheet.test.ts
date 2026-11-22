import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { DOCX_TEMPLATES_B64 } from "@/lib/term-sheet/docx-templates.generated";
import { detectFormType, extractValues } from "@/lib/term-sheet/extract";
import { clausesFor, fieldMap, fieldsFor, requiredFields, TERM_SHEET_FORMS } from "@/lib/term-sheet/fields";
import { docxText, fillDocumentXml, fillTermSheetDocx, templateBuffer } from "@/lib/term-sheet/fill";
import { ORIGINAL_TEXT_SHA256 } from "@/lib/term-sheet/original-text.generated";
import { renderTermSheetPdf } from "@/lib/term-sheet/pdf";
import { filledPlainText, groupNumber, missingRequired, normalizeInput, printedValue, previewHtml, progress } from "@/lib/term-sheet/render";
import {
  applyStale,
  hasStaleLinks,
  linkStatuses,
  notPlaced,
  pullFromRoundStructure,
  suggestFormType,
} from "@/lib/term-sheet/round-structure";
import { sanitizeValues } from "@/lib/term-sheet/values";
import { TERM_SHEET_FORM_TYPES, type RoundStructureInputs, type TermSheetFormType, type TermSheetValues } from "@/lib/term-sheet/types";
import JSZip from "jszip";

const RS: RoundStructureInputs = {
  roundType: "note",
  safeType: "post_money",
  preMoney: 10_000_000,
  raiseAmount: 1_500_000,
  optionPoolPct: 10,
  discountPct: 20,
  interestPct: 10,
  maturityMonths: 18,
  warrantPct: 30,
};

function sha(s: string) {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

/** Values for every blank of a template, so every placeholder gets replaced. */
function fullValues(form: TermSheetFormType): TermSheetValues {
  const v: TermSheetValues = {};
  for (const f of fieldsFor(form)) {
    if (f.kind === "words") v[f.id] = "6";
    else if (f.id === "date") v[f.id] = "January 5, 2027";
    else if (f.id === "investor") v[f.id] = "Northstar Angels, LLC";
    else if (f.id === "company") v[f.id] = "Acme Robotics, Inc.";
    else if (f.id === "state") v[f.id] = "Nevada";
    else if (f.kind === "num" && f.prefix === "$") v[f.id] = "2,345,678";
    else if (f.kind === "num") v[f.id] = "7";
    else v[f.id] = f.prefix === "$" ? "3,210,000" : "Test";
  }
  return v;
}

describe("term sheet field inventory", () => {
  it("has the blanks of the three revised templates", () => {
    expect(fieldsFor("convertible_note")).toHaveLength(10);
    expect(fieldsFor("safe")).toHaveLength(7);
    expect(fieldsFor("series_a")).toHaveLength(28);
  });

  it("gives every blank a clause and a unique id per template", () => {
    for (const form of TERM_SHEET_FORM_TYPES) {
      const ids = fieldsFor(form).map((f) => f.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const f of fieldsFor(form)) expect(f.sec.length).toBeGreaterThan(0);
      expect(clausesFor(form).length).toBeGreaterThan(0);
    }
  });

  it("shares one field for repeated values (cap and discount in the Note)", () => {
    const xml = Buffer.from(DOCX_TEMPLATES_B64.convertible_note, "base64");
    return JSZip.loadAsync(xml).then(async (z) => {
      const doc = await z.file("word/document.xml")!.async("string");
      expect((doc.match(/\{\{cap\|/g) ?? []).length).toBe(2);
      expect((doc.match(/\{\{discount\|/g) ?? []).length).toBe(2);
    });
  });
});

describe("fill integrity: only the blanks change", () => {
  for (const form of TERM_SHEET_FORM_TYPES) {
    it(`${form}: filling with no values gives the approved template text, character for character`, async () => {
      const out = await fillTermSheetDocx(form, {});
      expect(sha(await docxText(out))).toBe(ORIGINAL_TEXT_SHA256[form]);
    });

    it(`${form}: filling with values changes only the blanks`, async () => {
      const values = fullValues(form);
      const defs = fieldMap(form);
      const withMarkers = await docxText(templateBuffer(form));
      const expected = withMarkers.replace(/\{\{(\w+)\|([^}]*)\}\}/g, (_m, id: string, printed: string) => {
        const v = printedValue(defs[id], values[id]);
        return v ?? printed;
      });
      const out = await docxText(await fillTermSheetDocx(form, values));
      expect(out).toBe(expected);
      expect(out).not.toContain("{{");
    });

    it(`${form}: a filled blank loses its highlight, an empty one keeps it`, async () => {
      const zip = await JSZip.loadAsync(templateBuffer(form));
      const xml = await zip.file("word/document.xml")!.async("string");
      const emptyHl = (fillDocumentXml(form, xml, {}).match(/<w:highlight\b/g) ?? []).length;
      const fullHl = (fillDocumentXml(form, xml, fullValues(form)).match(/<w:highlight\b/g) ?? []).length;
      expect(emptyHl).toBeGreaterThan(0);
      expect(fullHl).toBeLessThan(emptyHl);
    });

    it(`${form}: the filled file is a valid zip with the letterhead image and footer kept`, async () => {
      const out = await fillTermSheetDocx(form, fullValues(form));
      const z = await JSZip.loadAsync(out);
      expect(z.file("word/media/image1.png")).toBeTruthy();
      expect(z.file("word/header1.xml")).toBeTruthy();
      expect(z.file("word/footer1.xml")).toBeTruthy();
    });
  }

  it("prints a repeated value the same in every clause", async () => {
    const out = await docxText(await fillTermSheetDocx("convertible_note", { cap: "12,000,000", discount: "25" }));
    expect((out.match(/\$12,000,000/g) ?? []).length).toBe(2);
    expect((out.match(/25%/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });
});

describe("rendering the typed values", () => {
  it("groups money and strips what the template already prints", () => {
    expect(groupNumber("1500000")).toBe("1,500,000");
    const amount = fieldMap("safe").amount;
    expect(normalizeInput(amount, "$1500000")).toBe("1,500,000");
    expect(printedValue(amount, "1500000")).toBe("$1,500,000");
    const discount = fieldMap("safe").discount;
    expect(printedValue(discount, "20%")).toBe("20%");
  });

  it("prints the offering period in words and numerals", () => {
    expect(printedValue(fieldMap("safe").period, "4")).toBe("four (4)");
    expect(printedValue(fieldMap("safe").period, "")).toBeNull();
  });

  it("reports progress and missing required blanks", () => {
    expect(progress("safe", {}).done).toBe(0);
    expect(missingRequired("safe", {}).length).toBe(requiredFields("safe").length);
    expect(missingRequired("safe", fullValues("safe"))).toHaveLength(0);
  });

  it("shows blanks as placeholders and filled values in the preview", () => {
    const html = previewHtml("safe", { company: "Acme Robotics, Inc." });
    expect(html).toContain('class="fld filled" data-f="company">Acme Robotics, Inc.<');
    expect(html).toContain('class="fld blank" data-f="investor">(INVESTOR)<');
    expect(filledPlainText("safe", fullValues("safe"))).toContain("Acme Robotics, Inc.");
  });

  it("escapes what a founder types", () => {
    const html = previewHtml("safe", { company: '<img src=x onerror=alert(1)> "Co"' });
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });

  it("ignores unknown fields and long input when saving", () => {
    const v = sanitizeValues("safe", { company: "A".repeat(500), nope: "x", amount: 5 });
    expect(v.company).toHaveLength(120);
    expect(v.nope).toBeUndefined();
    expect(v.amount).toBeUndefined();
  });

  it("keeps the template wording identical in the preview and the Word file", async () => {
    // Preview text with empty values must contain every sentence of the Word file (spot check on long clauses).
    const word = (await docxText(await fillTermSheetDocx("series_a", {}))).replace(/\s+/g, " ");
    const preview = filledPlainText("series_a", {});
    for (const piece of ["Liquidation Preference", "Protective Provisions", "Drag Along", "Right of First Refusal"]) {
      expect(word).toContain(piece);
      expect(preview).toContain(piece);
    }
  });
});

describe("Round structure link", () => {
  it("pulls only the blanks the template has", () => {
    const note = pullFromRoundStructure("convertible_note", RS);
    expect(note.values).toMatchObject({ amount: "1,500,000", cap: "10,000,000", interest: "10", discount: "20", warrant: "30" });
    const safe = pullFromRoundStructure("safe", { ...RS, roundType: "safe" });
    expect(safe.values).toMatchObject({ amount: "1,500,000", cap: "10,000,000", discount: "20" });
    expect(safe.values.interest).toBeUndefined();
    const sa = pullFromRoundStructure("series_a", { ...RS, roundType: "priced" });
    expect(sa.values).toMatchObject({ amount_raised: "1,500,000", premoney: "10,000,000", postmoney: "11,500,000" });
    expect(sa.linked.postmoney.key).toBe("derived");
  });

  it("does not place a zero discount, interest or warrant", () => {
    const v = pullFromRoundStructure("convertible_note", { ...RS, discountPct: 0, warrantPct: 0 }).values;
    expect(v.discount).toBeUndefined();
    expect(v.warrant).toBeUndefined();
  });

  it("says what the template has no blank for", () => {
    expect(notPlaced("convertible_note", RS).map((n) => n.label)).toContain("Maturity");
    expect(notPlaced("safe", RS).map((n) => n.label)).toContain("Cap type");
    expect(notPlaced("series_a", RS).map((n) => n.label)).toContain("Option pool");
  });

  it("suggests the template that matches the round type", () => {
    expect(suggestFormType("safe")).toBe("safe");
    expect(suggestFormType("note")).toBe("convertible_note");
    expect(suggestFormType("priced")).toBe("series_a");
  });

  it("flags a pulled blank as stale when the Round structure changes, and leaves edited blanks alone", () => {
    const pulled = pullFromRoundStructure("convertible_note", RS);
    const changed = { ...RS, raiseAmount: 2_000_000, interestPct: 8 };
    const values = { ...pulled.values, interest: "12" }; // the founder edited interest by hand
    const st = linkStatuses("convertible_note", values, pulled.linked, changed);
    expect(st.find((s) => s.id === "amount")?.state).toBe("stale");
    expect(st.find((s) => s.id === "interest")?.state).toBe("edited");
    expect(st.find((s) => s.id === "cap")?.state).toBe("synced");
    expect(hasStaleLinks(st)).toBe(true);
    const next = applyStale(values, pulled.linked, st);
    expect(next.values.amount).toBe("2,000,000");
    expect(next.values.interest).toBe("12");
  });

  it("shows no statuses without a saved Round structure", () => {
    expect(linkStatuses("safe", {}, {}, null)).toEqual([]);
  });
});

describe("reading values back from an uploaded term sheet", () => {
  for (const form of TERM_SHEET_FORM_TYPES) {
    it(`${form}: finds the template and the values it was filled with`, async () => {
      const values = fullValues(form);
      const text = await docxText(await fillTermSheetDocx(form, values));
      expect(detectFormType(text)).toBe(form);
      const found = extractValues(form, text);
      expect(Object.keys(found).length).toBeGreaterThan(Math.floor(fieldsFor(form).length / 2));
      const defs = fieldMap(form);
      for (const [id, v] of Object.entries(found)) {
        expect(printedValue(defs[id], v), `${form}.${id}`).toBe(printedValue(defs[id], values[id]));
      }
    });
  }

  it("leaves blanks that still print the template placeholder empty", async () => {
    const text = await docxText(await fillTermSheetDocx("safe", {}));
    expect(extractValues("safe", text)).toEqual({});
  });
});

describe("PDF", () => {
  for (const form of TERM_SHEET_FORM_TYPES) {
    it(`${form}: renders a PDF`, async () => {
      const buf = await renderTermSheetPdf(form, fullValues(form));
      expect(buf.subarray(0, 4).toString()).toBe("%PDF");
      expect(buf.length).toBeGreaterThan(5000);
    });
  }

  it("names the three templates", () => {
    expect(Object.values(TERM_SHEET_FORMS).map((f) => f.label)).toEqual(["Convertible Note", "SAFE", "Series A Preferred"]);
  });
});
