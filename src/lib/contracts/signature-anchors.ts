// Place signature fields on a rendered contract PDF by reading its text. The
// masters carry "By: / Name: / Title: / Date:" blocks under each party line, so
// the block is located by the party's name (a filled token or a literal such
// as "COMPANY:") and the labels beneath it in the same column. Server only.

import type { CountersignField, PlacedBox, SignatureAnchors } from "./types";

export type PdfLine = { page: number; pageW: number; pageH: number; y: number; items: PdfItem[]; text: string };
export type PdfItem = { str: string; x: number; y: number; w: number; h: number };

export class AnchorNotFoundError extends Error {
  constructor(what: string) {
    super(`Could not find the ${what} signature block in the rendered document.`);
    this.name = "AnchorNotFoundError";
  }
}

let workerReady: Promise<void> | null = null;
async function ensurePdfWorker(): Promise<void> {
  const g = globalThis as { pdfjsWorker?: unknown };
  if (g.pdfjsWorker) return;
  workerReady ??= import("pdfjs-dist/legacy/build/pdf.worker.mjs").then((m) => {
    g.pdfjsWorker = m;
  });
  await workerReady;
}

/** Text lines of every page, top to bottom, with item positions in PDF points. */
export async function readPdfLines(pdf: Uint8Array): Promise<{ lines: PdfLine[]; pageCount: number }> {
  await ensurePdfWorker();
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: pdf.slice(), isEvalSupported: false, useSystemFonts: true }).promise;
  const lines: PdfLine[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const vp = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const items: PdfItem[] = [];
    for (const it of content.items as Array<{ str?: string; transform?: number[]; width?: number; height?: number }>) {
      if (typeof it.str !== "string" || !it.str.trim() || !it.transform) continue;
      items.push({ str: it.str, x: it.transform[4], y: it.transform[5], w: it.width ?? 0, h: it.height ?? 10 });
    }
    lines.push(...groupLines(items, n, vp.width, vp.height));
  }
  try {
    await doc.destroy();
  } catch {
    /* ignore */
  }
  return { lines, pageCount: doc.numPages };
}

/** Group items sharing a baseline (±2pt) into lines, top to bottom then left to right. */
export function groupLines(items: PdfItem[], page: number, pageW: number, pageH: number): PdfLine[] {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const out: PdfLine[] = [];
  for (const it of sorted) {
    const line = out.find((l) => Math.abs(l.y - it.y) <= 2);
    if (line) line.items.push(it);
    else out.push({ page, pageW, pageH, y: it.y, items: [it], text: "" });
  }
  for (const l of out) {
    l.items.sort((a, b) => a.x - b.x);
    l.text = l.items.map((i) => i.str).join(" ");
  }
  return out.sort((a, b) => b.y - a.y);
}

type Hit = { line: PdfLine; item: PdfItem; index: number };

/** Last occurrence of `needle` in reading order (signature pages come last). */
function findLast(lines: PdfLine[], needle: string): Hit | null {
  const norm = (s: string) => s.replace(/\s+/g, " ").trim().toUpperCase();
  const n = norm(needle);
  const firstWord = n.split(" ")[0];
  let hit: Hit | null = null;
  lines.forEach((line, index) => {
    if (!norm(line.text).includes(n)) return;
    // Prefer the item holding the whole name; the name can also be split
    // across items, then the item holding its first word marks the column.
    const item =
      [...line.items].reverse().find((i) => norm(i.str).includes(n)) ??
      [...line.items].reverse().find((i) => norm(i.str).includes(firstWord)) ??
      line.items[0];
    hit = { line, item, index };
  });
  return hit;
}

/** First label (e.g. "By:") below `from`, in the same column, within `maxDrop` points. */
function findBelow(lines: PdfLine[], from: Hit, label: string, maxDrop = 160): Hit | null {
  const re = new RegExp(`^\\s*${label}`, "i");
  for (let i = from.index + 1; i < lines.length; i++) {
    const line = lines[i];
    const sameBlock = line.page === from.line.page ? from.line.y - line.y <= maxDrop : line.page === from.line.page + 1 && line.y > line.pageH - maxDrop;
    if (!sameBlock) {
      if (line.page > from.line.page + 1) break;
      continue;
    }
    for (const item of line.items) {
      if (re.test(item.str) && Math.abs(item.x - from.item.x) <= 90) return { line, item, index: i };
    }
  }
  return null;
}

/** Box to the right of a label, sitting on its baseline. Normalized 0..1, top left origin. */
function boxAfter(hit: Hit, label: string, width: number, height: number): PlacedBox {
  const { item, line } = hit;
  const labelLen = Math.min(item.str.length, label.length);
  const labelW = item.str.length ? (item.w * labelLen) / item.str.length : item.w;
  const left = item.x + labelW + 4;
  const top = item.y + height - 4; // box rises above the baseline
  const w = Math.min(width, line.pageW - left - 24);
  return {
    page: line.page,
    x: left / line.pageW,
    y: (line.pageH - top) / line.pageH,
    width: w / line.pageW,
    height: height / line.pageH,
  };
}

function resolveParty(party: string, values: Record<string, string>): string {
  return party.replace(/\{\{([a-z0-9_]+)\}\}/g, (_m, t: string) => values[t] ?? "");
}

export type ProspectFields = { signature: PlacedBox; name: PlacedBox | null; title: PlacedBox | null; date: PlacedBox | null };

function blockFor(lines: PdfLine[], party: string, what: string): { sig: PlacedBox; name: PlacedBox | null; title: PlacedBox | null; date: PlacedBox | null } {
  const head = findLast(lines, party);
  if (!head) throw new AnchorNotFoundError(what);
  const by = findBelow(lines, head, "By:");
  if (!by) throw new AnchorNotFoundError(what);
  const name = findBelow(lines, by, "Name:", 60);
  const title = findBelow(lines, by, "Title:", 90);
  const date = findBelow(lines, by, "Date:", 130);
  return {
    sig: boxAfter(by, "By:", 190, 26),
    name: name ? boxAfter(name, "Name:", 190, 14) : null,
    title: title ? boxAfter(title, "Title:", 190, 14) : null,
    date: date ? boxAfter(date, "Date:", 150, 14) : null,
  };
}

/** Prospect's block and iCFO's countersign blocks for a rendered contract. */
export function placeSignatureFields(
  lines: PdfLine[],
  anchors: SignatureAnchors,
  values: Record<string, string>,
): { prospect: ProspectFields; countersign: CountersignField[] } {
  const p = blockFor(lines, resolveParty(anchors.prospect.party, values), "company");
  const countersign: CountersignField[] = [];
  for (const c of anchors.countersign) {
    const party = resolveParty(c.party, values);
    if (!party) continue;
    const b = blockFor(lines, party, party);
    countersign.push({ ...b.sig, kind: "signature" });
    if (b.name) countersign.push({ ...b.name, kind: "name" });
    if (b.title) countersign.push({ ...b.title, kind: "title" });
    if (b.date) countersign.push({ ...b.date, kind: "date" });
  }
  return { prospect: { signature: p.sig, name: p.name, title: p.title, date: p.date }, countersign };
}
