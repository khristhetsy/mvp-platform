// Weekly input-metric report (§8). Counts each funnel step over a window and the
// step-to-step conversion rate — the metrics reviewed weekly, since signups and
// revenue are lagging outputs. Server-only (service role reads funnel_events).

import { serviceRoleClientUntyped } from "@/lib/supabase/admin";
import { FUNNEL_EVENTS, type FunnelEventName } from "@/lib/analytics/funnel";

const STEP_LABELS: Record<FunnelEventName, string> = {
  post_click: "Ad / post click",
  landing_view: "Landing view",
  assessment_start: "Assessment start",
  assessment_complete: "Assessment complete",
  band_assigned: "Band assigned",
  pricing_view: "Pricing view",
  checkout_start: "Checkout start",
  checkout_complete: "Checkout complete",
  first_distribution_sent: "First distribution sent",
  intro_requested: "Intro requested",
  renewal: "Renewal",
};

export type FunnelStep = {
  event: FunnelEventName;
  label: string;
  count: number;
  /** Conversion from the previous step (0–1), null for the first step. */
  conversionFromPrev: number | null;
};

export type FunnelReport = { days: number; since: string; steps: FunnelStep[]; total: number };

export async function loadFunnelReport(days = 7): Promise<FunnelReport> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const db = serviceRoleClientUntyped();

  const counts = await Promise.all(
    FUNNEL_EVENTS.map(async (event) => {
      try {
        const { count } = await db
          .from("funnel_events")
          .select("id", { count: "exact", head: true })
          .eq("event_name", event)
          .gte("occurred_at", since);
        return count ?? 0;
      } catch {
        return 0;
      }
    }),
  );

  const steps: FunnelStep[] = FUNNEL_EVENTS.map((event, i) => {
    const count = counts[i];
    const prev = i > 0 ? counts[i - 1] : null;
    return {
      event,
      label: STEP_LABELS[event],
      count,
      conversionFromPrev: prev && prev > 0 ? count / prev : null,
    };
  });

  return { days, since, steps, total: counts.reduce((a, b) => a + b, 0) };
}
