// iCFO diligence report → PDF (§14 v2). Server-only, uses pdfkit (already a repo dep).
// Role-aware input: pass the output of serializeReport(role). What each recipient
// sees is decided in report-model.ts (unit-tested); this file only draws it.

import type { ReportPayload } from "./serialize";
import type { DiligenceRole } from "./types";
import { buildReportModel, type ReportExtras, type ReportModel, type Tone } from "./report-model";
import { ALERT_INK, M, MUTED, NAVY, RULE, SANS, SANS_B, SERIF, MONO, INK, W, createCanvas, docToBuffer, masthead, newReportDoc, safe } from "./pdf-primitives";

export async function renderDiligenceMemoPdf(
  payload: ReportPayload,
  role: DiligenceRole,
  extras: ReportExtras = {},
): Promise<Buffer> {
  const model = buildReportModel(payload, role, extras);
  return renderModel(model);
}

export async function renderModel(model: ReportModel): Promise<Buffer> {
  const doc = newReportDoc(`Due Diligence Report · ${model.company}`);
  return docToBuffer(doc, () => {
    const c = createCanvas(doc);

    // ── Page 1: masthead ────────────────────────────────────────────────
    const meta: [string, string][] = [
      ["Report code", model.reportCode],
      ["Version", model.versionLabel],
      ["Generated", model.generatedAt.toISOString().slice(0, 16).replace("T", " ") + " UTC"],
      ...(model.generatedBy ? ([["Prepared by", model.generatedBy]] as [string, string][]) : []),
    ];
    masthead(c, { title: "Due Diligence Report", subtitle: `${model.company} · ${model.audienceLabel}`, meta, titleSize: 26 });
    c.y -= 2;

    // Stage tracker
    c.label("Engagement stage", M, c.y);
    c.y += 14;
    const sgap = 5;
    const sw = (W - sgap * (model.stages.length - 1)) / model.stages.length;
    model.stages.forEach((s, i) => {
      const x = M + i * (sw + sgap);
      doc.roundedRect(x, c.y, sw, 4, 2).fill(i <= model.stageIndex ? "#2F5D8A" : RULE);
      c.text(s, x, c.y + 8, { size: 7, color: i === model.stageIndex ? NAVY : MUTED, font: i === model.stageIndex ? SANS_B : SANS, width: sw, lineGap: 0 });
    });
    c.y += 34;

    // Verdict + readiness panels
    const pw = (W - 14) / 2;
    const v = model.verdict;
    const recText = v.recommendation ?? v.placeholder;
    const recFont = v.recommendation ? SERIF : "Times-Italic";
    const recSize = v.recommendation ? 15 : 13;
    const postureH = v.posture ? c.height(v.posture, pw - 28, SANS, 8.5) + 6 : 0;
    const leftH = 18 + c.height(recText, pw - 28, recFont, recSize, 0) + 8 + postureH + 16 + 24;
    const rightH = 118;
    const ph = Math.max(leftH, rightH);
    doc.roundedRect(M, c.y, pw, ph, 8).lineWidth(0.8).strokeColor(RULE).stroke();
    doc.roundedRect(M + pw + 14, c.y, pw, ph, 8).lineWidth(0.8).strokeColor(RULE).stroke();
    // left
    let ly = c.y + 14;
    c.label("Recommendation", M + 14, ly);
    ly += 16;
    c.text(recText, M + 14, ly, { font: recFont, size: recSize, color: v.recommendation ? NAVY : MUTED, width: pw - 28, lineGap: 0 });
    ly += c.height(recText, pw - 28, recFont, recSize, 0) + 8;
    if (v.posture) { c.text(v.posture, M + 14, ly, { size: 8.5, width: pw - 28 }); ly += postureH; }
    const facts = [
      model.confidence == null ? null : `Confidence ${Math.round(model.confidence)}%`,
      model.riskLevel == null ? null : `Risk level ${model.riskLevel}`,
    ].filter(Boolean).join("     ");
    if (facts) c.text(facts, M + 14, c.y + ph - 22, { size: 8.5, color: MUTED, width: pw - 28, lineGap: 0 });
    // right
    const rx = M + pw + 28;
    const rw = pw - 28;
    let ry = c.y + 14;
    if (model.readiness) {
      c.label("Capital Readiness Rating", rx, ry);
      ry += 16;
      const score = model.readiness.score;
      c.text(score == null ? "Not scored" : String(Math.round(score)), rx, ry, { font: SERIF, size: 26, color: score == null ? "#8A94A6" : NAVY, lineGap: 0 });
      ry += 34;
      const bands = [49, 20, 20, 11];
      let bx = rx;
      bands.forEach((b, i) => {
        const bw = (b / 100) * rw - 3;
        const lo = [0, 50, 70, 90][i];
        const hi = [49, 69, 89, 100][i];
        const active = score != null && score >= lo && score <= hi;
        doc.roundedRect(bx, ry, bw, 6, 2).fill(active ? "#2F5D8A" : "#E8ECF1");
        c.text(i === 3 ? "90+" : `${lo}-${hi}`, bx, ry + 9, { size: 7, color: MUTED, width: bw, lineGap: 0 });
        bx += bw + 3;
      });
      ry += 24;
      if (score == null) c.text("Action: founder has not completed the readiness assessment.", rx, ry, { size: 8, color: ALERT_INK, width: rw, lineGap: 0 });
    } else {
      const fc = model.findingCounts;
      c.label("Findings overview", rx, ry);
      ry += 16;
      c.text(String(fc.total), rx, ry, { font: SERIF, size: 26, color: NAVY, lineGap: 0 });
      c.text(`finding${fc.total === 1 ? "" : "s"} disclosed, ${fc.open} open`, rx + 40, ry + 10, { size: 9, color: MUTED, width: rw - 40, lineGap: 0 });
      ry += 36;
      let px = rx;
      ([["High", fc.high, "high"], ["Medium", fc.medium, "medium"], ["Low", fc.low, "low"]] as [string, number, Tone][]).forEach(([l, n, tone]) => {
        px += c.drawPill(`${n} ${l}`, tone, px, ry) + 6;
      });
    }
    c.y += ph + 18;

    c.label("Key metrics", M, c.y);
    c.y += 14;
    c.tiles(model.metrics);

    c.text("What the reader needs to know", M, c.y, { font: SERIF, size: 14, color: NAVY, lineGap: 0 });
    c.y += 22;
    model.takeaways.forEach((t, i) => {
      const body = `${t.title} ${t.body}`;
      // Measure in the bold face: the title is bold, so this never underestimates the wrap.
      const h = c.height(body, W - 24, SANS_B, 9.5, 2);
      c.ensure(h + 6);
      c.text(String(i + 1).padStart(2, "0"), M, c.y, { font: MONO, size: 9, color: "#2F5D8A", lineGap: 0 });
      doc.font(SANS_B).fontSize(9.5).fillColor(INK).text(safe(t.title) + " ", M + 24, c.y, { width: W - 24, continued: true, lineGap: 2 });
      doc.font(SANS).text(safe(t.body), { lineGap: 2 });
      c.y += h + 6;
    });

    // Contents: only sections this recipient actually gets.
    c.y += 4;
    c.ensure(30 + Math.ceil(model.sections.length / 2) * 13);
    c.rule(c.y);
    c.y += 10;
    c.label("Contents", M, c.y);
    c.y += 14;
    const half = Math.ceil(model.sections.length / 2);
    model.sections.forEach((s, i) => {
      const col = i < half ? 0 : 1;
      const row = col === 0 ? i : i - half;
      c.text(`${i + 2} · ${s.title}`, M + col * (W / 2 + 10), c.y + row * 13, { size: 9, width: W / 2 - 10, lineGap: 0 });
    });

    // ── Sections, from page 2 ─────────────────────────────────────────────
    c.newPage();
    c.sections(model.sections, 2);
    c.finish({
      left: `iCapOS · Due Diligence Report · ${model.company}`,
      right: `${model.reportCode} · ${model.versionLabel}`,
      footer: `iCFO Capital Global, Inc. · Confidential · ${model.audienceLabel}`,
    });
  });
}
