// Server-only: render a finished business plan to a PDF Buffer (pdfkit).
// Mirrors src/lib/diligence/pdf.ts.

import PDFDocument from "pdfkit";
import { BUSINESS_PLAN_SECTIONS } from "./sections";
import { normalizeCharts } from "./charts";
import type { BusinessPlan } from "./types";

const NAVY = "#0c2340";
const INDIGO = "#2E78F5";
const MUTED = "#64748b";
const ALLOC_HEX = ["#2a78d6", "#1baf7a", "#eda100", "#4a3aa7", "#e34948", "#e87ba4", "#eb6834", "#008300"];
function moneyShort(n: number): string {
  const a = Math.abs(n);
  return a >= 1e9 ? `$${(a / 1e9).toFixed(1)}B` : a >= 1e6 ? `$${(a / 1e6).toFixed(1)}M` : a >= 1e3 ? `$${Math.round(a / 1e3)}k` : `$${Math.round(a)}`;
}

function money(n: number): string {
  const abs = Math.abs(n);
  const s = abs >= 1_000_000 ? `$${(abs / 1_000_000).toFixed(1)}M` : abs >= 1_000 ? `$${Math.round(abs / 1_000)}k` : `$${Math.round(abs)}`;
  return n < 0 ? `-${s}` : s;
}

export function renderBusinessPlanPdf(
  plan: BusinessPlan,
  company: { name: string; industry: string | null; stage: string | null; fundingAmount: number | null },
): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 56, size: "LETTER", bufferPages: true });
      const chunks: Buffer[] = [];
      doc.on("data", (c) => chunks.push(Buffer.from(c)));
      doc.on("end", () => resolve(Buffer.concat(chunks)));

      const body = (t: string) => doc.font("Helvetica").fontSize(10.5).fillColor("#1e293b").text(t, { lineGap: 2 });
      const h2 = (t: string) =>
        doc.moveDown(0.8).font("Helvetica-Bold").fontSize(9).fillColor(INDIGO).text(t.toUpperCase(), { characterSpacing: 0.6 }).moveDown(0.2);

      // Cover
      doc.font("Helvetica-Bold").fontSize(9).fillColor(INDIGO).text("BUSINESS PLAN", { characterSpacing: 1 });
      doc.moveDown(0.2).font("Helvetica-Bold").fontSize(22).fillColor(NAVY).text(company.name);
      const meta = [company.industry, company.stage, company.fundingAmount ? `Target raise $${company.fundingAmount.toLocaleString()}` : null]
        .filter(Boolean)
        .join("  ·  ");
      doc.moveDown(0.2).font("Helvetica").fontSize(10).fillColor(MUTED).text(meta || "");
      doc.moveDown(1);

      if (plan.execSummary) {
        h2("Executive summary");
        body(plan.execSummary);
      }

      for (const def of BUSINESS_PLAN_SECTIONS) {
        if (def.id === "projections" || def.id === "exec_summary") continue;
        const content = plan.sections[def.id]?.content?.trim();
        if (!content) continue;
        h2(def.title);
        body(content);
      }

      if (plan.projections) {
        h2("Financial projections");
        const yr = plan.projections.years;
        const line = (label: string, key: "revenue" | "grossProfit" | "operatingExpense" | "netCashFlow") =>
          body(`${label.padEnd(20)} ${money(yr[0][key])}    ${money(yr[1][key])}    ${money(yr[2][key])}`);
        doc.font("Helvetica-Bold").fontSize(10).fillColor(MUTED).text(`${"".padEnd(20)} Year 1     Year 2     Year 3`);
        line("Revenue", "revenue");
        line("Gross profit", "grossProfit");
        line("Operating expense", "operatingExpense");
        line("Net cash flow", "netCashFlow");
        doc.moveDown(0.3).font("Helvetica-Oblique").fontSize(9).fillColor(MUTED).text(
          plan.projections.runwayMonths ? `Runway ~${plan.projections.runwayMonths} months` : "Cash-flow positive within 3 years",
        );
      }

      // Charts: market size + use of funds (drawn natively).
      const charts = normalizeCharts(plan.charts);
      const marketRows = ([["TAM", charts.market.tam], ["SAM", charts.market.sam], ["SOM", charts.market.som]] as const).filter(([, v]) => v != null) as Array<[string, number]>;
      if (marketRows.length) {
        h2("Market size");
        const maxV = Math.max(...marketRows.map(([, v]) => v), 1);
        const x0 = 56 + 44;
        for (const [label, v] of marketRows) {
          const y = doc.y;
          const w = Math.max((v / maxV) * 280, 3);
          doc.font("Helvetica").fontSize(9).fillColor("#334155").text(label, 56, y + 2, { width: 40 });
          doc.rect(x0, y, w, 12).fill(INDIGO);
          doc.font("Helvetica").fontSize(8.5).fillColor(MUTED).text(moneyShort(v), x0 + w + 5, y + 2);
          doc.y = y + 18;
        }
      }
      if (charts.allocation.length) {
        h2("Use of funds");
        for (let i = 0; i < charts.allocation.length; i++) {
          const a = charts.allocation[i];
          const y = doc.y;
          doc.rect(56, y + 1, 9, 9).fill(ALLOC_HEX[i % ALLOC_HEX.length]);
          doc.font("Helvetica").fontSize(9.5).fillColor("#334155").text(`${a.label}  —  ${a.pct}%`, 72, y);
          doc.y = y + 15;
        }
      }

      doc.moveDown(1.2);
      doc.font("Helvetica-Oblique").fontSize(8).fillColor(MUTED).text(
        "Prepared by the founder with AI assistance on iCapOS. Illustrative projections based on founder-provided assumptions. Educational material — not an offer of securities, a valuation, a forecast of returns, or investment advice.",
        { lineGap: 1 },
      );

      doc.end();
    } catch (err) {
      reject(err instanceof Error ? err : new Error("PDF render failed"));
    }
  });
}
