// Server-only: render a stored AI diligence report to a PDF Buffer (pdfkit).
// Mirrors the cap-table / business-plan PDF style.

import PDFDocument from "pdfkit";

const NAVY = "#0c2340";
const INDIGO = "#2E78F5";
const MUTED = "#64748b";
const BODY = "#1e293b";
const RED = "#b42318";

export type DiligenceReportRow = {
  executive_summary: string | null;
  business_overview: string | null;
  financial_review: string | null;
  market_review: string | null;
  legal_review: string | null;
  team_review: string | null;
  risk_flags: string[] | null;
  missing_documents: string[] | null;
  readiness_score: number | null;
  recommendations: string | null;
  created_at?: string | null;
};

export function renderDiligenceReportPdf(companyName: string, report: DiligenceReportRow): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 56, size: "LETTER", bufferPages: true });
      const chunks: Buffer[] = [];
      doc.on("data", (c) => chunks.push(Buffer.from(c)));
      doc.on("end", () => resolve(Buffer.concat(chunks)));

      const h2 = (t: string) =>
        doc
          .moveDown(0.9)
          .font("Helvetica-Bold")
          .fontSize(9)
          .fillColor(INDIGO)
          .text(t.toUpperCase(), { characterSpacing: 0.6 })
          .moveDown(0.3);

      const para = (t: string | null | undefined) => {
        if (!t || !t.trim()) {
          doc.font("Helvetica-Oblique").fontSize(10).fillColor(MUTED).text("Not provided.");
          return;
        }
        doc.font("Helvetica").fontSize(10).fillColor(BODY).text(t.trim(), { align: "left" });
      };

      const bullets = (items: string[] | null | undefined, color = BODY) => {
        const list = (items ?? []).filter(Boolean);
        if (list.length === 0) {
          doc.font("Helvetica-Oblique").fontSize(10).fillColor(MUTED).text("None recorded.");
          return;
        }
        doc.font("Helvetica").fontSize(10).fillColor(color);
        for (const item of list) doc.text(`•  ${item}`, { indent: 4 });
      };

      // Header
      doc.font("Helvetica-Bold").fontSize(9).fillColor(INDIGO).text("DILIGENCE REPORT", { characterSpacing: 1 });
      doc.moveDown(0.2).font("Helvetica-Bold").fontSize(22).fillColor(NAVY).text(companyName);
      const dated = report.created_at ? new Date(report.created_at) : new Date();
      doc.moveDown(0.2).font("Helvetica").fontSize(10).fillColor(MUTED).text(`Generated ${dated.toLocaleDateString()}`);

      if (typeof report.readiness_score === "number") {
        doc
          .moveDown(0.5)
          .font("Helvetica-Bold")
          .fontSize(11)
          .fillColor(NAVY)
          .text(`Readiness score: ${report.readiness_score}`);
      }

      h2("Executive summary");
      para(report.executive_summary);

      h2("Business overview");
      para(report.business_overview);

      h2("Financial review");
      para(report.financial_review);

      h2("Market review");
      para(report.market_review);

      h2("Legal & compliance review");
      para(report.legal_review);

      h2("Team review");
      para(report.team_review);

      h2("Risk flags");
      bullets(report.risk_flags, RED);

      h2("Missing documents");
      bullets(report.missing_documents);

      h2("Recommended next steps");
      const recs = (report.recommendations ?? "")
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      bullets(recs);

      // Footer disclaimer on every page.
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        doc
          .font("Helvetica")
          .fontSize(7.5)
          .fillColor(MUTED)
          .text(
            "Educational and informational only. Not investment, legal, or tax advice, and not a guarantee of funding. iCFO CapitalOS is not a registered broker-dealer, funding portal, or investment adviser.",
            56,
            doc.page.height - 60,
            { width: doc.page.width - 112, align: "center" },
          );
      }

      doc.end();
    } catch (err) {
      reject(err instanceof Error ? err : new Error("PDF generation failed."));
    }
  });
}
