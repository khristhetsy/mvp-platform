// iCFO diligence report → PDF (§14 v2). Server-only, uses pdfkit (already a repo dep).
// Role-aware input: pass the output of serializeReport(role). What each recipient
// sees is decided in report-model.ts (unit-tested); this file only draws it.

import PDFDocument from "pdfkit";
import type { ReportPayload } from "./serialize";
import type { DiligenceRole } from "./types";
import { buildReportModel, type Cell, type Metric, type ReportExtras, type ReportModel, type Section, type Table, type Tone } from "./report-model";

// Palette (matches the v2 mockup).
const NAVY = "#14213D";
const INK = "#1A1F2B";
const MUTED = "#5B6475";
const RULE = "#D5D9E0";
const PANEL = "#F3F5F8";
const ALERT_BG = "#FBE6DA";
const ALERT_INK = "#9A3412";
const HEAD_INK = "#C9D3E3";

const TONES: Record<Tone, { bg: string; fg: string }> = {
  high: { bg: "#FBE6DA", fg: "#7C2D12" },
  medium: { bg: "#FDF1D6", fg: "#78350F" },
  low: { bg: "#E8ECF1", fg: "#334155" },
  neutral: { bg: "#E8ECF1", fg: "#334155" },
  good: { bg: "#E1EAF5", fg: "#1E4E8C" },
  bad: { bg: "#7C2D12", fg: "#FFFFFF" },
};

// Geometry in points (Letter 612 × 792).
const PAGE_W = 612;
const PAGE_H = 792;
const M = 42;
const W = PAGE_W - M * 2;
const TOP = 62; // content start on pages 2+ (running header sits above)
const BOTTOM = PAGE_H - 50; // content must end above the footer

const SERIF = "Times-Bold";
const SANS = "Helvetica";
const SANS_B = "Helvetica-Bold";
const MONO = "Courier";

// WinAnsi-safe text for the standard fonts: map the few characters they cannot encode.
const safe = (s: string) =>
  s
    .replace(/[→⇒]/g, "->")
    .replace(/[≤]/g, "<=")
    .replace(/[≥]/g, ">=")
    .replace(/[✓✔]/g, "x")
    .replace(/[^\x09\x0A\x0D\x20-\x7E -ÿ–—‘’“”•…€]/g, "?");

export async function renderDiligenceMemoPdf(
  payload: ReportPayload,
  role: DiligenceRole,
  extras: ReportExtras = {},
): Promise<Buffer> {
  const model = buildReportModel(payload, role, extras);
  return renderModel(model);
}

export async function renderModel(model: ReportModel): Promise<Buffer> {
  return await new Promise<Buffer>((resolve, reject) => {
    // Small bottom margin so our own BOTTOM check, not pdfkit, decides page breaks.
    const doc = new PDFDocument({ size: "LETTER", margins: { top: 40, bottom: 16, left: M, right: M }, bufferPages: true, info: { Title: `Due Diligence Report · ${model.company}`, Author: "iCFO Capital Global, Inc." } });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(Buffer.from(c)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

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
        text(m.value, x + 10, y + 9, { font: SERIF, size: 19, color: m.alert ? ALERT_INK : NAVY, width: w - 20, lineGap: 0 });
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

    // ── Page 1: masthead ────────────────────────────────────────────────
    const bandH = 112;
    doc.rect(0, 0, PAGE_W, bandH).fill(NAVY);
    text("iCapOS", M, 28, { font: "Times-Roman", size: 11, color: HEAD_INK, lineGap: 0 });
    text("Due Diligence Report", M, 42, { font: SERIF, size: 26, color: "#FFFFFF", lineGap: 0 });
    text(`${model.company} · ${model.audienceLabel}`, M, 76, { size: 10, color: HEAD_INK, width: 300, lineGap: 0 });
    const meta: [string, string][] = [
      ["Report code", model.reportCode],
      ["Version", model.versionLabel],
      ["Generated", model.generatedAt.toISOString().slice(0, 16).replace("T", " ") + " UTC"],
      ...(model.generatedBy ? ([["Prepared by", model.generatedBy]] as [string, string][]) : []),
    ];
    meta.forEach(([k, v], i) => {
      const my = 36 + i * 13;
      text(k, PAGE_W - M - 200, my, { size: 8, color: HEAD_INK, width: 70, lineGap: 0 });
      text(v, PAGE_W - M - 128, my, { size: 8, color: "#FFFFFF", width: 128, lineGap: 0 });
    });
    y = bandH + 20;

    // Stage tracker
    label("Engagement stage", M, y);
    y += 14;
    const sgap = 5;
    const sw = (W - sgap * (model.stages.length - 1)) / model.stages.length;
    model.stages.forEach((s, i) => {
      const x = M + i * (sw + sgap);
      doc.roundedRect(x, y, sw, 4, 2).fill(i <= model.stageIndex ? "#2F5D8A" : RULE);
      text(s, x, y + 8, { size: 7, color: i === model.stageIndex ? NAVY : MUTED, font: i === model.stageIndex ? SANS_B : SANS, width: sw, lineGap: 0 });
    });
    y += 34;

    // Verdict + readiness panels
    const pw = (W - 14) / 2;
    const v = model.verdict;
    const recText = v.recommendation ?? v.placeholder;
    const recFont = v.recommendation ? SERIF : "Times-Italic";
    const recSize = v.recommendation ? 15 : 13;
    const postureH = v.posture ? height(v.posture, pw - 28, SANS, 8.5) + 6 : 0;
    const leftH = 18 + height(recText, pw - 28, recFont, recSize, 0) + 8 + postureH + 16 + 24;
    const rightH = 118;
    const ph = Math.max(leftH, rightH);
    doc.roundedRect(M, y, pw, ph, 8).lineWidth(0.8).strokeColor(RULE).stroke();
    doc.roundedRect(M + pw + 14, y, pw, ph, 8).lineWidth(0.8).strokeColor(RULE).stroke();
    // left
    let ly = y + 14;
    label("Recommendation", M + 14, ly);
    ly += 16;
    text(recText, M + 14, ly, { font: recFont, size: recSize, color: v.recommendation ? NAVY : MUTED, width: pw - 28, lineGap: 0 });
    ly += height(recText, pw - 28, recFont, recSize, 0) + 8;
    if (v.posture) { text(v.posture, M + 14, ly, { size: 8.5, width: pw - 28 }); ly += postureH; }
    const facts = [
      model.confidence == null ? null : `Confidence ${Math.round(model.confidence)}%`,
      model.riskLevel == null ? null : `Risk level ${model.riskLevel}`,
    ].filter(Boolean).join("     ");
    if (facts) text(facts, M + 14, y + ph - 22, { size: 8.5, color: MUTED, width: pw - 28, lineGap: 0 });
    // right
    const rx = M + pw + 28;
    const rw = pw - 28;
    let ry = y + 14;
    if (model.readiness) {
      label("Capital Readiness Rating", rx, ry);
      ry += 16;
      const score = model.readiness.score;
      text(score == null ? "Not scored" : String(Math.round(score)), rx, ry, { font: SERIF, size: 26, color: score == null ? "#8A94A6" : NAVY, lineGap: 0 });
      ry += 34;
      const bands = [49, 20, 20, 11];
      let bx = rx;
      bands.forEach((b, i) => {
        const bw = (b / 100) * rw - 3;
        const lo = [0, 50, 70, 90][i];
        const hi = [49, 69, 89, 100][i];
        const active = score != null && score >= lo && score <= hi;
        doc.roundedRect(bx, ry, bw, 6, 2).fill(active ? "#2F5D8A" : "#E8ECF1");
        text(i === 3 ? "90+" : `${lo}-${hi}`, bx, ry + 9, { size: 7, color: MUTED, width: bw, lineGap: 0 });
        bx += bw + 3;
      });
      ry += 24;
      if (score == null) text("Action: founder has not completed the readiness assessment.", rx, ry, { size: 8, color: ALERT_INK, width: rw, lineGap: 0 });
    } else {
      const c = model.findingCounts;
      label("Findings overview", rx, ry);
      ry += 16;
      text(String(c.total), rx, ry, { font: SERIF, size: 26, color: NAVY, lineGap: 0 });
      text(`finding${c.total === 1 ? "" : "s"} disclosed, ${c.open} open`, rx + 40, ry + 10, { size: 9, color: MUTED, width: rw - 40, lineGap: 0 });
      ry += 36;
      let px = rx;
      ([["High", c.high, "high"], ["Medium", c.medium, "medium"], ["Low", c.low, "low"]] as [string, number, Tone][]).forEach(([l, n, tone]) => {
        px += drawPill(`${n} ${l}`, tone, px, ry) + 6;
      });
    }
    y += ph + 18;

    label("Key metrics", M, y);
    y += 14;
    tiles(model.metrics);

    text("What the reader needs to know", M, y, { font: SERIF, size: 14, color: NAVY, lineGap: 0 });
    y += 22;
    model.takeaways.forEach((t, i) => {
      const body = `${t.title} ${t.body}`;
      // Measure in the bold face: the title is bold, so this never underestimates the wrap.
      const h = height(body, W - 24, SANS_B, 9.5, 2);
      ensure(h + 6);
      text(String(i + 1).padStart(2, "0"), M, y, { font: MONO, size: 9, color: "#2F5D8A", lineGap: 0 });
      doc.font(SANS_B).fontSize(9.5).fillColor(INK).text(safe(t.title) + " ", M + 24, y, { width: W - 24, continued: true, lineGap: 2 });
      doc.font(SANS).text(safe(t.body), { lineGap: 2 });
      y += h + 6;
    });

    // Contents: only sections this recipient actually gets.
    y += 4;
    ensure(30 + Math.ceil(model.sections.length / 2) * 13);
    rule(y);
    y += 10;
    label("Contents", M, y);
    y += 14;
    const half = Math.ceil(model.sections.length / 2);
    model.sections.forEach((s, i) => {
      const col = i < half ? 0 : 1;
      const row = col === 0 ? i : i - half;
      text(`${i + 2} · ${s.title}`, M + col * (W / 2 + 10), y + row * 13, { size: 9, width: W / 2 - 10, lineGap: 0 });
    });

    // ── Sections, from page 2 ─────────────────────────────────────────────
    newPage();
    model.sections.forEach((s, i) => {
      heading(`${i + 2} · ${s.title}`, s.internal);
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

    // ── Running header and footer ─────────────────────────────────────────
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      doc.page.margins.bottom = 0; // footer sits below the content area
      if (i > 0) {
        text(`iCapOS · Due Diligence Report · ${model.company}`, M, 28, { size: 7.5, color: MUTED, width: W * 0.6, lineGap: 0 });
        text(`${model.reportCode} · ${model.versionLabel}`, M, 28, { font: MONO, size: 7.5, color: MUTED, width: W, align: "right", lineGap: 0 });
        rule(42);
      }
      const fy = PAGE_H - 34;
      text(`iCFO Capital Global, Inc. · Confidential · ${model.audienceLabel}`, M, fy, { size: 7.5, color: MUTED, width: W * 0.75, lineGap: 0 });
      text(`Page ${i + 1} of ${range.count}`, M, fy, { size: 7.5, color: MUTED, width: W, align: "right", lineGap: 0 });
    }

    doc.end();
  });
}
