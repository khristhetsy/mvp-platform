import { redirect } from "next/navigation";
import { actingBypass } from "@/lib/admin/acting-central";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { loadFeatureFlags, isFeatureEnabled, type FeatureAudience, type FeatureKey } from "./index";

/**
 * Server guard for a workspace feature. If an admin has disabled `feature` for
 * `audience`, redirect away (defense-in-depth so hidden nav can't be deep-linked).
 */
export async function assertFeatureEnabled(
  audience: FeatureAudience,
  feature: FeatureKey,
  redirectTo: string,
): Promise<void> {
  // Staff acting as a founder whose department has the switch on ignore the founder's own switches.
  if (audience === "founder" && (await actingBypass())) return;
  const flags = await loadFeatureFlags(createServiceRoleClient());
  if (!isFeatureEnabled(flags, audience, feature)) {
    redirect(redirectTo);
  }
}
