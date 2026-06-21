import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { loadInvestorCut } from "@/lib/diligence/investor";
import { renderDiligenceMemoPdf } from "@/lib/diligence/pdf";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** GET — the investor's released, gated diligence memo as a PDF. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const auth = await requireApiProfile(["investor"]);
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const payload = await loadInvestorCut(createServiceRoleClient(), id, auth.profile.id);
  if (!payload) return NextResponse.json({ error: "Not available." }, { status: 403 });

  const pdf = await renderDiligenceMemoPdf(payload, "investor");
  const name = `diligence-${String(payload.engagement.report_code ?? id)}.pdf`;
  return new Response(new Uint8Array(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${name}"` },
  });
}
