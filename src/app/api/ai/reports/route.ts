import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { writeAuditLog } from "@/lib/data/audit";
import { diligenceReportCreateSchema } from "@/lib/validation";
import { generateAndSaveDiligenceReport } from "@/lib/reports/generate-and-save";

// Staff-initiated generation. Founder self-serve lives at
// POST /api/founder/report/generate and shares the same generation lib.
export async function POST(request: Request) {
  const auth = await requireApiProfile(["admin", "analyst"]);

  if ("error" in auth) {
    return auth.error ?? NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = diligenceReportCreateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid diligence report request." }, { status: 400 });
  }

  let result;
  try {
    result = await generateAndSaveDiligenceReport(auth.supabase, parsed.data.companyId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Report generation failed.";
    return NextResponse.json({ error: message }, { status: message === "Company not found." ? 404 : 400 });
  }

  await writeAuditLog(auth.supabase, {
    userId: auth.profile.id,
    action: "diligence_report.created",
    entityType: "diligence_report",
    entityId: String(result.report.id),
    metadata: { companyId: parsed.data.companyId, initiatedBy: "staff" },
  });

  return NextResponse.json(result);
}
