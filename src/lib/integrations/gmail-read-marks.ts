import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

// gmail_read_marks isn't in the generated types — raw client.
function raw(supabase: SupabaseClient<Database>): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

/** Gmail thread ids the user has opened (and thus "read") inside iCapOS. */
export async function getReadThreadIds(
  supabase: SupabaseClient<Database>,
  ownerId: string,
): Promise<Set<string>> {
  const { data } = await raw(supabase)
    .from("gmail_read_marks")
    .select("gmail_thread_id")
    .eq("owner_id", ownerId);
  return new Set(((data as Array<{ gmail_thread_id: string }> | null) ?? []).map((r) => r.gmail_thread_id));
}

/** Record a Gmail thread as read in iCapOS (idempotent). */
export async function markThreadRead(
  supabase: SupabaseClient<Database>,
  ownerId: string,
  threadId: string,
): Promise<void> {
  await raw(supabase)
    .from("gmail_read_marks")
    .upsert({ owner_id: ownerId, gmail_thread_id: threadId, read_at: new Date().toISOString() }, { onConflict: "owner_id,gmail_thread_id" });
}
