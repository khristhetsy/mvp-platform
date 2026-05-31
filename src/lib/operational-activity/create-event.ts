import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeOperationalSeverity } from "@/lib/operational-activity/event-severity";
import {
  sanitizeOperationalDescription,
  sanitizeOperationalMetadata,
} from "@/lib/operational-activity/sanitize";
import type { CreateOperationalEventInput } from "@/lib/operational-activity/types";
import type { Database } from "@/lib/supabase/types";

export type CreateOperationalEventResult =
  | { id: string; created: true }
  | { skipped: true; reason: "duplicate" }
  | { error: string };

const DEFAULT_DEDUPE_WINDOW_MINUTES = 15;

async function hasRecentDuplicate(
  supabase: SupabaseClient<Database>,
  dedupeKey: string,
  windowMinutes: number,
) {
  const since = new Date(Date.now() - windowMinutes * 60_000).toISOString();
  const { data, error } = await supabase
    .from("operational_activity_events")
    .select("id")
    .eq("metadata->>dedupe_key", dedupeKey)
    .gte("created_at", since)
    .limit(1)
    .maybeSingle();

  if (error) return false;
  return Boolean(data);
}

export async function createOperationalEvent(
  supabase: SupabaseClient<Database>,
  input: CreateOperationalEventInput,
): Promise<CreateOperationalEventResult> {
  const dedupeKey = input.dedupeKey?.trim();
  const dedupeWindow = input.dedupeWindowMinutes ?? DEFAULT_DEDUPE_WINDOW_MINUTES;

  if (dedupeKey) {
    const duplicate = await hasRecentDuplicate(supabase, dedupeKey, dedupeWindow);
    if (duplicate) {
      return { skipped: true, reason: "duplicate" };
    }
  }

  const metadata = sanitizeOperationalMetadata({
    ...(input.metadata ?? {}),
    ...(dedupeKey ? { dedupe_key: dedupeKey } : {}),
  });

  const { data, error } = await supabase
    .from("operational_activity_events")
    .insert({
      event_type: input.eventType,
      event_category: input.eventCategory,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      actor_user_id: input.actorUserId ?? null,
      actor_role: input.actorRole ?? null,
      company_id: input.companyId ?? null,
      investor_id: input.investorId ?? null,
      spv_id: input.spvId ?? null,
      related_user_id: input.relatedUserId ?? null,
      severity: normalizeOperationalSeverity(input.severity),
      title: input.title.trim(),
      description: sanitizeOperationalDescription(input.description),
      metadata,
      source_module: input.sourceModule,
      visibility: input.visibility ?? "admin_only",
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: error?.message ?? "Unable to create operational event." };
  }

  return { id: data.id, created: true };
}

/** Fire-and-forget helper for hot paths — never throws. */
export function emitOperationalEvent(
  supabase: SupabaseClient<Database>,
  input: CreateOperationalEventInput,
) {
  void createOperationalEvent(supabase, input).catch((error) => {
    console.error("[capitalos] operational event failed", {
      eventType: input.eventType,
      error: error instanceof Error ? error.message : "unknown",
    });
  });
}
