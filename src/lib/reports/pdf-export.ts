// Admin Reports PDF exports. Both reports use the shared v2 report kit
// (src/lib/diligence/pdf-primitives.ts); their layouts live in their own files.

import type { AdminReportPayload } from "@/lib/reports/admin-reports";
import { buildDueDiligencePortfolioPdf } from "@/lib/reports/portfolio-diligence-pdf";
import { buildSpvReadinessV2Pdf } from "@/lib/reports/spv-readiness-pdf";

export type PdfExportContext = {
  generatedBy: string;
};

/** Portfolio Due Diligence PDF (no single company). Layout: portfolio-diligence-pdf.ts. */
export async function buildDueDiligencePdf(payload: AdminReportPayload, context: PdfExportContext): Promise<Buffer> {
  return buildDueDiligencePortfolioPdf(payload, context);
}

/** SPV Readiness PDF. Layout: spv-readiness-pdf.ts. */
export async function buildSpvReadinessPdf(payload: AdminReportPayload, context: PdfExportContext): Promise<Buffer> {
  return buildSpvReadinessV2Pdf(payload, context);
}
