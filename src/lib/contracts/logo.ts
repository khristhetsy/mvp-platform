// The issuer's logo on the Information Statement cover. The Memorandum master carries the marker
// "(ISSUER LOGO)" on that cover. At render the marker becomes the uploaded picture, or nothing
// when none was uploaded, so a blank marker never reaches the subscriber.

import { DOMParser } from "@xmldom/xmldom";
import { loadDocx, saveDocx } from "./docx-engine";

/** Where a document's logo is kept: one per document, shared by its versions. */
export const logoPath = (doc: { document_key: string }) => `logos/${doc.document_key}`;

export const LOGO_MARKER = "(ISSUER LOGO)";
export const LOGO_MAX_BYTES = 1_000_000;
/** Largest the logo is drawn, in points (2.2in by 1.1in). */
const MAX_W = 158;
const MAX_H = 79;

export type LogoImage = { ext: "png" | "jpeg"; mime: "image/png" | "image/jpeg"; width: number; height: number };

/** Format and pixel size from the file's own header; null when it is not a PNG or JPEG. */
export function readLogoImage(b: Buffer): LogoImage | null {
  if (b.length > 24 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    const width = b.readUInt32BE(16);
    const height = b.readUInt32BE(20);
    return width > 0 && height > 0 ? { ext: "png", mime: "image/png", width, height } : null;
  }
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) {
        i++;
        continue;
      }
      const marker = b[i + 1];
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        const height = b.readUInt16BE(i + 5);
        const width = b.readUInt16BE(i + 7);
        return width > 0 && height > 0 ? { ext: "jpeg", mime: "image/jpeg", width, height } : null;
      }
      i += 2 + b.readUInt16BE(i + 2);
    }
  }
  return null;
}

/** Drawn size in points: the picture's own proportions, within the box. */
export function logoSize(width: number, height: number): { w: number; h: number } {
  const s = Math.min(MAX_W / width, MAX_H / height);
  return { w: Math.round(width * s), h: Math.round(height * s) };
}

const NS = [
  'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"',
  'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"',
  'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"',
  'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"',
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"',
].join(" ");

const REL_ID = "rIdIssuerLogo";

function drawingRun(w: number, h: number): string {
  const cx = w * 12700;
  const cy = h * 12700;
  return (
    `<w:r ${NS}><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/>` +
    `<wp:docPr id="9001" name="Issuer logo" descr="Issuer logo"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:pic><pic:nvPicPr><pic:cNvPr id="9001" name="Issuer logo"/><pic:cNvPicPr/></pic:nvPicPr>` +
    `<pic:blipFill><a:blip r:embed="${REL_ID}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>` +
    `</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`
  );
}

/** The master with its logo marker replaced by `image` (or emptied when there is none). Untouched when it has no marker. */
export async function applyLogo(docx: Buffer, image: Buffer | null): Promise<Buffer> {
  const { zip, doc } = await loadDocx(docx);
  const marked: { p: any; ts: any[] }[] = []; // eslint-disable-line @typescript-eslint/no-explicit-any
  const paras = doc.getElementsByTagName("w:p");
  for (let i = 0; i < paras.length; i++) {
    const ts: any[] = []; // eslint-disable-line @typescript-eslint/no-explicit-any
    const all = paras[i].getElementsByTagName("w:t");
    for (let j = 0; j < all.length; j++) ts.push(all[j]);
    if (ts.map((t) => t.textContent ?? "").join("").trim() === LOGO_MARKER) marked.push({ p: paras[i], ts });
  }
  if (!marked.length) return docx;
  for (const m of marked) for (const t of m.ts) t.textContent = "";

  const info = image ? readLogoImage(image) : null;
  if (!image || !info) return saveDocx(zip, doc);

  const { w, h } = logoSize(info.width, info.height);
  const media = `word/media/issuer-logo.${info.ext}`;
  zip.file(media, image);
  const relsPath = "word/_rels/document.xml.rels";
  const rels = (await zip.file(relsPath)?.async("string")) ?? '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
  if (!rels.includes(REL_ID)) {
    zip.file(relsPath, rels.replace("</Relationships>", `<Relationship Id="${REL_ID}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/issuer-logo.${info.ext}"/></Relationships>`));
  }
  const ctPath = "[Content_Types].xml";
  const ct = (await zip.file(ctPath)?.async("string")) ?? "";
  if (ct && !new RegExp(`Extension="${info.ext}"`, "i").test(ct)) {
    zip.file(ctPath, ct.replace(/(<Types[^>]*>)/, `$1<Default Extension="${info.ext}" ContentType="${info.mime}"/>`));
  }
  for (const m of marked) {
    const run = new DOMParser().parseFromString(drawingRun(w, h), "text/xml").documentElement;
    m.p.appendChild(doc.importNode ? doc.importNode(run, true) : run);
  }
  return saveDocx(zip, doc);
}
