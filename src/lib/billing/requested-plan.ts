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

  if (profileIds.length === 0) {
    return map;
  }

  const admin = createServiceRoleClient();

  await Promise.all(
    profileIds.map(async (profileId) => {
      const { data } = await admin.auth.admin.getUserById(profileId);
      map.set(profileId, parseRequestedPlan(data.user?.user_metadata?.requested_plan));
    }),
  );

  return map;
}
