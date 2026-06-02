import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { DealRoomActivityType } from "@/lib/deal-rooms/types";

type Client = SupabaseClient<Database>;

export async function writeDealRoomActivity(
  supabase: Client,
  input: {
    roomId: string;
    eventType: DealRoomActivityType;
    actorUserId?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  await supabase.from("deal_room_activity_events").insert({
    room_id: input.roomId,
    event_type: input.eventType,
    actor_user_id: input.actorUserId ?? null,
    metadata: input.metadata ?? {},
  });
}

