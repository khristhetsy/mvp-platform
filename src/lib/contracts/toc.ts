// Table of Contents page numbers for the Memorandum. The numbers in the master
// belong to the finished deal it was taken from; once the Memorandum is filled
// and edited (Exhibits pasted in, text added) they are stale. This renders the
// filled Word file with the same engine that makes the PDF, finds each heading
// in the order the contents lists them, and writes the page it landed on.
//
// The printed number is the PDF page minus an offset worked out from the first
// entry (the cover and notices before it are not numbered the same as the PDF).

import { loadDocx, saveDocx } from "./docx-engine";
import { docxToPdf } from "./render-pdf";
import { readPdfLines } from "./signature-anchors";

/* eslint-disable @typescript-eslint/no-explicit-any */
type XNode = any;

const norm = (s: string) => s.replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim().toLowerCase();

function own(p: XNode, tag: string): XNode[] {
  const out: XNode[] = [];
  const all = p.getElementsByTagName(tag);
  for (let i = 0; i < all.length; i++) {
    let a = all[i].parentNode;
    while (a && a.nodeName !== "w:p") a = a.parentNode;
    if (a === p) out.push(all[i]);
  }
  return out;
}
const pText = (p: XNode) => own(p, "w:t").map((t) => t.textContent ?? "").join("");

export type TocEntry = { p: XNode; title: string; numNode: XNode; current: number };

/** Entries of the contents list: paragraphs with a tab and a trailing page number, between "Table of Contents" and the next "EXHIBITS" line. */
export function tocEntries(doc: XNode): TocEntry[] {
  const body = doc.getElementsByTagName("w:body")[0];
  if (!body) return [];
  const ps: XNode[] = [];
  const all = body.getElementsByTagName("w:p");
  for (let i = 0; i < all.length; i++) ps.push(all[i]);
  const start = ps.findIndex((p) => norm(pText(p)) === "table of contents");
  if (start < 0) return [];
  const out: TocEntry[] = [];
  for (let i = start + 1; i < ps.length; i++) {
    const text = pText(ps[i]);
    if (norm(text) === "exhibits") break;
    if (own(ps[i], "w:tab").length === 0) continue;
    const m = text.match(/^(.*?)\t?\s*(\d+)\s*$/);
    if (!m || !m[1].trim()) continue;
    const texts = own(ps[i], "w:t");
    const numNode = [...texts].reverse().find((t) => /^\s*\d+\s*$/.test(t.textContent ?? ""));
    if (!numNode) continue;
    out.push({ p: ps[i], title: m[1].trim(), numNode, current: Number(m[2]) });
  }
  return out;
}

/** Page for each entry: first line after the contents itself, in contents order, whose whole text is the heading. */
export function locateEntries(titles: string[], lines: { page: number; text: string }[]): (number | null)[] {
  const tocAt = lines.findIndex((l) => norm(l.text) === "table of contents");
  if (tocAt < 0 || titles.length === 0) return titles.map(() => null);
  const last = norm(titles[titles.length - 1]);
  let cursor = lines.findIndex((l, i) => i > tocAt && norm(l.text).startsWith(last) && /\d\s*$/.test(l.text));
  if (cursor < 0) return titles.map(() => null);
  const pages: (number | null)[] = [];
  for (const t of titles) {
    const want = norm(t);
    let found = -1;
    for (let i = cursor + 1; i < lines.length; i++) {
      if (norm(lines[i].text) === want) {
        found = i;
        break;
      }
    }
    if (found < 0) pages.push(null);
    else {
      pages.push(lines[found].page);
      cursor = found;
    }
  }
  return pages;
}

/** The filled Memorandum with its Table of Contents page numbers brought up to date. Any problem leaves the file as it was. */
export async function refreshToc(docx: Buffer): Promise<Buffer> {
  try {
    const { zip, doc } = await loadDocx(docx);
    const entries = tocEntries(doc);
    if (entries.length === 0) return docx;
    const pdf = await docxToPdf(docx, "Memorandum.docx");
    const { lines } = await readPdfLines(new Uint8Array(pdf));
    const pages = locateEntries(entries.map((e) => e.title), lines);
    if (pages[0] === null) return docx;
    const offset = (pages[0] as number) - entries[0].current;
    let changed = false;
    let prev = 0;
    entries.forEach((e, i) => {
      const pg = pages[i];
      if (pg === null) return;
      const n = pg - offset;
      // A generic heading can match an earlier line than its own: keep only
      // numbers that never go backwards and stay within three pages of the printed one.
      if (n < prev || Math.abs(n - e.current) > 3) return;
      prev = n;
      if (n > 0 && n !== e.current) {
        e.numNode.textContent = String(n);
        changed = true;
      }
    });
    return changed ? await saveDocx(zip, doc) : docx;
  } catch {
    return docx;
  }
}
