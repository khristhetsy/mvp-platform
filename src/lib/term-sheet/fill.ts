// Fill the revised term sheet Word templates. Only the blanks change.
// Each blank in the template file is a {{id|printed text}} marker inside its original run, so the run keeps
// its fonts and layout. A filled blank loses its yellow highlight. An empty blank prints the template text
// again, and keeps the highlight, so a gap is always visible.
import JSZip from "jszip";
import { DOCX_TEMPLATES_B64 } from "./docx-templates.generated";
import { fieldMap } from "./fields";
import { printedValue } from "./render";
import type { TermSheetFormType, TermSheetValues } from "./types";

const MARKER = /\{\{(\w+)\|([^}]*)\}\}/g;

function xmlEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function templateBuffer(form: TermSheetFormType): Buffer {
  return Buffer.from(DOCX_TEMPLATES_B64[form], "base64");
}

/** Replace the markers in word/document.xml. Exported so tests can check the XML. */
export function fillDocumentXml(form: TermSheetFormType, xml: string, values: TermSheetValues): string {
  const defs = fieldMap(form);
  return xml.replace(/<w:r\b[^>]*>[\s\S]*?<\/w:r>/g, (run) => {
    if (!run.includes("{{")) return run;
    let allFilled = true;
    let out = run.replace(MARKER, (_m, id: string, printed: string) => {
      const def = defs[id];
      const v = def ? printedValue(def, values[id]) : null;
      if (v === null) {
        allFilled = false;
        return printed;
      }
      return xmlEscape(v);
    });
    if (allFilled) out = out.replace(/<w:highlight\b[^>]*\/>/g, "");
    return out;
  });
}

/** The filled Word file. Everything outside the blanks is byte for byte the template. */
export async function fillTermSheetDocx(form: TermSheetFormType, values: TermSheetValues): Promise<Buffer> {
  const zip = await JSZip.loadAsync(templateBuffer(form));
  const file = zip.file("word/document.xml");
  if (!file) throw new Error("Template is missing word/document.xml");
  const xml = await file.async("string");
  zip.file("word/document.xml", fillDocumentXml(form, xml, values));
  const out = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  return out;
}

/** Plain text of a docx (paragraph per line). */
export async function docxText(buf: Buffer | Uint8Array): Promise<string> {
  const zip = await JSZip.loadAsync(buf);
  const f = zip.file("word/document.xml");
  if (!f) return "";
  const xml = await f.async("string");
  return xml
    .replace(/<\/w:p>/g, "\n")
    .replace(/<w:tab\/>/g, " ")
    .replace(/<w:br\/>/g, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}
