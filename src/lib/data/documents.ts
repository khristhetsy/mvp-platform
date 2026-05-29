import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type DocumentInsert = Database["public"]["Tables"]["documents"]["Insert"];

export const PITCH_DECKS_BUCKET = "pitch-decks";
export const LEGACY_DOCUMENTS_BUCKET = "company-documents";

export function buildPitchDeckPath(companyId: string, userId: string, fileName: string) {
  const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const withExtension = safeFileName.toLowerCase().endsWith(".pdf") ? safeFileName : `${safeFileName}.pdf`;
  return `${companyId}/${userId}/${Date.now()}-${withExtension}`;
}

export function buildDocumentPath(companyId: string, documentType: string, fileName: string) {
  const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${companyId}/${documentType.toLowerCase()}/${crypto.randomUUID()}-${safeFileName}`;
}

export function getStorageBucket(documentType: string) {
  // Canonical private bucket for all company documents.
  // Keep PITCH_DECKS_BUCKET only for backward-compatible downloads.
  return LEGACY_DOCUMENTS_BUCKET;
}

export function buildStoragePath(
  documentType: string,
  companyId: string,
  userId: string,
  fileName: string,
) {
  if (documentType === "PITCH_DECK") {
    return buildPitchDeckPath(companyId, userId, fileName);
  }

  return buildDocumentPath(companyId, documentType, fileName);
}

export async function createDocumentRecord(supabase: SupabaseClient<Database>, input: DocumentInsert) {
  return supabase.from("documents").insert(input).select("*").single();
}

export async function listCompanyDocuments(supabase: SupabaseClient<Database>, companyId: string) {
  return supabase
    .from("documents")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
}

export async function createSignedDocumentUrl(
  supabase: SupabaseClient<Database>,
  bucket: string,
  filePath: string,
  expiresIn = 300,
) {
  return supabase.storage.from(bucket).createSignedUrl(filePath, expiresIn);
}
