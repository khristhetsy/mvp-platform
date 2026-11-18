/**
 * "Connect with investors" nudge for founders (server only). Loads the facts the
 * rules in connect-nudge-rules.ts need.
 *
 * Shown on the founder home as a banner and sent once a week as a short email to
 * active paid founders whose plan includes social media and who have not connected
 * a social account yet. It stops when they connect, or after they close it twice.
 *
 * Admin turns it off in Feature controls (founder:social_nudge). A missing flag row
 * means on, like every other feature flag. Any lookup that fails hides the nudge.
 */
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { loadFeatureFlags, isFeatureEnabled } from "@/lib/feature-controls";
import { getFounderSocialLimit } from "@/lib/social/founder-limits";
import { NUDGE_FEATURE, shouldShowConnectNudge, type ConnectNudgeFacts } from "@/lib/social/connect-nudge-rules";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return createServiceRoleClient(); }

/** The facts for one founder, or null when any lookup fails (the nudge stays hidden). */
export async function loadConnectNudgeFacts(profileId: string, flagOn?: boolean): Promise<ConnectNudgeFacts | null> {
  try {
    const client = db();
    const [sub, accounts, prefs, flags] = await Promise.all([
      client.from("subscriptions").select("plan_type, subscription_status").eq("profile_id", profileId).maybeSingle(),
      client.from("social_accounts").select("id", { count: "exact", head: true }).eq("owner_profile_id", profileId).neq("status", "disconnected"),
      client.from("user_preferences").select("social_nudge_dismissals, social_nudge_snoozed_until").eq("profile_id", profileId).maybeSingle(),
      flagOn === undefined ? loadFeatureFlags(client) : Promise.resolve(null),
    ]);
    if (sub.error || accounts.error || prefs.error) return null;
    const planType = (sub.data as { plan_type?: string } | null)?.plan_type ?? null;
    const status = (sub.data as { subscription_status?: string } | null)?.subscription_status ?? null;
    const limit = await getFounderSocialLimit(planType);
    const p = prefs.data as { social_nudge_dismissals?: number | null; social_nudge_snoozed_until?: string | null } | null;
    return {
      flagOn: flagOn ?? isFeatureEnabled(flags ?? {}, "founder", NUDGE_FEATURE),
      planType,
      status,
      socialEnabled: limit.enabled,
      connected: (accounts.count ?? 0) > 0,
      dismissals: p?.social_nudge_dismissals ?? 0,
      snoozedUntil: p?.social_nudge_snoozed_until ?? null,
    };
  } catch {
    return null;
  }
}

/** True when the home banner should render for this founder. */
export async function loadShowConnectNudge(profileId: string): Promise<boolean> {
  const facts = await loadConnectNudgeFacts(profileId);
  return facts ? shouldShowConnectNudge(facts) : false;
}
