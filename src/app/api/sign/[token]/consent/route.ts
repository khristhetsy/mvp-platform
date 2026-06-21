import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getRequestByToken, recordConsent } from "@/lib/esignature/public";
import { writeSignatureAudit, requestClientMeta } from "@/lib/esignature/storage";

export const dynamic = "force-dynamic";

/** POST — signer accepts the ESIGN/UETA electronic-records consent. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<Response> {
  const { token } = await params;
  const supabase = createServiceRoleClient();

  const request = await getRequestByToken(supabase, token);
  if (!request) return NextResponse.json({ error: "This signing link is invalid." }, { status: 404 });
  if (request.status === "completed" || request.status === "voided") {
    return NextResponse.json({ error: "This document is no longer available for signing." }, { status: 409 });
  }

  await recordConsent(supabase, request.id);

  const meta = requestClientMeta(req);
  await writeSignatureAudit(supabase, {
    requestId: request.id,
    eventType: "consented",
    actor: request.signer_email ?? request.signer_name,
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
  });

  return NextResponse.json({ ok: true });
}
