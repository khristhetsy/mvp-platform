// Shared pdfkit drawing kit for iCapOS reports (§14 v2 look): masthead band,
// tiles, stacked bars, paginating tables with repeated headers, pills, running
// header/footer. Used by the diligence engagement report and the portfolio report.

import PDFDocument from "pdfkit";
import type { Cell, Metric, Section, Table, Tone } from "./report-model";

export type PdfDoc = InstanceType<typeof PDFDocument>;

// Palette (matches the v2 mockup).
export const NAVY = "#14213D";
export const INK = "#1A1F2B";
export const MUTED = "#5B6475";
export const RULE = "#D5D9E0";
export const PANEL = "#F3F5F8";
export const ALERT_BG = "#FBE6DA";
export const ALERT_INK = "#9A3412";
export const HEAD_INK = "#C9D3E3";

export const TONES: Record<Tone, { bg: string; fg: string }> = {
  high: { bg: "#FBE6DA", fg: "#7C2D12" },
  medium: { bg: "#FDF1D6", fg: "#78350F" },
  low: { bg: "#E8ECF1", fg: "#334155" },
  neutral: { bg: "#E8ECF1", fg: "#334155" },
  good: { bg: "#E1EAF5", fg: "#1E4E8C" },
  bad: { bg: "#7C2D12", fg: "#FFFFFF" },
};

// Geometry in points (Letter 612 × 792).
export const PAGE_W = 612;
export const PAGE_H = 792;
export const M = 42;
export const W = PAGE_W - M * 2;
export const TOP = 62; // content start on pages 2+ (running header sits above)
export const BOTTOM = PAGE_H - 50; // content must end above the footer

export const SERIF = "Times-Bold";
export const SANS = "Helvetica";
export const SANS_B = "Helvetica-Bold";
export const MONO = "Courier";

// WinAnsi-safe text for the standard fonts: map the few characters they cannot encode.
export const safe = (s: string) =>
  s
    .replace(/[→⇒]/g, "->")
    .replace(/[≤]/g, "<=")
    .replace(/[≥]/g, ">=")
    .replace(/[✓✔]/g, "x")
    .replace(/[^\x09\x0A\x0D\x20-\x7E -ÿ–—‘’“”•…€]/g, "?");


export type RunningText = { left: string; right: string; footer: string };

export function newReportDoc(title: string): PdfDoc {
  // Small bottom margin so the canvas's own BOTTOM check, not pdfkit, decides page breaks.
  return new PDFDocument({ size: "LETTER", margins: { top: 40, bottom: 16, left: M, right: M }, bufferPages: true, info: { Title: title, Author: "iCFO Capital Global, Inc." } });
}

export function docToBuffer(doc: PdfDoc, draw: () => void): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(Buffer.from(c)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    draw();
    doc.end();
  });
}

export type Canvas = ReturnType<typeof createCanvas>;

export function createCanvas(doc: PdfDoc) {
  let y = 0;

  const text = (t: string, x: number, yy: number, opts: { font?: string; size?: number; color?: string; width?: number; align?: "left" | "right" | "center"; lineGap?: number } = {}) => {
    doc.font(opts.font ?? SANS).fontSize(opts.size ?? 9).fillColor(opts.color ?? INK);
    doc.text(safe(t), x, yy, { width: opts.width, align: opts.align ?? "left", lineGap: opts.lineGap ?? 1.5 });
  };
  const height = (t: string, width: number, font = SANS, size = 9, lineGap = 1.5) => {
    doc.font(font).fontSize(size);
    return doc.heightOfString(safe(t), { width, lineGap });
  };
  const newPage = () => { doc.addPage(); y = TOP; };
  const ensure = (h: number) => { if (y + h > BOTTOM) newPage(); };
  const rule = (yy: number, color = RULE, w = 0.75) => { doc.moveTo(M, yy).lineTo(M + W, yy).lineWidth(w).strokeColor(color).stroke(); };

  const pillW = (label: string) => { doc.font(SANS_B).fontSize(7.5); return doc.widthOfString(safe(label)) + 10; };
  const drawPill = (label: string, tone: Tone, x: number, yy: number) => {
    const w = pillW(label);
    const c = TONES[tone];
    doc.roundedRect(x, yy, w, 12, 6).fill(c.bg);
    text(label, x + 5, yy + 2.6, { font: SANS_B, size: 7.5, color: c.fg, lineGap: 0 });
    return w;
  };
  const label = (t: string, x: number, yy: number, width?: number, color = MUTED) =>
    text(t.toUpperCase(), x, yy, { font: SANS_B, size: 7.5, color, width, lineGap: 0 });

  const heading = (t: string, internal?: boolean) => {
    ensure(110); // keep a heading with at least its first block of content
    text(t, M, y, { font: SERIF, size: 15, color: NAVY, lineGap: 0 });
    if (internal) {
      doc.font(SERIF).fontSize(15);
      const x = M + doc.widthOfString(safe(t)) + 10;
      drawPill("Internal", "neutral", x, y + 2);
    }
    y += 24;
  };

  const paragraph = (t: string, size = 9.5, color = INK) => {
    const h = height(t, W, SANS, size, 2);
    ensure(h);
    text(t, M, y, { size, color, width: W, lineGap: 2 });
    y += h + 8;
  };

  const tiles = (metrics: Metric[], tileH = 50) => {
    ensure(tileH + 10);
    const gap = 8;
    const n = metrics.length;
    const w = (W - gap * (n - 1)) / n;
    metrics.forEach((m, i) => {
      const x = M + i * (w + gap);
      doc.roundedRect(x, y, w, tileH, 6).fill(m.alert ? ALERT_BG : PANEL);
      // Shrink long values (e.g. dollar totals) to fit the tile on one line.
      doc.font(SERIF).fontSize(19);
      const vw = doc.widthOfString(safe(m.value));
      const vs = vw > w - 20 ? Math.max(10, Math.floor((19 * (w - 20)) / vw)) : 19;
      text(m.value, x + 10, y + 9 + (19 - vs) / 2, { font: SERIF, size: vs, color: m.alert ? ALERT_INK : NAVY, width: w - 20, lineGap: 0 });
      text(m.label, x + 10, y + 33, { size: 7.5, color: m.alert ? "#7C2D12" : MUTED, width: w - 20, lineGap: 0 });
    });
    y += tileH + 14;
  };

  const bar = (b: NonNullable<Section["bar"]>) => {
    ensure(40);
    const total = b.segments.reduce((s, x) => s + x.value, 0);
    if (total === 0) {
      doc.roundedRect(M, y, W, 10, 3).fill("#E8ECF1");
    } else {
      let x = M;
      b.segments.forEach((s) => {
        if (s.value <= 0) return;
        const w = (s.value / total) * W;
        doc.rect(x, y, w, 10).fill(s.color);
        x += w;
      });
    }
    y += 16;
    let x = M;
    b.segments.forEach((s) => {
      const t = `${s.value} ${s.label.toLowerCase()}`;
      doc.rect(x, y + 1.5, 6, 6).fill(s.color);
      text(t, x + 9, y, { size: 8, color: MUTED, lineGap: 0 });
      doc.font(SANS).fontSize(8);
      x += 9 + doc.widthOfString(safe(t)) + 16;
    });
    if (b.caption) text(b.caption, M, y, { size: 8, color: MUTED, width: W, align: "right", lineGap: 0 });
    y += 20;
  };

  const table = (tb: Table) => {
    const pad = 4;
    const cols = tb.columns.map((c) => ({ ...c, w: c.width * W }));
    const drawHeader = () => {
      let x = M;
      cols.forEach((c) => {
        text(c.label, x + pad, y, { font: SANS_B, size: 8, color: MUTED, width: c.w - pad * 2, align: c.align, lineGap: 0 });
        x += c.w;
      });
      y += 13;
      rule(y, NAVY, 1.2);
      y += 5;
    };
    const cellH = (cell: Cell, c: (typeof cols)[number]) =>
      typeof cell === "string" ? height(cell, c.w - pad * 2, c.mono ? MONO : SANS, c.mono ? 8 : 8.5, 1.2) : 12;
    ensure(40);
    drawHeader();
    tb.rows.forEach((row) => {
      const h = Math.max(...row.map((cell, i) => cellH(cell, cols[i]))) + 8;
      if (y + h > BOTTOM) { newPage(); drawHeader(); }
      let x = M;
      row.forEach((cell, i) => {
        const c = cols[i];
        if (typeof cell === "string") {
          text(cell, x + pad, y, { font: c.mono ? MONO : SANS, size: c.mono ? 8 : 8.5, color: INK, width: c.w - pad * 2, align: c.align, lineGap: 1.2 });
        } else {
          const pw = pillW(cell.pill);
          const px = c.align === "center" ? x + (c.w - pw) / 2 : c.align === "right" ? x + c.w - pad - pw : x + pad;
          drawPill(cell.pill, cell.tone, px, y - 1.5);
        }
        x += c.w;
      });
      y += h - 3;
      rule(y);
      y += 5;
    });
    y += 8;
  };

  const keyValues = (kv: [string, string][]) => {
    const kw = W * 0.38;
    kv.forEach(([k, v]) => {
      const h = Math.max(height(k, kw - 8, SANS, 8.5), height(v, W - kw, SANS, 8.5)) + 8;
      ensure(h);
      text(k, M, y, { size: 8.5, color: MUTED, width: kw - 8 });
      text(v, M + kw, y, { size: 8.5, color: INK, width: W - kw });
      y += h - 3;
      rule(y);
      y += 5;
    });
    y += 8;
  };

  const checklist = (items: NonNullable<Section["checklist"]>) => {
    items.forEach((it) => {
      const lw = W - 110;
      const h = height(it.label, lw, SANS, 9.5) + (it.detail ? height(it.detail, lw, SANS, 8.5) + 2 : 0) + 8;
      ensure(h);
      doc.roundedRect(M, y + 0.5, 10, 10, 2).lineWidth(1.1).strokeColor(it.done ? "#1E4E8C" : MUTED).stroke();
      if (it.done) doc.roundedRect(M + 2.5, y + 3, 5, 5, 1).fill("#1E4E8C");
      text(it.label, M + 18, y, { size: 9.5, width: lw });
      if (it.detail) text(it.detail, M + 18, y + height(it.label, lw, SANS, 9.5) + 2, { size: 8.5, color: MUTED, width: lw });
      if (typeof it.status !== "string") drawPill(it.status.pill, it.status.tone, M + W - pillW(it.status.pill), y);
      y += h;
    });
    y += 6;
  };

  const notes = (list: NonNullable<Section["notes"]>) => {
    if (!list.length) return;
    ensure(30);
    label("Detail", M, y);
    y += 14;
    list.forEach((n) => {
      const body = n.lines.join("\n");
      const h = height(n.heading, W, SANS_B, 9) + (body ? height(body, W, SANS, 8.5) + 2 : 0) + (n.internal ? height(`Analyst note: ${n.internal}`, W - 12, "Helvetica-Oblique", 8.5) + 8 : 0) + 8;
      ensure(Math.min(h, BOTTOM - TOP));
      text(n.heading, M, y, { font: SANS_B, size: 9, width: W });
      y += height(n.heading, W, SANS_B, 9) + 2;
      if (body) { text(body, M, y, { size: 8.5, color: INK, width: W }); y += height(body, W, SANS, 8.5) + 2; }
      if (n.internal) {
        const ih = height(`Analyst note: ${n.internal}`, W - 12, "Helvetica-Oblique", 8.5);
        doc.rect(M, y + 2, W, ih + 6).fill("#FDF1D6");
        text(`Analyst note: ${n.internal}`, M + 6, y + 5, { font: "Helvetica-Oblique", size: 8.5, color: "#78350F", width: W - 12 });
        y += ih + 10;
      }
      y += 6;
    });
    y += 4;
  };

  /** Draw report sections in order, numbering headings from firstNumber. */
  const sections = (list: Section[], firstNumber: number) => {
    list.forEach((s, i) => {
      heading(`${i + firstNumber} · ${s.title}`, s.internal);
      if (s.intro) paragraph(s.intro);
      if (s.bar) bar(s.bar);
      if (s.metrics) tiles(s.metrics, 46);
      if (s.paragraphs) s.paragraphs.forEach((p) => paragraph(p, s.key === "method" ? 8.5 : 9.5, s.key === "method" ? MUTED : INK));
      if (s.table) table(s.table);
      else if (s.empty) paragraph(s.empty, 9, MUTED);
      if (s.checklist) checklist(s.checklist);
      if (s.keyValues) keyValues(s.keyValues);
      if (s.notes) notes(s.notes);
      y += 10;
    });

  };

  /** Running header (pages 2+) and footer (every page). Call once, last. */
  const finish = (running: RunningText) => {
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      doc.page.margins.bottom = 0; // footer sits below the content area
      if (i > 0) {
        text(running.left, M, 28, { size: 7.5, color: MUTED, width: W * 0.6, lineGap: 0 });
        text(running.right, M, 28, { font: MONO, size: 7.5, color: MUTED, width: W, align: "right", lineGap: 0 });
        rule(42);
      }
      const fy = PAGE_H - 34;
      text(running.footer, M, fy, { size: 7.5, color: MUTED, width: W * 0.75, lineGap: 0 });
      text(`Page ${i + 1} of ${range.count}`, M, fy, { size: 7.5, color: MUTED, width: W, align: "right", lineGap: 0 });
    }

  };

  return {
    get y() { return y; },
    set y(v: number) { y = v; },
    doc, text, height, newPage, ensure, rule, pillW, drawPill, label, heading, paragraph, tiles, bar, table, keyValues, checklist, notes, sections, finish,
  };
}
