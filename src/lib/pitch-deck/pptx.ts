// Server-only: render a pitch deck to an editable PowerPoint Buffer (pptxgenjs).
import PptxGenJS from "pptxgenjs";
import { DECK_SLIDES } from "./slides";
import { getDeckTheme, hex, type DeckTheme } from "./themes";
import type { PitchDeck } from "./types";
import type { DeckChartData } from "./chart-data";

type DeckChartKind = "projections" | "market" | "funds" | "problem" | "solution" | "competition" | "traction";

function hasChart(chart: DeckChartKind, d: DeckChartData): boolean {
  if (chart === "projections") return d.projections.length > 0;
  if (chart === "market") return !!(d.market.tam || d.market.sam || d.market.som);
  if (chart === "problem") return d.problem.length > 0;
  if (chart === "solution") return d.solution.length > 0;
  if (chart === "competition") return d.competition.length > 0;
  if (chart === "traction") return d.traction.series.length > 0;
  return d.allocation.length > 0;
}

export async function renderDeckPptx(deck: PitchDeck, company: { name: string }, chartData?: DeckChartData): Promise<Buffer> {
  const theme = getDeckTheme(deck.theme);
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "WIDE", width: 10, height: 5.625 });
  pptx.layout = "WIDE";

  DECK_SLIDES.forEach((def, i) => {
    const s = deck.slides[def.id];
    const slide = pptx.addSlide();
    slide.background = { color: hex(theme.bg) };
    slide.addText(def.title.toUpperCase(), { x: 0.6, y: 0.5, w: 8.8, h: 0.3, fontSize: 11, bold: true, color: hex(theme.accent), charSpacing: 2 });
    slide.addText(s?.headline || def.title, { x: 0.6, y: 0.9, w: 8.8, h: 0.9, fontSize: 28, bold: true, color: hex(theme.headline) });
    const showChart = !!(def.chart && chartData && hasChart(def.chart, chartData));
    const bullets = (s?.body || "").split("\n").map((l) => l.replace(/^•\s*/, "").trim()).filter(Boolean);
    if (bullets.length) {
      slide.addText(bullets.map((t) => ({ text: t, options: { bullet: true, breakLine: true } })), {
        x: 0.6, y: 2.0, w: showChart ? 4.6 : 8.8, h: 2.8, fontSize: showChart ? 13 : 15, color: hex(theme.body), lineSpacingMultiple: 1.3,
      });
    }
    if (showChart) addChart(pptx, slide, def.chart!, chartData!, theme);
    slide.addText(`${company.name}  ·  ${i + 1} / ${DECK_SLIDES.length}`, { x: 0.6, y: 5.2, w: 8.8, h: 0.3, fontSize: 9, color: hex(theme.footer) });
  });

  const out = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
  return out;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function addChart(pptx: PptxGenJS, slide: any, chart: DeckChartKind, d: DeckChartData, theme: DeckTheme): void {
  const box = { x: 5.4, y: 2.0, w: 4.0, h: 2.8 };
  const CH = theme.chart.map(hex);
  const bodyC = hex(theme.body), footC = hex(theme.footer);
  if (chart === "problem") {
    slide.addChart(pptx.ChartType.bar, [{ name: "Cost of status quo", labels: d.problem.map((p) => p.label), values: d.problem.map((p) => p.value) }], { ...box, barDir: "bar", chartColors: CH, showLegend: false, catAxisLabelColor: bodyC, valAxisLabelColor: footC });
    return;
  }
  if (chart === "solution") {
    slide.addChart(pptx.ChartType.bar, [
      { name: "Before", labels: d.solution.map((s) => s.label), values: d.solution.map((s) => s.before) },
      { name: "With product", labels: d.solution.map((s) => s.label), values: d.solution.map((s) => s.after) },
    ], { ...box, chartColors: [hex(theme.footer), CH[0]], showLegend: true, legendPos: "b", legendColor: bodyC, catAxisLabelColor: bodyC, valAxisLabelColor: footC });
    return;
  }
  if (chart === "competition") {
    slide.addChart(pptx.ChartType.bar, [
      { name: "Automation depth", labels: d.competition.map((p) => p.label), values: d.competition.map((p) => p.x) },
      { name: "Ease of adoption", labels: d.competition.map((p) => p.label), values: d.competition.map((p) => p.y) },
    ], { ...box, chartColors: [CH[0], CH[1]], showLegend: true, legendPos: "b", legendColor: bodyC, catAxisLabelColor: bodyC, valAxisLabelColor: footC });
    return;
  }
  if (chart === "traction") {
    slide.addChart(pptx.ChartType.line, [{ name: d.traction.unit || "Traction", labels: d.traction.series.map((p) => p.period), values: d.traction.series.map((p) => p.value) }], { ...box, chartColors: [CH[0]], showLegend: false, catAxisLabelColor: bodyC, valAxisLabelColor: footC });
    return;
  }
  if (chart === "projections") {
    slide.addChart(pptx.ChartType.bar, [
      { name: "Revenue", labels: d.projections.map((_, i) => `Year ${i + 1}`), values: d.projections.map((p) => p.revenue) },
      { name: "Gross profit", labels: d.projections.map((_, i) => `Year ${i + 1}`), values: d.projections.map((p) => p.grossProfit) },
    ], { ...box, chartColors: [CH[0], CH[1]], showLegend: true, legendPos: "b", legendColor: bodyC, catAxisLabelColor: bodyC, valAxisLabelColor: footC });
    return;
  }
  if (chart === "market") {
    const rows = ([["TAM", d.market.tam], ["SAM", d.market.sam], ["SOM", d.market.som]] as const).filter(([, v]) => v != null) as Array<[string, number]>;
    slide.addChart(pptx.ChartType.bar, [{ name: "Market", labels: rows.map(([l]) => l), values: rows.map(([, v]) => v) }], { ...box, barDir: "bar", chartColors: CH, showLegend: false, catAxisLabelColor: bodyC, valAxisLabelColor: footC });
    return;
  }
  slide.addChart(pptx.ChartType.doughnut, [{ name: "Use of funds", labels: d.allocation.map((a) => a.label), values: d.allocation.map((a) => a.pct) }], { ...box, chartColors: CH, showLegend: true, legendPos: "r", legendColor: bodyC, holeSize: 55 });
}
