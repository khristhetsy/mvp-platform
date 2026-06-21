import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { requirePermissionApi } from "@/lib/api/permissions";
import { writeAuditLog } from "@/lib/data/audit";
import { getRequestById, markRequestSent } from "@/lib/esignature/requests";
import { listFields } from "@/lib/esignature/fields";
import { writeSignatureAudit, requestClientMeta } from "@/lib/esignature/storage";
import { sendSigningInvite, buildSignUrl } from "@/lib/esignature/email";

export const dynamic = "force-dynamic";

/** POST — finalize a draft: generate the access token, send the signer invite. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await requirePermissionApi("review_documents");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const request = await getRequestById(auth.supabase, id);
  if (!request || request.created_by !== auth.userId) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  if (request.status !== "draft") {
    return NextResponse.json({ error: "This envelope has already been sent." }, { status: 409 });
  }
  if (!request.signer_name || !request.signer_email) {
    return NextResponse.json({ error: "Add the signer's name and email before sending." }, { status: 400 });
  }

  const fields = await listFields(auth.supabase, id);
  if (!fields.some((f) => f.field_type === "signature")) {
    return NextResponse.json({ error: "Place at least one signature field before sending." }, { status: 400 });
  }

  // Cryptographically random, unguessable token (32 bytes hex).
  const accessToken = randomBytes(32).toString("hex");
  await markRequestSent(auth.supabase, id, accessToken);

  const meta = requestClientMeta(req);
  await writeSignatureAudit(auth.supabase, {
    requestId: id,
    eventType: "sent",
    actor: auth.profile.email ?? auth.profile.full_name ?? auth.userId,
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
    metadata: { signer_email: request.signer_email },
  });
  await writeAuditLog(auth.supabase, {
    userId: auth.userId,
    action: "esignature.request_sent",
    entityType: "signature_requests",
    entityId: id,
    metadata: { signer_email: request.signer_email, document_name: request.document_name },
  });

  let delivered = false;
  try {
    const result = await sendSigningInvite({
      to: request.signer_email,
      signerName: request.signer_name,
      documentName: request.document_name,
      dealLabel: request.deal_label,
      token: accessToken,
    });
    delivered = result.delivered;
  } catch {
    // Envelope is sent; surface a soft warning so the admin can copy the link.
  }

  return NextResponse.json({ ok: true, delivered, signUrl: buildSignUrl(accessToken) });
}
