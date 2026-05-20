import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { writeAuditLog } from "@/lib/data/audit";
import { buildDocumentPath, createDocumentRecord } from "@/lib/data/documents";
import { documentUploadSchema } from "@/lib/validation";

const maxUploadBytes = 25 * 1024 * 1024;
const allowedMimeTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
]);

export async function POST(request: Request) {
  const auth = await requireApiProfile(["founder"]);

  if ("error" in auth) {
    return auth.error;
  }

  const formData = await request.formData();
  const parsed = documentUploadSchema.safeParse({
    companyId: formData.get("companyId"),
    documentType: formData.get("documentType"),
  });
  const file = formData.get("file");

  if (!parsed.success || !(file instanceof File)) {
    return NextResponse.json({ error: "Invalid upload request." }, { status: 400 });
  }

  if (file.size > maxUploadBytes) {
    return NextResponse.json({ error: "File exceeds the 25MB MVP upload limit." }, { status: 400 });
  }

  if (!allowedMimeTypes.has(file.type)) {
    return NextResponse.json({ error: "Unsupported file type." }, { status: 400 });
  }

  const { data: company } = await auth.supabase
    .from("companies")
    .select("id")
    .eq("id", parsed.data.companyId)
    .eq("founder_id", auth.profile.id)
    .single();

  if (!company) {
    return NextResponse.json({ error: "Company not found or inaccessible." }, { status: 403 });
  }

  const filePath = buildDocumentPath(parsed.data.companyId, parsed.data.documentType, file.name);
  const { error: uploadError } = await auth.supabase.storage.from("company-documents").upload(filePath, file, {
    contentType: file.type,
    upsert: false,
  });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 400 });
  }

  const { data: document, error: documentError } = await createDocumentRecord(auth.supabase, {
    company_id: parsed.data.companyId,
    uploaded_by: auth.profile.id,
    document_type: parsed.data.documentType,
    file_name: file.name,
    file_path: filePath,
    file_url: null,
    mime_type: file.type,
    size_bytes: file.size,
  });

  if (documentError) {
    return NextResponse.json({ error: documentError.message }, { status: 400 });
  }

  await writeAuditLog(auth.supabase, {
    userId: auth.profile.id,
    action: "document.uploaded",
    entityType: "document",
    entityId: document.id,
    metadata: { companyId: parsed.data.companyId, documentType: parsed.data.documentType },
  });

  return NextResponse.json({
    document,
  });
}
