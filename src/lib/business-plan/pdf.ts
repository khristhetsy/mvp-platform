// Server-only: render a finished business plan to a PDF Buffer (pdfkit).
// Mirrors src/lib/diligence/pdf.ts.

import PDFDocument from "pdfkit";
import { BUSINESS_PLAN_SECTIONS } from "./sections";
import type { BusinessPlan } from "./types";

const NAVY = "#0c2340";
const INDIGO = "#534AB7";
const MUTED = "#64748b";

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

      doc.moveDown(1.2);
      doc.font("Helvetica-Oblique").fontSize(8).fillColor(MUTED).text(
        "Prepared by the founder with AI assistance on CapitalOS. Illustrative projections based on founder-provided assumptions. Educational material — not an offer of securities, a valuation, a forecast of returns, or investment advice.",
        { lineGap: 1 },
      );

      doc.end();
    } catch (err) {
      reject(err instanceof Error ? err : new Error("PDF render failed"));
    }
  });
}
