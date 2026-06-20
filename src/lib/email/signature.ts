import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

// user_preferences isn't in the generated types — raw client.
function raw(supabase: SupabaseClient<Database>): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

export async function loadSignature(supabase: SupabaseClient<Database>, profileId: string): Promise<string> {
  const { data } = await raw(supabase)
    .from("user_preferences")
    .select("email_signature")
    .eq("profile_id", profileId)
    .maybeSingle();
  return (data as { email_signature: string | null } | null)?.email_signature ?? "";
}

export async function saveSignature(
  supabase: SupabaseClient<Database>,
  profileId: string,
  signature: string,
): Promise<void> {
  const now = new Date().toISOString();
  await raw(supabase)
    .from("user_preferences")
    .upsert({ profile_id: profileId, email_signature: signature, updated_at: now }, { onConflict: "profile_id" });
}
