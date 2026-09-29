import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { getActiveCompanyForUser } from "@/lib/organizations/active-company";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getPitchDeckAnalysis } from "@/lib/pitch-deck/analysis-store";
import { renderPitchDeckAnalysisPdf } from "@/lib/pitch-deck/analysis-pdf";

export const dynamic = "force-dynamic";

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
    const buffer = await renderPitchDeckAnalysisPdf(saved.analysis, company.company_name);
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
