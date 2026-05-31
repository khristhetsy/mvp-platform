import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export type OperationalEventLevel = "info" | "warning" | "error";

export type OperationalEventInput = {
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  userId?: string | null;
  level?: OperationalEventLevel;
  metadata?: Record<string, unknown>;
};

function logOperationalEvent(input: OperationalEventInput) {
  const level = input.level ?? "info";
  const payload = {
    action: input.action,
    entityType: input.entityType ?? null,
    entityId: input.entityId ?? null,
    level,
    metadata: input.metadata ?? {},
  };

  if (level === "error") {
    console.error("[capitalos]", payload);
    return;
  }

  if (level === "warning") {
    console.warn("[capitalos]", payload);
    return;
  }

  console.info("[capitalos]", payload);
}

export async function recordOperationalEvent(
  client: SupabaseClient<Database> | null,
  input: OperationalEventInput,
) {
  logOperationalEvent(input);

  try {
    const admin = client ?? createServiceRoleClient();
    await admin.from("audit_logs").insert({
      user_id: input.userId ?? null,
      action: input.action,
      entity_type: input.entityType ?? "system",
      entity_id: input.entityId ?? null,
      metadata: {
        level: input.level ?? "info",
        ...(input.metadata ?? {}),
      },
    });
  } catch (error) {
    console.error("[capitalos] failed to persist operational event", {
      action: input.action,
      error: error instanceof Error ? error.message : "unknown",
    });
  }
}

export function recordOperationalError(
  action: string,
  error: unknown,
  context?: Record<string, unknown>,
) {
  void recordOperationalEvent(null, {
    action,
    level: "error",
    metadata: {
      message: error instanceof Error ? error.message : String(error),
      ...context,
    },
  });
}
