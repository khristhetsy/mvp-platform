/**
 * Founder report → PDF (server, pdfkit). Same structure as the send-format document:
 * letterhead, cover block, executive summary (five parts), outreach vs meetings bars,
 * pipeline funnel, activity / pipeline / communications / notes / upcoming tables,
 * signature and the confidentiality footer. Charts are drawn as vectors so they print.
 */
import PDFDocument from "pdfkit";
import type { ExecSummary, FrozenReport } from "@/lib/ir/report";

const NAVY = "#0A1A40", BLUE = "#1A6CE4", GREEN = "#1E8A57", GREY = "#9AA6BA", INK = "#0F1B33", MUTED = "#5B6B86", LINE = "#E2E7F0", PALE = "#EEF1F6";
const FIRM = "iCFO Capital Global, Inc.";

export function renderReportPdf(r: FrozenReport, ex: ExecSummary): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margins: { top: 54, bottom: 60, left: 54, right: 54 }, bufferPages: true, info: { Title: `Investor Outreach Report · ${r.project.title}`, Author: FIRM } });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c)); doc.on("end", () => resolve(Buffer.concat(chunks))); doc.on("error", reject);
    const W = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const L = doc.page.margins.left;
    const need = (h: number) => { if (doc.y + h > doc.page.height - doc.page.margins.bottom) doc.addPage(); };
    const h2 = (t: string) => { need(40); doc.moveDown(0.9); doc.font("Helvetica-Bold").fontSize(12.5).fillColor(NAVY).text(t); doc.moveTo(L, doc.y + 2).lineTo(L + W, doc.y + 2).strokeColor(LINE).lineWidth(0.8).stroke(); doc.moveDown(0.5); };
    const h3 = (t: string) => { need(28); doc.moveDown(0.5); doc.font("Helvetica-Bold").fontSize(10.5).fillColor(INK).text(t); doc.moveDown(0.2); };
    const p = (t: string, o: { size?: number; color?: string } = {}) => { need(30); doc.font("Helvetica").fontSize(o.size ?? 10).fillColor(o.color ?? INK).text(t, { lineGap: 2.5 }); };
    const bullets = (items: string[]) => { if (!items.length) { p("None this period.", { color: MUTED }); return; } for (const it of items) { need(18); doc.font("Helvetica").fontSize(10).fillColor(INK).text(`•  ${it}`, { indent: 6, lineGap: 2 }); } };
    const table = (head: string[], rows: string[][], widths: number[], numeric: boolean[] = []) => {
      const draw = (cells: string[], bold: boolean, bg?: string) => {
        const heights = cells.map((c, i) => doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(9).heightOfString(c || " ", { width: widths[i] - 8 }));
        const rh = Math.max(...heights) + 8; need(rh + 2);
        if (bg) doc.rect(L, doc.y, W, rh).fill(bg);
        let x = L; const y = doc.y;
        cells.forEach((c, i) => { doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(9).fillColor(bold ? MUTED : INK).text(c || "", x + 4, y + 4, { width: widths[i] - 8, align: numeric[i] ? "right" : "left" }); x += widths[i]; });
        doc.y = y + rh; doc.x = L;
        doc.moveTo(L, doc.y).lineTo(L + W, doc.y).strokeColor(LINE).lineWidth(0.5).stroke();
      };
      draw(head, true, PALE);
      if (!rows.length) draw(["Nothing recorded for this period.", ...head.slice(1).map(() => "")], false);
      for (const row of rows) draw(row, false);
      doc.moveDown(0.4);
    };
    const bars = () => {
      const h = 150, top = doc.y + 6, left = L + 28, plotW = W - 36, plotH = h - 40, n = r.trend.labels.length || 1;
      const max = Math.max(1, ...r.trend.intros, ...r.trend.held);
      need(h + 20);
      [0, 0.5, 1].forEach((f) => { const y = top + plotH - f * plotH; doc.moveTo(left, y).lineTo(left + plotW, y).strokeColor(LINE).lineWidth(0.6).stroke(); doc.font("Helvetica").fontSize(8).fillColor(MUTED).text(String(Math.round(f * max)), L, y - 4, { width: 24, align: "right" }); });
      const gw = plotW / n, bw = Math.min(16, gw / 3);
      r.trend.labels.forEach((lab, i) => {
        const x = left + i * gw + gw / 2; const ha = (r.trend.intros[i] / max) * plotH, hb = (r.trend.held[i] / max) * plotH;
        doc.rect(x - bw - 2, top + plotH - ha, bw, ha).fill(BLUE); doc.rect(x + 2, top + plotH - hb, bw, hb).fill(NAVY);
        doc.font("Helvetica").fontSize(8).fillColor(MUTED).text(lab, x - gw / 2, top + plotH + 6, { width: gw, align: "center" });
      });
      doc.rect(left + plotW - 190, top - 4, 8, 8).fill(BLUE); doc.font("Helvetica").fontSize(8).fillColor(INK).text("Introductions sent", left + plotW - 178, top - 5);
      doc.rect(left + plotW - 90, top - 4, 8, 8).fill(NAVY); doc.text("Meetings held", left + plotW - 78, top - 5);
      doc.y = top + h - 14; doc.x = L;
      p("Introductions go out in batches; meetings tend to follow one to three periods later, which is why the two bars rarely peak together.", { size: 8.5, color: MUTED });
    };
    const funnel = () => {
      const rowH = 18, labelW = 120, valW = 40, barW = W - labelW - valW, max = Math.max(1, ...r.pipeline.map((x) => x.count));
      need(r.pipeline.length * rowH + 10);
      const top = doc.y + 4;
      r.pipeline.forEach((it, i) => {
        const y = top + i * rowH; const bw = Math.max(2, (it.count / max) * barW);
        doc.font("Helvetica").fontSize(9).fillColor(MUTED).text(it.label, L, y + 3, { width: labelW });
        doc.rect(L + labelW, y + 3, barW, 10).fill(PALE); doc.rect(L + labelW, y + 3, bw, 10).fill(it.stage === "committed" ? GREEN : it.stage === "passed" ? GREY : BLUE);
        doc.font("Helvetica-Bold").fontSize(9).fillColor(NAVY).text(String(it.count), L + labelW + barW + 8, y + 3, { width: valW - 8 });
      });
      doc.y = top + r.pipeline.length * rowH + 6; doc.x = L;
    };

    // Letterhead
    doc.font("Helvetica-Bold").fontSize(15).fillColor(NAVY).text(FIRM, L, doc.y, { continued: false });
    doc.font("Helvetica").fontSize(9).fillColor(MUTED).text("Investor Relations · La Jolla, California");
    const yTop = doc.page.margins.top;
    doc.font("Helvetica-Bold").fontSize(12).fillColor(NAVY).text("Investor Outreach Report", L, yTop, { width: W, align: "right" });
    doc.font("Helvetica").fontSize(9).fillColor(MUTED).text(`Prepared ${r.preparedOn}`, L, yTop + 16, { width: W, align: "right" });
    doc.y = yTop + 44; doc.x = L;
    doc.moveTo(L, doc.y).lineTo(L + W, doc.y).strokeColor(NAVY).lineWidth(1.2).stroke(); doc.moveDown(0.8);

    // Cover block
    const meta: Array<[string, string]> = [["Prepared for", `${r.founder.name}, ${r.project.title}`], ["Reporting period", r.period.label], ["Project term", `${r.project.termLabel} · ${r.project.monthLabel}`], ["Prepared by", `${r.project.owner_name ?? "Investor Relations"}, Investor Relations`]];
    for (const [k, v] of meta) { const y = doc.y; doc.font("Helvetica").fontSize(9).fillColor(MUTED).text(k, L, y, { width: 110 }); doc.font("Helvetica").fontSize(10).fillColor(INK).text(v, L + 116, y, { width: W - 116 }); doc.moveDown(0.15); }
    doc.x = L;

    h2("Executive summary");
    need(50); const by = doc.y;
    doc.rect(L, by, W, 4).fill(BLUE);
    doc.y = by + 10; doc.x = L;
    doc.font("Helvetica-Bold").fontSize(10.5).fillColor(NAVY).text("Bottom line. ", { continued: true }).font("Helvetica").fillColor(INK).text(ex.bottom, { lineGap: 2.5 });
    doc.moveDown(0.5); p(ex.lead);
    h3("Period highlights"); bullets(ex.highlights);
    h3("What investors are asking"); bullets(ex.themes);
    h3("Watch items"); bullets(ex.watch);
    h3(`Asks of ${r.project.title}`); bullets(ex.asks);

    h2(`Outreach and meetings by ${r.trend.kind}`); bars();
    h2("Pipeline funnel"); funnel();

    h2("Activity this period");
    const cmp = Boolean(r.prevMetrics);
    const rows: Array<[string, keyof typeof r.metrics]> = [["Introductions sent", "intros"], ["Investors contacted", "contacted"], ["Meetings booked", "booked"], ["Meetings held", "held"], ["Commitments", "committed"]];
    table(["Measure", "This period", cmp ? "Previous" : "", cmp ? "Change" : ""], rows.map(([lab, k]) => { const d = cmp ? r.metrics[k] - r.prevMetrics![k] : 0; return [lab, String(r.metrics[k]), cmp ? String(r.prevMetrics![k]) : "", cmp ? (d > 0 ? `+${d}` : String(d)) : ""]; }), [W * 0.46, W * 0.18, W * 0.18, W * 0.18], [false, true, true, true]);

    h2("Investor pipeline at period end");
    const tot = r.pipeline.reduce((s, x) => s + x.count, 0);
    table(["Stage", "Investors", `Share of ${tot}`], [...r.pipeline.map((x) => [x.label, String(x.count), tot ? `${Math.round((x.count / tot) * 100)}%` : "—"]), ["Total matched", String(tot), ""]], [W * 0.5, W * 0.25, W * 0.25], [false, true, true]);

    h2("Communications log");
    p("Every investor contact made on your behalf in this period, with the outcome and the next step. Firms are named once a meeting is booked.", { size: 9, color: MUTED });
    doc.moveDown(0.3);
    table(["Date", "Channel", "Firm", "What happened", "Next step"], r.comms.map((c) => [c.date, c.channel, c.firm, c.what, c.next]), [W * 0.1, W * 0.17, W * 0.2, W * 0.33, W * 0.2]);

    h2("Notes from your IR team");
    if (!r.notes.length) p("No notes for this period.", { color: MUTED });
    for (const n of r.notes) { need(24); doc.font("Helvetica-Bold").fontSize(10).fillColor(INK).text(`${n.date}. `, { continued: true }).font("Helvetica").text(n.body, { lineGap: 2 }); doc.moveDown(0.3); }

    h2("Upcoming meetings");
    table(["Firm", "When"], r.upcoming.map((u) => [u.firm, u.when]), [W * 0.6, W * 0.4]);

    h2("Next period");
    p("Your team continues outreach against the matched list, with follow ups scheduled for investors who have met with you and data room access for those in diligence. Ask your iCFO contact before approaching any investor directly, so outreach is not duplicated.");

    doc.moveDown(1.2); need(60);
    doc.font("Helvetica-Bold").fontSize(10).fillColor(INK).text(r.project.owner_name ?? "Investor Relations");
    doc.font("Helvetica").fontSize(9).fillColor(MUTED).text(`Investor Relations, ${FIRM}`);
    doc.moveDown(0.8);
    p(`Confidential. Prepared for ${r.founder.name} and ${r.project.title} only. Investor names and contact details are held by ${FIRM} and are not included in this report. Firms are named once a meeting is booked. Figures cover the reporting period stated above and are drawn from the iCapOS Investor Relations Hub. This report is not an offer to sell securities.`, { size: 8, color: MUTED });

    // Page numbers
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(i);
      doc.page.margins.bottom = 0;   // writing inside the bottom margin must not spawn a page
      doc.font("Helvetica").fontSize(8).fillColor(MUTED).text(`${FIRM} · Investor Outreach Report · Page ${i + 1} of ${range.count}`, L, doc.page.height - 40, { width: W, align: "center", lineBreak: false });
    }
    doc.end();
  });
}
