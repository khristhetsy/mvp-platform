import { NextResponse } from "next/server";
import { requirePermissionApi } from "@/lib/api/permissions";
import { writeAuditLog } from "@/lib/data/audit";
import { getRequestById, markRequestVoided } from "@/lib/esignature/requests";
import { writeSignatureAudit, requestClientMeta } from "@/lib/esignature/storage";

export const dynamic = "force-dynamic";

/** POST — void an unsigned envelope (draft / sent / viewed). */
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
  if (request.status === "completed" || request.status === "signed") {
    return NextResponse.json({ error: "A signed document can't be voided." }, { status: 409 });
  }
  if (request.status === "voided") {
    return NextResponse.json({ error: "This envelope is already voided." }, { status: 409 });
  }

  await markRequestVoided(auth.supabase, id);

  const meta = requestClientMeta(req);
  await writeSignatureAudit(auth.supabase, {
    requestId: id,
    eventType: "voided",
    actor: auth.profile.email ?? auth.profile.full_name ?? auth.userId,
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
  });
  await writeAuditLog(auth.supabase, {
    userId: auth.userId,
    action: "esignature.request_voided",
    entityType: "signature_requests",
    entityId: id,
    metadata: { document_name: request.document_name },
  });

  return NextResponse.json({ ok: true });
}
