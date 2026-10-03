// Read a .docx into a layout model: paragraphs and tables with their resolved
// properties (styles, direct formatting, numbering), plus the section's page
// setup, headers and footers. Server only; pure apart from unzipping.

import JSZip from "jszip";
import { DOMParser } from "@xmldom/xmldom";

type El = Element;
const TW = 20; // twips per point
const EMU = 12700; // EMU per point

export type Family = "serif" | "sans" | "calibri";
export type RunStyle = {
  family: Family;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  size: number; // pt
  color: string; // hex without #
  caps: boolean;
  smallCaps: boolean;
  highlight: string | null;
  vert: "super" | "sub" | null;
  hidden: boolean;
  charSpacing: number; // pt added after each character
};
export type Inline =
  | { kind: "text"; text: string; style: RunStyle }
  | { kind: "tab"; style: RunStyle }
  | { kind: "br"; style: RunStyle }
  | { kind: "page" }
  | { kind: "image"; data: Uint8Array; w: number; h: number; style: RunStyle }
  | { kind: "field"; field: "PAGE" | "NUMPAGES"; style: RunStyle };
export type Tab = { pos: number; type: "left" | "right" | "center" | "decimal" };
export type ParaProps = {
  align: "left" | "center" | "right" | "both";
  left: number;
  right: number;
  firstLine: number; // negative = hanging
  before: number;
  after: number;
  beforeAuto: boolean;
  afterAuto: boolean;
  line: number; // auto: multiple (1 = single); exact/atLeast: points
  lineRule: "auto" | "exact" | "atLeast";
  tabs: Tab[];
  keepNext: boolean;
  keepLines: boolean;
  pageBreakBefore: boolean;
  widow: boolean;
  contextual: boolean;
  styleId: string | null;
  /** Framed paragraph (e.g. a centered page number) that floats and takes no space. */
  frame: { xAlign: "left" | "center" | "right"; y: number } | null;
};
export type Para = { kind: "p"; props: ParaProps; inlines: Inline[]; mark: RunStyle };
export type Cell = { width: number; blocks: Block[]; vMerge: "restart" | "continue" | null; span: number; marL: number; marR: number; marT: number; marB: number };
export type Row = { cells: Cell[]; cantSplit: boolean; minHeight: number; exactHeight: boolean };
export type Table = { kind: "tbl"; indent: number; cols: number[]; rows: Row[]; align: "left" | "center" | "right" };
export type Block = Para | Table;
export type Section = {
  pageW: number;
  pageH: number;
  top: number;
  bottom: number;
  left: number;
  right: number;
  headerDist: number;
  footerDist: number;
  titlePg: boolean;
  headers: { first: Block[] | null; default: Block[] | null };
  footers: { first: Block[] | null; default: Block[] | null };
  defaultTab: number;
};
export type DocModel = { section: Section; body: Block[] };

// ── XML helpers ────────────────────────────────────────────────────────────
function kids(n: Node | null | undefined, name?: string): El[] {
  const out: El[] = [];
  if (!n) return out;
  for (let c = n.firstChild; c; c = c.nextSibling) if (c.nodeType === 1 && (!name || (c as El).nodeName === name)) out.push(c as El);
  return out;
}
function kid(n: Node | null | undefined, name: string): El | null {
  return kids(n, name)[0] ?? null;
}
function attr(e: El | null | undefined, name: string): string | null {
  if (!e) return null;
  const v = e.getAttribute(name);
  return v === "" && !e.hasAttribute(name) ? null : v;
}
function num(v: string | null): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
/** On/off property: present means on unless w:val is false/0/off. */
function onOff(e: El | null): boolean | null {
  if (!e) return null;
  const v = attr(e, "w:val");
  return !(v === "0" || v === "false" || v === "off" || v === "none");
}
const parse = (xml: string) => new DOMParser().parseFromString(xml, "text/xml") as unknown as Document;

// ── Fonts and themes ───────────────────────────────────────────────────────
function familyFor(name: string | null): Family | null {
  if (!name) return null;
  const n = name.toLowerCase();
  if (n.includes("times") || n.includes("cambria") || n.includes("georgia") || n.includes("garamond") || n.includes("serif")) return n.includes("sans") ? "sans" : "serif";
  if (n.includes("arial") || n.includes("helvetica") || n.includes("liberation sans")) return "sans";
  return "calibri";
}

// ── Properties ─────────────────────────────────────────────────────────────
const BASE_RUN: RunStyle = { family: "serif", bold: false, italic: false, underline: false, strike: false, size: 10, color: "000000", caps: false, smallCaps: false, highlight: null, vert: null, hidden: false, charSpacing: 0 };
const BASE_PARA: ParaProps = { align: "left", left: 0, right: 0, firstLine: 0, before: 0, after: 0, beforeAuto: false, afterAuto: false, line: 1, lineRule: "auto", tabs: [], keepNext: false, keepLines: false, pageBreakBefore: false, widow: true, contextual: false, styleId: null, frame: null };

type Ctx = { theme: { minor: string | null; major: string | null } };

function applyRPr(base: RunStyle, rPr: El | null, ctx: Ctx): RunStyle {
  if (!rPr) return base;
  const s = { ...base };
  const f = kid(rPr, "w:rFonts");
  if (f) {
    const theme = attr(f, "w:asciiTheme") ?? attr(f, "w:hAnsiTheme");
    const name = attr(f, "w:ascii") ?? attr(f, "w:hAnsi") ?? (theme ? (theme.startsWith("major") ? ctx.theme.major : ctx.theme.minor) : null);
    const fam = familyFor(name);
    if (fam) s.family = fam;
  }
  const b = onOff(kid(rPr, "w:b"));
  if (b !== null) s.bold = b;
  const i = onOff(kid(rPr, "w:i"));
  if (i !== null) s.italic = i;
  const u = kid(rPr, "w:u");
  if (u) s.underline = attr(u, "w:val") !== "none";
  const st = onOff(kid(rPr, "w:strike"));
  if (st !== null) s.strike = st;
  const sz = num(attr(kid(rPr, "w:sz"), "w:val"));
  if (sz !== null) s.size = sz / 2;
  const c = attr(kid(rPr, "w:color"), "w:val");
  if (c && /^[0-9a-f]{6}$/i.test(c)) s.color = c;
  else if (c === "auto") s.color = "000000";
  const caps = onOff(kid(rPr, "w:caps"));
  if (caps !== null) s.caps = caps;
  const sc = onOff(kid(rPr, "w:smallCaps"));
  if (sc !== null) s.smallCaps = sc;
  const hl = kid(rPr, "w:highlight");
  if (hl) s.highlight = attr(hl, "w:val") === "none" ? null : attr(hl, "w:val");
  const va = attr(kid(rPr, "w:vertAlign"), "w:val");
  if (va) s.vert = va === "superscript" ? "super" : va === "subscript" ? "sub" : null;
  const cs = num(attr(kid(rPr, "w:spacing"), "w:val"));
  if (cs !== null) s.charSpacing = cs / TW;
  const v = onOff(kid(rPr, "w:vanish"));
  if (v !== null) s.hidden = v;
  return s;
}

function applyPPr(base: ParaProps, pPr: El | null): ParaProps {
  if (!pPr) return base;
  const p = { ...base, tabs: [...base.tabs] };
  const jc = attr(kid(pPr, "w:jc"), "w:val");
  if (jc) p.align = jc === "center" ? "center" : jc === "right" || jc === "end" ? "right" : jc === "both" || jc === "distribute" ? "both" : "left";
  const ind = kid(pPr, "w:ind");
  if (ind) {
    const l = num(attr(ind, "w:left") ?? attr(ind, "w:start"));
    if (l !== null) p.left = l / TW;
    const r = num(attr(ind, "w:right") ?? attr(ind, "w:end"));
    if (r !== null) p.right = r / TW;
    const h = num(attr(ind, "w:hanging"));
    const fl = num(attr(ind, "w:firstLine"));
    if (h !== null) p.firstLine = -h / TW;
    else if (fl !== null) p.firstLine = fl / TW;
  }
  const sp = kid(pPr, "w:spacing");
  if (sp) {
    const b = num(attr(sp, "w:before"));
    if (b !== null) p.before = b / TW;
    const a = num(attr(sp, "w:after"));
    if (a !== null) p.after = a / TW;
    if (attr(sp, "w:beforeAutospacing") !== null) p.beforeAuto = attr(sp, "w:beforeAutospacing") !== "0";
    if (attr(sp, "w:afterAutospacing") !== null) p.afterAuto = attr(sp, "w:afterAutospacing") !== "0";
    const ln = num(attr(sp, "w:line"));
    const rule = attr(sp, "w:lineRule");
    if (ln !== null) {
      if (rule === "exact" || rule === "atLeast") {
        p.lineRule = rule;
        p.line = ln / TW;
      } else {
        p.lineRule = "auto";
        p.line = ln / 240;
      }
    }
  }
  const fr = kid(pPr, "w:framePr");
  if (fr && attr(fr, "w:xAlign")) {
    const xa = attr(fr, "w:xAlign");
    p.frame = { xAlign: xa === "center" ? "center" : xa === "right" || xa === "outside" ? "right" : "left", y: (num(attr(fr, "w:y")) ?? 0) / TW };
  }
  const tabs = kid(pPr, "w:tabs");
  if (tabs) {
    for (const t of kids(tabs, "w:tab")) {
      const pos = num(attr(t, "w:pos"));
      if (pos === null) continue;
      const val = attr(t, "w:val") ?? "left";
      p.tabs = p.tabs.filter((x) => Math.abs(x.pos - pos / TW) > 0.01);
      if (val === "clear") continue;
      p.tabs.push({ pos: pos / TW, type: val === "right" || val === "end" ? "right" : val === "center" ? "center" : val === "decimal" ? "decimal" : "left" });
    }
    p.tabs.sort((a, b) => a.pos - b.pos);
  }
  for (const [tag, key] of [["w:keepNext", "keepNext"], ["w:keepLines", "keepLines"], ["w:pageBreakBefore", "pageBreakBefore"], ["w:widowControl", "widow"], ["w:contextualSpacing", "contextual"]] as const) {
    const v = onOff(kid(pPr, tag));
    if (v !== null) p[key] = v;
  }
  return p;
}

// ── Styles ─────────────────────────────────────────────────────────────────
type StyleDef = { id: string; type: string; basedOn: string | null; pPr: El | null; rPr: El | null; numPr: El | null };
class Styles {
  map = new Map<string, StyleDef>();
  defaultPara: string | null = null;
  defaultTable: string | null = null;
  docRPr: El | null = null;
  docPPr: El | null = null;
  constructor(doc: Document | null) {
    if (!doc) return;
    const root = doc.documentElement;
    const dd = kid(root, "w:docDefaults");
    this.docRPr = kid(kid(dd, "w:rPrDefault"), "w:rPr");
    this.docPPr = kid(kid(dd, "w:pPrDefault"), "w:pPr");
    for (const s of kids(root, "w:style")) {
      const id = attr(s, "w:styleId") ?? "";
      const type = attr(s, "w:type") ?? "paragraph";
      const pPr = kid(s, "w:pPr");
      this.map.set(id, { id, type, basedOn: attr(kid(s, "w:basedOn"), "w:val"), pPr, rPr: kid(s, "w:rPr"), numPr: kid(pPr, "w:numPr") });
      if (attr(s, "w:default") === "1" && type === "paragraph") this.defaultPara = id;
      if (attr(s, "w:default") === "1" && type === "table") this.defaultTable = id;
    }
  }
  chain(id: string | null): StyleDef[] {
    const out: StyleDef[] = [];
    let cur = id ? this.map.get(id) : undefined;
    const seen = new Set<string>();
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id);
      out.unshift(cur);
      cur = cur.basedOn ? this.map.get(cur.basedOn) : undefined;
    }
    return out;
  }
}

// ── Numbering ──────────────────────────────────────────────────────────────
type Level = { start: number; fmt: string; text: string; suff: "tab" | "space" | "nothing"; pPr: El | null; rPr: El | null };
class Numbering {
  abstracts = new Map<string, Level[]>();
  nums = new Map<string, { abs: string; overrides: Map<number, number> }>();
  counters = new Map<string, number[]>();
  started = new Set<string>();
  constructor(doc: Document | null) {
    if (!doc) return;
    const root = doc.documentElement;
    for (const a of kids(root, "w:abstractNum")) {
      const levels: Level[] = [];
      for (const l of kids(a, "w:lvl")) {
        const i = Number(attr(l, "w:ilvl") ?? 0);
        levels[i] = {
          start: num(attr(kid(l, "w:start"), "w:val")) ?? 1,
          fmt: attr(kid(l, "w:numFmt"), "w:val") ?? "decimal",
          text: attr(kid(l, "w:lvlText"), "w:val") ?? "",
          suff: (attr(kid(l, "w:suff"), "w:val") as Level["suff"]) ?? "tab",
          pPr: kid(l, "w:pPr"),
          rPr: kid(l, "w:rPr"),
        };
      }
      this.abstracts.set(attr(a, "w:abstractNumId") ?? "", levels);
    }
    for (const n of kids(root, "w:num")) {
      const overrides = new Map<number, number>();
      for (const o of kids(n, "w:lvlOverride")) {
        const so = num(attr(kid(o, "w:startOverride"), "w:val"));
        if (so !== null) overrides.set(Number(attr(o, "w:ilvl") ?? 0), so);
      }
      this.nums.set(attr(n, "w:numId") ?? "", { abs: attr(kid(n, "w:abstractNumId"), "w:val") ?? "", overrides });
    }
  }
  /** Advance the list and return the label for this paragraph. */
  next(numId: string, ilvl: number): { level: Level; label: string } | null {
    const n = this.nums.get(numId);
    if (!n) return null;
    const levels = this.abstracts.get(n.abs);
    const level = levels?.[ilvl];
    if (!levels || !level) return null;
    let c = this.counters.get(n.abs);
    if (!c) {
      c = levels.map((l) => (l ? l.start - 1 : 0));
      this.counters.set(n.abs, c);
    }
    if (!this.started.has(numId)) {
      this.started.add(numId);
      for (const [lv, start] of n.overrides) c[lv] = start - 1;
    }
    c[ilvl] = (c[ilvl] ?? 0) + 1;
    for (let d = ilvl + 1; d < levels.length; d++) if (levels[d]) c[d] = levels[d].start - 1;
    const label = level.text.replace(/%(\d)/g, (_m, d: string) => {
      const lv = Number(d) - 1;
      return formatNum(c![lv] ?? 1, levels[lv]?.fmt ?? "decimal");
    });
    return { level, label: level.fmt === "bullet" ? "•" : level.fmt === "none" ? "" : label };
  }
}
function roman(n: number): string {
  const t: [number, string][] = [[1000, "m"], [900, "cm"], [500, "d"], [400, "cd"], [100, "c"], [90, "xc"], [50, "l"], [40, "xl"], [10, "x"], [9, "ix"], [5, "v"], [4, "iv"], [1, "i"]];
  let s = "";
  for (const [v, r] of t) while (n >= v) { s += r; n -= v; }
  return s;
}
function letter(n: number): string {
  const ch = String.fromCharCode(97 + ((n - 1) % 26));
  return ch.repeat(Math.floor((n - 1) / 26) + 1);
}
function formatNum(n: number, fmt: string): string {
  switch (fmt) {
    case "lowerLetter": return letter(n);
    case "upperLetter": return letter(n).toUpperCase();
    case "lowerRoman": return roman(n);
    case "upperRoman": return roman(n).toUpperCase();
    case "decimalZero": return n < 10 ? `0${n}` : String(n);
    default: return String(n);
  }
}

// ── Reader ─────────────────────────────────────────────────────────────────
class Reader {
  constructor(
    private styles: Styles,
    private numbering: Numbering,
    private ctx: Ctx,
    private media: Map<string, Uint8Array>,
  ) {}

  baseRun(): RunStyle {
    let r = applyRPr({ ...BASE_RUN, family: familyFor(this.ctx.theme.minor) ?? "calibri" }, this.styles.docRPr, this.ctx);
    if (!this.styles.docRPr || !kid(this.styles.docRPr, "w:sz")) r = { ...r, size: 10 };
    return r;
  }

  paraStyle(pPr: El | null, tableStyle: string | null): { props: ParaProps; run: RunStyle; numPr: El | null } {
    let props = applyPPr(BASE_PARA, this.styles.docPPr);
    let run = this.baseRun();
    for (const s of this.styles.chain(tableStyle)) {
      props = applyPPr(props, s.pPr);
      run = applyRPr(run, s.rPr, this.ctx);
    }
    const styleId = attr(kid(pPr, "w:pStyle"), "w:val") ?? this.styles.defaultPara;
    let numPr: El | null = null;
    for (const s of this.styles.chain(styleId)) {
      props = applyPPr(props, s.pPr);
      run = applyRPr(run, s.rPr, this.ctx);
      if (s.numPr) numPr = s.numPr;
    }
    return { props: { ...props, styleId }, run, numPr: kid(pPr, "w:numPr") ?? numPr };
  }

  runStyle(base: RunStyle, rPr: El | null): RunStyle {
    const charStyle = attr(kid(rPr, "w:rStyle"), "w:val");
    let r = base;
    for (const s of this.styles.chain(charStyle)) r = applyRPr(r, s.rPr, this.ctx);
    return applyRPr(r, rPr, this.ctx);
  }

  blocks(container: El, tableStyle: string | null = null): Block[] {
    const out: Block[] = [];
    for (const c of kids(container)) {
      if (c.nodeName === "w:p") out.push(this.para(c, tableStyle));
      else if (c.nodeName === "w:tbl") out.push(this.table(c));
      else if (c.nodeName === "w:sdt") out.push(...this.blocks(kid(c, "w:sdtContent") ?? c, tableStyle));
    }
    return out;
  }

  para(p: El, tableStyle: string | null): Para {
    const pPr = kid(p, "w:pPr");
    const st = this.paraStyle(pPr, tableStyle);
    let props = st.props;
    const inlines: Inline[] = [];
    // Numbering: level indent sits between the style and direct formatting.
    const numPr = st.numPr;
    if (numPr) {
      const numId = attr(kid(numPr, "w:numId"), "w:val");
      const ilvl = Number(attr(kid(numPr, "w:ilvl"), "w:val") ?? 0);
      const n = numId && numId !== "0" ? this.numbering.next(numId, ilvl) : null;
      if (n) {
        props = applyPPr(props, n.level.pPr);
        if (n.label) {
          const labelStyle = applyRPr(this.runStyle(st.run, kid(pPr, "w:rPr")), n.level.rPr, this.ctx);
          inlines.push({ kind: "text", text: n.label, style: { ...labelStyle, underline: false, highlight: null } });
          if (n.level.suff === "tab") inlines.push({ kind: "tab", style: labelStyle });
          else if (n.level.suff === "space") inlines.push({ kind: "text", text: " ", style: labelStyle });
        }
      }
    }
    props = applyPPr(props, pPr);
    const mark = this.runStyle(st.run, kid(pPr, "w:rPr"));
    this.inlines(p, st.run, inlines, { inField: null });
    return { kind: "p", props, inlines, mark };
  }

  private inlines(n: El, base: RunStyle, out: Inline[], state: { inField: null | { code: string; result: boolean; style: RunStyle } }) {
    for (const c of kids(n)) {
      switch (c.nodeName) {
        case "w:r":
          this.run(c, base, out, state);
          break;
        case "w:hyperlink":
        case "w:smartTag":
        case "w:ins":
        case "w:fldSimple": {
          if (c.nodeName === "w:fldSimple") {
            const instr = (attr(c, "w:instr") ?? "").trim().split(/\s+/)[0]?.toUpperCase();
            if (instr === "PAGE" || instr === "NUMPAGES") {
              const r = kid(c, "w:r");
              out.push({ kind: "field", field: instr, style: this.runStyle(base, kid(r, "w:rPr")) });
              break;
            }
          }
          this.inlines(c, base, out, state);
          break;
        }
        case "w:sdt":
          this.inlines(kid(c, "w:sdtContent") ?? c, base, out, state);
          break;
        default:
          break;
      }
    }
  }

  private run(r: El, base: RunStyle, out: Inline[], state: { inField: null | { code: string; result: boolean; style: RunStyle } }) {
    const style = this.runStyle(base, kid(r, "w:rPr"));
    for (const c of kids(r)) {
      const name = c.nodeName;
      if (name === "w:fldChar") {
        const t = attr(c, "w:fldCharType");
        if (t === "begin") state.inField = { code: "", result: false, style };
        else if (t === "separate" && state.inField) {
          state.inField.result = true;
          const code = state.inField.code.trim().split(/\s+/)[0]?.toUpperCase();
          if (code === "PAGE" || code === "NUMPAGES") out.push({ kind: "field", field: code, style: state.inField.style });
        } else if (t === "end") state.inField = null;
        continue;
      }
      if (name === "w:instrText") {
        if (state.inField) state.inField.code += c.textContent ?? "";
        continue;
      }
      if (state.inField) {
        // Result text of PAGE/NUMPAGES is replaced; other fields keep their cached result.
        const code = state.inField.code.trim().split(/\s+/)[0]?.toUpperCase();
        if (!state.inField.result || code === "PAGE" || code === "NUMPAGES") continue;
      }
      if (style.hidden) continue;
      if (name === "w:t") out.push({ kind: "text", text: c.textContent ?? "", style });
      else if (name === "w:tab") out.push({ kind: "tab", style });
      else if (name === "w:br") out.push(attr(c, "w:type") === "page" ? { kind: "page" } : { kind: "br", style });
      else if (name === "w:cr") out.push({ kind: "br", style });
      else if (name === "w:noBreakHyphen") out.push({ kind: "text", text: "‑", style });
      else if (name === "w:softHyphen") continue;
      else if (name === "w:sym") out.push({ kind: "text", text: "•", style });
      else if (name === "w:drawing" || name === "w:pict") {
        const img = this.image(c);
        if (img) out.push({ ...img, kind: "image", style });
      }
    }
  }

  private image(n: El): { data: Uint8Array; w: number; h: number } | null {
    const all = n.getElementsByTagName("*");
    let rid: string | null = null;
    let w = 0;
    let h = 0;
    for (let i = 0; i < all.length; i++) {
      const e = all[i] as El;
      if (e.nodeName === "wp:extent") {
        w = Number(attr(e, "cx") ?? 0) / EMU;
        h = Number(attr(e, "cy") ?? 0) / EMU;
      }
      if (e.nodeName === "a:blip") rid = attr(e, "r:embed");
      if (e.nodeName === "v:imagedata") rid = attr(e, "r:id");
      if (e.nodeName === "v:shape" && !w) {
        const style = attr(e, "style") ?? "";
        const mw = /width:([\d.]+)pt/.exec(style);
        const mh = /height:([\d.]+)pt/.exec(style);
        if (mw && mh) { w = Number(mw[1]); h = Number(mh[1]); }
      }
    }
    const data = rid ? this.media.get(rid) : undefined;
    return data && w > 0 && h > 0 ? { data, w, h } : null;
  }

  table(t: El): Table {
    const tblPr = kid(t, "w:tblPr");
    const tableStyle = attr(kid(tblPr, "w:tblStyle"), "w:val") ?? this.styles.defaultTable;
    const cols = kids(kid(t, "w:tblGrid"), "w:gridCol").map((g) => (num(attr(g, "w:w")) ?? 0) / TW);
    const indent = (num(attr(kid(tblPr, "w:tblInd"), "w:w")) ?? 0) / TW;
    const jc = attr(kid(tblPr, "w:jc"), "w:val");
    // Default cell margins: table style, then the table, then 0.08" left/right.
    let marL = 5.4, marR = 5.4, marT = 0, marB = 0;
    const readMar = (m: El | null) => {
      if (!m) return;
      const g = (n: string) => num(attr(kid(m, n), "w:w"));
      marL = (g("w:left") ?? g("w:start") ?? marL * TW) / TW;
      marR = (g("w:right") ?? g("w:end") ?? marR * TW) / TW;
      marT = (g("w:top") ?? marT * TW) / TW;
      marB = (g("w:bottom") ?? marB * TW) / TW;
    };
    readMar(kid(tblPr, "w:tblCellMar"));
    const rows: Row[] = [];
    for (const tr of kids(t, "w:tr")) {
      const trPr = kid(tr, "w:trPr");
      const trH = kid(trPr, "w:trHeight");
      const cells: Cell[] = [];
      for (const tc of kids(tr, "w:tc")) {
        const tcPr = kid(tc, "w:tcPr");
        const span = num(attr(kid(tcPr, "w:gridSpan"), "w:val")) ?? 1;
        const vm = kid(tcPr, "w:vMerge");
        const cm = kid(tcPr, "w:tcMar");
        const g = (n: string) => num(attr(kid(cm, n), "w:w"));
        cells.push({
          width: (num(attr(kid(tcPr, "w:tcW"), "w:w")) ?? 0) / TW,
          blocks: this.blocks(tc, tableStyle),
          vMerge: vm ? (attr(vm, "w:val") === "restart" ? "restart" : "continue") : null,
          span,
          marL: (g("w:left") ?? g("w:start") ?? marL * TW) / TW,
          marR: (g("w:right") ?? g("w:end") ?? marR * TW) / TW,
          marT: (g("w:top") ?? marT * TW) / TW,
          marB: (g("w:bottom") ?? marB * TW) / TW,
        });
      }
      rows.push({
        cells,
        cantSplit: onOff(kid(trPr, "w:cantSplit")) ?? false,
        minHeight: (num(attr(trH, "w:val")) ?? 0) / TW,
        exactHeight: attr(trH, "w:hRule") === "exact",
      });
    }
    return { kind: "tbl", indent, cols, rows, align: jc === "center" ? "center" : jc === "right" || jc === "end" ? "right" : "left" };
  }
}

async function rels(zip: JSZip, part: string): Promise<Map<string, string>> {
  const dir = part.replace(/[^/]+$/, "");
  const file = `${dir}_rels/${part.slice(dir.length)}.rels`;
  const xml = await zip.file(file)?.async("string");
  const out = new Map<string, string>();
  if (!xml) return out;
  for (const r of kids(parse(xml).documentElement, "Relationship")) {
    const target = attr(r, "Target") ?? "";
    out.set(attr(r, "Id") ?? "", target.startsWith("/") ? target.slice(1) : target.startsWith("..") ? target : `${dir}${target}`);
  }
  return out;
}

async function mediaFor(zip: JSZip, part: string): Promise<{ rel: Map<string, string>; media: Map<string, Uint8Array> }> {
  const rel = await rels(zip, part);
  const media = new Map<string, Uint8Array>();
  for (const [id, target] of rel) {
    if (!/\.(png|jpe?g)$/i.test(target)) continue;
    const f = zip.file(target);
    if (f) media.set(id, await f.async("uint8array"));
  }
  return { rel, media };
}

/** Parse a .docx into the layout model. */
export async function readDocx(docx: Uint8Array | Buffer): Promise<DocModel> {
  const zip = await JSZip.loadAsync(docx);
  const text = async (p: string) => (await zip.file(p)?.async("string")) ?? null;
  const stylesXml = await text("word/styles.xml");
  const numberingXml = await text("word/numbering.xml");
  const themeXml = await text("word/theme/theme1.xml");
  const settingsXml = await text("word/settings.xml");
  const ctx: Ctx = {
    theme: {
      minor: themeXml ? /<a:minorFont>\s*<a:latin typeface="([^"]*)"/.exec(themeXml)?.[1] ?? null : null,
      major: themeXml ? /<a:majorFont>\s*<a:latin typeface="([^"]*)"/.exec(themeXml)?.[1] ?? null : null,
    },
  };
  const styles = new Styles(stylesXml ? parse(stylesXml) : null);
  const numbering = new Numbering(numberingXml ? parse(numberingXml) : null);
  const defaultTab = settingsXml ? (num(/<w:defaultTabStop w:val="(\d+)"/.exec(settingsXml)?.[1] ?? null) ?? 720) / TW : 36;

  const docXml = (await text("word/document.xml")) ?? "";
  const doc = parse(docXml);
  const body = kid(doc.documentElement, "w:body")!;
  const { rel, media } = await mediaFor(zip, "word/document.xml");
  const reader = new Reader(styles, numbering, ctx, media);
  const blocks = reader.blocks(body);

  const sect = kids(body, "w:sectPr").at(-1) ?? null;
  const pgSz = kid(sect, "w:pgSz");
  const pgMar = kid(sect, "w:pgMar");
  const m = (n: string, d: number) => (num(attr(pgMar, n)) ?? d) / TW;
  const section: Section = {
    pageW: (num(attr(pgSz, "w:w")) ?? 12240) / TW,
    pageH: (num(attr(pgSz, "w:h")) ?? 15840) / TW,
    top: m("w:top", 1440),
    bottom: m("w:bottom", 1440),
    left: m("w:left", 1440),
    right: m("w:right", 1440),
    headerDist: m("w:header", 720),
    footerDist: m("w:footer", 720),
    titlePg: onOff(kid(sect, "w:titlePg")) ?? false,
    headers: { first: null, default: null },
    footers: { first: null, default: null },
    defaultTab,
  };
  // Headers and footers: separate numbering state is not needed (no lists there).
  for (const [tag, key] of [["w:headerReference", "headers"], ["w:footerReference", "footers"]] as const) {
    for (const ref of kids(sect, tag)) {
      const type = attr(ref, "w:type") ?? "default";
      if (type !== "first" && type !== "default") continue;
      const target = rel.get(attr(ref, "r:id") ?? "");
      if (!target) continue;
      const xml = await text(target);
      if (!xml) continue;
      const part = await mediaFor(zip, target);
      const hr = new Reader(styles, new Numbering(null), ctx, part.media);
      section[key][type] = hr.blocks(parse(xml).documentElement);
    }
  }
  return { section, body: blocks };
}
