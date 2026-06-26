// Activity logging for iCFO Events. Called from the server layer on every
// mutation so the actor is reliable.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { EventActivityType } from "./types";

// event_activity isn't in generated types yet — raw cast.
function raw(supabase: SupabaseClient<Database>): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

export async function logEventActivity(
  supabase: SupabaseClient<Database>,
  eventId: string,
  actorId: string,
  eventType: EventActivityType,
  payload?: Record<string, unknown>,
): Promise<void> {
  await raw(supabase)
    .from("event_activity")
    .insert({
      event_id: eventId,
      actor_id: actorId,
      event_type: eventType,
      payload: payload ?? {},
    });
}
