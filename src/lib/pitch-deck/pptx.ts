// Server-only: render a pitch deck to an editable PowerPoint Buffer (pptxgenjs).
import PptxGenJS from "pptxgenjs";
import { DECK_SLIDES } from "./slides";
import type { PitchDeck } from "./types";
import type { DeckChartData } from "./chart-data";

const NAVY = "0C2340";
const INDIGO = "2E78F5";
const LIGHT = "DCE6F5";
const CH = ["85B7EB", "5DCAA5", "EF9F27", "9085E9"];

function hasChart(chart: "projections" | "market" | "funds", d: DeckChartData): boolean {
  if (chart === "projections") return d.projections.length > 0;
  if (chart === "market") return !!(d.market.tam || d.market.sam || d.market.som);
  return d.allocation.length > 0;
}

export async function renderDeckPptx(deck: PitchDeck, company: { name: string }, chartData?: DeckChartData): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "WIDE", width: 10, height: 5.625 });
  pptx.layout = "WIDE";

  DECK_SLIDES.forEach((def, i) => {
    const s = deck.slides[def.id];
    const slide = pptx.addSlide();
    slide.background = { color: NAVY };
    slide.addText(def.title.toUpperCase(), { x: 0.6, y: 0.5, w: 8.8, h: 0.3, fontSize: 11, bold: true, color: INDIGO, charSpacing: 2 });
    slide.addText(s?.headline || def.title, { x: 0.6, y: 0.9, w: 8.8, h: 0.9, fontSize: 28, bold: true, color: "FFFFFF" });
    const showChart = !!(def.chart && chartData && hasChart(def.chart, chartData));
    const bullets = (s?.body || "").split("\n").map((l) => l.replace(/^•\s*/, "").trim()).filter(Boolean);
    if (bullets.length) {
      slide.addText(bullets.map((t) => ({ text: t, options: { bullet: true, breakLine: true } })), {
        x: 0.6, y: 2.0, w: showChart ? 4.6 : 8.8, h: 2.8, fontSize: showChart ? 13 : 15, color: LIGHT, lineSpacingMultiple: 1.3,
      });
    }
    if (showChart) addChart(pptx, slide, def.chart!, chartData!);
    slide.addText(`${company.name}  ·  ${i + 1} / ${DECK_SLIDES.length}`, { x: 0.6, y: 5.2, w: 8.8, h: 0.3, fontSize: 9, color: "6B7DA0" });
  });

  const out = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
  return out;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function addChart(pptx: PptxGenJS, slide: any, chart: "projections" | "market" | "funds", d: DeckChartData): void {
  const box = { x: 5.4, y: 2.0, w: 4.0, h: 2.8 };
  if (chart === "projections") {
    slide.addChart(pptx.ChartType.bar, [
      { name: "Revenue", labels: d.projections.map((_, i) => `Year ${i + 1}`), values: d.projections.map((p) => p.revenue) },
      { name: "Gross profit", labels: d.projections.map((_, i) => `Year ${i + 1}`), values: d.projections.map((p) => p.grossProfit) },
    ], { ...box, chartColors: ["85B7EB", "5DCAA5"], showLegend: true, legendPos: "b", legendColor: "DCE6F5", catAxisLabelColor: "DCE6F5", valAxisLabelColor: "9FB2D6" });
    return;
  }
  if (chart === "market") {
    const rows = ([["TAM", d.market.tam], ["SAM", d.market.sam], ["SOM", d.market.som]] as const).filter(([, v]) => v != null) as Array<[string, number]>;
    slide.addChart(pptx.ChartType.bar, [{ name: "Market", labels: rows.map(([l]) => l), values: rows.map(([, v]) => v) }], { ...box, barDir: "bar", chartColors: CH, showLegend: false, catAxisLabelColor: "DCE6F5", valAxisLabelColor: "9FB2D6" });
    return;
  }
  slide.addChart(pptx.ChartType.doughnut, [{ name: "Use of funds", labels: d.allocation.map((a) => a.label), values: d.allocation.map((a) => a.pct) }], { ...box, chartColors: CH, showLegend: true, legendPos: "r", legendColor: "DCE6F5", holeSize: 55 });
}
