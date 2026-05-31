import { NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/api/admin";
import { writeAuditLog } from "@/lib/data/audit";
import { createSignedDocumentUrl, getStorageBucket, PITCH_DECKS_BUCKET } from "@/lib/data/documents";
import { SPV_INVESTOR_DOCUMENTS_BUCKET, SPV_REQUIREMENT_DOCUMENT_TYPE } from "@/lib/spv/spv-documents";
import { userHasCompanyAccess } from "@/lib/onboarding/ensure-founder-setup";
import { signedDocumentUrlSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const auth = await requireStaffApi(["founder", "admin", "analyst", "investor"]);

  if ("error" in auth) {
    return auth.error;
  }

  const parsed = signedDocumentUrlSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid document request." }, { status: 400 });
  }

  const { data: document, error: documentError } = await auth.supabase
    .from("documents")
    .select("*")
    .eq("id", parsed.data.documentId)
    .single();

  if (documentError || !document?.file_path) {
    return NextResponse.json({ error: "Document not found or inaccessible." }, { status: 404 });
  }

  if (document.document_type === SPV_REQUIREMENT_DOCUMENT_TYPE) {
    if (auth.profile.role === "founder") {
      return NextResponse.json({ error: "Document not found or inaccessible." }, { status: 404 });
    }

    if (auth.profile.role === "investor" && document.uploaded_by !== auth.profile.id) {
      return NextResponse.json({ error: "Document not found or inaccessible." }, { status: 404 });
    }
  } else if (auth.profile.role === "founder") {
    const hasAccess = await userHasCompanyAccess(auth.profile.id, document.company_id);

    if (!hasAccess) {
      return NextResponse.json({ error: "Document not found or inaccessible." }, { status: 404 });
    }
  } else if (auth.profile.role === "investor") {
    const { data: company } = await auth.supabase
      .from("companies")
      .select("review_status")
      .eq("id", document.company_id)
      .single();

    if (company?.review_status !== "approved") {
      return NextResponse.json({ error: "Document not found or inaccessible." }, { status: 404 });
    }
  }

  const canonicalBucket =
    document.document_type === SPV_REQUIREMENT_DOCUMENT_TYPE
      ? SPV_INVESTOR_DOCUMENTS_BUCKET
      : getStorageBucket(document.document_type ?? "");
  let { data, error } = await createSignedDocumentUrl(auth.supabase, canonicalBucket, document.file_path);

  if (error && (document.document_type === "PITCH_DECK" || document.document_type === "pitch_deck")) {
    const fallback = await createSignedDocumentUrl(auth.supabase, PITCH_DECKS_BUCKET, document.file_path);
    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (!data?.signedUrl) {
    return NextResponse.json({ error: "Unable to create a signed URL for this document." }, { status: 500 });
  }

  await writeAuditLog(auth.supabase, {
    userId: auth.profile.id,
    action: "document.signed_url.created",
    entityType: "document",
    entityId: document.id,
  });

  return NextResponse.json({ signedUrl: data.signedUrl, expiresIn: 300 });
}
