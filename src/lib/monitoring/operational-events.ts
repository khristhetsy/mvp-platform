import * as Sentry from "@sentry/nextjs";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

/**
 * Send a server-side failure to Sentry with a searchable action tag.
 *
 * The point of this module is that a failure in a money or compliance path
 * (a billing write that didn't land, a dropped SPV seed) should page someone,
 * not just sit in a log nobody reads. Tagging by action lets you alert on a
 * specific one — e.g. anything under `billing.webhook.*`.
 */
function captureToSentry(action: string, error: unknown, context?: Record<string, unknown>) {
  try {
    const err = error instanceof Error ? error : new Error(String(error));
    Sentry.captureException(err, {
      tags: { operational_action: action },
      extra: context ?? {},
    });
  } catch {
    // Never let the reporter throw into the caller's failure path.
  }
}

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
  captureToSentry(action, error, context);
  void recordOperationalEvent(null, {
    action,
    level: "error",
    metadata: {
      message: error instanceof Error ? error.message : String(error),
      ...context,
    },
  });
}

/**
 * Awaitable failure reporter for paths where the durable record must be written
 * before the handler returns — e.g. a webhook that is about to return 500 and
 * hand control back to the caller. Captures to Sentry (fire-and-forget, buffered)
 * and awaits the audit_logs write so the failure is queryable even if the process
 * is torn down immediately after the response.
 */
export async function reportServerFailure(
  action: string,
  error: unknown,
  context?: Record<string, unknown>,
): Promise<void> {
  captureToSentry(action, error, context);
  await recordOperationalEvent(null, {
    action,
    level: "error",
    metadata: {
      message: error instanceof Error ? error.message : String(error),
      ...context,
    },
  });
}
