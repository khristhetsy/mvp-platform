// Append-only audit writer for the DD module (dd_audit_log). Service role only.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

function raw(supabase: SupabaseClient<Database>): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

export async function ddAudit(
  supabase: SupabaseClient<Database>,
  input: {
    engagementId: string | null;
    actorId: string | null;
    action: string;
    target?: string | null;
    before?: unknown;
    after?: unknown;
  },
): Promise<void> {
  await raw(supabase)
    .from("dd_audit_log")
    .insert({
      engagement_id: input.engagementId,
      actor_id: input.actorId,
      action: input.action,
      target: input.target ?? null,
      before: input.before ?? null,
      after: input.after ?? null,
    });
}
