import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { assertFounderMember, NotAMemberError } from "@/lib/diligence/founder-actions";
import { serializeReport } from "@/lib/diligence/serialize";
import { renderDiligenceMemoPdf } from "@/lib/diligence/pdf";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** GET — the founder's gated diligence memo as a PDF. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const service = createServiceRoleClient();
  try {
    await assertFounderMember(service, id, auth.profile.id);
  } catch (err) {
    if (err instanceof NotAMemberError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }

  const payload = await serializeReport(service, id, "founder");
  if (!payload) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const pdf = await renderDiligenceMemoPdf(payload, "founder");
  const name = `diligence-${String(payload.engagement.report_code ?? id)}.pdf`;
  return new Response(new Uint8Array(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${name}"` },
  });
}
