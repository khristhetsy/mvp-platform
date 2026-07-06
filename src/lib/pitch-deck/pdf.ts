// Server-only: render a pitch deck to a PDF Buffer (pdfkit) — one landscape slide per page.
import PDFDocument from "pdfkit";
import { DECK_SLIDES } from "./slides";
import type { PitchDeck } from "./types";
import type { DeckChartData } from "./chart-data";

const NAVY = "#0C2340";
const INDIGO = "#2E78F5";
const LIGHT = "#DCE6F5";
const CH = ["#85B7EB", "#5DCAA5", "#EF9F27", "#9085e9"];
function chMoney(n: number): string {
  const a = Math.abs(n);
  return a >= 1e9 ? `$${(a / 1e9).toFixed(1)}B` : a >= 1e6 ? `$${(a / 1e6).toFixed(1)}M` : a >= 1e3 ? `$${Math.round(a / 1e3)}k` : `$${Math.round(a)}`;
}

export function renderDeckPdf(deck: PitchDeck, company: { name: string }, chartData?: DeckChartData): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: [720, 405], margin: 0, bufferPages: true }); // 16:9
      const chunks: Buffer[] = [];
      doc.on("data", (c) => chunks.push(Buffer.from(c)));
      doc.on("end", () => resolve(Buffer.concat(chunks)));

      DECK_SLIDES.forEach((def, i) => {
        if (i > 0) doc.addPage({ size: [720, 405], margin: 0 });
        const s = deck.slides[def.id];
        // Background
        doc.rect(0, 0, 720, 405).fill(NAVY);
        // Eyebrow
        doc.font("Helvetica-Bold").fontSize(10).fillColor(INDIGO).text(def.title.toUpperCase(), 48, 44, { characterSpacing: 1 });
        // Headline
        doc.font("Helvetica-Bold").fontSize(26).fillColor("#FFFFFF").text(s?.headline || def.title, 48, 74, { width: 624, lineGap: 2 });
        // Body bullets
        const hasChart = !!(def.chart && chartData && slideHasChart(def.chart, chartData));
        const bodyW = hasChart ? 300 : 606;
        const body = (s?.body || "").split("\n").map((l) => l.replace(/^•\s*/, "")).filter(Boolean);
        let y = 150;
        doc.font("Helvetica").fontSize(13).fillColor(LIGHT);
        for (const line of body.slice(0, 6)) {
          doc.circle(54, y + 7, 2).fill(INDIGO);
          doc.fillColor(LIGHT).text(line, 66, y, { width: bodyW, lineGap: 2 });
          y = doc.y + 8;
        }
        if (hasChart) drawChart(doc, def.chart!, chartData!, 400, 150, 280, 200);
        // Footer
        doc.font("Helvetica").fontSize(8).fillColor("#6B7DA0").text(`${company.name}  ·  ${i + 1} / ${DECK_SLIDES.length}`, 48, 384);
      });

      doc.end();
    } catch (err) {
      reject(err instanceof Error ? err : new Error("PDF render failed"));
    }
  });
}

function slideHasChart(chart: "projections" | "market" | "funds", d: DeckChartData): boolean {
  if (chart === "projections") return d.projections.length > 0;
  if (chart === "market") return !!(d.market.tam || d.market.sam || d.market.som);
  return d.allocation.length > 0;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function drawChart(doc: any, chart: "projections" | "market" | "funds", d: DeckChartData, x: number, y: number, w: number, h: number): void {
  if (chart === "projections") {
    const yrs = d.projections;
    const max = Math.max(...yrs.flatMap((p) => [p.revenue, p.grossProfit]), 1);
    const base = y + h - 20, groupW = w / yrs.length;
    yrs.forEach((p, i) => {
      const gx = x + i * groupW + groupW / 2;
      const rh = (p.revenue / max) * (h - 30), gh = (p.grossProfit / max) * (h - 30);
      doc.rect(gx - 22, base - rh, 18, rh).fill("#85B7EB");
      doc.rect(gx + 4, base - gh, 18, gh).fill("#5DCAA5");
      doc.font("Helvetica").fontSize(9).fillColor("#9fb2d6").text(`Year ${i + 1}`, gx - 26, base + 5, { width: 52, align: "center" });
    });
    doc.fontSize(8).fillColor("#85B7EB").text("Revenue", x, y - 6);
    doc.fillColor("#5DCAA5").text("Gross profit", x + 70, y - 6);
    return;
  }
  if (chart === "market") {
    const rows = ([["TAM", d.market.tam], ["SAM", d.market.sam], ["SOM", d.market.som]] as const).filter(([, v]) => v != null) as Array<[string, number]>;
    const max = Math.max(...rows.map(([, v]) => v), 1);
    rows.forEach(([label, v], i) => {
      const ry = y + i * 40;
      const bw = Math.max((v / max) * (w - 60), 3);
      doc.font("Helvetica").fontSize(10).fillColor("#dce6f5").text(label, x, ry + 4);
      doc.rect(x + 40, ry, bw, 16).fill(CH[i]);
      doc.fontSize(9).fillColor("#9fb2d6").text(chMoney(v), x + 40 + bw + 5, ry + 4);
    });
    return;
  }
  const total = d.allocation.reduce((a, s) => a + (s.pct || 0), 0) || 1;
  let acc = 0;
  d.allocation.forEach((s, i) => {
    const frac = (s.pct || 0) / total;
    doc.save();
    doc.path(sectorPath(x + 70, y + h / 2, 70, acc * 2 * Math.PI - Math.PI / 2, (acc + frac) * 2 * Math.PI - Math.PI / 2)).fill(CH[i % CH.length]);
    doc.restore();
    doc.font("Helvetica").fontSize(9).fillColor("#dce6f5").text(`${s.label} ${s.pct}%`, x + 150, y + 6 + i * 16);
    doc.rect(x + 138, y + 8 + i * 16, 7, 7).fill(CH[i % CH.length]);
    acc += frac;
  });
}

function sectorPath(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
  const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} Z`;
}
