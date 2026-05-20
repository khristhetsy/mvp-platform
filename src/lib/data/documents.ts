import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type DocumentInsert = Database["public"]["Tables"]["documents"]["Insert"];

export function buildDocumentPath(companyId: string, documentType: string, fileName: string) {
  const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${companyId}/${documentType.toLowerCase()}/${crypto.randomUUID()}-${safeFileName}`;
}

export async function createDocumentRecord(supabase: SupabaseClient<Database>, input: DocumentInsert) {
  return supabase.from("documents").insert(input).select("*").single();
}

export async function createSignedDocumentUrl(supabase: SupabaseClient<Database>, filePath: string, expiresIn = 300) {
  return supabase.storage.from("company-documents").createSignedUrl(filePath, expiresIn);
}
