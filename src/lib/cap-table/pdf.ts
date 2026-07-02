// Server-only: render a cap table to a PDF Buffer (pdfkit). Mirrors the
// business-plan PDF style. A clean snapshot — holders, ownership, optional round.

import PDFDocument from "pdfkit";
import type { CapTable } from "./types";
import { summarize, modelRound } from "./compute";

const NAVY = "#0c2340";
const INDIGO = "#2E78F5";
const MUTED = "#64748b";

function money(n: number): string {
  const abs = Math.abs(n);
  const s = abs >= 1_000_000 ? `$${(abs / 1_000_000).toFixed(1)}M` : abs >= 1_000 ? `$${Math.round(abs / 1_000)}k` : `$${Math.round(abs)}`;
  return n < 0 ? `-${s}` : s;
}
function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

export function renderCapTablePdf(companyName: string, cap: CapTable): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 56, size: "LETTER", bufferPages: true });
      const chunks: Buffer[] = [];
      doc.on("data", (c) => chunks.push(Buffer.from(c)));
      doc.on("end", () => resolve(Buffer.concat(chunks)));

      const h2 = (t: string) =>
        doc.moveDown(0.8).font("Helvetica-Bold").fontSize(9).fillColor(INDIGO).text(t.toUpperCase(), { characterSpacing: 0.6 }).moveDown(0.3);

      doc.font("Helvetica-Bold").fontSize(9).fillColor(INDIGO).text("CAP TABLE", { characterSpacing: 1 });
      doc.moveDown(0.2).font("Helvetica-Bold").fontSize(22).fillColor(NAVY).text(companyName);
      doc.moveDown(0.2).font("Helvetica").fontSize(10).fillColor(MUTED).text(new Date().toLocaleDateString());
      doc.moveDown(0.8);

      const sum = summarize(cap.holders);

      h2("Ownership summary");
      doc.font("Helvetica").fontSize(10).fillColor("#1e293b");
      doc.text(`Founders: ${pct(sum.founderPct)}    Option pool: ${pct(sum.poolPct)}    Investors: ${pct(sum.investorPct)}`);
      doc.text(`Fully diluted shares: ${sum.totalShares.toLocaleString()}`);

      h2("Shareholders");
      doc.font("Helvetica-Bold").fontSize(9).fillColor(MUTED).text(
        `${"Holder".padEnd(28)}${"Class".padEnd(16)}${"Shares".padEnd(14)}FD %`,
      );
      doc.font("Helvetica").fontSize(9.5).fillColor("#1e293b");
      for (const row of sum.rows) {
        doc.text(
          `${row.holder.name.slice(0, 26).padEnd(28)}${row.holder.shareClass.slice(0, 14).padEnd(16)}${Math.max(0, row.holder.shares).toLocaleString().padEnd(14)}${pct(row.pct)}`,
        );
      }

      if (cap.round && (cap.round.newInvestment > 0 || cap.round.preMoney > 0)) {
        const res = modelRound(cap.holders, cap.round);
        h2("Modeled round");
        doc.font("Helvetica").fontSize(10).fillColor("#1e293b");
        doc.text(
          `Pre-money ${money(res.preMoney)}  +  new ${money(res.newInvestment)}  =  post-money ${money(res.postMoney)}`,
        );
        doc.text(`New investor: ${pct(res.newInvestorPct)}${res.pricePerShare !== null ? `   ·   $${res.pricePerShare.toFixed(4)}/share` : ""}`);
        doc.moveDown(0.3).font("Helvetica-Bold").fontSize(9).fillColor(MUTED).text(`${"Holder".padEnd(28)}${"Before".padEnd(12)}After`);
        doc.font("Helvetica").fontSize(9.5).fillColor("#1e293b");
        for (const d of res.rows) {
          doc.text(`${d.name.slice(0, 26).padEnd(28)}${pct(d.pctBefore).padEnd(12)}${pct(d.pctAfter)}`);
        }
      }

      doc.moveDown(1.2);
      doc.font("Helvetica-Oblique").fontSize(8).fillColor(MUTED).text(
        "Prepared by the founder on iCapOS. Illustrative cap table based on founder-provided figures. Not a valuation, an offer of securities, a forecast of returns, or investment advice.",
        { lineGap: 1 },
      );

      doc.end();
    } catch (err) {
      reject(err instanceof Error ? err : new Error("PDF render failed"));
    }
  });
}
