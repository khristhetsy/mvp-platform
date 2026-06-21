import { NextResponse } from "next/server";
import { requirePermissionApi } from "@/lib/api/permissions";
import { serializeReport } from "@/lib/diligence/serialize";
import { renderDiligenceMemoPdf } from "@/lib/diligence/pdf";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** GET — admin-full diligence memo as a PDF. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const auth = await requirePermissionApi("manage_diligence");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const payload = await serializeReport(auth.supabase, id, "admin");
  if (!payload) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const pdf = await renderDiligenceMemoPdf(payload, "admin");
  const name = `diligence-${String(payload.engagement.report_code ?? id)}.pdf`;
  return new Response(new Uint8Array(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${name}"` },
  });
}
