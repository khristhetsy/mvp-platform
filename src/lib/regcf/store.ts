import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { RegCfDocKey } from "@/lib/regcf/documents";

function raw(supabase: SupabaseClient<Database>): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

export interface RegCfStoredDoc {
  doc_key: RegCfDocKey;
  content: string | null;
  ai_generated: boolean;
  updated_at: string;
}

export async function getRegCfDocuments(
  supabase: SupabaseClient<Database>,
  founderId: string,
): Promise<RegCfStoredDoc[]> {
  const { data } = await raw(supabase)
    .from("regcf_documents")
    .select("doc_key, content, ai_generated, updated_at")
    .eq("founder_id", founderId);
  return (data ?? []) as RegCfStoredDoc[];
}

export async function upsertRegCfDocument(
  supabase: SupabaseClient<Database>,
  input: { founderId: string; companyId: string | null; docKey: RegCfDocKey; content: string; aiGenerated: boolean },
): Promise<void> {
  const { error } = await raw(supabase)
    .from("regcf_documents")
    .upsert(
      {
        founder_id: input.founderId,
        company_id: input.companyId,
        doc_key: input.docKey,
        content: input.content,
        ai_generated: input.aiGenerated,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "founder_id,doc_key" },
    );
  if (error) throw new Error(error.message);
}
