import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { buildStoragePath, getStorageBucket } from "@/lib/data/documents";
import { userHasCompanyAccess } from "@/lib/onboarding/ensure-founder-setup";
import { getActiveCompanyForUser } from "@/lib/organizations/active-company";

export const dynamic = "force-dynamic";

// Returns a Supabase Storage signed upload URL so the browser can upload a
// document straight to storage — bypassing the serverless ~4.5 MB request-body
// limit. The file bytes never pass through this function. The follow-up call to
// /api/documents/upload (with storagePath) records the document and runs the
// authoritative ownership check before persisting.
const MAX_BYTES = 25 * 1024 * 1024;

function normalizeDocumentType(input: string) {
  const value = input.toUpperCase().trim();
  if (value === "FINANCIALS") return "FINANCIAL_STATEMENTS";
  if (value === "LEGAL_DOCUMENT") return "LEGAL_DOCUMENTS";
  return value;
}

const FOUNDER_ALLOWED_DOCUMENT_TYPES = new Set([
  "PITCH_DECK", "BUSINESS_PLAN", "FINANCIAL_STATEMENTS", "CAP_TABLE", "TEAM_BIOS",
  "LEGAL_DOCUMENTS", "CORPORATE_DOCUMENTS", "CUSTOMER_CONTRACTS", "MARKET_RESEARCH", "OTHER",
]);

export async function POST(req: Request): Promise<Response> {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as
    | { companyId?: string; documentType?: string; fileName?: string; contentType?: string; fileSize?: number }
    | null;

  const documentType = typeof body?.documentType === "string" ? normalizeDocumentType(body.documentType) : "";
  const fileName = typeof body?.fileName === "string" ? body.fileName : "";
  const fileSize = typeof body?.fileSize === "number" ? body.fileSize : 0;

  if (!documentType || !FOUNDER_ALLOWED_DOCUMENT_TYPES.has(documentType)) {
    return NextResponse.json({ error: "Invalid document type." }, { status: 400 });
  }
  if (!fileName) return NextResponse.json({ error: "A file name is required." }, { status: 400 });
  if (fileSize > MAX_BYTES) return NextResponse.json({ error: "File exceeds the 25 MB limit." }, { status: 400 });

  const { company } = await getActiveCompanyForUser(auth.profile);
  const companyId = (typeof body?.companyId === "string" && body.companyId) || company?.id;
  if (!companyId) {
    return NextResponse.json({ error: "No company profile is linked to your account." }, { status: 403 });
  }
  if (!(await userHasCompanyAccess(auth.profile.id, companyId))) {
    return NextResponse.json({ error: "You don't have access to this company." }, { status: 403 });
  }

  const admin = createServiceRoleClient();
  const bucket = getStorageBucket(documentType);
  const path = buildStoragePath(documentType, companyId, auth.profile.id, fileName);
  const { data, error } = await admin.storage.from(bucket).createSignedUploadUrl(path);
  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Could not prepare the upload." }, { status: 500 });
  }

  return NextResponse.json({ bucket, path: data.path, token: data.token, companyId });
}
