import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { PlanType } from "@/lib/subscriptions/plans";
import { parseRequestedPlan } from "@/lib/subscriptions/plans";

export async function getRequestedPlanForProfile(profileId: string): Promise<PlanType | null> {
  const admin = createServiceRoleClient();
  const { data, error } = await admin.auth.admin.getUserById(profileId);

  if (error || !data.user) {
    return null;
  }

  return parseRequestedPlan(data.user.user_metadata?.requested_plan);
}

export async function getRequestedPlansByProfileIds(profileIds: string[]) {
  const map = new Map<string, PlanType | null>();

  // Skip null or empty ids (an admin-created company can have no founder);
  // auth.admin.getUserById throws "Expected parameter to be UUID" on them.
  const ids = profileIds.filter((id): id is string => typeof id === "string" && id.length > 0);

  if (ids.length === 0) {
    return map;
  }

  const admin = createServiceRoleClient();

  await Promise.all(
    ids.map(async (profileId) => {
      const { data } = await admin.auth.admin.getUserById(profileId);
      map.set(profileId, parseRequestedPlan(data.user?.user_metadata?.requested_plan));
    }),
  );

  return map;
}
