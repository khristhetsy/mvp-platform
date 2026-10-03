// Word (.docx) engine for SPV contracts. Format fidelity rule: the master's
// layout is never regenerated. Everything here edits text inside the master's
// own XML: field tokens are written into the existing runs (keeping their run
// properties), values replace tokens in place, and an edited paragraph keeps its
// paragraph properties (style, numbering, indentation, spacing) and the first
// run's character formatting. Fonts, margins, headers, footers, tables and
// signature blocks come from the master untouched.

import JSZip from "jszip";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import type { BodyEdits, FieldMatch, Segment, TemplateField } from "./types";

const DOC_PART = "word/document.xml";

// xmldom node shapes (kept loose: its typings differ from lib.dom).
/* eslint-disable @typescript-eslint/no-explicit-any */
type XNode = any;
type XDoc = any;

const TOKEN_RE = /\{\{([a-z0-9_]+)\}\}/g;

export class TemplateMatchError extends Error {
  constructor(public missing: { token: string; find: string }[]) {
    super(`Field text not found in the master: ${missing.map((m) => `${m.token} ("${m.find}")`).join(", ")}`);
    this.name = "TemplateMatchError";
  }
}

// ── XML helpers ─────────────────────────────────────────────────────────────

function parse(xml: string): XDoc {
  return new DOMParser().parseFromString(xml, "text/xml");
}
function serialize(doc: XDoc): string {
  return new XMLSerializer().serializeToString(doc);
}
function els(root: XNode, tag: string): XNode[] {
  return Array.from(root.getElementsByTagName(tag) as ArrayLike<XNode>);
}
function kids(node: XNode): XNode[] {
  return Array.from((node.childNodes ?? []) as ArrayLike<XNode>).filter((n) => n.nodeType === 1);
}
function closestAncestor(node: XNode, tag: string): XNode | null {
  let cur = node.parentNode;
  while (cur) {
    if (cur.nodeName === tag) return cur;
    cur = cur.parentNode;
  }
  return null;
}
function firstKid(node: XNode, tag: string): XNode | null {
  return kids(node).find((k) => k.nodeName === tag) ?? null;
}
function setText(t: XNode, text: string) {
  while (t.firstChild) t.removeChild(t.firstChild);
  t.appendChild(t.ownerDocument.createTextNode(text));
  t.setAttribute("xml:space", "preserve");
}
function textOf(t: XNode): string {
  return t.textContent ?? "";
}
function onOff(rPr: XNode | null, tag: string): boolean {
  if (!rPr) return false;
  const el = firstKid(rPr, tag);
  if (!el) return false;
  const v = el.getAttribute("w:val");
  return !(v === "0" || v === "false" || v === "none");
}

/** Body paragraphs in document order (includes table cells). */
function paragraphs(doc: XDoc): XNode[] {
  const body = els(doc, "w:body")[0];
  return body ? els(body, "w:p") : [];
}

/** The w:t nodes that belong to this paragraph (not to a nested text box paragraph). */
function ownTexts(p: XNode): XNode[] {
  return els(p, "w:t").filter((t) => closestAncestor(t, "w:p") === p);
}
function ownRuns(p: XNode): XNode[] {
  return els(p, "w:r").filter((r) => closestAncestor(r, "w:p") === p);
}

function paragraphText(p: XNode): string {
  return ownTexts(p).map(textOf).join("");
}

// ── Zip I/O ────────────────────────────────────────────────────────────────

export async function loadDocx(bytes: Uint8Array | Buffer): Promise<{ zip: JSZip; doc: XDoc }> {
  const zip = await JSZip.loadAsync(bytes);
  const part = zip.file(DOC_PART);
  if (!part) throw new Error("This file is not a Word document (word/document.xml is missing).");
  const doc = parse(await part.async("string"));
  return { zip, doc };
}

export async function saveDocx(zip: JSZip, doc: XDoc): Promise<Buffer> {
  zip.file(DOC_PART, serialize(doc), { createFolders: false });
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

// ── 1. Tokenize: master text → {{token}} ──────────────────────────────────

/** Replace characters [start, end) of a paragraph's text with `insert`, editing w:t nodes in place. */
function spliceParagraph(p: XNode, start: number, end: number, insert: string) {
  const texts = ownTexts(p);
  let pos = 0;
  let inserted = false;
  for (const t of texts) {
    const s = textOf(t);
    const a = pos;
    const b = pos + s.length;
    pos = b;
    if (b <= start || a >= end) {
      // Zero length range at a node boundary: insert at the start node.
      if (!inserted && start === end && a === start) {
        setText(t, insert + s);
        inserted = true;
      }
      continue;
    }
    const from = Math.max(start, a) - a;
    const to = Math.min(end, b) - a;
    if (!inserted) {
      setText(t, s.slice(0, from) + insert + s.slice(to));
      inserted = true;
    } else {
      setText(t, s.slice(0, from) + s.slice(to));
    }
  }
}

function occurrences(hay: string, needle: string): number[] {
  const out: number[] = [];
  if (!needle) return out;
  let i = hay.indexOf(needle);
  while (i !== -1) {
    out.push(i);
    i = hay.indexOf(needle, i + needle.length);
  }
  return out;
}

/**
 * Write each field's token into the master's text. Fields are applied in
 * sort order, so longer phrases (e.g. "ICFO (COMPANY) SPV, LLC") are claimed
 * before the shorter text inside them ("(COMPANY)"). Returns the matches found
 * per token; throws when a field's text is not in the master.
 */
export function tokenizeDoc(doc: XDoc, fields: TemplateField[], entityMatch: string | null, opts: { strict?: boolean } = {}): Record<string, number> {
  const counts: Record<string, number> = {};
  const missing: { token: string; find: string }[] = [];
  const ordered = [...fields].sort((a, b) => a.sort_order - b.sort_order);
  const specs: { token: string; m: FieldMatch }[] = [];
  for (const f of ordered) for (const m of f.position_ref) specs.push({ token: f.token, m });
  if (entityMatch) specs.push({ token: "issuing_entity", m: { find: entityMatch } });

  const paras = paragraphs(doc);
  for (const { token, m } of specs) {
    const replace = m.replace ?? m.find;
    const offsetInFind = m.find.indexOf(replace);
    if (offsetInFind < 0) throw new Error(`Field ${token}: "${replace}" is not part of "${m.find}".`);
    let seen = 0;
    let hits = 0;
    for (const p of paras) {
      const text = paragraphText(p);
      if (m.context && !text.includes(m.context)) continue;
      // Splice from the end so earlier offsets stay valid.
      const found = occurrences(text, m.find);
      const chosen = found.filter(() => {
        const idx = seen++;
        return m.nth === undefined || m.nth === idx;
      });
      for (const at of [...chosen].reverse()) {
        const s = at + offsetInFind;
        spliceParagraph(p, s, s + replace.length, `{{${token}}}`);
        hits++;
      }
    }
    counts[token] = (counts[token] ?? 0) + hits;
    if (hits === 0) missing.push({ token, find: m.find });
  }
  if (missing.length && opts.strict !== false) throw new TemplateMatchError(missing);
  return counts;
}

// ── 2. Editor model ────────────────────────────────────────────────────────

export type ModelSegment = Segment & { hl?: boolean };
export type ModelParagraph = {
  id: string;
  segments: ModelSegment[];
  style: string | null;
  numbered: boolean;
  align: string | null;
  /** Paragraph holds an image, field code or text box: shown, not editable. */
  locked: boolean;
};
export type ModelBlock =
  | { type: "p"; p: ModelParagraph }
  | { type: "table"; rows: ModelParagraph[][][] };

function runFormat(r: XNode): { b: boolean; i: boolean; hl: boolean } {
  const rPr = firstKid(r, "w:rPr");
  return { b: onOff(rPr, "w:b"), i: onOff(rPr, "w:i"), hl: Boolean(rPr && firstKid(rPr, "w:highlight")) };
}

function paragraphModel(p: XNode, id: string): ModelParagraph {
  const segs: ModelSegment[] = [];
  const push = (text: string, f: { b: boolean; i: boolean; hl: boolean }) => {
    if (!text) return;
    const last = segs[segs.length - 1];
    if (last && Boolean(last.b) === f.b && Boolean(last.i) === f.i && Boolean(last.hl) === f.hl) last.text += text;
    else segs.push({ text, ...(f.b ? { b: true } : {}), ...(f.i ? { i: true } : {}), ...(f.hl ? { hl: true } : {}) });
  };
  for (const r of ownRuns(p)) {
    const f = runFormat(r);
    for (const k of kids(r)) {
      if (k.nodeName === "w:t") push(textOf(k), f);
      else if (k.nodeName === "w:tab") push("\t", f);
      else if (k.nodeName === "w:br" || k.nodeName === "w:cr") push("\n", f);
    }
  }
  const pPr = firstKid(p, "w:pPr");
  const style = pPr ? firstKid(pPr, "w:pStyle")?.getAttribute("w:val") ?? null : null;
  const align = pPr ? firstKid(pPr, "w:jc")?.getAttribute("w:val") ?? null : null;
  const locked =
    els(p, "w:drawing").length > 0 || els(p, "w:pict").length > 0 || els(p, "w:fldChar").length > 0 ||
    els(p, "w:fldSimple").length > 0 || els(p, "w:txbxContent").length > 0 || els(p, "w:footnoteReference").length > 0;
  return { id, segments: segs, style, numbered: Boolean(pPr && firstKid(pPr, "w:numPr")), align, locked };
}

/** Body blocks for the editor: paragraphs and tables, ids = paragraph order. */
export function buildModel(doc: XDoc): ModelBlock[] {
  const paras = paragraphs(doc);
  const idOf = new Map<XNode, string>();
  paras.forEach((p, i) => idOf.set(p, String(i)));
  const body = els(doc, "w:body")[0];
  const blocks: ModelBlock[] = [];

  const walk = (node: XNode, out: ModelBlock[]) => {
    for (const k of kids(node)) {
      if (k.nodeName === "w:p") out.push({ type: "p", p: paragraphModel(k, idOf.get(k)!) });
      else if (k.nodeName === "w:tbl") {
        const rows = kids(k).filter((r) => r.nodeName === "w:tr").map((tr) =>
          kids(tr).filter((c) => c.nodeName === "w:tc").map((tc) =>
            els(tc, "w:p").filter((p) => idOf.has(p)).map((p) => paragraphModel(p, idOf.get(p)!)),
          ),
        );
        out.push({ type: "table", rows });
      } else if (k.nodeName === "w:sdt") {
        const content = firstKid(k, "w:sdtContent");
        if (content) walk(content, out);
      }
    }
  };
  if (body) walk(body, blocks);
  return blocks;
}

// ── 3. Apply editor edits ──────────────────────────────────────────────────

const RPR_LEADING = new Set(["w:rStyle", "w:rFonts"]);

function styledRPr(base: XNode | null, doc: XDoc, seg: Segment): XNode {
  const rPr = base ? base.cloneNode(true) : doc.createElement("w:rPr");
  for (const tag of ["w:b", "w:bCs", "w:i", "w:iCs", "w:highlight"]) {
    for (const k of kids(rPr).filter((x) => x.nodeName === tag)) rPr.removeChild(k);
  }
  const add: string[] = [];
  if (seg.b) add.push("w:b", "w:bCs");
  if (seg.i) add.push("w:i", "w:iCs");
  if (add.length) {
    const before = kids(rPr).find((k) => !RPR_LEADING.has(k.nodeName)) ?? null;
    for (const tag of add) rPr.insertBefore(doc.createElement(tag), before);
  }
  return rPr;
}

function appendSegmentRuns(p: XNode, doc: XDoc, baseRPr: XNode | null, segments: Segment[]) {
  for (const seg of segments) {
    if (!seg.text) continue;
    const r = doc.createElement("w:r");
    const rPr = styledRPr(baseRPr, doc, seg);
    if (kids(rPr).length) r.appendChild(rPr);
    // Split on tabs and line breaks so they become real Word tabs and breaks.
    const parts = seg.text.split(/(\t|\n)/);
    for (const part of parts) {
      if (part === "\t") r.appendChild(doc.createElement("w:tab"));
      else if (part === "\n") r.appendChild(doc.createElement("w:br"));
      else if (part) {
        const t = doc.createElement("w:t");
        setText(t, part);
        r.appendChild(t);
      }
    }
    p.appendChild(r);
  }
}

function firstTextRPr(p: XNode): XNode | null {
  const r = ownRuns(p).find((x) => els(x, "w:t").length > 0) ?? ownRuns(p)[0];
  const rPr = r ? firstKid(r, "w:rPr") : null;
  return rPr ? rPr.cloneNode(true) : null;
}

function rewriteParagraph(p: XNode, doc: XDoc, segments: Segment[]) {
  const baseRPr = firstTextRPr(p);
  for (const k of kids(p)) if (k.nodeName !== "w:pPr") p.removeChild(k);
  appendSegmentRuns(p, doc, baseRPr, segments);
}

/**
 * Apply paragraph edits. An edited paragraph keeps its w:pPr (style, list
 * numbering, spacing) and the first run's character formatting; bold and
 * italic come from the segments. Inserted paragraphs clone the anchor's
 * paragraph properties, which is how a new list item inherits numbering.
 * Locked paragraphs (images, field codes) are never rewritten.
 */
export function applyEdits(doc: XDoc, edits: BodyEdits) {
  const paras = paragraphs(doc);
  const byId = new Map<string, XNode>();
  paras.forEach((p, i) => byId.set(String(i), p));

  // Inserts first (anchored on original ids, or on earlier inserts).
  for (const ins of edits.inserted ?? []) {
    const anchor = byId.get(ins.after);
    if (!anchor) continue;
    const p = doc.createElement("w:p");
    const pPr = firstKid(anchor, "w:pPr");
    if (pPr) p.appendChild(pPr.cloneNode(true));
    appendSegmentRuns(p, doc, firstTextRPr(anchor), ins.segments);
    anchor.parentNode.insertBefore(p, anchor.nextSibling);
    byId.set(ins.id, p);
  }

  for (const [id, segs] of Object.entries(edits.edits ?? {})) {
    const p = byId.get(id);
    if (!p) continue;
    if (paragraphModel(p, id).locked) continue;
    if (segs === null) {
      // A table cell must keep at least one paragraph.
      const cell = closestAncestor(p, "w:tc");
      if (cell && els(cell, "w:p").length <= 1) rewriteParagraph(p, doc, []);
      else p.parentNode.removeChild(p);
    } else {
      rewriteParagraph(p, doc, segs);
    }
  }
}

// ── 4. Fill values ─────────────────────────────────────────────────────────

/**
 * Replace {{tokens}} with values in every w:t of the document part. A value
 * with line breaks becomes Word line breaks inside the same run. Missing values
 * render as `missingText(token)` (preview only; sending is blocked upstream).
 */
export function fillTokens(doc: XDoc, values: Record<string, string>, missingText: (token: string) => string) {
  for (const t of els(doc, "w:t")) {
    const s = textOf(t);
    if (!s.includes("{{")) continue;
    const out = s.replace(TOKEN_RE, (_m, tok: string) => {
      const v = values[tok];
      return v !== undefined && v !== "" ? v : missingText(tok);
    });
    if (!out.includes("\n")) {
      setText(t, out);
      continue;
    }
    const r = t.parentNode;
    const lines = out.split("\n");
    setText(t, lines[0]);
    let after = t;
    for (const line of lines.slice(1)) {
      const br = t.ownerDocument.createElement("w:br");
      r.insertBefore(br, after.nextSibling);
      const nt = t.ownerDocument.createElement("w:t");
      setText(nt, line);
      r.insertBefore(nt, br.nextSibling);
      after = nt;
    }
  }
}

/** Review highlights in the master are for the drafter, never for the prospect. */
export function stripHighlights(doc: XDoc) {
  for (const h of els(doc, "w:highlight")) h.parentNode.removeChild(h);
}

/** Tokens that still appear in the document text. */
export function tokensInDoc(doc: XDoc): string[] {
  const found = new Set<string>();
  for (const t of els(doc, "w:t")) for (const m of textOf(t).matchAll(TOKEN_RE)) found.add(m[1]);
  return [...found];
}

// ── 5. High level ──────────────────────────────────────────────────────────

export type RenderInput = {
  master: Uint8Array | Buffer;
  fields: TemplateField[];
  entityMatch: string | null;
  values: Record<string, string>;
  edits: BodyEdits;
  /** Preview shows open fields as [Label]; final render must have none. */
  mode: "preview" | "final";
};

/** Tokenized master, before edits and values: the base the editor model uses. */
export async function tokenizedModel(master: Uint8Array | Buffer, fields: TemplateField[], entityMatch: string | null) {
  const { doc } = await loadDocx(master);
  tokenizeDoc(doc, fields, entityMatch);
  return { doc, blocks: buildModel(doc) };
}

export async function renderDocx(input: RenderInput): Promise<Buffer> {
  const { zip, doc } = await loadDocx(input.master);
  tokenizeDoc(doc, input.fields, input.entityMatch);
  applyEdits(doc, input.edits);
  const labels = new Map(input.fields.map((f) => [f.token, f.label]));
  labels.set("issuing_entity", "Issuing entity");
  fillTokens(doc, input.values, (tok) => {
    if (input.mode === "final") throw new Error(`Required field is empty: ${labels.get(tok) ?? tok}`);
    return `[${labels.get(tok) ?? tok}]`;
  });
  stripHighlights(doc);
  return saveDocx(zip, doc);
}
