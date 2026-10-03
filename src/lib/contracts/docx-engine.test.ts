import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { applyEdits, buildModel, loadDocx, renderDocx, tokenizeDoc, TemplateMatchError } from "./docx-engine";
import type { TemplateField } from "./types";

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const r = (t: string, rPr = "") => `<w:r>${rPr ? `<w:rPr>${rPr}</w:rPr>` : ""}<w:t xml:space="preserve">${t}</w:t></w:r>`;
const HL = '<w:rFonts w:ascii="Garamond"/><w:highlight w:val="yellow"/>';

// "(COMPANY)" is split across runs, as Word often stores it.
const BODY = `<?xml version="1.0" encoding="UTF-8"?><w:document ${W}><w:body>
<w:p><w:pPr><w:jc w:val="center"/></w:pPr>${r("(DA", HL)}${r("TE)", HL)}</w:p>
<w:p><w:pPr><w:pStyle w:val="Body"/></w:pPr>${r("Investment by ICFO (COM")}${r("PANY) SPV, LLC into ")}${r("(COMPANY)", HL)}${r(", a Delaware corporation.")}</w:p>
<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="3"/></w:numPr></w:pPr>${r("Interest: (10.0%) per annum.", '<w:rFonts w:ascii="Garamond"/>')}</w:p>
<w:tbl><w:tr><w:tc><w:p>${r("ICFO VENTURE GROUP, LLC")}</w:p></w:tc><w:tc><w:p>${r("[ADDRESS]")}</w:p></w:tc></w:tr></w:tbl>
<w:sectPr><w:pgMar w:top="1440"/></w:sectPr></w:body></w:document>`;

async function docx(): Promise<Buffer> {
  const z = new JSZip();
  z.file("[Content_Types].xml", "<Types/>");
  z.file("word/document.xml", BODY);
  z.file("word/styles.xml", "<w:styles/>");
  z.file("word/header1.xml", "<w:hdr>logo</w:hdr>");
  return z.generateAsync({ type: "nodebuffer" });
}

const field = (token: string, find: string, replace?: string, extra: Partial<TemplateField> = {}, sort = 0): TemplateField => ({
  token,
  label: token,
  type: "text",
  required: true,
  default_value: null,
  position_ref: [{ find, ...(replace ? { replace } : {}) }],
  sort_order: sort,
  ...extra,
});

const FIELDS: TemplateField[] = [
  field("spv_name", "ICFO (COMPANY) SPV, LLC", undefined, {}, 0),
  field("company_name", "(COMPANY)", undefined, {}, 1),
  field("date", "(DATE)", undefined, {}, 2),
  field("company_state", "a Delaware corporation", "Delaware", { default_value: "Delaware" }, 3),
  field("interest_rate", "(10.0%)", "10.0", { type: "percent", default_value: "10.0" }, 4),
  field("company_address", "[ADDRESS]", undefined, { type: "multiline" }, 5),
];

async function text(buf: Buffer, part = "word/document.xml") {
  return (await JSZip.loadAsync(buf)).file(part)!.async("string");
}

describe("tokenize", () => {
  it("claims phrases across runs, longer phrases first, entity included", async () => {
    const { doc } = await loadDocx(await docx());
    const counts = tokenizeDoc(doc, FIELDS, "ICFO VENTURE GROUP, LLC");
    expect(counts).toMatchObject({ spv_name: 1, company_name: 1, date: 1, company_state: 1, interest_rate: 1, company_address: 1, issuing_entity: 1 });
  });
  it("refuses a field whose text is not in the master", async () => {
    const { doc } = await loadDocx(await docx());
    expect(() => tokenizeDoc(doc, [field("x", "(NOT THERE)")], null)).toThrow(TemplateMatchError);
  });
});

describe("render", () => {
  const values = { spv_name: "ICFO ARRAYWORKS SPV, LLC", company_name: "ARRAYWORKS, INC.", date: "October 2, 2026", company_state: "Delaware", interest_rate: "12.0", company_address: "11 Portwalk Place\nPortsmouth, NH 03801", issuing_entity: "ICFO VENTURE GROUP, LLC" };

  it("fills values in place and changes nothing but document.xml", async () => {
    const src = await docx();
    const out = await renderDocx({ master: src, fields: FIELDS, entityMatch: "ICFO VENTURE GROUP, LLC", values, edits: { edits: {}, inserted: [] }, mode: "final" });
    const xml = await text(out);
    expect(xml).toContain("ICFO ARRAYWORKS SPV, LLC");
    expect(xml).toContain("ARRAYWORKS, INC.");
    expect(xml).toContain("(12.0%)");
    expect(xml).not.toContain("{{");
    // Review highlights never reach the prospect; other run properties survive.
    expect(xml).not.toContain("w:highlight");
    expect(xml).toContain('w:ascii="Garamond"');
    // Multiline values become Word line breaks.
    expect(xml).toMatch(/11 Portwalk Place<\/w:t><w:br\/><w:t xml:space="preserve">Portsmouth/);
    // Layout parts are byte identical.
    expect(await text(out, "word/styles.xml")).toBe("<w:styles/>");
    expect(await text(out, "word/header1.xml")).toBe("<w:hdr>logo</w:hdr>");
    expect(xml).toContain('<w:pgMar w:top="1440"/>');
    expect(Object.keys((await JSZip.loadAsync(out)).files).sort()).toEqual(Object.keys((await JSZip.loadAsync(src)).files).sort());
  });

  it("blocks a final render with an open field", async () => {
    await expect(renderDocx({ master: await docx(), fields: FIELDS, entityMatch: null, values: {}, edits: { edits: {}, inserted: [] }, mode: "final" })).rejects.toThrow(/Required field is empty/);
  });

  it("shows open fields as [Label] in preview", async () => {
    const out = await renderDocx({ master: await docx(), fields: FIELDS, entityMatch: null, values: {}, edits: { edits: {}, inserted: [] }, mode: "preview" });
    expect(await text(out)).toContain("[company_name]");
  });
});

describe("edits keep the locked layout", () => {
  it("rewrites a paragraph keeping its pPr and font, with bold and italic", async () => {
    const { doc } = await loadDocx(await docx());
    tokenizeDoc(doc, FIELDS, null);
    applyEdits(doc, { edits: { "2": [{ text: "Interest: " }, { text: "{{interest_rate}}", b: true }, { text: "% simple.", i: true }] }, inserted: [] });
    const model = buildModel(doc);
    const p = model[2];
    expect(p.type).toBe("p");
    if (p.type !== "p") return;
    expect(p.p.numbered).toBe(true);
    expect(p.p.segments).toEqual([{ text: "Interest: " }, { text: "{{interest_rate}}", b: true }, { text: "% simple.", i: true }]);
  });

  it("inserts a list item that inherits the anchor's numbering", async () => {
    const { doc } = await loadDocx(await docx());
    applyEdits(doc, { edits: {}, inserted: [{ id: "n1", after: "2", segments: [{ text: "New covenant." }] }] });
    const model = buildModel(doc);
    const added = model[3];
    expect(added.type === "p" && added.p.numbered && added.p.segments[0].text).toBe("New covenant.");
  });

  it("deletes a paragraph but never empties a table cell", async () => {
    const { doc } = await loadDocx(await docx());
    applyEdits(doc, { edits: { "0": null, "3": null }, inserted: [] });
    const model = buildModel(doc);
    expect(model.filter((b) => b.type === "p")).toHaveLength(2);
    const table = model.find((b) => b.type === "table");
    expect(table?.type === "table" && table.rows[0][0]).toHaveLength(1);
  });
});
