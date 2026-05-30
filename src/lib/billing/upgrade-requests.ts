import { createServiceRoleClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/data/audit";
import { notifyStaff } from "@/lib/notifications/notifications";
import type { UpgradeRequestType } from "@/lib/billing/upgrade";
import type { FeatureKey, PlanType } from "@/lib/subscriptions/plans";

export type UpgradeRequestRecord = {
  id: string;
  profile_id: string;
  request_type: UpgradeRequestType;
  requested_plan: PlanType | null;
  feature_key: FeatureKey | null;
  status: "pending" | "reviewed" | "closed";
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export async function createUpgradeRequest(input: {
  profileId: string;
  requestType: UpgradeRequestType;
  requestedPlan?: PlanType | null;
  featureKey?: FeatureKey | null;
  notes?: string | null;
}) {
  const admin = createServiceRoleClient();
  const now = new Date().toISOString();

  const { data, error } = await admin
    .from("upgrade_requests")
    .insert({
      profile_id: input.profileId,
      request_type: input.requestType,
      requested_plan: input.requestedPlan ?? null,
      feature_key: input.featureKey ?? null,
      notes: input.notes ?? null,
      updated_at: now,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(`Failed to create upgrade request: ${error?.message ?? "unknown error"}`);
  }

  await writeAuditLog(admin, {
    userId: input.profileId,
    action: "upgrade_request_created",
    entityType: "upgrade_request",
    entityId: data.id,
    metadata: {
      request_type: input.requestType,
      requested_plan: input.requestedPlan ?? null,
      feature_key: input.featureKey ?? null,
    },
  });

  void notifyStaff({
    actorUserId: input.profileId,
    type: "upgrade_request_submitted",
    title: "Upgrade request submitted",
    message: `A founder submitted an upgrade request (${input.requestType}).`,
    entityType: "upgrade_request",
    entityId: data.id,
  });

  return data as UpgradeRequestRecord;
}

export async function listUpgradeRequestsForAdmin(limit = 50) {
  const admin = createServiceRoleClient();
  const { data, error } = await admin
    .from("upgrade_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to load upgrade requests: ${error.message}`);
  }

  const rows = (data ?? []) as UpgradeRequestRecord[];
  const profileIds = [...new Set(rows.map((row) => row.profile_id))];

  const profileMap = new Map<string, { full_name: string | null; email: string | null; role: string }>();

  if (profileIds.length > 0) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, full_name, email, role")
      .in("id", profileIds);

    for (const profile of profiles ?? []) {
      profileMap.set(profile.id, {
        full_name: profile.full_name,
        email: profile.email,
        role: profile.role,
      });
    }
  }

  return rows.map((row) => ({
    ...row,
    profiles: profileMap.get(row.profile_id) ?? null,
  }));
}

export async function listUpgradeRequestsByProfileIds(profileIds: string[]) {
  if (profileIds.length === 0) {
    return new Map<string, UpgradeRequestRecord[]>();
  }

  const admin = createServiceRoleClient();
  const { data, error } = await admin
    .from("upgrade_requests")
    .select("*")
    .in("profile_id", profileIds)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load upgrade requests: ${error.message}`);
  }

  const map = new Map<string, UpgradeRequestRecord[]>();

  for (const row of (data ?? []) as UpgradeRequestRecord[]) {
    const existing = map.get(row.profile_id) ?? [];
    existing.push(row);
    map.set(row.profile_id, existing);
  }

  return map;
}
