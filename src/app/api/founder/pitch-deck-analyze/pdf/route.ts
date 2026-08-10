import { NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { requireApiProfile } from "@/lib/api/auth";
import { getActiveCompanyForUser } from "@/lib/organizations/active-company";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getPitchDeckAnalysis } from "@/lib/pitch-deck/analysis-store";
import type { PitchDeckAnalysis } from "@/app/api/founder/pitch-deck-analyze/route";

export const dynamic = "force-dynamic";

const NAVY = "#0c2340";
const INDIGO = "#2E78F5";
const MUTED = "#64748b";

function render(analysis: PitchDeckAnalysis, companyName: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 54 });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const W = doc.page.width - 108;
    const heading = (t: string) => doc.moveDown(0.8).fillColor(INDIGO).font("Helvetica-Bold").fontSize(9).text(t.toUpperCase(), { characterSpacing: 0.6 }).moveDown(0.25);
    const para = (t: string) => doc.fillColor("#374151").font("Helvetica").fontSize(10.5).text(t, { width: W, lineGap: 2 });

    doc.fillColor(INDIGO).font("Helvetica-Bold").fontSize(8).text("PITCH DECK AI ANALYZER", { characterSpacing: 0.8 });
    doc.moveDown(0.2).fillColor(NAVY).font("Helvetica-Bold").fontSize(20).text(companyName);
    doc.fillColor(MUTED).font("Helvetica").fontSize(9).text(`Overall score ${analysis.overallScore}/100 · Generated ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`);

    heading("Overall verdict");
    para(analysis.overallVerdict);

    heading("Simulated investor first impression");
    para(analysis.investorReaction);

    if (analysis.topStrengths.length) {
      heading("Top strengths");
      analysis.topStrengths.forEach((s) => para(`•  ${s}`));
    }
    if (analysis.topGaps.length) {
      heading("Top gaps");
      analysis.topGaps.forEach((g) => para(`•  ${g}`));
    }

    heading("Section-by-section breakdown");
    analysis.sections.forEach((s) => {
      doc.moveDown(0.4).fillColor(NAVY).font("Helvetica-Bold").fontSize(11).text(`${s.name}  —  ${s.score}/100 · ${s.verdict.replace("_", " ")}`);
      doc.fillColor("#374151").font("Helvetica").fontSize(10).text(s.feedback, { width: W, lineGap: 1.5 });
      doc.fillColor(MUTED).font("Helvetica-Oblique").fontSize(9.5).text(`Quick fix: ${s.tip}`, { width: W, lineGap: 1.5 });
    });

    doc.moveDown(1.2).fillColor("#94a3b8").font("Helvetica").fontSize(8)
      .text("Informational only — not investment advice. AI-generated feedback from a simulated VC perspective.", { width: W });

    doc.end();
  });
}

// POST — render the founder's saved pitch-deck analysis to a PDF.
export async function POST(): Promise<Response> {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { company } = await getActiveCompanyForUser(auth.profile);
  if (!company) return NextResponse.json({ error: "No company linked." }, { status: 400 });

  const admin = createServiceRoleClient();
  const saved = await getPitchDeckAnalysis(admin, company.id);
  if (!saved) return NextResponse.json({ error: "Run and save an analysis first." }, { status: 400 });

  try {
    const buffer = await render(saved.analysis, company.company_name);
    const name = `${company.company_name} — Pitch deck analysis.pdf`.replace(/[^a-zA-Z0-9._ -]/g, "");
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${name}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to export PDF." }, { status: 500 });
  }
}
