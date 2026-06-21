import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  getRequestByToken,
  getCreatorEmail,
  listFieldsForToken,
  saveSignerValuesAndSign,
} from "@/lib/esignature/public";
import { writeSignatureAudit, requestClientMeta } from "@/lib/esignature/storage";
import { sealEnvelope } from "@/lib/esignature/seal";
import { sendCompletionNotice } from "@/lib/esignature/email";
import { onSignatureCompleted } from "@/lib/diligence/consent";
import { resolveAutoValue } from "@/lib/esignature/compute";

export const dynamic = "force-dynamic";

const submitSchema = z.object({
  // Map of field id → signer-entered value (signature data URL or typed text).
  values: z.record(z.string(), z.string().max(3_000_000)),
});

/** POST — signer completes required fields and signs. Persists values + flips
 *  the envelope to "signed". (Sealing happens in step 6.) */
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
  if (!request.consent_accepted) {
    return NextResponse.json({ error: "Please accept the electronic-signature consent first." }, { status: 400 });
  }

  const parsed = submitSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid submission." }, { status: 400 });
  }
  const provided = parsed.data.values;
  const today = new Date().toISOString().slice(0, 10);

  const fields = await listFieldsForToken(supabase, request.id);

  // Server computes auto values (never trust the client for those).
  const resolved: { fieldId: string; value: string }[] = [];
  for (const f of fields) {
    const auto = resolveAutoValue(f, today, request.signer_company);
    const value = auto !== null ? auto : (provided[f.id] ?? "").trim();

    if (f.required && !value) {
      return NextResponse.json({ error: "Please complete all required fields." }, { status: 400 });
    }
    resolved.push({ fieldId: f.id, value });
  }

  await saveSignerValuesAndSign(supabase, request.id, resolved);

  const meta = requestClientMeta(req);
  await writeSignatureAudit(supabase, {
    requestId: request.id,
    eventType: "signed",
    actor: request.signer_email ?? request.signer_name,
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
    metadata: { field_count: resolved.length },
  });

  // Seal: burn values + signature into the PDF, hash, store, complete, notify.
  let sealed = false;
  try {
    const updatedFields = await listFieldsForToken(supabase, request.id);
    const result = await sealEnvelope(supabase, request, updatedFields);
    sealed = true;

    await writeSignatureAudit(supabase, {
      requestId: request.id,
      eventType: "sealed",
      actor: "system",
      metadata: { document_hash: result.hash },
    });

    // If this envelope is a Diligence consent, seal the DD version + advance.
    try { await onSignatureCompleted(supabase, request.id); } catch { /* best-effort; not a DD consent */ }

    const adminEmail = await getCreatorEmail(supabase, request.created_by);
    await Promise.allSettled([
      request.signer_email
        ? sendCompletionNotice({ to: request.signer_email, documentName: request.document_name, token, forSigner: true })
        : Promise.resolve(),
      adminEmail
        ? sendCompletionNotice({ to: adminEmail, documentName: request.document_name, token, forSigner: false })
        : Promise.resolve(),
    ]);
  } catch {
    // Signature is recorded; sealing can be retried. Don't fail the signer.
  }

  return NextResponse.json({ ok: true, sealed });
}
