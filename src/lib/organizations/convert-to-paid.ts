import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlanType } from "@/lib/subscriptions/plans";

// Converting an admin-created demo Founder account to a paying one, by card
// (Lemon Squeezy, recurring). Staff send the client a checkout link; the demo stays a
// comped demo until the first payment arrives, then the billing webhook calls
// activateConvertedOrg. The client enters their own card at Lemon Squeezy, iCapOS never
// touches it.

function loose(client: unknown): SupabaseClient {
  return client as SupabaseClient;
}

export type ConvertPlan = "founder_basic" | "founder_professional";

export const CONVERT_PLANS: ConvertPlan[] = ["founder_basic", "founder_professional"];

export function isConvertPlan(value: unknown): value is ConvertPlan {
  return value === "founder_basic" || value === "founder_professional";
}

export function variantIdForPlan(plan: ConvertPlan): string | undefined {
  if (plan === "founder_basic") return process.env.LEMONSQUEEZY_VARIANT_ID_BASIC;
  return process.env.LEMONSQUEEZY_VARIANT_ID_PROFESSIONAL;
}

/** The organization tier that goes with a plan. */
export function tierForPlan(plan: ConvertPlan | PlanType): "basic" | "professional" | null {
  if (plan === "founder_basic") return "basic";
  if (plan === "founder_professional") return "professional";
  return null;
}

export type Conversion = {
  plan: ConvertPlan;
  name: string | null;
  email: string;
  sentAt: string;
};

/** What the registry needs: which accounts have a checkout link out. Best effort, so the
 *  page still loads before the migration has been applied. */
export async function loadConversions(admin: unknown): Promise<Record<string, Conversion>> {
  const out: Record<string, Conversion> = {};
  try {
    const { data, error } = await loose(admin)
      .from("organizations")
      .select("id, conversion_plan, conversion_name, conversion_email, conversion_sent_at")
      .not("conversion_sent_at", "is", null);
    if (error) return out;
    for (const r of (data ?? []) as Array<{
      id: string;
      conversion_plan: string | null;
      conversion_name: string | null;
      conversion_email: string | null;
      conversion_sent_at: string | null;
    }>) {
      if (isConvertPlan(r.conversion_plan) && r.conversion_email && r.conversion_sent_at) {
        out[r.id] = { plan: r.conversion_plan, name: r.conversion_name, email: r.conversion_email, sentAt: r.conversion_sent_at };
      }
    }
  } catch {
    // migration not applied yet: no pending conversions to show
  }
  return out;
}

/**
 * Called by the billing webhook once a payment is active. If this founder belongs to an
 * admin-created demo account with a checkout link out, the account becomes a normal paying
 * one: active, no longer a demo, email dispatch on. Safe to call for any founder and any
 * number of times: it only touches an account that is still pending. Never throws, so a
 * problem here can not fail the webhook.
 */
export async function activateConvertedOrg(admin: unknown, founderId: string): Promise<boolean> {
  try {
    const { data: companies } = await loose(admin).from("companies").select("org_id").eq("founder_id", founderId);
    const orgIds = ((companies ?? []) as Array<{ org_id: string | null }>).map((c) => c.org_id).filter((id): id is string => Boolean(id));
    if (!orgIds.length) return false;

    const { data: pending } = await loose(admin)
      .from("organizations")
      .select("id, conversion_plan")
      .in("id", orgIds)
      .eq("created_via", "admin_direct")
      .not("conversion_sent_at", "is", null);
    const rows = (pending ?? []) as Array<{ id: string; conversion_plan: string | null }>;
    if (!rows.length) return false;

    let activated = false;
    for (const org of rows) {
      const tier = isConvertPlan(org.conversion_plan) ? tierForPlan(org.conversion_plan) : null;
      const { error } = await loose(admin)
        .from("organizations")
        .update({
          billing_status: "active",
          purpose: null,
          email_dispatch_enabled: true,
          ...(tier ? { tier } : {}),
          conversion_plan: null,
          conversion_name: null,
          conversion_email: null,
          conversion_sent_at: null,
        })
        .eq("id", org.id);
      if (!error) activated = true;
    }
    return activated;
  } catch {
    return false;
  }
}
