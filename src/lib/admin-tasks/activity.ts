// Activity logging for admin tasks. Called from the server layer on every
// mutation so the actor is reliable (including storage events).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { TaskActivityEvent } from "./types";

// admin_task_* tables aren't in generated types yet — raw cast.
function raw(supabase: SupabaseClient<Database>): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

export async function logActivity(
  supabase: SupabaseClient<Database>,
  taskId: string,
  actorId: string,
  event: TaskActivityEvent,
  opts?: { payload?: Record<string, unknown>; comment?: string | null },
): Promise<void> {
  await raw(supabase)
    .from("admin_task_activity")
    .insert({
      task_id: taskId,
      actor_id: actorId,
      event_type: event,
      payload: opts?.payload ?? {},
      comment_text: opts?.comment ?? null,
    });
}
