// Lay out the .docx model and draw it with pdfkit. Word's own rules where they
// decide line and page breaks: greedy line breaking at spaces and hyphens,
// unkerned glyph widths, justification over the spaces after the last tab,
// tab stops (explicit, the hanging indent, then the default grid), line height
// from the font's ascent + descent + line gap, paragraph spacing (the larger of
// after and before), space before dropped at the top of a page, widow/orphan
// control in the body and in table cells, keep with next, keep lines together,
// table rows that split across pages, and headers and footers that push the
// body when they are taller than the margins.
//
// Measured against Word's own PDFs of the five iCFO masters (Oct 3, 2026):
// 97.9% of 1,855 lines have the same text, page and position (within 2pt).

import PDFDocument from "pdfkit";
import { FONT_DATA } from "./fonts-data";
import type { Block, Cell, DocModel, Family, Inline, Para, ParaProps, RunStyle, Section, Table } from "./model";

// ── Fonts ──────────────────────────────────────────────────────────────────
// Vertical metrics in font units (unitsPerEm 2048), read from the bundled files.
const METRICS: Record<Family, { asc: number; desc: number; gap: number }> = {
  serif: { asc: 1825, desc: 443, gap: 87 },
  sans: { asc: 1854, desc: 434, gap: 67 },
  calibri: { asc: 1950, desc: 550, gap: 0 },
};
const UPM = 2048;
/**
 * Word 2013+ shrinks the spaces of a justified line to fit one more word. The
 * limit was fitted against Word's own PDFs of the iCFO masters (Oct 3, 2026):
 * 24% of the line's space width gives the most lines identical to Word's.
 */
export const JUSTIFY_SHRINK = 0.24;
const fontKey = (s: RunStyle) => `${s.family}-${s.bold && s.italic ? "BI" : s.bold ? "B" : s.italic ? "I" : "R"}`;
const effSize = (s: RunStyle) => (s.vert ? s.size * 0.65 : s.size);
function lineMetrics(s: RunStyle): { asc: number; desc: number; gap: number } {
  const m = METRICS[s.family];
  const k = s.size / UPM;
  return { asc: m.asc * k, desc: m.desc * k, gap: m.gap * k };
}

type Doc = InstanceType<typeof PDFDocument>;
class Measurer {
  private cache = new Map<string, number>();
  constructor(private doc: Doc) {}
  width(text: string, s: RunStyle): number {
    if (!text) return 0;
    const key = `${fontKey(s)}|${effSize(s)}|${text}`;
    let w = this.cache.get(key);
    if (w === undefined) {
      this.doc.font(fontKey(s)).fontSize(effSize(s));
      w = this.doc.widthOfString(glyphs(text)) + s.charSpacing * [...text].length;
      this.cache.set(key, w);
    }
    return w;
  }
}

// U+2011 (non-breaking hyphen) is kept out of the break rules below, then drawn
// and measured as a plain hyphen, which the bundled fonts have.
const display = (t: string, s: RunStyle) => (s.caps || s.smallCaps ? t.toUpperCase() : t);
const glyphs = (t: string) => t.replace(/\u2011/g, "-");

// ── Line layout ────────────────────────────────────────────────────────────
type Piece =
  | { kind: "text"; text: string; style: RunStyle; x: number; w: number; space: boolean }
  | { kind: "image"; data: Uint8Array; w: number; h: number; x: number; style: RunStyle }
  | { kind: "field"; field: "PAGE" | "NUMPAGES"; style: RunStyle; x: number; w: number };
type Line = { pieces: Piece[]; asc: number; desc: number; gap: number; height: number; pageAfter: boolean };
type Atom =
  | { t: "word"; parts: { text: string; style: RunStyle; w: number }[]; w: number }
  | { t: "space"; text: string; style: RunStyle; w: number }
  | { t: "tab"; style: RunStyle }
  | { t: "br"; style: RunStyle }
  | { t: "page" }
  | { t: "image"; data: Uint8Array; w: number; h: number; style: RunStyle }
  | { t: "field"; field: "PAGE" | "NUMPAGES"; style: RunStyle; w: number };

function atomize(inlines: Inline[], m: Measurer): Atom[] {
  const atoms: Atom[] = [];
  let word: Extract<Atom, { t: "word" }> | null = null;
  const flush = () => {
    if (word && word.parts.length) atoms.push(word);
    word = null;
  };
  for (const it of inlines) {
    if (it.kind === "text") {
      const text = display(it.text, it.style);
      // Break after spaces, and after hyphens/dashes inside a word.
      const re = /( +)|([^ ]*?[-–—](?=[^ ]))|([^ ]+)/g;
      let mt: RegExpExecArray | null;
      while ((mt = re.exec(text))) {
        if (mt[1]) {
          flush();
          atoms.push({ t: "space", text: mt[1], style: it.style, w: m.width(mt[1], it.style) });
        } else {
          const chunk = mt[2] ?? mt[3];
          if (!chunk) continue;
          word ??= { t: "word", parts: [], w: 0 };
          const w = m.width(chunk, it.style);
          word.parts.push({ text: chunk, style: it.style, w });
          word.w += w;
          if (mt[2]) flush();
        }
      }
    } else {
      flush();
      if (it.kind === "tab") atoms.push({ t: "tab", style: it.style });
      else if (it.kind === "br") atoms.push({ t: "br", style: it.style });
      else if (it.kind === "page") atoms.push({ t: "page" });
      else if (it.kind === "image") atoms.push({ t: "image", data: it.data, w: it.w, h: it.h, style: it.style });
      else if (it.kind === "field") atoms.push({ t: "field", field: it.field, style: it.style, w: m.width("99", it.style) });
    }
  }
  flush();
  return atoms;
}

/** Natural line metrics for a style (used for empty lines and line height). */
function addMetrics(line: Line, s: RunStyle) {
  const lm = lineMetrics(s);
  line.asc = Math.max(line.asc, lm.asc);
  line.desc = Math.max(line.desc, lm.desc);
  line.gap = Math.max(line.gap, lm.gap);
}

function layoutParagraph(p: Para, width: number, m: Measurer, defaultTab: number): Line[] {
  const props = p.props;
  const atoms = atomize(p.inlines, m);
  const lines: Line[] = [];
  const newLine = (): Line => ({ pieces: [], asc: 0, desc: 0, gap: 0, height: 0, pageAfter: false });
  let line = newLine();
  let first = true;
  const lineStart = () => props.left + (first ? props.firstLine : 0);
  const lineEnd = width - props.right;
  let x = lineStart();
  let pendingSpaces: { text: string; style: RunStyle; w: number }[] = [];
  let lastTabIndex = 0; // justification applies after the last tab
  const tabIdx: number[] = [];
  let ended: "br" | "page" | null = null;

  const finish = (justify: boolean) => {
    if (!line.pieces.length) addMetrics(line, p.mark);
    // Justify: spread the free space over spaces after the last tab.
    const usedNow = line.pieces.length ? Math.max(...line.pieces.map((pc) => pc.x + pc.w)) : 0;
    if ((justify && props.align === "both") || usedNow > lineEnd + 0.01) {
      const spaces = line.pieces.filter((pc, i) => pc.kind === "text" && pc.space && i >= lastTabIndex);
      const used = line.pieces.length ? Math.max(...line.pieces.map((pc) => pc.x + pc.w)) : 0;
      const free = lineEnd - used;
      if (spaces.length && (free > 0 || free < 0)) {
        const extra = free / spaces.length;
        let shift = 0;
        for (let i = 0; i < line.pieces.length; i++) {
          const pc = line.pieces[i];
          pc.x += shift;
          if (i >= lastTabIndex && pc.kind === "text" && pc.space) {
            pc.w += extra;
            shift += extra;
          }
        }
      }
    } else if (props.align === "center" || props.align === "right") {
      const used = line.pieces.length ? Math.max(...line.pieces.map((pc) => pc.x + pc.w)) : lineStart();
      const start = lineStart();
      const free = lineEnd - start - (used - start);
      const dx = props.align === "center" ? free / 2 : free;
      if (dx > 0) for (const pc of line.pieces) pc.x += dx;
    }
    lines.push(line);
    line = newLine();
    first = false;
    x = lineStart();
    pendingSpaces = [];
    lastTabIndex = 0;
    tabIdx.length = 0;
  };

  const lineSpaces = () => line.pieces.reduce((s, pc, i) => s + (i >= lastTabIndex && pc.kind === "text" && pc.space ? pc.w : 0), 0);
  const placeSpaces = () => {
    for (const s of pendingSpaces) {
      line.pieces.push({ kind: "text", text: s.text, style: s.style, x, w: s.w, space: true });
      x += s.w;
    }
    pendingSpaces = [];
  };

  const nextTab = (pos: number): { pos: number; type: "left" | "right" | "center" | "decimal" } => {
    const explicit = props.tabs.find((t) => t.pos > pos + 0.01);
    // The hanging indent is an implicit tab stop for the first line.
    if (first && props.firstLine < 0 && props.left > pos + 0.01 && (!explicit || props.left < explicit.pos)) return { pos: props.left, type: "left" };
    if (explicit) return explicit;
    const grid = Math.floor(pos / defaultTab + 1e-6) + 1;
    return { pos: grid * defaultTab, type: "left" };
  };

  for (let i = 0; i < atoms.length; i++) {
    const a = atoms[i];
    if (a.t === "space") {
      pendingSpaces.push({ text: a.text, style: a.style, w: a.w });
      addMetrics(line, a.style);
      continue;
    }
    if (a.t === "br" || a.t === "page") {
      placeSpaces();
      if (a.t === "br") addMetrics(line, a.style);
      line.pageAfter = a.t === "page";
      ended = a.t;
      finish(false);
      continue;
    }
    if (a.t === "tab") {
      placeSpaces();
      addMetrics(line, a.style);
      const stop = nextTab(x);
      // Content up to the next tab/break decides right and center alignment.
      let follow = 0;
      for (let j = i + 1; j < atoms.length; j++) {
        const b = atoms[j];
        if (b.t === "tab" || b.t === "br" || b.t === "page") break;
        follow += b.t === "word" || b.t === "space" || b.t === "field" ? b.w : b.t === "image" ? b.w : 0;
      }
      let target = stop.pos;
      if (stop.type === "right") target = Math.max(x, stop.pos - follow);
      else if (stop.type === "center") target = Math.max(x, stop.pos - follow / 2);
      if (target > lineEnd + 0.5 && line.pieces.length) {
        finish(true);
        continue;
      }
      line.pieces.push({ kind: "text", text: "", style: a.style, x, w: target - x, space: false });
      x = target;
      tabIdx.push(line.pieces.length);
      lastTabIndex = line.pieces.length;
      continue;
    }
    const w = a.w;
    const spaceW = pendingSpaces.reduce((s, sp) => s + sp.w, 0);
    const shrink = props.align === "both" ? JUSTIFY_SHRINK * (lineSpaces() + spaceW) : 0;
    if (x + spaceW + w - shrink > lineEnd + 0.01 && line.pieces.length) {
      finish(true);
    }
    placeSpaces();
    if (a.t === "word") {
      for (const part of a.parts) {
        line.pieces.push({ kind: "text", text: part.text, style: part.style, x, w: part.w, space: false });
        addMetrics(line, part.style);
        x += part.w;
      }
    } else if (a.t === "image") {
      line.pieces.push({ kind: "image", data: a.data, w: a.w, h: a.h, x, style: a.style });
      line.asc = Math.max(line.asc, a.h);
      x += a.w;
    } else if (a.t === "field") {
      line.pieces.push({ kind: "field", field: a.field, style: a.style, x, w: a.w });
      addMetrics(line, a.style);
      x += a.w;
    }
  }
  // Trailing spaces hang past the margin and are not drawn.
  pendingSpaces = [];
  if (line.pieces.length || ended === null || ended === "br" || !lines.length) finish(false);
  else if (ended === "page" && lines.length) {
    /* page break was the last thing in the paragraph */
  }
  for (const l of lines) {
    const natural = l.asc + l.desc + l.gap;
    l.height = props.lineRule === "exact" ? props.line : props.lineRule === "atLeast" ? Math.max(props.line, natural) : natural * props.line;
  }
  return lines;
}

// ── Pagination ─────────────────────────────────────────────────────────────
type Op = { y: number; line: Line; x0: number; baseline: number };
type Page = { ops: Op[] };

function spacingBefore(p: ParaProps) {
  return p.beforeAuto ? 14 : p.before;
}
function spacingAfter(p: ParaProps) {
  return p.afterAuto ? 14 : p.after;
}
/**
 * Space between two paragraphs: the larger of the previous paragraph's space
 * after and this one's space before (measured against Word's PDFs of the
 * masters). Contextual spacing between paragraphs of the same style drops both,
 * and auto space before is dropped for the first paragraph of the document or
 * of a table cell.
 */
function gap(prev: Para | null, cur: ParaProps): number {
  if (prev && cur.contextual && prev.props.contextual && prev.props.styleId === cur.styleId) return 0;
  const before = cur.beforeAuto && !prev ? 0 : spacingBefore(cur);
  if (!prev) return before;
  const after = spacingAfter(prev.props);
  return Math.max(after, before);
}
function baselineOf(l: Line, top: number, props: ParaProps): number {
  // Extra height from line spacing sits above the text (Word puts it there for
  // multiples); exact heights clip around the text box.
  const natural = l.asc + l.desc + l.gap;
  if (props.lineRule === "exact") return top + l.height - l.desc - l.gap;
  return top + (l.height - natural) + l.asc;
}

/** Content of a block area laid out without page breaks (cells, headers). */
/** One line (or nested-table line) of a cell or header, with its paragraph for widow control. */
type Unit = { top: number; height: number; ops: Op[]; cell?: number; para?: { id: number; index: number; count: number; widow: boolean } };
let paraSeq = 0;
function layoutFlat(blocks: Block[], width: number, x0: number, m: Measurer, defaultTab: number): { units: Unit[]; height: number } {
  const units: Unit[] = [];
  let y = 0;
  let prev: Para | null = null;
  for (const b of blocks) {
    if (b.kind === "p" && b.props.frame) {
      // Floats over the flow: laid out at its own width, aligned, no space taken.
      const ls = layoutParagraph({ ...b, props: { ...b.props, align: "left", left: 0, right: 0, firstLine: 0 } }, width, m, defaultTab);
      for (const l of ls) {
        const used = l.pieces.length ? Math.max(...l.pieces.map((pc) => pc.x + pc.w)) : 0;
        const dx = b.props.frame.xAlign === "center" ? (width - used) / 2 : b.props.frame.xAlign === "right" ? width - used : 0;
        for (const pc of l.pieces) pc.x += dx;
        units.push({ top: y + b.props.frame.y, height: 0, ops: [{ y: 0, line: l, x0, baseline: baselineOf(l, 0, b.props) }] });
      }
      continue;
    }
    if (b.kind === "p") {
      y += gap(prev, b.props);
      // Word ignores page breaks inside table cells, headers and footers.
      const ls = layoutParagraph({ ...b, inlines: b.inlines.filter((it) => it.kind !== "page") }, width, m, defaultTab);
      const id = ++paraSeq;
      ls.forEach((l, index) => {
        // Word keeps a paragraph's space after with its last line when a row splits.
        const tail = index === ls.length - 1 ? spacingAfter(b.props) : 0;
        units.push({ top: y, height: l.height + tail, ops: [{ y: 0, line: l, x0, baseline: baselineOf(l, 0, b.props) }], para: { id, index, count: ls.length, widow: b.props.widow } });
        y += l.height;
      });
      prev = b;
    } else {
      if (prev) y += spacingAfter(prev.props);
      const t = layoutTableRows(b, width, x0, m, defaultTab);
      for (const r of t) {
        for (const u of r.units) units.push({ top: y + u.top, height: u.height, ops: u.ops });
        y += r.height;
      }
      prev = null;
    }
  }
  // Auto space after is dropped for the last paragraph of a cell, as auto space
  // before is for the first.
  if (prev && !prev.props.afterAuto) y += spacingAfter(prev.props);
  return { units, height: y };
}

type RowLayout = { height: number; units: Unit[]; cantSplit: boolean };
function columnXs(t: Table, width: number): { xs: number[]; total: number } {
  const cols = t.cols.length ? t.cols : [width];
  const xs = [0];
  for (const c of cols) xs.push(xs[xs.length - 1] + c);
  return { xs, total: xs[xs.length - 1] };
}
function layoutTableRows(t: Table, width: number, x0: number, m: Measurer, defaultTab: number): RowLayout[] {
  const { xs, total } = columnXs(t, width);
  const left = x0 + t.indent + (t.align === "center" ? (width - total) / 2 : t.align === "right" ? width - total : 0);
  const out: RowLayout[] = [];
  for (const row of t.rows) {
    let col = 0;
    const units: Unit[] = [];
    let height = 0;
    let cellNo = 0;
    for (const cell of row.cells) {
      cellNo++;
      const span = Math.max(1, cell.span);
      const cx = left + (xs[col] ?? 0);
      const cw = (xs[Math.min(col + span, xs.length - 1)] ?? total) - (xs[col] ?? 0) || cell.width;
      col += span;
      if (cell.vMerge === "continue") continue;
      const inner = layoutFlat(cell.blocks, cw - cell.marL - cell.marR, cx + cell.marL, m, defaultTab);
      for (const u of inner.units) units.push({ ...u, top: u.top + cell.marT, cell: cellNo });
      height = Math.max(height, inner.height + cell.marT + cell.marB);
    }
    if (row.exactHeight && row.minHeight) height = row.minHeight;
    else height = Math.max(height, row.minHeight);
    out.push({ height, units, cantSplit: row.cantSplit });
  }
  return out;
}

/**
 * Lines of a row that stay on this page: per cell, the lines that fit, then
 * Word's widow/orphan control (no lone first line at the bottom, no lone last
 * line at the top) for the paragraph that straddles the break.
 */
function splitFit(units: Unit[], room: number, atTop: boolean): Unit[] {
  const out: Unit[] = [];
  const cells = new Map<number, Unit[]>();
  for (const u of units) {
    const k = u.cell ?? 0;
    if (!cells.has(k)) cells.set(k, []);
    cells.get(k)!.push(u);
  }
  for (const list of cells.values()) {
    list.sort((a, b) => a.top - b.top);
    let n = list.findIndex((u) => u.top + u.height > room);
    if (n === -1) n = list.length;
    if (n < list.length && n > 0) {
      const cut = list[n];
      const p = cut.para;
      if (p && p.widow && p.count >= 2) {
        let onPage = p.index; // lines of this paragraph above the cut
        if (p.count - onPage === 1 && onPage >= 2) {
          n -= 1; // widow: no lone last line at the top of the next page
          onPage -= 1;
        }
        if (onPage === 1 && !atTop) n -= 1; // orphan: no lone first line at the bottom
      }
    }
    // A cell that would keep nothing here takes the whole row with it.
    if (n === 0 && list.length) return [];
    out.push(...list.slice(0, n));
  }
  return out;
}

class Paginator {
  pages: Page[] = [];
  y = 0;
  top = 0;
  bottom = 0;
  atTop = true;
  hardBreak = false;
  constructor(private bounds: (pageIndex: number) => { top: number; bottom: number }) {
    this.newPage();
  }
  get page() {
    return this.pages[this.pages.length - 1];
  }
  newPage(hard = false) {
    this.pages.push({ ops: [] });
    const b = this.bounds(this.pages.length - 1);
    this.top = b.top;
    this.bottom = b.bottom;
    this.y = b.top;
    this.atTop = true;
    this.hardBreak = hard;
  }
  room() {
    return this.bottom - this.y;
  }
}

function paginate(model: DocModel, m: Measurer, bounds: (i: number) => { top: number; bottom: number }): Page[] {
  const sec = model.section;
  const width = sec.pageW - sec.left - sec.right;
  const pg = new Paginator(bounds);
  const EPS = 0.01;
  const blocks = model.body;
  let first = true;
  let prev: Para | null = null;

  const firstLineHeight = (b: Block | undefined): number => {
    if (!b) return 0;
    if (b.kind === "p") {
      const ls = layoutParagraph(b, width, m, sec.defaultTab);
      return spacingBefore(b.props) + (ls[0]?.height ?? 0);
    }
    const rows = layoutTableRows(b, width, sec.left, m, sec.defaultTab);
    const u = rows[0]?.units.reduce((mx, x) => Math.max(mx, x.top + x.height), 0) ?? 0;
    return Math.min(u, rows[0]?.height ?? 0);
  };

  for (let bi = 0; bi < blocks.length; bi++) {
    const b = blocks[bi];
    if (b.kind === "tbl") {
      if (prev && !pg.atTop) pg.y += spacingAfter(prev.props);
      for (const row of layoutTableRows(b, width, sec.left, m, sec.defaultTab)) {
        let units = row.units;
        let height = row.height;
        if (height > pg.room() + EPS && (row.cantSplit || height <= pg.bottom - pg.top) && !pg.atTop && row.cantSplit) pg.newPage();
        while (height > pg.room() + EPS && !(pg.atTop && units.length === 0)) {
          // Split: each cell keeps the lines that fit; the rest moves on.
          const room = pg.room();
          const fit = splitFit(units, room + EPS, pg.atTop);
          if (!fit.length && !pg.atTop) {
            pg.newPage();
            continue;
          }
          const placed = fit.length ? fit : [units[0]];
          for (const u of placed) for (const op of u.ops) pg.page.ops.push({ ...op, y: pg.y + u.top, baseline: pg.y + u.top + op.baseline });
          const rest = units.filter((u) => !placed.includes(u));
          if (!rest.length) {
            // Every line fits; only the row's trailing space runs past the
            // bottom. The row stays here and the next row starts a new page.
            pg.y += height;
            pg.atTop = false;
            height = 0;
            units = [];
            break;
          }
          // Each cell continues from the top of the next page on its own.
          const firsts = new Map<number, number>();
          for (const u of rest) firsts.set(u.cell ?? 0, Math.min(firsts.get(u.cell ?? 0) ?? Infinity, u.top));
          const shift = Math.min(...rest.map((u) => u.top));
          units = rest.map((u) => ({ ...u, top: u.top - (firsts.get(u.cell ?? 0) ?? shift) }));
          height = Math.max(height - shift, ...units.map((u) => u.top + u.height));
          pg.newPage();
        }
        for (const u of units) for (const op of u.ops) pg.page.ops.push({ ...op, y: pg.y + u.top, baseline: pg.y + u.top + op.baseline });
        pg.y += height;
        pg.atTop = false;
      }
      prev = null;
      first = false;
      continue;
    }

    const p = b;
    const props = p.props;
    if (props.pageBreakBefore && !pg.atTop) pg.newPage(true);
    const lines = layoutParagraph(p, width, m, sec.defaultTab);
    // Space before is dropped at the top of a page, except at the very start
    // of the document and after a manual page break.
    let before = pg.atTop && !first ? (pg.hardBreak ? spacingBefore(props) : 0) : gap(first ? null : prev, props);
    const next = blocks[bi + 1];
    const after = spacingAfter(props);
    const total = lines.reduce((s, l) => s + l.height, 0);

    // Keep with next / keep lines together: move the paragraph to a new page
    // when it (and the next paragraph's first line) does not fit here.
    if (!pg.atTop) {
      const need = before + total + (props.keepNext ? after + firstLineHeight(next) : 0);
      const pageH = pg.bottom - pg.top;
      if ((props.keepNext || props.keepLines) && need > pg.room() + EPS && need <= pageH) pg.newPage();
    }
    if (pg.atTop && !first && !pg.hardBreak) before = 0;
    pg.y += before;
    void after;

    let i = 0;
    while (i < lines.length) {
      // How many of the remaining lines fit on this page?
      let k = 0;
      let h = 0;
      while (i + k < lines.length && pg.y + h + lines[i + k].height <= pg.bottom + EPS) {
        h += lines[i + k].height;
        k++;
        if (lines[i + k - 1].pageAfter) break;
      }
      const remaining = lines.length - i;
      if (k < remaining && !lines[i + k - 1]?.pageAfter) {
        if (props.widow && remaining >= 2) {
          if (remaining - k === 1 && k >= 2) k -= 1; // widow: no single last line at a page top
          if (k === 1 && i === 0 && !pg.atTop) k = 0; // orphan: no single first line at a page bottom
        }
        if (k === 0 && pg.atTop) k = 1; // a line taller than the page still goes somewhere
      }
      for (let j = 0; j < k; j++) {
        const l = lines[i + j];
        pg.page.ops.push({ y: pg.y, line: l, x0: sec.left, baseline: baselineOf(l, pg.y, props) });
        pg.y += l.height;
        pg.atTop = false;
      }
      i += k;
      const brk = k > 0 && lines[i - 1].pageAfter;
      if (i < lines.length || brk) pg.newPage(brk);
    }
    prev = p;
    first = false;
  }
  return pg.pages;
}

// ── Drawing ────────────────────────────────────────────────────────────────
const HIGHLIGHT: Record<string, string> = { yellow: "#FFFF00", green: "#00FF00", cyan: "#00FFFF", lightGray: "#D3D3D3", magenta: "#FF00FF" };

// Each image is embedded once and reused on every page (pdfkit's openImage is
// not in its type definitions).
type Opened = unknown;
const IMAGES = new WeakMap<Doc, Map<Uint8Array, Opened>>();
function imageFor(doc: Doc, data: Uint8Array): Buffer {
  let m = IMAGES.get(doc);
  if (!m) IMAGES.set(doc, (m = new Map()));
  let img = m.get(data);
  if (!img) m.set(data, (img = (doc as unknown as { openImage(src: Buffer): Opened }).openImage(Buffer.from(data))));
  return img as Buffer;
}

function drawLine(doc: Doc, op: Op, pageNo: number, pageCount: number) {
  const { line, x0, baseline } = op;
  // Highlights first, so text sits on top.
  for (const pc of line.pieces) {
    if (pc.kind !== "text" || !pc.style.highlight || pc.w <= 0) continue;
    const s = pc.style;
    const lm = lineMetrics(s);
    doc.save().rect(x0 + pc.x, baseline - lm.asc, pc.w, lm.asc + lm.desc).fill(HIGHLIGHT[s.highlight!] ?? "#FFFF00").restore();
  }
  for (const pc of line.pieces) {
    if (pc.kind === "image") {
      doc.image(imageFor(doc, pc.data), x0 + pc.x, baseline - pc.h, { width: pc.w, height: pc.h });
      continue;
    }
    const s = pc.style;
    const text = pc.kind === "field" ? String(pc.field === "PAGE" ? pageNo : pageCount) : pc.text;
    const rise = s.vert === "super" ? s.size * 0.33 : s.vert === "sub" ? -s.size * 0.14 : 0;
    if (text && !(pc.kind === "text" && pc.space)) {
      doc.font(fontKey(s)).fontSize(effSize(s)).fillColor(`#${s.color}`);
      doc.text(glyphs(text), x0 + pc.x, baseline - rise, { lineBreak: false, baseline: "alphabetic", characterSpacing: s.charSpacing || undefined });
    }
    if ((s.underline || s.strike) && pc.w > 0 && text) {
      const thick = Math.max(0.5, s.size / 20);
      const y = s.underline ? baseline + s.size * 0.12 : baseline - s.size * 0.28;
      doc.save().lineWidth(thick).strokeColor(`#${s.color}`).moveTo(x0 + pc.x, y).lineTo(x0 + pc.x + pc.w, y).stroke().restore();
    }
  }
}

/** Render the model to PDF bytes. */
export async function renderModel(model: DocModel): Promise<Buffer> {
  const sec: Section = model.section;
  const doc = new PDFDocument({ size: [sec.pageW, sec.pageH], margin: 0, autoFirstPage: false, info: { Producer: "iCapOS", Creator: "iCapOS" } });
  for (const [key, b64] of Object.entries(FONT_DATA)) doc.registerFont(key, Buffer.from(b64, "base64"));
  const m = new Measurer(doc);
  const width = sec.pageW - sec.left - sec.right;

  const headerFor = (i: number) => (sec.titlePg && i === 0 ? sec.headers.first : sec.headers.default);
  const footerFor = (i: number) => (sec.titlePg && i === 0 ? sec.footers.first : sec.footers.default);
  const flat = new Map<Block[], ReturnType<typeof layoutFlat>>();
  const area = (blocks: Block[] | null) => {
    if (!blocks) return null;
    let f = flat.get(blocks);
    if (!f) {
      f = layoutFlat(blocks, width, sec.left, m, sec.defaultTab);
      flat.set(blocks, f);
    }
    return f;
  };
  const bounds = (i: number) => {
    const h = area(headerFor(i));
    const f = area(footerFor(i));
    const top = Math.max(sec.top, h ? sec.headerDist + h.height : 0);
    const bottom = Math.min(sec.pageH - sec.bottom, f ? sec.pageH - sec.footerDist - f.height : Infinity);
    return { top, bottom };
  };

  const pages = paginate(model, m, bounds);
  pages.forEach((page, i) => {
    doc.addPage({ size: [sec.pageW, sec.pageH], margin: 0 });
    const h = area(headerFor(i));
    if (h) for (const u of h.units) for (const op of u.ops) drawLine(doc, { ...op, baseline: sec.headerDist + u.top + op.baseline }, i + 1, pages.length);
    const f = area(footerFor(i));
    if (f) {
      const top = sec.pageH - sec.footerDist - f.height;
      for (const u of f.units) for (const op of u.ops) drawLine(doc, { ...op, baseline: top + u.top + op.baseline }, i + 1, pages.length);
    }
    for (const op of page.ops) drawLine(doc, op, i + 1, pages.length);
  });

  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  doc.end();
  return done;
}

export type { Cell };
