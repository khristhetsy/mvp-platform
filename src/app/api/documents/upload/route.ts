import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { recordOperationalError } from "@/lib/monitoring/operational-events";
import { writeAuditLog } from "@/lib/data/audit";
import {
  buildStoragePath,
  createDocumentRecord,
  getStorageBucket,
} from "@/lib/data/documents";
import {
  ensureFounderCompanyForUser,
  userHasCompanyAccess,
} from "@/lib/onboarding/ensure-founder-setup";
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

const uploadErrorMessages: Record<number, string> = {
  400: "Upload failed due to invalid input. Please check the file and try again.",
  401: "Authentication required. Please sign in and try again.",
  403: "No company profile is linked to your account. Please create a company profile first.",
  409: "A pitch deck is already uploaded for this company.",
  500: "Upload failed due to a server error. Please try again.",
};

export async function POST(request: Request) {
  const auth = await requireApiProfile(["founder"]);

  if ("error" in auth) {
    return auth.error;
  }

  const rateLimited = await enforceRateLimit({
    bucket: "document_upload",
    subjectId: auth.profile.id,
    limit: 20,
    windowMs: 60_000,
  });
  if (rateLimited) {
    return rateLimited;
  }

  let company = await ensureFounderCompanyForUser(auth.profile);

  const formData = await request.formData();
  const parsed = documentUploadSchema.safeParse({
    companyId: formData.get("companyId") || company?.id,
    documentType: formData.get("documentType"),
  });
  const file = formData.get("file");

  if (!parsed.success || !(file instanceof File)) {
    return NextResponse.json({ error: "Invalid upload request." }, { status: 400 });
  }

  if (!company) {
    return NextResponse.json(
      {
        error: "No company profile is linked to your account. Please create a company profile first.",
      },
      { status: 403 },
    );
  }

  const hasAccess = await userHasCompanyAccess(auth.profile.id, parsed.data.companyId);

  if (!hasAccess) {
    return NextResponse.json(
      {
        error: "No company profile is linked to your account. Please create a company profile first.",
      },
      { status: 403 },
    );
  }

  if (file.size > maxUploadBytes) {
    return NextResponse.json({ error: "File exceeds the 25MB MVP upload limit." }, { status: 400 });
  }

  if (!allowedMimeTypes.has(file.type)) {
    return NextResponse.json({ error: "Unsupported file type." }, { status: 400 });
  }

  if (parsed.data.documentType === "PITCH_DECK" && file.type !== "application/pdf") {
    return NextResponse.json({ error: "Pitch decks must be uploaded as a PDF." }, { status: 400 });
  }

  // Prevent duplicate pitch deck uploads for a company.
  if (parsed.data.documentType === "PITCH_DECK") {
    const { data: existingPitchDeck, error: existingError } = await auth.supabase
      .from("documents")
      .select("id")
      .eq("company_id", parsed.data.companyId)
      .eq("document_type", "PITCH_DECK")
      .limit(1)
      .maybeSingle();

    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 400 });
    }

    if (existingPitchDeck) {
      return NextResponse.json({ error: uploadErrorMessages[409] }, { status: 409 });
    }
  }

  const bucket = getStorageBucket(parsed.data.documentType);
  const filePath = buildStoragePath(
    parsed.data.documentType,
    parsed.data.companyId,
    auth.profile.id,
    file.name,
  );

  const { error: uploadError } = await auth.supabase.storage.from(bucket).upload(filePath, file, {
    contentType: file.type,
    upsert: false,
  });

  if (uploadError) {
    recordOperationalError("document.upload_storage_failed", uploadError, {
      userId: auth.profile.id,
      companyId: parsed.data.companyId,
      documentType: parsed.data.documentType,
    });
    if (uploadError.message.toLowerCase().includes("bucket not found")) {
      return NextResponse.json(
        {
          error:
            `Storage bucket "${bucket}" was not found in Supabase. ` +
            "Run the latest Supabase migration (0003_company_members_rls_storage.sql) or create the bucket and policies, then retry.",
        },
        { status: 500 },
      );
    }
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
    status: "uploaded",
  });

  if (documentError) {
    // In case a unique constraint is added later (e.g., one pitch deck per company), return a clearer message.
    if (documentError.code === "23505") {
      return NextResponse.json({ error: uploadErrorMessages[409] }, { status: 409 });
    }
    return NextResponse.json({ error: documentError.message }, { status: 400 });
  }

  await writeAuditLog(auth.supabase, {
    userId: auth.profile.id,
    action: "document.uploaded",
    entityType: "document",
    entityId: document.id,
    metadata: {
      companyId: parsed.data.companyId,
      documentType: parsed.data.documentType,
      bucket,
      filePath,
    },
  });

  return NextResponse.json({
    document,
  });
}
