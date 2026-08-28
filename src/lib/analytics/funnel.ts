// Funnel instrumentation (§8). Emits input metrics to the funnel_events table so
// the weekly operator dashboard can read step counts + step-to-step conversion —
// the metric layer that was missing while signups read as an unreadable zero.
// Also dual-writes to PostHog. Best-effort: telemetry never throws into a request.

import { serviceRoleClientUntyped } from "@/lib/supabase/admin";
import { track } from "@/lib/analytics/posthog";

/** The ordered funnel (§8). Keep names stable — the dashboard groups on them. */
export const FUNNEL_EVENTS = [
  "post_click",
  "landing_view",
  "assessment_start",
  "assessment_complete",
  "band_assigned",
  "pricing_view",
  "checkout_start",
  "checkout_complete",
  "first_distribution_sent",
  "intro_requested",
  "renewal",
] as const;

export type FunnelEventName = (typeof FUNNEL_EVENTS)[number];

export type FunnelEventInput = {
  sessionId: string;
  eventName: FunnelEventName;
  properties?: Record<string, unknown>;
  organizationId?: string | null;
};

/** Record one funnel event. Never throws — telemetry must not break a flow. */
export async function recordFunnelEvent(input: FunnelEventInput): Promise<void> {
  try {
    const db = serviceRoleClientUntyped();
    await db.from("funnel_events").insert({
      session_id: input.sessionId,
      event_name: input.eventName,
      properties: input.properties ?? null,
      organization_id: input.organizationId ?? null,
    });
  } catch {
    /* swallow — see note above */
  }
  try {
    track(input.eventName, { session_id: input.sessionId, ...(input.properties ?? {}) });
  } catch {
    /* swallow */
  }
}
