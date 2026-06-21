// Envelope (signature_requests) data access. Service-role client only.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { SignatureRequest, SourceFormat } from "./types";

function raw(supabase: SupabaseClient<Database>): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

export type CreateDraftInput = {
  documentName: string;
  dealLabel?: string | null;
  sourceFormat: SourceFormat;
  sourceFilePath?: string | null;
  workingFilePath: string;
  pageCount: number;
  createdBy: string;
};

/** Insert a draft envelope after a successful upload/conversion. */
export async function createDraftRequest(
  supabase: SupabaseClient<Database>,
  input: CreateDraftInput,
): Promise<SignatureRequest> {
  const { data, error } = await raw(supabase)
    .from("signature_requests")
    .insert({
      document_name: input.documentName,
      deal_label: input.dealLabel ?? null,
      source_format: input.sourceFormat,
      source_file_path: input.sourceFilePath ?? null,
      working_file_path: input.workingFilePath,
      page_count: input.pageCount,
      status: "draft",
      created_by: input.createdBy,
    })
    .select("*")
    .single();

  if (error || !data) throw new Error(`Could not create signature request: ${error?.message ?? "unknown"}`);
  return data as unknown as SignatureRequest;
}

/** List envelopes created by an admin, newest first. */
export async function listRequests(
  supabase: SupabaseClient<Database>,
  createdBy: string,
): Promise<SignatureRequest[]> {
  const { data } = await raw(supabase)
    .from("signature_requests")
    .select("*")
    .eq("created_by", createdBy)
    .order("created_at", { ascending: false });
  return (data as unknown as SignatureRequest[]) ?? [];
}

export async function getRequestById(
  supabase: SupabaseClient<Database>,
  id: string,
): Promise<SignatureRequest | null> {
  const { data } = await raw(supabase)
    .from("signature_requests")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return (data as unknown as SignatureRequest) ?? null;
}
