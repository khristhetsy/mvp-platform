import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  getRequestByToken,
  listFieldsForToken,
  saveSignerValuesAndSign,
} from "@/lib/esignature/public";
import { writeSignatureAudit, requestClientMeta } from "@/lib/esignature/storage";

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
    let value: string;
    if (f.auto_source === "signing_date" || f.field_type === "date") {
      value = today;
    } else if (f.auto_source === "signer_company" || f.field_type === "company") {
      value = request.signer_company ?? "";
    } else {
      value = (provided[f.id] ?? "").trim();
    }

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

  return NextResponse.json({ ok: true });
}
