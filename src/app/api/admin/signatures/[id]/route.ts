import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermissionApi } from "@/lib/api/permissions";
import { getRequestById, updateRequestDetails } from "@/lib/esignature/requests";
import { listFields } from "@/lib/esignature/fields";
import { signatureSignedUrl } from "@/lib/esignature/storage";

export const dynamic = "force-dynamic";

/** GET — envelope detail + fields + short-lived preview URL for the working PDF. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await requirePermissionApi("review_documents");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const request = await getRequestById(auth.supabase, id);
  if (!request || request.created_by !== auth.userId) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const [fields, previewUrl] = await Promise.all([
    listFields(auth.supabase, id),
    signatureSignedUrl(auth.supabase, request.working_file_path, 600),
  ]);

  return NextResponse.json({ request, fields, previewUrl });
}

const patchSchema = z.object({
  signer_name: z.string().max(160).nullish(),
  signer_email: z.string().email().max(200).nullish(),
  signer_company: z.string().max(200).nullish(),
  deal_label: z.string().max(200).nullish(),
});

/** PATCH — save signer details / deal label on a draft envelope. */
export async function PATCH(
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
    return NextResponse.json({ error: "Only a draft envelope can be edited." }, { status: 409 });
  }

  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid details." }, { status: 400 });
  }

  await updateRequestDetails(auth.supabase, id, {
    signerName: parsed.data.signer_name ?? null,
    signerEmail: parsed.data.signer_email ?? null,
    signerCompany: parsed.data.signer_company ?? null,
    dealLabel: parsed.data.deal_label ?? null,
  });

  return NextResponse.json({ ok: true });
}
