/**
 * Founder social media events for the admin activity feed (operational_activity_events).
 * Not logged, by design: drafts, draft edits, AI agent use, page views.
 */
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createOperationalEvent } from "@/lib/operational-activity/create-event";
import type { OperationalEventSeverity } from "@/lib/operational-activity/types";

export type FounderSocialEventType =
  | "founder.social_account_connected"
  | "founder.social_post_scheduled"
  | "founder.social_post_published"
  | "founder.social_post_failed"
  | "founder.social_email_sent"
  | "founder.social_limit_reached"
  | "admin.social_limits_changed";

const META: Record<FounderSocialEventType, { title: string; severity: OperationalEventSeverity }> = {
  "founder.social_account_connected": { title: "Social account connected", severity: "info" },
  "founder.social_post_scheduled": { title: "Social post scheduled", severity: "info" },
  "founder.social_post_published": { title: "Social post published", severity: "info" },
  "founder.social_post_failed": { title: "Social post failed", severity: "high" },
  "founder.social_email_sent": { title: "Social email sent", severity: "info" },
  "founder.social_limit_reached": { title: "Social post limit reached", severity: "medium" },
  "admin.social_limits_changed": { title: "Founder social limits changed", severity: "info" },
};

export type FounderSocialEventInput = {
  type: FounderSocialEventType;
  /** The founder the event is about. */
  founderId: string;
  /** Who did it: the founder, or the admin for limit changes. */
  actorUserId?: string | null;
  description?: string | null;
  metadata?: Record<string, unknown>;
  /** Set to log a failure once per post. */
  dedupeKey?: string | null;
};

/** Best effort: a logging failure never blocks the founder action. */
export async function logFounderSocialEvent(input: FounderSocialEventInput): Promise<void> {
  try {
    const meta = META[input.type];
    const isAdminChange = input.type === "admin.social_limits_changed";
    await createOperationalEvent(createServiceRoleClient(), {
      eventType: input.type,
      eventCategory: isAdminChange ? "system" : "founder",
      entityType: "profile",
      entityId: input.founderId,
      relatedUserId: input.founderId,
      actorUserId: input.actorUserId ?? input.founderId,
      actorRole: isAdminChange ? "admin" : "founder",
      severity: meta.severity,
      title: meta.title,
      description: input.description ?? null,
      metadata: input.metadata ?? {},
      sourceModule: "founder_social",
      visibility: "admin_only",
      dedupeKey: input.dedupeKey ?? null,
      // A failed post is logged once, not on every queue retry.
      dedupeWindowMinutes: input.dedupeKey ? 60 * 24 * 30 : undefined,
    });
  } catch (err) {
    console.error("[capitalos] founder social event failed", { type: input.type, error: err instanceof Error ? err.message : "unknown" });
  }
}
